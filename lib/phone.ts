/**
 * Normalize phone numbers for use as stable external identity (SMS/Twilio).
 * Used for contact lookup/insert and dedupe. Not full E.164 validation.
 */
export function normalizePhone(raw: string | null | undefined): string {
  if (raw == null || typeof raw !== "string") return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const hasPlus = trimmed.startsWith("+");
  const digitsOnly = trimmed.replace(/\D/g, "");
  if (!digitsOnly) return "";
  return hasPlus ? `+${digitsOnly}` : digitsOnly;
}
