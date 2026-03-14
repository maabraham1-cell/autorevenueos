'use client';

/**
 * AutoRevenueOS channel badge - consistent channel labelling.
 */
export function ChannelBadge({ channel }: { channel: string | null }) {
  const label =
    channel === 'website_chat' ? 'Website' : channel ?? 'Unknown';
  const initial =
    channel === 'meta' ? 'M' : channel === 'sms' ? 'S' : channel === 'website_chat' ? 'W' : channel === 'email' ? 'E' : 'C';

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E7EB] bg-[#F8FAFC] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-[#64748B]">
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#DBEAFE] text-[9px] font-semibold text-[#1E3A8A]">
        {initial}
      </span>
      <span>{label}</span>
    </span>
  );
}
