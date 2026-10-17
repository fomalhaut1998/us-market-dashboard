import type { MultiplierLevel } from "@/types/dashboard";

interface MultiplierSelectorProps {
  levels: MultiplierLevel[];
  currentMultiplier: string;
}

export function MultiplierSelector({ levels, currentMultiplier }: MultiplierSelectorProps) {
  return (
    <div className="grid grid-cols-5 gap-1.5 sm:gap-3 lg:gap-4">
      {levels.map((level) => {
        const selected = level.value === currentMultiplier;

        return (
          <div
            key={level.value}
            className={`flex min-h-[98px] min-w-0 flex-col items-center justify-center rounded-[16px] border-2 px-0.5 py-3 text-center sm:min-h-[146px] sm:rounded-[22px] sm:px-3 sm:py-4 ${
              selected
                ? "border-success bg-soft-green shadow-[0_0_0_3px_rgba(26,161,91,0.12)]"
                : "border-line bg-surface-subtle"
            }`}
          >
            <strong
              className={`text-[1.02rem] leading-none font-black tracking-[-0.04em] tabular-nums sm:text-2xl sm:leading-normal lg:text-[2rem] ${
                selected ? "text-success" : "text-ink"
              }`}
            >
              {level.value}
            </strong>
            <span className="mt-1.5 whitespace-pre-line text-[0.6rem] leading-3.5 text-muted sm:mt-2 sm:text-sm sm:leading-5">
              {level.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
