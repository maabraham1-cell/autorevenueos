import { type NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUserAndBusiness } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

type InboxMessage = {
  id: string;
  direction: string;
  body: string | null;
  created_at: string;
};

type InboxConversation = {
  conversation_id: string | null;
  contact_id: string | null;
  contact_label: string;
  channel: string | null;
  latest_message: string;
  latest_message_at: string;
  latest_message_direction: string;
  recovery_status: string;
  estimated_value: number;
  proof_label: string;
  messages: InboxMessage[];
  has_unread: boolean;
  ai?: {
    intent: "booking_request" | "pricing_question" | "reschedule" | "general_question" | "unclear";
    confidence?: number;
    entities: {
      service?: string | null;
      preferred_day?: string | null;
      preferred_time?: string | null;
      customer_name?: string | null;
    };
    action: "ask_followup" | "send_booking_link" | "create_booking_request_draft" | "handoff" | "none";
    reply: string;
  } | null;
  booking_draft?: {
    service?: string | null;
    preferred_day?: string | null;
    preferred_time?: string | null;
    status?: "draft";
  } | null;
};

type ConversationAccumulator = {
  conversation_id: string | null;
  contact_id: string | null;
  channel: string | null;
  messages: InboxMessage[];
  latest_message: string;
  latest_message_at: string;
  latest_message_direction: string;
};

