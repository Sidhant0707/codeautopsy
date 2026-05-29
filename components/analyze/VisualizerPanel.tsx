// components/analyze/VisualizerPanel.tsx
"use client";

import { motion } from "framer-motion";
import { Layers } from "lucide-react";
import dynamic from "next/dynamic";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { MAP_VIEW_CONFIG, MapViewType } from "@/components/analyze/constants";
import { RepoData } from "@/lib/types/analyze";
import SkeletonLoader from "@/components/analyze/SkeletonLoader";
import InfoTooltip from "@/components/InfoTooltip";

const ArchitectureMap = dynamic(() => import("@/components/ArchitectureMap"), {
  loading: () => <SkeletonLoader />,
  ssr: false,
});
const TreemapVisualizer = dynamic(
  () => import("@/components/TreemapVisualizer"),
  { loading: () => <SkeletonLoader />, ssr: false },
);
const DirectoryTreeVisualizer = dynamic(
  () => import("@/components/DirectoryTreeVisualizer"),
  { loading: () => <SkeletonLoader />, ssr: false },
);

const MAP_VIEW_TOOLTIPS: Record<string, string> = {
  graph:
    "Force-directed graph of file imports. Click any node to trace its Blast Radius.",
  directory:
    "Folder tree of your repo. Shows which directories contain the most files.",
  treemap:
    "File sizes as colored blocks. Bigger block = larger file. Red = top 10% by size.",
};

interface VisualizerPanelProps {
  data: RepoData;
  mapView: MapViewType;
  onMapViewChange: (view: MapViewType) => void;
  prChangedFiles?: string[];
}

export default function VisualizerPanel({
  data,
  mapView,
  onMapViewChange,
  prChangedFiles = [],
}: VisualizerPanelProps) {
  return (
    <motion.div
      key="visualizer"
      role="tabpanel"
      id="tabpanel-visualizer"
      aria-labelledby="tab-visualizer"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ type: "spring", stiffness: 380, damping: 30, mass: 0.8 }}
      className="absolute inset-0 p-4 flex flex-col gap-3"
    >
      {/* ── View switcher ─────────────────────────────────────────────── */}
      <div className="relative w-full flex flex-col sm:flex-row items-center justify-center gap-4 px-1 py-2 flex-shrink-0">
        <div className="flex flex-col gap-1 w-full sm:w-auto sm:absolute sm:left-2 text-left">
          <h3 className="text-sm font-bold text-slate-300 font-mono tracking-widest uppercase">
            Blueprint Map
          </h3>
          <span className="text-[10px] font-mono text-slate-500">
            VISUAL LAYOUT
          </span>
        </div>

        <div className="flex overflow-x-auto w-full sm:w-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] bg-[#141414]/90 backdrop-blur-xl p-1 rounded-xl border border-white/20 shadow-[0_0_15px_rgba(0,0,0,0.5)] z-10">
          {MAP_VIEW_CONFIG.map((view) => {
            const tooltip = MAP_VIEW_TOOLTIPS[view.id];
            return (
              <button
                key={view.id}
                onClick={() => onMapViewChange(view.id)}
                className={`flex-shrink-0 whitespace-nowrap px-3 sm:px-4 py-1.5 text-[10px] font-mono uppercase tracking-widest rounded-lg transition-all flex items-center gap-1.5 ${
                  mapView === view.id
                    ? "bg-white/10 text-white font-bold shadow-inner"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                {view.label}
                {tooltip && (
                  <span onClick={(e) => e.stopPropagation()}>
                    <InfoTooltip content={tooltip} side="bottom" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Map area ──────────────────────────────────────────────────── */}
      <div className="flex-1 w-full rounded-2xl border border-white/10 overflow-hidden bg-black shadow-2xl relative">
        <ErrorBoundary fallbackMessage="Failed to render architecture map.">
          {mapView === "graph" ? (
            data.dependencyGraph &&
            Object.keys(data.dependencyGraph).length > 0 ? (
              <ArchitectureMap
                dependencyGraph={data.dependencyGraph}
                entryPoints={data.entryPoints}
                fileMetrics={data.fileMetrics}
                prChangedFiles={prChangedFiles}
                pageRankScores={data.pageRankScores ?? {}}
              />
            ) : (
              <div className="w-full h-full bg-[#0e0e0e] flex flex-col items-center justify-center p-4 text-center">
                <Layers className="w-10 h-10 text-slate-600 mb-4" />
                <p className="text-slate-500 font-mono text-xs">
                  No blueprint data parsed.
                </p>
              </div>
            )
          ) : mapView === "directory" ? (
            <DirectoryTreeVisualizer metrics={data.fileMetrics} />
          ) : (
            <TreemapVisualizer metrics={data.fileMetrics} />
          )}
        </ErrorBoundary>
      </div>
    </motion.div>
  );
}
