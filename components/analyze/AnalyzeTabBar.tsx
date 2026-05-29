// components/analyze/AnalyzeTabBar.tsx
"use client";

import { motion } from "framer-motion";
import { TAB_CONFIG, TabType } from "@/components/analyze/constants";
import InfoTooltip from "@/components/InfoTooltip";

const TAB_TOOLTIPS: Record<string, string> = {
  overview: "High-level summary of repo structure, stats, and AI diagnostics.",
  visualizer:
    "Interactive dependency graph. See how files connect and trace impact.",
  doctor:
    "AI-powered code health report. Flags bugs, smells, and improvements.",
  pr_impact: "Paste a PR to see exactly which files it breaks downstream.",
  risk_radar:
    "Scores your codebase for security, complexity, and maintenance risk.",
  arch_insights:
    "Graph algorithms reveal critical files, stability zones, and dead code.",
};

interface AnalyzeTabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export default function AnalyzeTabBar({
  activeTab,
  onTabChange,
}: AnalyzeTabBarProps) {
  return (
    <div
      role="tablist"
      aria-label="Analysis Tools"
      className="h-16 flex-shrink-0 border-b border-white/5 flex items-center justify-center px-4 sm:px-6 bg-[#0a0a0a]/50 backdrop-blur-sm z-20 overflow-hidden"
    >
      <div className="flex overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] items-center gap-2 bg-[#141414]/90 backdrop-blur-xl p-1.5 rounded-xl border border-white/20 shadow-[0_0_30px_rgba(255,255,255,0.15)] ring-1 ring-black/50 transition-all hover:shadow-[0_0_40px_rgba(255,255,255,0.25)] w-auto">
        {TAB_CONFIG.map((tab) => {
          const isActive = activeTab === tab.id;
          const tooltip = TAB_TOOLTIPS[tab.id];
          return (
            <button
              type="button"
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onTabChange(tab.id)}
              className={`relative flex-shrink-0 whitespace-nowrap px-3 sm:px-4 py-2 rounded-lg text-[11px] font-bold uppercase tracking-widest font-mono transition-colors flex items-center gap-1.5 sm:gap-2 ${
                isActive
                  ? "text-white"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="active-tab-highlight"
                  className="absolute inset-0 bg-white/10 rounded-lg shadow-inner border border-white/10"
                  initial={false}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <tab.icon className="w-3.5 h-3.5 relative z-10 flex-shrink-0" />
              {/* Label hidden on very small screens to prevent overflow */}
              <span className="relative z-10 hidden xs:inline sm:inline">
                {tab.label}
              </span>
              {/* Tooltip sits outside the button's z-10 stacking context */}
              {tooltip && (
                <span
                  className="relative z-10"
                  onClick={(e) => e.stopPropagation()}
                >
                  <InfoTooltip content={tooltip} side="bottom" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
