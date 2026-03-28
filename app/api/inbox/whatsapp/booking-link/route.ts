import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserAndBusiness } from "@/lib/auth";
import { buildWhatsAppBookingLink } from "@/lib/whatsapp";

const LOG_PREFIX = "[inbox/whatsapp/booking-link]";

export async function GET(request: NextRequest) {
  try {
    const { user, business } = await getCurrentUserAndBusiness(request);

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    if (!business) {
      return NextResponse.json(
        { error: "No business linked to this user" },
        { status: 400 },
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const rawContactId = searchParams.get("contactId");
    const rawConversationId = searchParams.get("conversationId");
    const contactId =
      rawContactId ?? rawConversationId ?? null; // legacy fallback
    const missedCallId = searchParams.get("missedCallId");
    const conversationId = rawConversationId ?? null;
    const sourceParam =
      searchParams.get("source")?.toString().trim() || "whatsapp";
    const source =
      sourceParam === "messenger" || sourceParam === "instagram"
        ? sourceParam
        : "whatsapp";

    const bookingLinkRaw = (business as any).booking_link as string | null | undefined;
    if (!bookingLinkRaw) {
      return NextResponse.json(
        { error: "No booking link configured for this business" },
        { status: 404 },
      );
    }

    const attributed = buildWhatsAppBookingLink({
      bookingLink: bookingLinkRaw,
      source,
      contactId,
      conversationId,
      missedCallId,
    });

    if (!attributed) {
      console.error(LOG_PREFIX, "failed to build booking link", {
        business_id: (business as any).id,
      });
      return NextResponse.json(
        { error: "Failed to build booking link" },
        { status: 500 },
      );
    }

    return NextResponse.json({ booking_link: attributed });
  } catch (e) {
    console.error(LOG_PREFIX, "unexpected error", { error: e });
    return NextResponse.json(
      { error: "Failed to build booking link" },
      { status: 500 },
    );
  }
}

