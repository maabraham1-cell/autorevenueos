import { type NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCurrentUserAndBusiness } from "@/lib/auth";

type RecoveryRow = {
  id: string;
  created_at: string;
  contact_id: string | null;
  status: string | null;
  events: { source_channel: string | null }[] | { source_channel: string | null } | null;
};

type MessageRow = {
  contact_id: string | null;
  channel: string | null;
  body: string | null;
  created_at: string;
};

type RecoveryDto = {
  id: string;
  contact_id: string | null;
  channel: string | null;
  created_at: string;
  latest_message: string;
  status: string;
  estimated_value: number;
  proof_label: string;
};

function getChannelFromEvents(row: RecoveryRow): string | null {
  const events = row.events as any;
  if (!events) return null;
  if (Array.isArray(events)) {
    return events[0]?.source_channel ?? null;
  }
  return events.source_channel ?? null;
}

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
      return NextResponse.json([] satisfies RecoveryDto[], { status: 200 });
    }

    const { data: recoveriesRaw, error: recoveriesError } = await supabase
      .from("recoveries")
      .select(
        `
          id,
          created_at,
          contact_id,
          status,
          events!inner (
            source_channel,
            created_at
          )
        `
      )
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(100);

    if (recoveriesError) {
      console.error("[recoveries] recoveries lookup error:", recoveriesError.message);
    }

    if (!recoveriesRaw || recoveriesRaw.length === 0) {
      return NextResponse.json([] satisfies RecoveryDto[]);
    }

    const recoveries = recoveriesRaw as unknown as RecoveryRow[];

    const contactIds =
      recoveries
        .map((r) => r.contact_id)
        .filter((id): id is string => !!id) ?? [];

    let messages: MessageRow[] = [];
    if (contactIds.length > 0) {
      const { data: messagesRaw, error: messagesError } = await supabase
        .from("messages")
        .select("*")
        .eq("business_id", business.id)
        .in("contact_id", contactIds)
        .order("created_at", { ascending: false });

      if (messagesError) {
        console.error("[recoveries] messages lookup error:", messagesError.message);
      } else if (messagesRaw) {
        messages = messagesRaw as unknown as MessageRow[];
      }
    }

    const averageBookingValue =
      typeof (business as any).average_booking_value === "number" &&
      (business as any).average_booking_value > 0
        ? (business as any).average_booking_value
        : 60;

    const result: RecoveryDto[] = recoveries.map((rec) => {
      const channel = getChannelFromEvents(rec);
      const recCreatedAt = new Date(rec.created_at);

      const messagesForContactChannel = messages.filter(
        (m) =>
          m.contact_id === rec.contact_id &&
          (m.channel as string | null) === (channel as string | null)
      );

      const hasLaterMessages = messagesForContactChannel.some((m) => {
        const msgDate = new Date(m.created_at);
        return msgDate > recCreatedAt;
      });

      const latestMessage = messagesForContactChannel[0] ?? null;
      const latestText = (latestMessage?.body as string | null) ?? "";
      const normalizedText = latestText.toLowerCase();

      const isBooked =
        normalizedText.includes("booking confirmed") ||
        normalizedText.includes("appointment confirmed") ||
        normalizedText.includes("reservation confirmed") ||
        normalizedText.includes("table booked") ||
        normalizedText.includes("see you") ||
        normalizedText.includes("confirmed") ||
        normalizedText.includes("booked");

      let autoStatus: "Recovered" | "In Conversation" | "Booked" = "Recovered";
      if (hasLaterMessages) {
        autoStatus = "In Conversation";
      }
      if (latestText && isBooked) {
        autoStatus = "Booked";
      }

      const manualStatus = (rec.status as string | null) ?? null;
      const effectiveStatus = manualStatus ?? autoStatus;

      let proof_label: string;
      if (effectiveStatus === "Booked") {
        proof_label = "Likely booked";
      } else if (effectiveStatus === "In Conversation") {
        proof_label = "Conversation continued";
      } else if (effectiveStatus === "Follow Up") {
        proof_label = "Needs follow-up";
      } else if (effectiveStatus === "Lost") {
        proof_label = "Marked as lost";
      } else {
        proof_label = "Replied after auto-response";
      }

      return {
        id: rec.id,
        contact_id: rec.contact_id,
        channel: channel,
        created_at: rec.created_at,
        latest_message: latestText || "No message preview available",
        status: effectiveStatus,
        estimated_value: averageBookingValue,
        proof_label,
      };
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error("[recoveries] unexpected error:", e);
    return NextResponse.json(
      { error: "Failed to load recoveries" },
      { status: 500 }
    );
  }
}

