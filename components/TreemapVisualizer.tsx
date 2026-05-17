"use client";

import React, { useMemo, useState, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Layers } from "lucide-react";

interface FileMetric {
  path: string;
  size: number;
}

interface TreemapVisualizerProps {
  metrics: FileMetric[];
}

// --- PRINCIPAL UPGRADE 1: Premium Glassmorphism Themes ---
// Instead of solid primary colors, we use ultra-subtle tinted glass with glowing borders.
const FOLDER_THEMES = [
  "border-emerald-500/20 bg-emerald-500/[0.02] hover:bg-emerald-500/[0.08] hover:border-emerald-400/50",
  "border-cyan-500/20 bg-cyan-500/[0.02] hover:bg-cyan-500/[0.08] hover:border-cyan-400/50",
  "border-blue-500/20 bg-blue-500/[0.02] hover:bg-blue-500/[0.08] hover:border-blue-400/50",
  "border-purple-500/20 bg-purple-500/[0.02] hover:bg-purple-500/[0.08] hover:border-purple-400/50",
  "border-amber-500/20 bg-amber-500/[0.02] hover:bg-amber-500/[0.08] hover:border-amber-400/50",
  "border-rose-500/20 bg-rose-500/[0.02] hover:bg-rose-500/[0.08] hover:border-rose-400/50",
  "border-slate-500/20 bg-slate-500/[0.02] hover:bg-slate-500/[0.08] hover:border-slate-400/50",
];

interface EnrichedFileMetric extends FileMetric {
  folder: string;
  name: string;
  theme: string;
  loc: number;
}

interface LayoutBox extends EnrichedFileMetric {
  x: number;
  y: number;
  width: number;
  height: number;
}

const estimateLOC = (bytes: number) => Math.max(1, Math.round(bytes / 30));

// Recursive slice-and-dice layout algorithm
function calculateLayout(
  items: EnrichedFileMetric[],
  x: number,
  y: number,
  width: number,
  height: number,
): LayoutBox[] {
  if (items.length === 0) return [];
  if (items.length === 1) return [{ ...items[0], x, y, width, height }];

  const totalWeight = items.reduce((sum, item) => sum + item.size, 0);
  let halfWeight = 0;
  let splitIndex = 0;

  for (let i = 0; i < items.length; i++) {
    halfWeight += items[i].size;
    if (halfWeight >= totalWeight / 2) {
      splitIndex = i + 1;
      break;
    }
  }

  if (splitIndex === items.length) splitIndex = items.length - 1;

  const group1 = items.slice(0, splitIndex);
  const group2 = items.slice(splitIndex);

  const weight1 = group1.reduce((sum, item) => sum + item.size, 0);
  const ratio1 = weight1 / totalWeight;

  if (width > height) {
    const w1 = width * ratio1;
    const w2 = width - w1;
    return [
      ...calculateLayout(group1, x, y, w1, height),
      ...calculateLayout(group2, x + w1, y, w2, height),
    ];
  } else {
    const h1 = height * ratio1;
    const h2 = height - h1;
    return [
      ...calculateLayout(group1, x, y, width, h1),
      ...calculateLayout(group2, x, y + h1, width, h2),
    ];
  }
}

// --- PRINCIPAL UPGRADE 2: Memoized Node Component ---
// This prevents the entire tree from re-rendering when you hover over a single box.
const TreemapNode = memo(
  ({
    box,
    onHover,
  }: {
    box: LayoutBox;
    onHover: (b: LayoutBox | null) => void;
  }) => {
    // Performance optimization: Don't render text for microscopic boxes
    const isLargeEnough = box.width > 8 && box.height > 6;

    return (
      <div
        onMouseEnter={() => onHover(box)}
        onMouseLeave={() => onHover(null)}
        className={`absolute border-[0.5px] overflow-hidden cursor-crosshair transition-colors duration-300 hover:z-30 hover:shadow-[0_0_30px_rgba(0,0,0,0.8)] backdrop-blur-sm ${box.theme}`}
        style={{
          left: `${box.x}%`,
          top: `${box.y}%`,
          width: `${box.width}%`,
          height: `${box.height}%`,
        }}
      >
        {isLargeEnough && (
          <div className="p-2 w-full h-full flex flex-col items-start justify-start opacity-60 hover:opacity-100 transition-opacity">
            <span className="text-white font-bold text-xs truncate w-full tracking-tight">
              {box.name}
            </span>
            <span className="text-slate-400 font-mono text-[9px] truncate w-full mt-0.5 uppercase tracking-widest">
              {box.loc.toLocaleString()} lines
            </span>
          </div>
        )}
      </div>
    );
  },
);
TreemapNode.displayName = "TreemapNode";

