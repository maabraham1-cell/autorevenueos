'use client';

/**
 * AutoRevenueOS proof chip - proof label display.
 */
type ProofChipProps = {
  label: string;
  status?: string;
};

export function ProofChip({ label, status }: ProofChipProps) {
  let colors = 'bg-[#F8FAFC] text-[#64748B] border-[#E5E7EB]';
  if (status === 'Booked') {
    colors = 'bg-[#FFFBEB] text-[#D97706] border-[#FED7AA]';
  } else if (status === 'Follow Up') {
    colors = 'bg-[#FFFBEB] text-[#D97706] border-[#FED7AA]';
  } else if (status === 'In Conversation') {
    colors = 'bg-[#EEF2FF] text-[#4F46E5] border-[#C7D2FE]';
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${colors}`}
    >
      {label}
    </span>
  );
}
