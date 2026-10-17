"use client";

import { useRef } from "react";
import type { KeyboardEvent } from "react";
import type { DashboardTab, DashboardTabId } from "@/types/dashboard";

interface TabsProps {
  tabs: DashboardTab[];
  activeTab: DashboardTabId;
  onChange: (tab: DashboardTabId) => void;
}

export function Tabs({ tabs, activeTab, onChange }: TabsProps) {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function focusTab(index: number) {
    const nextIndex = (index + tabs.length) % tabs.length;
    const nextTab = tabs[nextIndex];
    onChange(nextTab.id);
    tabRefs.current[nextIndex]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      focusTab(index + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusTab(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusTab(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusTab(tabs.length - 1);
    }
  }

  return (
    <div
      role="tablist"
      aria-label="看板页面"
      className="grid grid-cols-3 gap-2.5 sm:gap-4"
    >
      {tabs.map((tab, index) => {
        const selected = tab.id === activeTab;

        return (
          <button
            key={tab.id}
            ref={(node) => {
              tabRefs.current[index] = node;
            }}
            id={`tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={`min-h-14 rounded-[18px] border px-1.5 py-3 text-[0.86rem] font-bold tracking-[-0.01em] shadow-[var(--shadow-tab)] outline-none transition sm:min-h-16 sm:rounded-[20px] sm:px-4 sm:text-lg ${
              selected
                ? "border-brand-solid bg-brand-solid text-white shadow-[0_10px_22px_rgba(44,103,232,0.26)]"
                : "border-line bg-surface text-muted hover:-translate-y-0.5 hover:border-brand/40 hover:text-ink focus-visible:ring-4 focus-visible:ring-brand/20"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
