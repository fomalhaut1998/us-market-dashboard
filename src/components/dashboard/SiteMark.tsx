/**
 * 站点品牌标记：地球 + 上行行情线，与 public/assets/site-icon.svg 同一套几何。
 * 纯装饰元素，语义由相邻标题承担，因此对读屏隐藏。
 */
export function SiteMark({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 512 512"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="site-mark-bg" x1="86" y1="34" x2="430" y2="492" gradientUnits="userSpaceOnUse">
          <stop stopColor="#3E7DFF" />
          <stop offset=".52" stopColor="#2457D6" />
          <stop offset="1" stopColor="#122D78" />
        </linearGradient>
        <radialGradient id="site-mark-glow" cx="0" cy="0" r="1" gradientTransform="translate(154 116) rotate(51) scale(392)" gradientUnits="userSpaceOnUse">
          <stop stopColor="#A9C8FF" stopOpacity=".34" />
          <stop offset="1" stopColor="#A9C8FF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill="url(#site-mark-bg)" />
      <rect width="512" height="512" rx="116" fill="url(#site-mark-glow)" />
      <g fill="none" stroke="#CFE1FF" strokeLinecap="round">
        <circle cx="256" cy="247.5" r="142.5" strokeWidth="26" opacity=".82" />
        <ellipse cx="256" cy="247.5" rx="59" ry="142.5" strokeWidth="14" opacity=".46" />
        <path d="M113.5 247.5h285" strokeWidth="14" opacity=".46" />
      </g>
      <path d="M140 338 215 277.5 272.5 305 367.5 192.5" transform="translate(0 7)" fill="none" stroke="#0B2058" strokeOpacity=".22" strokeWidth="38" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M140 338 215 277.5 272.5 305 367.5 192.5" fill="none" stroke="#FFFFFF" strokeWidth="33" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="367.5" cy="192.5" r="29" fill="#8CF0BC" />
      <circle cx="367.5" cy="192.5" r="10" fill="#0C2A68" />
    </svg>
  );
}
