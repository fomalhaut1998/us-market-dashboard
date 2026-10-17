interface DisciplineListProps {
  subtitle: string;
  items: string[];
}

export function DisciplineList({ subtitle, items }: DisciplineListProps) {
  return (
    <div>
      <h3 className="text-base font-extrabold text-ink sm:text-lg">{subtitle}</h3>
      <ol className="mt-4 space-y-3">
        {items.map((item, index) => (
          <li key={item} className="flex gap-3 text-sm leading-6 text-secondary sm:text-base sm:leading-7">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-soft-blue text-xs font-extrabold text-brand">
              {index + 1}
            </span>
            <span className="pt-px">{item}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
