import { notFound } from "next/navigation";
import { createBookingConfirmToken } from "@/lib/booking-confirm-token";
import { getSupabaseAdmin } from "@/lib/supabase";
import { BookingConfirmForm } from "./BookingConfirmForm";

type Props = {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{
    // Canonical attribution identifier from booking links.
    contactId?: string;
    // Legacy alias used in older links; treated as a fallback to contactId.
    conversationId?: string;
    // Older flows (email/webhooks) that already pass contact_id / recovery_id.
    contact_id?: string;
    recovery_id?: string;
  }>;
};

export default async function BookPage({ params, searchParams }: Props) {
  const { businessId } = await params;
  const {
    contactId,
    conversationId,
    contact_id: legacyContactId,
    recovery_id: recoveryId,
  } = await searchParams;

  // Canonical contact identifier for attribution:
  // 1) contactId (new booking links)
  // 2) conversationId (legacy alias, treated as contact id)
  // 3) contact_id (old query param used by existing email/webhook flows)
  const effectiveContactId =
    (contactId && contactId.trim()) ||
    (conversationId && conversationId.trim()) ||
    (legacyContactId && legacyContactId.trim()) ||
    null;

  const db = getSupabaseAdmin();
  if (!db) notFound();

  const { data: business, error } = await db
    .from("businesses")
    .select("id, name")
    .eq("id", businessId)
    .single();

  if (error || !business) notFound();

  const token = createBookingConfirmToken({
    business_id: business.id,
    contact_id: effectiveContactId,
    recovery_id: recoveryId?.trim() || null,
  });

  if (!token) notFound();

  const businessName = (business as { name?: string }).name ?? "the business";

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h1 className="text-xl font-semibold text-slate-800 mb-1">
          Confirm your booking
        </h1>
        <p className="text-slate-600 text-sm mb-6">
          You’re booking with <strong>{businessName}</strong>. Click below to
          confirm.
        </p>
        <BookingConfirmForm confirmToken={token} />
      </div>
    </div>
  );
}