export default function TreemapVisualizer({ metrics }: TreemapVisualizerProps) {
  const [hoveredFile, setHoveredFile] = useState<LayoutBox | null>(null);

  const { layout, totalLOC } = useMemo(() => {
    if (!metrics || metrics.length === 0) return { layout: [], totalLOC: 0 };

    // FIX: Calculate true Total LOC based on ALL files before filtering
    const absoluteTotalLOC = metrics.reduce(
      (sum, item) => sum + estimateLOC(item.size),
      0,
    );
    const totalSize = metrics.reduce((sum, m) => sum + m.size, 0);

    // Performance: Filter out microscopic dust files for the VISUAL layout only
    const validMetrics = metrics.filter((m) => m.size > totalSize * 0.0005);
    validMetrics.sort((a, b) => b.size - a.size);

    const themeMap = new Map<string, string>();
    let themeIndex = 0;

    const enrichedItems = validMetrics.map((item) => {
      const parts = item.path.split("/");
      const rootFolder = parts.length > 1 ? parts[0] : "root";

      if (!themeMap.has(rootFolder)) {
        themeMap.set(
          rootFolder,
          FOLDER_THEMES[themeIndex % FOLDER_THEMES.length],
        );
        themeIndex++;
      }

      return {
        ...item,
        folder: rootFolder,
        name: parts.pop() || "unknown",
        theme: themeMap.get(rootFolder)!,
        loc: estimateLOC(item.size),
      };
    });

    const rawLayout = calculateLayout(enrichedItems, 0, 0, 100, 100);

    // Return the absolute total LOC, not the filtered one
    return { layout: rawLayout, totalLOC: absoluteTotalLOC };
  }, [metrics]);

  if (layout.length === 0) {
    return (
      <div className="w-full h-full min-h-[500px] flex flex-col items-center justify-center rounded-2xl border border-white/5 bg-[#0a0a0a]">
        <Layers className="w-8 h-8 text-slate-600 mb-3" />
        <p className="text-slate-500 font-mono text-xs uppercase tracking-widest">
          No valid metrics
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[500px] rounded-2xl border border-white/5 bg-[#0a0a0a] relative overflow-hidden p-4 sm:p-6 flex flex-col">
      {/* Header Stats */}
      <div className="flex justify-between items-center z-10 pointer-events-none mb-4 flex-shrink-0">
        <div className="text-[10px] font-mono text-slate-400 bg-white/[0.02] px-3 py-2 rounded-lg border border-white/5 flex items-center gap-2 shadow-lg backdrop-blur-md">
          Total Estimated LOC:{" "}
          <span className="text-white font-bold">
            {totalLOC.toLocaleString()}
          </span>
        </div>
        <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest hidden sm:block">
          {layout.length} Files Mapped
        </div>
      </div>

      {/* --- PRINCIPAL UPGRADE 3: Container Animation Only --- */}
      {/* Animating the container instead of 500 individual children saves massive CPU cycles */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full flex-1 rounded-xl overflow-hidden border border-white/10 bg-[#0e0e0e] shadow-[0_0_40px_rgba(0,0,0,0.3)]"
      >
        {layout.map((box, idx) => (
          <TreemapNode
            key={`${box.path}-${idx}`}
            box={box}
            onHover={setHoveredFile}
          />
        ))}
      </motion.div>

      {/* Floating Info Panel */}
      <AnimatePresence>
        {hoveredFile && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-8 right-8 z-40 bg-[#0e0e0e]/95 border border-white/10 p-5 rounded-2xl shadow-2xl backdrop-blur-xl min-w-[280px] max-w-[320px] pointer-events-none"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-white/40 animate-pulse" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest truncate">
                {hoveredFile.folder}
              </span>
            </div>
            <div className="text-sm text-white font-mono break-all mb-5 leading-relaxed">
              {hoveredFile.path}
            </div>

            <div className="flex justify-between items-end border-t border-white/10 pt-4">
              <span className="text-[10px] text-slate-500 font-mono tracking-widest">
                EST. WEIGHT
              </span>
              <span className="text-sm text-slate-200 font-bold font-mono">
                {hoveredFile.loc.toLocaleString()} Lines
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
