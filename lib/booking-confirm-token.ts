/**
 * Short-lived token for the AutoRevenueOS booking page confirm flow.
 * Prevents forgery: only a token issued by us (with secret) can confirm a booking.
 */

import { createHmac, timingSafeEqual } from "crypto";

const ALG = "sha256";
const EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

export type BookingConfirmPayload = {
  business_id: string;
  contact_id: string | null;
  recovery_id: string | null;
  exp: number;
};

function getSecret(): string {
  const s = process.env.BOOKING_CONFIRM_SECRET ?? process.env.STRIPE_SECRET_KEY;
  if (!s || s.length < 16) return "";
  return s;
}

function toBase64Url(buf: Buffer): string {
  return buf.toString("base64url");
}

function fromBase64Url(str: string): Buffer | null {
  try {
    return Buffer.from(str, "base64url");
  } catch {
    return null;
  }
}

export function createBookingConfirmToken(payload: Omit<BookingConfirmPayload, "exp">): string | null {
  const secret = getSecret();
  if (!secret) return null;

  const exp = Date.now() + EXPIRY_MS;
  const data: BookingConfirmPayload = { ...payload, exp };
  const payloadJson = JSON.stringify(data);
  const payloadB64 = toBase64Url(Buffer.from(payloadJson, "utf8"));
  const sig = createHmac(ALG, secret).update(payloadB64).digest();
  const sigB64 = toBase64Url(sig);
  return `${payloadB64}.${sigB64}`;
}

export function verifyBookingConfirmToken(token: string): BookingConfirmPayload | null {
  const secret = getSecret();
  if (!secret || !token) return null;

  const i = token.lastIndexOf(".");
  if (i <= 0) return null;

  const payloadB64 = token.slice(0, i);
  const sigB64 = token.slice(i + 1);

  const sig = createHmac(ALG, secret).update(payloadB64).digest();
  const sigDecoded = fromBase64Url(sigB64);
  if (!sigDecoded || sigDecoded.length !== sig.length || !timingSafeEqual(sigDecoded, sig)) {
    return null;
  }

  const raw = fromBase64Url(payloadB64);
  if (!raw) return null;

  let data: BookingConfirmPayload;
  try {
    data = JSON.parse(raw.toString("utf8")) as BookingConfirmPayload;
  } catch {
    return null;
  }

  if (typeof data.exp !== "number" || data.exp < Date.now()) return null;
  if (typeof data.business_id !== "string" || !data.business_id) return null;

  return {
    business_id: data.business_id,
    contact_id: data.contact_id ?? null,
    recovery_id: data.recovery_id ?? null,
    exp: data.exp,
  };
}
