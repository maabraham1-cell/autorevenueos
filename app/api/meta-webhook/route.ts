// Backwards-compatible alias route.
// Keep existing webhook path operational while the canonical route is:
// /api/meta/webhook
export { GET, POST } from "@/app/api/meta/webhook/route";

