import { type NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUserAndBusiness } from "@/lib/auth";

type InboxMessage = {
  id: string;
  direction: string;
  body: string | null;
  created_at: string;
};

type InboxConversation = {
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
};

type ConversationAccumulator = {
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
      return NextResponse.json([] satisfies InboxConversation[], { status: 200 });
    }

    // Load all messages for this business so every channel
    // (including plain SMS leads) appears in the inbox.
    const { data: recoveries, error: recoveriesError } = await supabase
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

    const { data: messages, error: messagesError } = await supabase
      .from("messages")
      .select("*")
      .eq("business_id", business.id)
      .order("created_at", { ascending: true });

    if (messagesError) {
      console.error(
        "[inbox] messages lookup error:",
        messagesError.message
      );
      return NextResponse.json([] satisfies InboxConversation[]);
    }

    if (!messages || messages.length === 0) {
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
      const key = `${contactId ?? "unknown"}::${channel ?? "unknown"}`;

      const msg: InboxMessage = {
        id: String(row.id),
        direction: String(row.direction ?? "inbound"),
        body: (row.body as string | null) ?? null,
        created_at: row.created_at as string,
      };

      let conv = conversationMap.get(key);
      if (!conv) {
        conv = {
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

    let customerIndex = 1;
    for (const conv of conversations) {
      if (conv.channel === "meta") {
        conv.contact_label = "Messenger user";
      } else if (conv.channel === "sms") {
        conv.contact_label = "SMS lead";
      } else if (conv.channel === "website_chat") {
        conv.contact_label = "Website visitor";
      } else if (conv.channel === "whatsapp") {
        conv.contact_label = "WhatsApp";
      } else {
        conv.contact_label = `Customer #${String(customerIndex)}`;
        customerIndex += 1;
      }
    }

    return NextResponse.json(conversations);
  } catch (e) {
    console.error("[inbox] unexpected error:", e);
    return NextResponse.json(
      { error: "Failed to load inbox conversations" },
      { status: 500 }
    );
  }
}

