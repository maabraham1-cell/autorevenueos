'use client';

/**
 * AutoRevenueOS section header - consistent typography hierarchy.
 */
type SectionHeaderProps = {
  title: string;
  description?: string;
  rightContent?: React.ReactNode;
};

export function SectionHeader({ title, description, rightContent }: SectionHeaderProps) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-sm font-semibold text-[#0F172A]">{title}</h2>
        {description && <p className="mt-1 text-xs text-[#64748B]">{description}</p>}
      </div>
      {rightContent && <div className="shrink-0">{rightContent}</div>}
    </div>
  );
}
