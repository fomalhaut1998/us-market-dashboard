import { siteConfig } from "@/config/site";
import { GitHubMark } from "./ProjectBadge";

const projectLinks = [
  { label: "GitHub 仓库", href: siteConfig.repository },
  { label: "发布记录", href: siteConfig.releases },
  { label: "更新日志", href: siteConfig.changelog },
  { label: "使用文档", href: siteConfig.readme },
  { label: "问题反馈", href: siteConfig.issues },
  { label: "MIT 许可", href: siteConfig.licenseUrl },
] as const;

export function ProjectFooter() {
  return (
    <footer className="mt-8 pb-2 sm:mt-10">
      <div className="rounded-[24px] border border-line/70 bg-surface px-5 py-5 shadow-[var(--shadow-section)] sm:px-6 sm:py-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-line bg-surface-soft text-ink">
              <GitHubMark className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm font-extrabold tracking-[-0.01em] text-ink">
                <span>{siteConfig.name}</span>
                <a
                  href={siteConfig.release}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="rounded-full bg-soft-blue px-2 py-0.5 font-mono text-[0.66rem] font-bold text-brand transition hover:bg-soft-blue-line focus-visible:ring-4 focus-visible:ring-brand/20 focus-visible:outline-none"
                  aria-label={`查看 ${siteConfig.versionLabel} 发布说明（新窗口打开）`}
                >
                  {siteConfig.versionLabel}
                </a>
              </p>
              <p className="mt-1 text-[0.72rem] leading-5 text-tertiary">
                开源项目 · {siteConfig.license} License · 发布于 {siteConfig.releaseDate}
              </p>
            </div>
          </div>

          <nav
            aria-label="项目相关链接"
            className="flex flex-wrap gap-x-4 gap-y-2 text-[0.72rem] font-bold text-secondary sm:gap-x-5"
          >
            {projectLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex items-center gap-1 rounded transition hover:text-brand focus-visible:ring-4 focus-visible:ring-brand/20 focus-visible:outline-none"
              >
                {link.label}
                <span aria-hidden="true" className="text-tertiary">
                  ↗
                </span>
              </a>
            ))}
          </nav>
        </div>

        <dl className="mt-5 grid gap-3 border-t border-line/70 pt-4 text-[0.72rem] leading-5 text-tertiary sm:grid-cols-2 sm:gap-8">
          <div>
            <dt className="font-bold text-muted">数据来源</dt>
            <dd className="mt-1">
              行情 Twelve Data（限流或失败时自动切换 Nasdaq / FMP 备用源）；波动率与期权数据
              Cboe；情绪 CNN Fear &amp; Greed；估值 Multpl 月度非估算值；信用利差 FRED。
            </dd>
          </div>
          <div>
            <dt className="font-bold text-muted">口径与缓存</dt>
            <dd className="mt-1">
              全部取最近一个交易日收盘，服务端缓存 30 分钟；PE 为月度数据，滞后超过 45
              天只标注、不参与倍率计算。
            </dd>
          </div>
        </dl>

        <p className="mt-4 text-[0.7rem] leading-5 text-tertiary">
          本页只是把固定规则按阈值算给你看，不构成投资建议；规则与阈值见「策略与纪律」与情绪页的指标说明。
        </p>
      </div>

      <p className="mt-3 text-center text-[0.66rem] leading-5 text-tertiary">
        © 2026 {siteConfig.author} · Built with Next.js · 数据更新以页面顶部「最后更新」为准
      </p>
    </footer>
  );
}
