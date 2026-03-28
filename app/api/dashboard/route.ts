import { type NextRequest, NextResponse } from "next/server";
import { getCurrentUserAndBusiness } from "@/lib/auth";
import { getProviderBySource } from "@/lib/booking-providers";
import { isAdminRole } from "@/lib/roles";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const { user, business, role } = await getCurrentUserAndBusiness(request);

    if (!user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 },
      );
    }

    if (isAdminRole(role)) {
      return NextResponse.json(
        { error: "Forbidden. Internal admin accounts use the operator workspace." },
        { status: 403 },
      );
    }

    if (!business) {
      return NextResponse.json({
        error: "No business linked to this user",
      }, { status: 400 });
    }

    const averageBookingValue =
      typeof (business as any).average_booking_value === "number" &&
      (business as any).average_booking_value > 0
        ? (business as any).average_booking_value
        : 60;
    const costPerLead =
      typeof (business as any).cost_per_lead === "number" &&
      (business as any).cost_per_lead >= 0
        ? (business as any).cost_per_lead
        : 3;

    // recovered_leads = count of recoveries for this business
    const { count: recovered_leads, error: recoveriesCountError } = await supabase
      .from("recoveries")
      .select("*", { count: "exact", head: true })
      .eq("business_id", business.id);

    if (recoveriesCountError) {
      console.error("[dashboard] recoveries count error:", recoveriesCountError.message);
    }

    const recovered = recovered_leads ?? 0;
    const estimated_revenue = recovered * averageBookingValue;
    const cost = recovered * costPerLead;
    const roi = cost > 0 ? estimated_revenue / cost : 0;

    // Confirmed bookings and billing: distinct from recovered leads (attribution).
    const { count: confirmed_count, error: confirmedCountError } = await supabase
      .from("confirmed_bookings")
      .select("*", { count: "exact", head: true })
      .eq("business_id", business.id);

    if (confirmedCountError) {
      console.error("[dashboard] confirmed_bookings count error:", confirmedCountError.message);
    }

    const { count: billed_count, error: billedCountError } = await supabase
      .from("confirmed_bookings")
      .select("*", { count: "exact", head: true })
      .eq("business_id", business.id)
      .not("billed_at", "is", null);

    if (billedCountError) {
      console.error("[dashboard] billed count error:", billedCountError.message);
    }

    const { data: recentConfirmedRaw, error: recentConfirmedError } = await supabase
      .from("confirmed_bookings")
      .select("id, confirmed_at, confirmation_source, billing_status, billing_error, external_booking_id")
      .eq("business_id", business.id)
      .order("confirmed_at", { ascending: false })
      .limit(10);

    if (recentConfirmedError) {
      console.error("[dashboard] recent confirmed_bookings error:", recentConfirmedError.message);
    }

    const recent_confirmed_bookings =
      recentConfirmedRaw?.map((r) => {
        const source = r.confirmation_source as string;
        const provider = getProviderBySource(source);
        return {
          id: r.id as string,
          confirmed_at: r.confirmed_at as string,
          confirmation_source: source,
          confirmation_source_display_name: provider?.name ?? source,
          trust_level: provider?.trustLevel ?? null,
          trust_label: provider?.trustLabel ?? null,
          billing_status: (r as { billing_status?: string }).billing_status ?? "pending",
          billing_error: (r as { billing_error?: string }).billing_error ?? null,
          external_booking_id: (r as { external_booking_id?: string }).external_booking_id ?? null,
        };
      }) ?? [];

    const { data: recentBillingEventsRaw, error: billingEventsError } = await supabase
      .from("billing_events")
      .select("id, event_type, message, created_at, confirmed_booking_id")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (billingEventsError) {
      console.error("[dashboard] billing_events error:", billingEventsError.message);
    }

    const recent_billing_events =
      recentBillingEventsRaw?.map((e) => ({
        id: e.id as string,
        event_type: e.event_type as string,
        message: (e as { message?: string }).message ?? null,
        created_at: e.created_at as string,
        confirmed_booking_id: (e as { confirmed_booking_id?: string }).confirmed_booking_id ?? null,
      })) ?? [];

    // Recent recoveries with basic context (created_at, contact_id, channel via events.source_channel).
    const { data: recentRecoveriesRaw, error: recentRecoveriesError } = await supabase
      .from("recoveries")
      .select(
        `
          id,
          created_at,
          contact_id,
          events!inner (
            source_channel
          )
        `
      )
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (recentRecoveriesError) {
      console.error("[dashboard] recent recoveries error:", recentRecoveriesError.message);
    }

    const recent_recoveries =
      recentRecoveriesRaw?.map((row) => ({
        id: row.id as string,
        created_at: row.created_at as string,
        contact_id: row.contact_id as string | null,
        channel:
          (row as any).events && Array.isArray((row as any).events)
            ? (row as any).events[0]?.source_channel ?? null
            : (row as any).events?.source_channel ?? null,
      })) ?? [];

    // Build recovered revenue pipeline for this business.
    const { data: pipelineRecoveriesRaw, error: pipelineRecoveriesError } = await supabase
      .from("recoveries")
      .select(
        `
          id,
          created_at,
          contact_id,
          status,
          event_id,
          events!inner (
            source_channel,
            created_at
          )
        `
      )
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (pipelineRecoveriesError) {
      console.error("[dashboard] pipeline recoveries error:", pipelineRecoveriesError.message);
    }

    const contactIds =
      pipelineRecoveriesRaw
        ?.map((r) => r.contact_id as string | null)
        .filter((id): id is string => !!id) ?? [];

    let messagesForPipeline: any[] = [];
    if (contactIds.length > 0) {
      const { data: messagesRaw, error: messagesError } = await supabase
        .from("messages")
        .select("*")
        .eq("business_id", business.id)
        .in("contact_id", contactIds)
        .order("created_at", { ascending: false });

      if (messagesError) {
        console.error("[dashboard] pipeline messages error:", messagesError.message);
      } else if (messagesRaw) {
        messagesForPipeline = messagesRaw;
      }
    }

    const pipeline =
      pipelineRecoveriesRaw?.map((rec) => {
        const channel =
          (rec as any).events && Array.isArray((rec as any).events)
            ? (rec as any).events[0]?.source_channel ?? null
            : (rec as any).events?.source_channel ?? null;

        const recCreatedAt = new Date(rec.created_at as string);

        const messagesForContactChannel = messagesForPipeline.filter(
          (m) =>
            m.contact_id === rec.contact_id &&
            (m.channel as string | null) === (channel as string | null)
        );

        const hasLaterMessages = messagesForContactChannel.some((m) => {
          const msgDate = new Date(m.created_at as string);
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

        const manualStatus = (rec as any).status as string | null;
        const knownManual = ["Recovered", "In Conversation", "Follow Up", "Booked", "Lost"];
        const status = manualStatus && knownManual.includes(manualStatus) ? manualStatus : autoStatus;

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

        return {
          contact_id: rec.contact_id as string | null,
          channel: channel as string | null,
          created_at: rec.created_at as string,
          latest_message: latestText || "No message preview available",
          status,
          estimated_value: averageBookingValue,
          proof_label,
        };
      }) ?? [];

    return NextResponse.json({
      recovered_leads: recovered,
      confirmed_bookings: confirmed_count ?? 0,
      billed_bookings: billed_count ?? 0,
      estimated_revenue,
      cost,
      roi,
      average_booking_value: averageBookingValue,
      currency_code: ((business as any).currency_code as string) ?? "GBP",
      locale: ((business as any).locale as string) ?? "en-GB",
      activation_status: ((business as any).activation_status as string) ?? "payment_required",
      recent_recoveries,
      recent_confirmed_bookings,
      recent_billing_events,
      pipeline,
    });
  } catch (e) {
    console.error("[dashboard] unexpected error:", e);
    return NextResponse.json(
      {
        recovered_leads: 0,
        confirmed_bookings: 0,
        billed_bookings: 0,
        estimated_revenue: 0,
        cost: 0,
        roi: 0,
        average_booking_value: 60,
        recent_recoveries: [],
        recent_confirmed_bookings: [],
        recent_billing_events: [],
        pipeline: [],
      },
      { status: 500 }
    );
  }
}

