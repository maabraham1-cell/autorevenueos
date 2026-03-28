/**
 * Stripe billing: create customer, SetupIntent for saving card, activate business when done.
 * No charge upfront. Payment method is stored and used for future usage-based billing (confirmed_bookings meter).
 */

import Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/supabase";
import { provisionNumberForBusiness } from "@/lib/twilio-number";

const secretKey = process.env.STRIPE_SECRET_KEY;
const stripe = secretKey && secretKey.startsWith("sk_") ? new Stripe(secretKey) : null;

export type ActivationStatus =
  | "onboarding"
  | "payment_required"
  | "billing_ready"
  | "active"
  | "suspended";

export type ConfirmSetupPhase =
  | "stripe"
  | "stripe_customer"
  | "billing_db"
  | "twilio"
  | "finalize"
  | "config";

export type ConfirmSetupIntentResult =
  | { ok: true; fullyActivated: true }
  | { ok: true; fullyActivated: false; twilio_provisioning_error: string }
  | { ok: false; error: string; phase: ConfirmSetupPhase };

/**
 * Get or create a Stripe customer for the business. Saves stripe_customer_id when creating.
 */
export async function getOrCreateStripeCustomer(
  businessId: string,
  email?: string | null
): Promise<{ ok: true; customerId: string } | { ok: false; error: string }> {
  if (!stripe) return { ok: false, error: "Stripe is not configured" };
  const db = getSupabaseAdmin();
  if (!db) return { ok: false, error: "Database not available" };

  const { data: business, error: fetchError } = await db
    .from("businesses")
    .select("stripe_customer_id")
    .eq("id", businessId)
    .single();

  if (fetchError || !business) return { ok: false, error: "Business not found" };
  const existing = (business as { stripe_customer_id?: string }).stripe_customer_id;
  if (existing && existing.trim()) {
    return { ok: true, customerId: existing.trim() };
  }

  const customer = await stripe.customers.create({
    email: email && email.trim() ? email.trim() : undefined,
    metadata: { business_id: businessId },
  });

  const { error: updateError } = await db
    .from("businesses")
    .update({ stripe_customer_id: customer.id })
    .eq("id", businessId);

  if (updateError) {
    console.error("[stripe-billing] failed to save stripe_customer_id:", updateError.message);
    return { ok: false, error: "Failed to link Stripe customer to business" };
  }
  return { ok: true, customerId: customer.id };
}

/**
 * Create a SetupIntent for the business's Stripe customer. Client uses client_secret with Stripe Elements.
 */
export async function createSetupIntent(customerId: string): Promise<{ ok: true; clientSecret: string } | { ok: false; error: string }> {
  if (!stripe) return { ok: false, error: "Stripe is not configured" };
  try {
    const setupIntent = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      usage: "off_session",
      metadata: { usage: "autorevenueos_billing" },
    });
    if (!setupIntent.client_secret) return { ok: false, error: "SetupIntent missing client_secret" };
    return { ok: true, clientSecret: setupIntent.client_secret };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[stripe-billing] createSetupIntent error:", msg);
    return { ok: false, error: msg };
  }
}

/**
 * After client confirms SetupIntent: set default payment method, save billing state, provision Twilio,
 * and set activation_status = active only when billing + phone recovery are both successful.
 */
