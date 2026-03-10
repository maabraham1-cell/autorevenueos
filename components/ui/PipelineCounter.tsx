'use client';

/**
 * AutoRevenueOS pipeline counter - status-based count pills.
 */
type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'error';

const TONE_STYLES: Record<Tone, string> = {
  neutral: 'border-[#E5E7EB] bg-white text-[#475569]',
  info: 'border-[#BFDBFE] bg-[#DBEAFE] text-[#1E3A8A]',
  success: 'border-[#BBF7D0] bg-[#DCFCE7] text-[#166534]',
  warning: 'border-[#FED7AA] bg-[#FFFBEB] text-[#D97706]',
  error: 'border-[#FECACA] bg-[#FEE2E2] text-[#DC2626]',
};

type PipelineCounterProps = {
  label: string;
  value: number;
  tone?: Tone;
};

export function PipelineCounter({ label, value, tone = 'neutral' }: PipelineCounterProps) {
  const style = TONE_STYLES[tone];
  return (
    <div className={`flex items-center gap-2 rounded-full border px-3 py-1.5 ${style}`}>
      <span className="text-[11px] font-medium uppercase tracking-wide">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}
