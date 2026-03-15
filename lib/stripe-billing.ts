/**
 * Stripe billing: create customer, SetupIntent for saving card, activate business when done.
 * No charge upfront. Payment method is stored and used for future usage-based billing (confirmed_bookings meter).
 */

import Stripe from "stripe";
import { getSupabaseAdmin } from "@/lib/supabase";

const secretKey = process.env.STRIPE_SECRET_KEY;
const stripe = secretKey && secretKey.startsWith("sk_") ? new Stripe(secretKey) : null;

export type ActivationStatus = "onboarding" | "payment_required" | "active" | "suspended";

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
 * After client confirms SetupIntent: set payment method as default and set business activation_status = active.
 */
export async function confirmSetupIntentAndActivate(
  setupIntentId: string,
  businessId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!stripe) return { ok: false, error: "Stripe is not configured" };
  const db = getSupabaseAdmin();
  if (!db) return { ok: false, error: "Database not available" };

  const { data: business, error: bizError } = await db
    .from("businesses")
    .select("id, stripe_customer_id")
    .eq("id", businessId)
    .single();

  if (bizError || !business) return { ok: false, error: "Business not found" };
  const customerId = (business as { stripe_customer_id?: string }).stripe_customer_id;
  if (!customerId) return { ok: false, error: "Business has no Stripe customer" };

  let setupIntent: Stripe.SetupIntent;
  try {
    setupIntent = await stripe.setupIntents.retrieve(setupIntentId);
  } catch (e) {
    return { ok: false, error: "Invalid SetupIntent" };
  }

  if (setupIntent.customer !== customerId) {
    return { ok: false, error: "SetupIntent does not belong to this business" };
  }
  if (setupIntent.status !== "succeeded") {
    return { ok: false, error: "SetupIntent not yet succeeded" };
  }

  const paymentMethodId = typeof setupIntent.payment_method === "string"
    ? setupIntent.payment_method
    : (setupIntent.payment_method as Stripe.PaymentMethod)?.id;
  if (!paymentMethodId) return { ok: false, error: "No payment method on SetupIntent" };

  try {
    await stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[stripe-billing] set default payment method error:", msg);
    return { ok: false, error: msg };
  }

  const { error: updateError } = await db
    .from("businesses")
    .update({
      activation_status: "active",
      stripe_default_payment_method_id: paymentMethodId,
    })
    .eq("id", businessId);

  if (updateError) {
    console.error("[stripe-billing] failed to set activation_status:", updateError.message);
    return { ok: false, error: "Payment method saved but activation update failed" };
  }
  return { ok: true };
}

/**
 * Get activation status and whether business has a payment method (active = has card).
 */
export async function getBusinessActivationStatus(businessId: string): Promise<{
  activation_status: ActivationStatus;
  has_payment_method: boolean;
  stripe_customer_id: string | null;
} | null> {
  const db = getSupabaseAdmin();
  if (!db) return null;
  const { data, error } = await db
    .from("businesses")
    .select("activation_status, stripe_customer_id, stripe_default_payment_method_id")
    .eq("id", businessId)
    .single();
  if (error || !data) return null;
  const status = (data as { activation_status?: string }).activation_status as ActivationStatus | undefined;
  const pmId = (data as { stripe_default_payment_method_id?: string }).stripe_default_payment_method_id;
  const hasPaymentMethod = status === "active" && !!pmId;
  return {
    activation_status: status ?? "payment_required",
    has_payment_method: hasPaymentMethod,
    stripe_customer_id: (data as { stripe_customer_id?: string }).stripe_customer_id ?? null,
  };
}
