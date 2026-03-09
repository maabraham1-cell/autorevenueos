export async function sendRecoverySms({
  to,
  businessName,
  bookingLink,
}: {
  to: string;
  businessName: string;
  bookingLink: string | null;
}): Promise<{ success: true; provider: string; to: string; body: string }> {
  const body = `Hi, sorry we missed your call to ${businessName}. You can book here: ${bookingLink ?? ""}`;
  console.log("[sendRecoverySms]", body);
  return {
    success: true,
    provider: "mock",
    to,
    body,
  };
}
