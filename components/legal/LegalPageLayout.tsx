'use client';

const CARD_MAX_WIDTH = 'min(820px, 100%)';
const APP_BG = 'bg-[#020617]';
const APP_BG_GRADIENT = 'bg-[radial-gradient(ellipse_at_top,_rgba(37,99,235,0.24),transparent_60%)]';

export type TocItem = { id: string; label: string };

type LegalPageLayoutProps = {
  title: string;
  lastUpdated: string;
  toc: TocItem[];
  children: React.ReactNode;
};

export function LegalPageLayout({ title, lastUpdated, toc, children }: LegalPageLayoutProps) {
  return (
    <div
      className={`min-h-screen ${APP_BG} ${APP_BG_GRADIENT} px-4 py-10 sm:py-14`}
      aria-label="Legal document"
    >
      <div className="mx-auto flex max-w-6xl justify-center gap-10 lg:gap-14">
        {/* Sticky TOC — desktop only */}
        <aside
          className="hidden shrink-0 lg:block"
          style={{ width: 200 }}
          aria-label="Table of contents"
        >
          <nav
            className="sticky top-24 rounded-xl border border-[#E5E7EB]/60 bg-white/90 p-4 shadow-sm backdrop-blur-sm"
            style={{ maxHeight: 'calc(100vh - 8rem)' }}
          >
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
              On this page
            </p>
            <ul className="space-y-1.5 overflow-y-auto text-sm">
              {toc.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    className="block rounded-md py-1.5 pr-2 text-[#475569] transition-colors hover:bg-[#F1F5F9] hover:text-[#0F172A]"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* White card — main content */}
        <article
          className="w-full rounded-[14px] border border-[#E5E7EB]/80 bg-white shadow-[0_32px_80px_rgba(15,23,42,0.2)]"
          style={{ maxWidth: CARD_MAX_WIDTH }}
        >
          <div className="px-8 py-10 sm:px-12 sm:py-12 md:px-14 md:py-14">
            <p className="text-xs font-medium text-[#64748B]">{lastUpdated}</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-[#0F172A] sm:text-4xl">
              {title}
            </h1>
            <div className="legal-content mt-8 max-w-none [&_section]:scroll-mt-24 [&_h2]:mt-10 [&_h2]:border-b [&_h2]:border-[#E5E7EB] [&_h2]:pb-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-[#0F172A] [&_h3]:mt-6 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-[#0F172A] [&_p]:leading-relaxed [&_p]:text-[#334155] [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-6 [&_li]:text-[#334155] [&_a]:text-[#2563EB] [&_a]:no-underline hover:[&_a]:underline">
              {children}
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
