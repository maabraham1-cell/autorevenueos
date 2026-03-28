import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase";

/** User-facing copy for API routes when billing is not active. */
export const OUTBOUND_BILLING_BLOCKED_MESSAGE =
  "Add a payment method to activate messaging and automation.";

export class BillingNotReadyError extends Error {
  readonly code = "BILLING_NOT_READY" as const;

  constructor(
    public readonly businessId: string,
    public readonly billingStatus: string | null,
  ) {
    super(OUTBOUND_BILLING_BLOCKED_MESSAGE);
    this.name = "BillingNotReadyError";
  }
}

export function isBillingReadyForOutbound(
  billingStatus: string | null | undefined,
): boolean {
  return billingStatus === "ready";
}

export function isBillingOutboundBlockedError(error: unknown): boolean {
  return (
    error instanceof BillingNotReadyError ||
    (error instanceof Error && error.message === OUTBOUND_BILLING_BLOCKED_MESSAGE)
  );
}

/**
 * Loads `businesses.billing_status` and throws {@link BillingNotReadyError} when not `ready`.
 * Logs blocked attempts (never silent).
 */
export async function assertBillingReadyForOutboundWithClient(
  db: SupabaseClient,
  businessId: string,
  logContext?: Record<string, unknown>,
): Promise<void> {
  const { data, error } = await db
    .from("businesses")
    .select("billing_status")
    .eq("id", businessId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load billing status: ${error.message}`);
  }

  const billingStatus =
    (data as { billing_status?: string } | null)?.billing_status ?? null;

  if (!isBillingReadyForOutbound(billingStatus)) {
    console.warn("[outbound-billing] blocked", {
      business_id: businessId,
      billing_status: billingStatus,
      reason: "billing_not_ready",
      ...logContext,
    });
    throw new BillingNotReadyError(businessId, billingStatus);
  }
}

export async function assertBillingReadyForOutbound(
  businessId: string,
  logContext?: Record<string, unknown>,
): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new Error("Supabase admin unavailable");
  }
  await assertBillingReadyForOutboundWithClient(admin, businessId, logContext);
}
