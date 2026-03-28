export function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

const DISALLOWED_AUTO_SEND_KEYWORDS = [
  "price",
  "pricing",
  "cost",
  "£",
  "availability",
  "available",
  "opening hours",
  "hours",
  "confirmed",
  "booked",
  "reservation confirmed",
  "appointment confirmed",
  "reschedule",
  "cancel",
  "cancellation",
];

export function isLikelyPricingOrPolicyQuestion(text: string): boolean {
  const t = text.toLowerCase();
  return DISALLOWED_AUTO_SEND_KEYWORDS.some((k) => t.includes(k.toLowerCase()));
}

export function isShortReply(text: string): boolean {
  // Keep the heuristic simple and conservative.
  return text.trim().length <= 450;
}

export function isSafeAutoSendCandidate(params: {
  action: string;
  confidence: number;
  reply: string;
}): boolean {
  const { action, confidence, reply } = params;
  const c = clamp01(confidence);
  if (c < 0.85) return false;

  if (action !== "ask_followup" && action !== "send_booking_link") return false;
  if (!isShortReply(reply)) return false;
  if (isLikelyPricingOrPolicyQuestion(reply)) return false;

  // For booking-link sends, require the reply to contain attribution params.
  if (action === "send_booking_link") {
    const t = reply.toLowerCase();
    if (!/source=(whatsapp|messenger|instagram)/.test(t)) return false;
    if (!t.includes("contactid=") && !t.includes("contactid%3d")) {
      // contactId is usually present as contactId=...
      // If it isn't, we don't auto-send.
      return false;
    }
  }

  return true;
}

