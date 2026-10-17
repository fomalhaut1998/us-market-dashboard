import type { ReactNode } from "react";

interface SectionCardProps {
  title: string;
  description?: ReactNode;
  icon?: string;
  children: ReactNode;
  className?: string;
}

export function SectionCard({
  title,
  description,
  icon,
  children,
  className = "",
}: SectionCardProps) {
  return (
    <section
      className={`rounded-[26px] border border-line/70 bg-surface px-4 py-5 shadow-[var(--shadow-section)] sm:rounded-[28px] sm:px-7 sm:py-7 lg:px-9 lg:py-8 ${className}`}
    >
      <header className="mb-4 sm:mb-6">
        <div className="flex items-center gap-3">
          <span className="h-8 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />
          {icon ? (
            <span className="text-2xl leading-none" aria-hidden="true">
              {icon}
            </span>
          ) : null}
          <h2 className="text-[1.14rem] leading-7 font-extrabold tracking-[-0.02em] text-ink sm:text-[1.45rem] sm:leading-normal">
            {title}
          </h2>
        </div>
        {description ? (
          <p className="mt-2.5 text-[0.85rem] leading-6 text-muted sm:mt-3 sm:ml-[18px] sm:text-base sm:leading-7">
            {description}
          </p>
        ) : null}
      </header>
      {children}
    </section>
  );
}