export async function GET(request: NextRequest) {
  try {
    const { user, business } = await getCurrentUserAndBusiness(request);

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 },
      );
    }

    if (!business) {
      console.warn("[inbox] no business resolved for user", {
        userId: (user as any)?.id,
      });
      return NextResponse.json([] satisfies InboxConversation[], { status: 200 });
    }

    // Use service-role/admin client for server-side inbox reads.
    // This allows RLS to be enabled without requiring every table/policy for the inbox view.
    const db = getSupabaseAdmin() ?? supabase;

    // Load all messages for this business so every channel
    // (including plain SMS leads) appears in the inbox.
    const { data: recoveries, error: recoveriesError } = await db
      .from("recoveries")
      .select("id, contact_id, created_at, status")
      .eq("business_id", business.id)
      .order("created_at", { ascending: true });

    if (recoveriesError) {
      console.error("[inbox] recoveries lookup error:", recoveriesError.message);
    }

    const contactRecoveryMap = new Map<string, string>();
    const manualStatusMap = new Map<string, string>();

    (recoveries ?? []).forEach((rec: any) => {
      const contactId = rec.contact_id as string | null;
      if (!contactId) return;
      if (!contactRecoveryMap.has(contactId)) {
        contactRecoveryMap.set(contactId, rec.created_at as string);
      }
      const manualStatus = (rec.status as string | null) ?? null;
      if (manualStatus) {
        manualStatusMap.set(contactId, manualStatus);
      }
    });

    // Backwards-compatible query:
    // Some environments may not have `messages.conversation_id` yet.
    let messages: Array<any> | null = null;
    const {
      data: messagesAttempt,
      error: messagesAttemptError,
    } = await db
      .from("messages")
      .select("id, contact_id, channel, direction, body, created_at, conversation_id")
      .eq("business_id", business.id)
      .order("created_at", { ascending: true });

    if (messagesAttemptError) {
      const errMsg = (messagesAttemptError as any)?.message ?? "";
      const missingConversationId = /conversation_id.*does not exist/i.test(errMsg);

      if (!missingConversationId) {
        console.error("[inbox] messages lookup error:", messagesAttemptError.message);
        return NextResponse.json([] satisfies InboxConversation[]);
      }

      // Legacy fallback (no conversation_id column)
      const {
        data: legacyMessages,
        error: legacyMessagesError,
      } = await db
        .from("messages")
        .select("id, contact_id, channel, direction, body, created_at")
        .eq("business_id", business.id)
        .order("created_at", { ascending: true });

      if (legacyMessagesError) {
        console.error("[inbox] legacy messages lookup error:", legacyMessagesError.message);
        return NextResponse.json([] satisfies InboxConversation[]);
      }

      messages = legacyMessages ?? [];
    } else {
      messages = messagesAttempt ?? [];
    }

    if (!messages || messages.length === 0) {
      console.log("[inbox] empty messages for business", {
        businessId: business.id,
      });
      return NextResponse.json([] satisfies InboxConversation[]);
    }

    const averageBookingValue =
      typeof (business as any).average_booking_value === "number" &&
      (business as any).average_booking_value > 0
        ? (business as any).average_booking_value
        : 60;

    const conversationMap = new Map<string, ConversationAccumulator>();

    for (const row of messages) {
      const contactId = (row.contact_id as string | null) ?? null;
      const channel = (row.channel as string | null) ?? null;
      const conversationId = (row.conversation_id as string | null) ?? null;

      // Primary grouping: real conversation id when present.
      // Fallback for legacy data: contact_id + channel.
      const key =
        conversationId && conversationId.length > 0
          ? `conv:${conversationId}`
          : `${contactId ?? "unknown"}::${channel ?? "unknown"}`;

      const msg: InboxMessage = {
        id: String(row.id),
        direction: String(row.direction ?? "inbound"),
        body: (row.body as string | null) ?? null,
        created_at: row.created_at as string,
      };

      let conv = conversationMap.get(key);
      if (!conv) {
        conv = {
          conversation_id: conversationId,
          contact_id: contactId,
          channel,
          messages: [],
          latest_message: msg.body ?? "",
          latest_message_at: msg.created_at,
          latest_message_direction: msg.direction,
        };
        conversationMap.set(key, conv);
      }

      conv.messages.push(msg);

      if (new Date(msg.created_at) >= new Date(conv.latest_message_at)) {
        conv.latest_message = msg.body ?? "";
        conv.latest_message_at = msg.created_at;
        conv.latest_message_direction = msg.direction;
      }
    }

    console.log("[inbox] built conversation threads", {
      businessId: business.id,
      messagesCount: messages.length,
      conversationsCount: conversationMap.size,
    });

    const conversations: InboxConversation[] = [];

    for (const [, conv] of conversationMap) {
      const earliestRecoveryAt =
        conv.contact_id != null
          ? contactRecoveryMap.get(conv.contact_id) ?? null
          : null;

      let hasLaterMessages = false;
      if (earliestRecoveryAt) {
        const recoveryDate = new Date(earliestRecoveryAt);
        hasLaterMessages = conv.messages.some((m) => {
          const msgDate = new Date(m.created_at);
          return msgDate > recoveryDate;
        });
      }

      const latestMsg = conv.messages[conv.messages.length - 1];
      const latestText = (latestMsg?.body ?? "").toString();
      const normalized = latestText.toLowerCase();

      const isBooked =
        normalized.includes("booking confirmed") ||
        normalized.includes("appointment confirmed") ||
        normalized.includes("reservation confirmed") ||
        normalized.includes("table booked") ||
        normalized.includes("see you") ||
        normalized.includes("confirmed") ||
        normalized.includes("booked");

      let status: "Recovered" | "In Conversation" | "Follow Up" | "Booked" | "Lost" =
        "Recovered";
      if (hasLaterMessages) {
        status = "In Conversation";
      }
      if (latestText && isBooked) {
        status = "Booked";
      }

      if (conv.contact_id) {
        const manual = manualStatusMap.get(conv.contact_id);
        if (manual === "Recovered" || manual === "In Conversation" || manual === "Follow Up" || manual === "Booked" || manual === "Lost") {
          status = manual;
        }
      }

      let proof_label: string;
      if (status === "Booked") {
        proof_label = "Likely booked";
      } else if (status === "Follow Up") {
        proof_label = "Needs follow-up";
      } else if (status === "Lost") {
        proof_label = "Marked as lost";
      } else if (hasLaterMessages) {
        proof_label = "Conversation continued";
      } else {
        proof_label = "Replied after auto-response";
      }

      const latestDirection = conv.latest_message_direction ?? "inbound";
      conversations.push({
        conversation_id: conv.conversation_id,
        contact_id: conv.contact_id,
        contact_label: "",
        channel: conv.channel,
        latest_message: conv.latest_message || latestText,
        latest_message_at: conv.latest_message_at,
        latest_message_direction: latestDirection,
        recovery_status: status,
        estimated_value: averageBookingValue,
        proof_label,
        messages: conv.messages,
        has_unread: latestDirection === "inbound",
      });
    }

    conversations.sort(
      (a, b) =>
        new Date(b.latest_message_at).getTime() -
        new Date(a.latest_message_at).getTime()
    );

    // Attach stored AI suggestions (from conversations.metadata.ai).
    const conversationIdsForAI = conversations
      .map((c) => c.conversation_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    const aiByConversationId = new Map<string, NonNullable<InboxConversation["ai"]>>();
    const bookingDraftByConversationId = new Map<
      string,
      NonNullable<InboxConversation["booking_draft"]>
    >();

    if (conversationIdsForAI.length > 0) {
      const { data: convRows, error: convRowsError } = await db
        .from("conversations")
        .select("id, metadata")
        .in("id", conversationIdsForAI);

      if (convRowsError) {
        console.error("[inbox] AI conversations lookup error:", convRowsError.message);
      } else {
        // Map stored metadata.ai + conversations.metadata.booking_draft for UI.
        for (const row of convRows ?? []) {
          const meta = (row.metadata ?? {}) as any;
          const ai = meta?.ai ?? null;
          const booking_draft = meta?.booking_draft ?? null;
          if (ai && typeof ai.reply === "string") {
            aiByConversationId.set(String(row.id), {
              intent: ai.intent ?? "unclear",
              confidence:
                typeof ai.confidence === "number" ? ai.confidence : undefined,
              entities: {
                // Phase 2 stores nested entities; Phase 1 stored flattened keys.
                service: ai.entities?.service ?? ai.service ?? null,
                preferred_day:
                  ai.entities?.preferred_day ?? ai.preferred_day ?? null,
                preferred_time:
                  ai.entities?.preferred_time ?? ai.preferred_time ?? null,
                customer_name: ai.entities?.customer_name ?? null,
              },
              action: ai.action ?? ai.last_action ?? "none",
              reply: ai.reply,
            });
          }

          if (booking_draft && typeof booking_draft === "object") {
            bookingDraftByConversationId.set(String(row.id), {
              service: booking_draft.service ?? null,
              preferred_day: booking_draft.preferred_day ?? null,
              preferred_time: booking_draft.preferred_time ?? null,
              status: "draft",
            });
          }
        }
      }
    }

    // Lookup contacts so we can show meaningful labels (name or phone).
    const contactIdSet = new Set<string>();
    for (const conv of conversations) {
      if (conv.contact_id) contactIdSet.add(conv.contact_id);
    }
    const contactIds = Array.from(contactIdSet);

    const contactLabelMap = new Map<
      string,
      { name: string | null; phone: string | null }
    >();

    if (contactIds.length > 0) {
      const { data: contacts, error: contactsError } = await db
        .from("contacts")
        .select("id, name, phone")
        .in("id", contactIds);

      if (contactsError) {
        console.error("[inbox] contacts lookup error:", contactsError.message);
      } else {
        for (const row of contacts ?? []) {
          contactLabelMap.set(String(row.id), {
            name: (row.name as string | null) ?? null,
            phone: (row.phone as string | null) ?? null,
          });
        }
      }
    }

    let customerIndex = 1;
    for (const conv of conversations) {
      conv.ai = conv.conversation_id
        ? aiByConversationId.get(conv.conversation_id) ?? null
        : null;

      conv.booking_draft = conv.conversation_id
        ? bookingDraftByConversationId.get(conv.conversation_id) ?? null
        : null;

      const contactMeta =
        (conv.contact_id && contactLabelMap.get(conv.contact_id)) || null;

      const name = contactMeta?.name?.trim() || "";
      const phone = contactMeta?.phone?.trim() || "";

      if (name) {
        conv.contact_label = name;
      } else if (phone) {
        conv.contact_label = phone;
      } else if (conv.channel === "website_chat") {
        conv.contact_label = "Website visitor";
      } else if (conv.channel === "meta") {
        conv.contact_label = "Meta user";
      } else if (conv.channel === "messenger") {
        conv.contact_label = "Messenger user";
      } else if (conv.channel === "instagram") {
        conv.contact_label = "Instagram user";
      } else if (conv.channel === "sms") {
        conv.contact_label = "SMS lead";
      } else if (conv.channel === "whatsapp") {
        conv.contact_label = "WhatsApp";
      } else {
        conv.contact_label = `Customer #${String(customerIndex)}`;
        customerIndex += 1;
      }
    }

    const normalized = conversations.map((c) => ({
      ...c,
      messages: Array.isArray(c.messages) ? c.messages : [],
    }));

    return NextResponse.json(normalized);
  } catch (e) {
    console.error("[inbox] unexpected error:", e);
    return NextResponse.json(
      { error: "Failed to load inbox conversations" },
      { status: 500 }
    );
  }
}

