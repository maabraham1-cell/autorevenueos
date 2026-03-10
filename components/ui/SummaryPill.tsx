'use client';

/**
 * AutoRevenueOS summary pill - compact metric display, used for pipeline counts.
 * Use isRevenue=true for revenue KPI to apply green accent.
 */
type SummaryPillProps = {
  label: string;
  value: number | string;
  subtitle?: string;
  isRevenue?: boolean;
};

export function SummaryPill({ label, value, subtitle, isRevenue = false }: SummaryPillProps) {
  const accentColor = isRevenue ? 'from-[#22C55E] to-[#16A34A]' : 'from-[#3B82F6] to-[#1E3A8A]';
  const valueColor = isRevenue ? 'text-[#166534]' : 'text-[#0F172A]';

  return (
    <div className="card-base flex flex-col justify-between rounded-[12px] p-4 transition-all duration-200 hover:shadow-[var(--card-shadow-hover)] sm:p-5">
      <div>
        <div className={`mb-2 h-1 w-8 rounded-full bg-gradient-to-r ${accentColor}`} />
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748B]">
          {label}
        </p>
      </div>
      <div className="mt-2">
        <p className={`text-2xl font-semibold tracking-tight ${valueColor}`}>{value}</p>
        {subtitle && <p className="mt-1 text-xs text-[#94A3B8]">{subtitle}</p>}
      </div>
    </div>
  );
}
