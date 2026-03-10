'use client';

/**
 * AutoRevenueOS metric card - KPI display with gradient bar, consistent shadow.
 * Use isRevenue=true to apply green accent for money/recovered revenue values.
 */
type MetricCardProps = {
  label: string;
  value: string;
  subtitle?: string;
  isRevenue?: boolean;
};

export function MetricCard({ label, value, subtitle, isRevenue = false }: MetricCardProps) {
  const accentColor = isRevenue ? 'from-[#22C55E] to-[#16A34A]' : 'from-[#3B82F6] to-[#1E3A8A]';
  const valueColor = isRevenue ? 'text-[#166534]' : 'text-[#0F172A]';

  return (
    <div className="card-base flex flex-col justify-between rounded-[12px] p-5 transition-all duration-200 hover:shadow-[var(--card-shadow-hover)] sm:p-6">
      <div>
        <div className={`mb-3 h-1 w-10 rounded-full bg-gradient-to-r ${accentColor}`} />
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#64748B]">
          {label}
        </p>
        <p className={`mt-3 text-2xl font-semibold tracking-tight sm:text-3xl ${valueColor}`}>
          {value}
        </p>
      </div>
      {subtitle && (
        <p className="mt-3 text-xs text-[#94A3B8]">{subtitle}</p>
      )}
    </div>
  );
}