export async function confirmSetupIntentAndActivate(
  setupIntentId: string,
  businessId: string,
  baseUrl: string
): Promise<ConfirmSetupIntentResult> {
  if (!stripe) return { ok: false, error: "Stripe is not configured", phase: "config" };
  const db = getSupabaseAdmin();
  if (!db) return { ok: false, error: "Database not available", phase: "config" };

  const trimmedBase = typeof baseUrl === "string" ? baseUrl.trim().replace(/\/$/, "") : "";
  if (!trimmedBase) {
    return { ok: false, error: "App URL not configured (NEXT_PUBLIC_APP_URL)", phase: "config" };
  }

  const { data: business, error: bizError } = await db
    .from("businesses")
    .select("id, stripe_customer_id, location")
    .eq("id", businessId)
    .single();

  if (bizError || !business) return { ok: false, error: "Business not found", phase: "billing_db" };
  const customerId = (business as { stripe_customer_id?: string }).stripe_customer_id;
  if (!customerId) return { ok: false, error: "Business has no Stripe customer", phase: "billing_db" };
  const location = (business as { location?: string }).location ?? null;

  let setupIntent: Stripe.SetupIntent;
  try {
    setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
  } catch (e) {
    return { ok: false, error: "Invalid SetupIntent", phase: "stripe" };
  }

  if (setupIntent.customer !== customerId) {
    return { ok: false, error: "SetupIntent does not belong to this business", phase: "stripe" };
  }
  if (setupIntent.status !== "succeeded") {
    return { ok: false, error: "SetupIntent not yet succeeded", phase: "stripe" };
  }

  const paymentMethodId = typeof setupIntent.payment_method === "string"
    ? setupIntent.payment_method
    : (setupIntent.payment_method as Stripe.PaymentMethod)?.id;
  if (!paymentMethodId) return { ok: false, error: "No payment method on SetupIntent", phase: "stripe" };

  try {
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[stripe-billing] set default payment method error:", msg);
    return { ok: false, error: msg, phase: "stripe_customer" };
  }

  const { error: billingUpdateError } = await db
    .from("businesses")
    .update({
      billing_status: "ready",
      stripe_default_payment_method_id: paymentMethodId,
      activation_status: "billing_ready",
    })
    .eq("id", businessId);

  if (billingUpdateError) {
    console.error("[stripe-billing] failed to save billing after Stripe success:", billingUpdateError.message);
    return {
      ok: false,
      error:
        "Your card was verified with Stripe, but we could not save billing state. Try again or contact support.",
      phase: "billing_db",
    };
  }

  const provisionResult = await provisionNumberForBusiness({
    businessId,
    baseUrl: trimmedBase,
    location,
  });

  if (!provisionResult.ok) {
    if (provisionResult.persistFailure === false || provisionResult.code === "PROVISIONING_BUSY") {
      return {
        ok: false,
        error: provisionResult.error,
        phase: "twilio",
      };
    }

    const errMsg = provisionResult.error.slice(0, 1000);
    const { error: failPersist } = await db
      .from("businesses")
      .update({
        phone_recovery_status: "failed",
        twilio_provisioning_error: errMsg,
      })
      .eq("id", businessId);

    if (failPersist) {
      console.error("[stripe-billing] failed to persist Twilio error:", failPersist.message);
      return {
        ok: false,
        error:
          "Phone recovery provisioning failed and we could not save the error. Please try again from Settings.",
        phase: "twilio",
      };
    }

    return {
      ok: true,
      fullyActivated: false,
      twilio_provisioning_error: provisionResult.error,
    };
  }

  const { error: finalizeError } = await db
    .from("businesses")
    .update({
      activation_status: "active",
    })
    .eq("id", businessId);

  if (finalizeError) {
    console.error("[stripe-billing] failed to set activation_status after provision:", finalizeError.message);
    return {
      ok: false,
      error:
        "Your payment method and phone recovery number were saved, but we could not finalize activation. Please open Settings and retry.",
      phase: "finalize",
    };
  }

  return { ok: true, fullyActivated: true };
}

/**
 * Get activation status and whether business has billing ready (card on file).
 */
export async function getBusinessActivationStatus(businessId: string): Promise<{
  activation_status: ActivationStatus;
  has_payment_method: boolean;
  billing_status: string;
  phone_recovery_status: string;
  stripe_customer_id: string | null;
} | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("businesses")
    .select(
      "activation_status, stripe_customer_id, stripe_default_payment_method_id, billing_status, phone_recovery_status"
    )
    .eq("id", businessId)
    .single();
  if (error || !data) return null;
  const status = (data as { activation_status?: string }).activation_status as ActivationStatus | undefined;
  const billingStatus = (data as { billing_status?: string }).billing_status ?? "pending";
  const phoneRecoveryStatus = (data as { phone_recovery_status?: string }).phone_recovery_status ?? "none";
  const hasPaymentMethod = billingStatus === "ready";
  return {
    activation_status: status ?? "payment_required",
    has_payment_method: hasPaymentMethod,
    billing_status: billingStatus,
    phone_recovery_status: phoneRecoveryStatus,
    stripe_customer_id: (data as { stripe_customer_id?: string }).stripe_customer_id ?? null,
  };
}
