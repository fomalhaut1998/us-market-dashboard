import packageJson from "../../package.json";

const repository = "https://github.com/fomalhaut1998/us-market-dashboard";

/**
 * 站点与开源项目元信息。
 * 版本号只维护 package.json 一处，页面徽章、发布链接都从这里派生。
 */
export const siteConfig = {
  name: "美股估值与情绪监控看板",
  version: packageJson.version,
  versionLabel: `v${packageJson.version}`,
  releaseDate: "2026-10-17",
  license: packageJson.license ?? "MIT",
  author: "Fomalhaut",
  repository,
  liveDemo: "https://us-market-dashboard-gules.vercel.app",
  releases: `${repository}/releases`,
  release: `${repository}/releases/tag/v${packageJson.version}`,
  changelog: `${repository}/blob/main/CHANGELOG.md`,
  readme: `${repository}#readme`,
  issues: `${repository}/issues`,
  licenseUrl: `${repository}/blob/main/LICENSE`,
} as const;
