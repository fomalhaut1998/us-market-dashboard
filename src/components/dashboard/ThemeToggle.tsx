"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

const storageKey = "us-stock-dashboard-theme";
const themeEvent = "dashboard-theme-change";

function getThemeSnapshot(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function subscribeToTheme(onStoreChange: () => void) {
  window.addEventListener(themeEvent, onStoreChange);
  return () => window.removeEventListener(themeEvent, onStoreChange);
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  try {
    localStorage.setItem(storageKey, theme);
  } catch {
    // The visual theme can still change when browser storage is unavailable.
  }

  document
    .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
    .forEach((meta) => meta.setAttribute("content", theme === "dark" ? "#0b1220" : "#f2f5fb"));

  window.dispatchEvent(new Event(themeEvent));
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, () => "light");
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      aria-label={`切换至${isDark ? "白天" : "黑夜"}模式`}
      aria-pressed={isDark}
      title={`切换至${isDark ? "白天" : "黑夜"}模式`}
      onClick={() => applyTheme(isDark ? "light" : "dark")}
      className="relative flex h-10 w-[70px] shrink-0 items-center justify-between rounded-full border border-line bg-surface p-1 text-tertiary shadow-[var(--shadow-tab)] outline-none transition hover:border-brand/55 focus-visible:ring-4 focus-visible:ring-brand/25 sm:h-11 sm:w-[72px]"
    >
      <span
        className="theme-toggle__thumb absolute left-1 top-1 h-8 w-8 rounded-full bg-soft-blue shadow-sm transition-transform duration-200 sm:h-9 sm:w-9"
        aria-hidden="true"
      />
      <svg
        viewBox="0 0 24 24"
        className="theme-toggle__sun relative z-10 h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="3.5" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" />
      </svg>
      <svg
        viewBox="0 0 24 24"
        className="theme-toggle__moon relative z-10 h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M20.2 15.3A8.5 8.5 0 0 1 8.7 3.8 8.5 8.5 0 1 0 20.2 15.3Z" />
      </svg>
    </button>
  );
}
