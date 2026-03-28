#!/usr/bin/env node
/**
 * INTERNAL ONLY — not exposed via the app or any HTTP route.
 *
 * Step 2: Audit Twilio IncomingPhoneNumber resources vs Supabase `businesses`,
 * optionally release orphans with explicit confirmation (never auto-delete linked numbers).
 *
 * AUDIT (default)
 *   npm run twilio:inventory
 *   node scripts/twilio-inventory.mjs
 *   node scripts/twilio-inventory.mjs --human
 *
 * RELEASE (explicit SIDs only)
 *   node scripts/twilio-inventory.mjs --release --confirm=I_UNDERSTAND --sids=PNxx,PNyy
 *
 * Env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional: loads .env.local from repo root when present.
 */

import twilio from "twilio";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

function loadEnvLocal() {
  const p = join(dirname(fileURLToPath(import.meta.url)), "..", ".env.local");
  try {
    const raw = readFileSync(p, "utf8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (!process.env[k]) process.env[k] = v;
    }
  } catch {
    /* no .env.local */
  }
}

loadEnvLocal();

/** Heuristic: likely dev/test signup — still NEVER auto-released; flagged for review only. */
function looksLikeTestBusiness(name) {
  if (!name || typeof name !== "string") return false;
  const n = name.trim().toLowerCase();
  return (
    /test|demo|sandbox|staging|localhost|sample|dummy|fake\b/.test(n) ||
    n === "new business" ||
    n.length < 2
  );
}

/**
 * Production-safe link: would be harmful to release this SID if it were still in use.
 */
function isProductionLinkedRow(b) {
  const suspended = (b.activation_status ?? "") === "suspended";
  const testName = looksLikeTestBusiness(b.name);
  if (suspended || testName) return false;
  const hasSid = !!(b.twilio_number_sid && String(b.twilio_number_sid).trim());
  const hasPhone = !!(b.twilio_phone_number && String(b.twilio_phone_number).trim());
  const recoveryOk = (b.phone_recovery_status ?? "") === "provisioned";
  const billingOk = (b.billing_status ?? "") === "ready";
  const active = (b.activation_status ?? "") === "active";
  if (hasSid && (hasPhone || recoveryOk) && (billingOk || active)) return true;
  if (hasSid && hasPhone) return true;
  return false;
}

function classifyLinkedBusiness(b) {
  if ((b.activation_status ?? "") === "suspended") {
    return { bucket: "linked_inactive", reason: "Business activation_status is suspended — manual review only" };
  }
  if (looksLikeTestBusiness(b.name)) {
    return {
      bucket: "linked_inactive",
      reason: "Business name matches test/demo heuristic — manual review only",
    };
  }
  if ((b.phone_recovery_status ?? "") === "failed" && !(b.twilio_phone_number ?? "").trim()) {
    return {
      bucket: "linked_review",
      reason: "Phone recovery failed; row may be mid-debug — do not auto-release",
    };
  }
  return {
    bucket: "linked_production",
    reason: "SID linked to a business row — NEVER release via this tool without clearing DB first",
  };
}

/** @param {import('twilio').Twilio} client */
async function listAllIncomingPhoneNumbers(client) {
  const out = [];
  let page = await client.incomingPhoneNumbers.page({ pageSize: 100 });
  out.push(...page.instances);
  let next = await page.nextPage();
  while (next) {
    out.push(...next.instances);
    next = await next.nextPage();
  }
  return out;
}

function printHumanTable(rows) {
  const lines = [
    "",
    "=== twilio-inventory (human summary) ===",
    "category | phone | sid | linked_business_ids | reason",
    "---|---|---|---|---",
  ];
  for (const r of rows) {
    const cat = (r.category ?? "").slice(0, 28);
    const phone = (r.phone ?? "").slice(0, 22);
    const sid = (r.sid ?? "").slice(0, 36);
    const bids = Array.isArray(r.linked_business_ids)
      ? r.linked_business_ids.join(",").slice(0, 44)
      : (r.linked_business_id ?? "—").toString().slice(0, 44);
    const reason = (r.reason ?? "").replace(/\|/g, ";").slice(0, 100);
    lines.push(`${cat} | ${phone} | ${sid} | ${bids} | ${reason}`);
  }
  lines.push("");
  console.error(lines.join("\n"));
}

