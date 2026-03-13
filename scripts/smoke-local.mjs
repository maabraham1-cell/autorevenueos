// Simple local smoke test script for AutoRevenueOS.
// Usage (with dev server running on http://localhost:3000):
//   node scripts/smoke-local.mjs

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

async function check(path) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url);
  let body = null;
  try {
    body = await res.json();
  } catch {
    // ignore
  }
  return { path, status: res.status, ok: res.ok, body };
}

async function main() {
  const results = [];

  results.push(await check("/api/health"));
  results.push(await check("/api/missed-call")); // GET only
  results.push(await check("/marketing"));

  for (const r of results) {
    console.log(
      `[smoke] ${r.path} -> ${r.status} ${r.ok ? "OK" : "FAIL"}`,
      typeof r.body === "object" ? "" : ""
    );
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("[smoke] unexpected error", e);
  process.exitCode = 1;
});

