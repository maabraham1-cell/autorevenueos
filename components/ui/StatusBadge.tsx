'use client';

/**
 * AutoRevenueOS status badge - pill shape, rounded full, semibold text.
 * Standardised status colors:
 * - Recovered → neutral gray
 * - In Conversation → soft blue
 * - Follow Up → amber
 * - Booked → green
 * - Lost → red
 */
type Status = 'Recovered' | 'In Conversation' | 'Follow Up' | 'Booked' | 'Lost';

const STATUS_STYLES: Record<string, string> = {
  Recovered: 'bg-[#F1F5F9] text-[#475569] border-[#E5E7EB]',
  'In Conversation': 'bg-[#DBEAFE] text-[#1E3A8A] border-[#BFDBFE]',
  'Follow Up': 'bg-[#FFFBEB] text-[#D97706] border-[#FED7AA]',
  Booked: 'bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]',
  Lost: 'bg-[#FEE2E2] text-[#DC2626] border-[#FECACA]',
};

const baseClasses =
  'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide border';

export function StatusBadge({ status, showCaret = false }: { status: string; showCaret?: boolean }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.Recovered;
  return (
    <span className={`${baseClasses} ${style}`}>
      {status}
      {showCaret && <span className="ml-1 text-[9px] font-normal normal-case text-[#94A3B8]">▾</span>}
    </span>
  );
}