async function main() {
  const args = process.argv.slice(2);
  const release = args.includes("--release");
  const human = args.includes("--human");
  const confirm = args.find((a) => a.startsWith("--confirm="))?.split("=")[1]?.trim();
  const sidsArg = args.find((a) => a.startsWith("--sids="))?.split("=")[1];

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!accountSid || !authToken || !url || !key) {
    console.error(
      "Missing env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY"
    );
    process.exit(1);
  }

  const client = twilio(accountSid, authToken);
  const db = createClient(url, key);

  const incoming = await listAllIncomingPhoneNumbers(client);
  const { data: businesses, error: be } = await db
    .from("businesses")
    .select(
      "id, name, activation_status, billing_status, phone_recovery_status, twilio_number_sid, twilio_phone_number"
    );

  if (be) throw be;

  /** @type {Map<string, Array<{ id: string; name: string | null; activation_status?: string; billing_status?: string; phone_recovery_status?: string; twilio_phone_number?: string | null; twilio_number_sid?: string | null }>>} */
  const sidToBusinesses = new Map();

  for (const b of businesses ?? []) {
    const sid = typeof b.twilio_number_sid === "string" ? b.twilio_number_sid.trim() : "";
    if (!sid) continue;
    if (!sidToBusinesses.has(sid)) sidToBusinesses.set(sid, []);
    sidToBusinesses.get(sid).push(b);
  }

  for (const [sid, list] of sidToBusinesses) {
    if (list.length > 1) {
      console.warn(
        "[twilio-inventory] DUPLICATE_SID_IN_DB",
        JSON.stringify({
          sid,
          business_ids: list.map((x) => x.id),
          note: "Multiple businesses reference the same Twilio SID — data integrity issue; do not release without fixing DB",
        })
      );
    }
  }

  const incomingSids = new Set(incoming.map((n) => n.sid));

  /** @type {object[]} */
  const report = [];

  for (const n of incoming) {
    const sid = n.sid;
    const phone = n.phoneNumber;
    const friendly = n.friendlyName ?? "";
    const list = sidToBusinesses.get(sid);

    if (list && list.length > 0) {
      const primary = list[0];
      const { bucket, reason } = classifyLinkedBusiness(primary);
      const prod = list.some((b) => isProductionLinkedRow(b));
      report.push({
        phone,
        sid,
        friendlyName: friendly,
        linked_business_id: primary.id,
        linked_business_ids: list.map((b) => b.id),
        business_name: primary.name ?? null,
        activation_status: primary.activation_status ?? null,
        billing_status: primary.billing_status ?? null,
        phone_recovery_status: primary.phone_recovery_status ?? null,
        category: list.length > 1 ? "duplicate_sid_in_db" : bucket,
        reason:
          (list.length > 1
            ? "Duplicate SID in DB (" + list.map((b) => b.id).join(", ") + "). "
            : "") + reason,
        safe_to_auto_release: false,
        production_signal: prod,
      });
      continue;
    }

    const auto = friendly.startsWith("AutoRevenueOS-");
    report.push({
      phone,
      sid,
      friendlyName: friendly,
      linked_business_id: null,
      linked_business_ids: [],
      business_name: null,
      activation_status: null,
      category: "orphan_twilio_not_in_db",
      reason: auto
        ? "In Twilio but not linked to any business row (deleted business, failed DB save, duplicate buy, or unlinked). Typical release candidate after review."
        : "In Twilio, not in Supabase — friendlyName does not start with AutoRevenueOS- (manual review; may be non-app number).",
      safe_to_auto_release: false,
      production_signal: false,
    });
  }

  for (const b of businesses ?? []) {
    const sid = typeof b.twilio_number_sid === "string" ? b.twilio_number_sid.trim() : "";
    if (!sid) continue;
    if (!incomingSids.has(sid)) {
      report.push({
        phone: b.twilio_phone_number ?? null,
        sid,
        friendlyName: null,
        linked_business_id: b.id,
        linked_business_ids: [b.id],
        business_name: b.name ?? null,
        activation_status: b.activation_status ?? null,
        category: "db_reference_missing_twilio",
        reason:
          "Business row references SID not found in this Twilio account (number released elsewhere, wrong subaccount, or stale row). Fix DB or re-provision.",
        safe_to_auto_release: false,
        production_signal: false,
      });
    }
  }

  const summary = {
    generated_at: new Date().toISOString(),
    twilio_account_sid: accountSid,
    twilio_incoming_count: incoming.length,
    businesses_with_sid: [...sidToBusinesses.keys()].length,
    categories: report.reduce((acc, r) => {
      const c = r.category ?? "unknown";
      acc[c] = (acc[c] ?? 0) + 1;
      return acc;
    }, {}),
    rows: report,
  };

  console.log(JSON.stringify(summary, null, 2));

  if (human) {
    printHumanTable(report);
  }

  if (!release) {
    console.error(
      "\n[twilio-inventory] Audit only. No numbers were released.\n" +
        "Release: node scripts/twilio-inventory.mjs --release --confirm=I_UNDERSTAND --sids=PNxxx\n" +
        "Safeguards: refuses any SID still present on businesses.twilio_number_sid; refuses non-orphan categories."
    );
    return;
  }

  if (confirm !== "I_UNDERSTAND") {
    console.error("[twilio-inventory] Refusing release: pass --confirm=I_UNDERSTAND");
    process.exit(1);
  }

  const allowList = (sidsArg ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (allowList.length === 0) {
    console.error(
      "[twilio-inventory] Refusing release: pass --sids=PNxxx,PNyyy with explicit SIDs (no bulk auto-delete)."
    );
    process.exit(1);
  }

  for (const sid of allowList) {
    const linkedList = sidToBusinesses.get(sid);
    if (linkedList && linkedList.length > 0) {
      console.error(
        "[twilio-inventory] REFUSE_RELEASE_LINKED_TO_BUSINESS",
        JSON.stringify({
          at: new Date().toISOString(),
          action: "refused",
          sid,
          business_ids: linkedList.map((x) => x.id),
          reason: "SID is still stored on businesses.twilio_number_sid — never auto-delete production or linked numbers",
        })
      );
      continue;
    }

    const exists = incoming.some((n) => n.sid === sid);
    if (!exists) {
      console.error(
        "[twilio-inventory] SKIP_NOT_IN_TWILIO",
        JSON.stringify({ at: new Date().toISOString(), action: "skipped", sid })
      );
      continue;
    }

    const row = report.find((r) => r.sid === sid && r.category === "orphan_twilio_not_in_db");
    if (!row) {
      console.error(
        "[twilio-inventory] REFUSE_RELEASE_NOT_ORPHAN_CATEGORY",
        JSON.stringify({
          at: new Date().toISOString(),
          action: "refused",
          sid,
          reason: "Only category orphan_twilio_not_in_db may be released — manual review required for other categories",
        })
      );
      continue;
    }

    try {
      await client.incomingPhoneNumbers(sid).remove();
      console.log(
        "[twilio-inventory] RELEASE_OK",
        JSON.stringify({
          at: new Date().toISOString(),
          action: "twilio_incoming_phone_removed",
          twilio_account_sid: accountSid,
          sid,
          phone: row.phone,
          friendlyName: row.friendlyName ?? null,
          linked_business_id: null,
          operator_note: "explicit SID + orphan category + not linked in DB",
        })
      );
    } catch (e) {
      console.error(
        "[twilio-inventory] RELEASE_FAILED",
        JSON.stringify({
          at: new Date().toISOString(),
          action: "error",
          sid,
          phone: row.phone,
          error: e instanceof Error ? e.message : String(e),
        })
      );
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
