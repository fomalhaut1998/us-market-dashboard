import { siteConfig } from "@/config/site";

/** GitHub 官方 Octocat 标记（16×16）。 */
export function GitHubMark({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

/**
 * 页头的开源标识：GitHub 仓库入口 + 当前版本号（链接到对应 Release）。
 * 版本号来自 package.json，不在这里手写。
 */
export function ProjectBadge({ className = "" }: { className?: string }) {
  return (
    <div
      className={`inline-flex h-10 shrink-0 items-center overflow-hidden rounded-full border border-line bg-surface text-[0.72rem] font-bold text-secondary shadow-[var(--shadow-tab)] ${className}`}
    >
      <a
        href={siteConfig.repository}
        target="_blank"
        rel="noreferrer noopener"
        aria-label="在 GitHub 查看本项目源码（新窗口打开）"
        title="GitHub 开源仓库"
        className="inline-flex h-full items-center gap-1.5 px-3 transition hover:bg-surface-soft hover:text-ink focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none focus-visible:ring-inset"
      >
        <GitHubMark className="h-3.5 w-3.5" />
        <span className="hidden lg:inline">GitHub</span>
      </a>
      <span className="h-4 w-px bg-line" aria-hidden="true" />
      <a
        href={siteConfig.release}
        target="_blank"
        rel="noreferrer noopener"
        aria-label={`查看 ${siteConfig.versionLabel} 发布说明（新窗口打开）`}
        title={`${siteConfig.versionLabel} 发布说明`}
        className="inline-flex h-full items-center px-3 font-mono text-[0.7rem] font-bold text-brand transition hover:bg-soft-blue focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:outline-none focus-visible:ring-inset"
      >
        {siteConfig.versionLabel}
      </a>
    </div>
  );
}
