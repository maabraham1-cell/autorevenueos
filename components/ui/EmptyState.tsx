'use client';

/**
 * AutoRevenueOS empty state - consistent empty state treatment.
 */
type EmptyStateProps = {
  title: string;
  description: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <section className="animate-fade-in-up rounded-2xl border border-dashed border-[#E5E7EB] bg-white/90 p-8 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_20px_rgba(15,23,42,0.08)]">
      <h2 className="text-sm font-semibold text-[#0F172A]">{title}</h2>
      <p className="mt-2 text-sm text-[#64748B]">{description}</p>
    </section>
  );
}
