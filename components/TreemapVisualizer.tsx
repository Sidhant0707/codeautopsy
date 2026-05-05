"use client";

import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";

interface FileMetric {
  path: string;
  size: number;
}

interface TreemapVisualizerProps {
  metrics: FileMetric[];
}


const FOLDER_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-purple-500", "bg-amber-500",
  "bg-pink-500", "bg-cyan-500", "bg-rose-500", "bg-indigo-500",
  "bg-teal-500", "bg-orange-500"
];


interface EnrichedFileMetric extends FileMetric {
  folder: string;
  name: string | undefined;
  color: string | undefined;
  loc: number;
}

interface LayoutBox extends EnrichedFileMetric {
  x: number;
  y: number;
  width: number;
  height: number;
}

const estimateLOC = (bytes: number) => Math.max(1, Math.round(bytes / 30));

function calculateLayout(
  items: EnrichedFileMetric[],
  x: number,
  y: number,
  width: number,
  height: number
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

export default function TreemapVisualizer({ metrics }: TreemapVisualizerProps) {
  const [hoveredFile, setHoveredFile] = useState<LayoutBox | null>(null);

  const { layout, totalLOC } = useMemo(() => {
    if (!metrics || metrics.length === 0) return { layout: [], totalLOC: 0 };

    
    const validMetrics = metrics.filter(m => m.size > 0);

    
    validMetrics.sort((a, b) => b.size - a.size);

    
    const colorMap = new Map<string, string>();
    let colorIndex = 0;

    const enrichedItems = validMetrics.map(item => {
      const parts = item.path.split("/");
      const rootFolder = parts.length > 1 ? parts[0] : "root";
      
      if (!colorMap.has(rootFolder)) {
        colorMap.set(rootFolder, FOLDER_COLORS[colorIndex % FOLDER_COLORS.length]);
        colorIndex++;
      }

      return {
        ...item,
        folder: rootFolder,
        name: parts.pop(),
        color: colorMap.get(rootFolder),
        loc: estimateLOC(item.size)
      };
    });

    const totalLOC = enrichedItems.reduce((sum, item) => sum + item.loc, 0);

    
    const rawLayout = calculateLayout(enrichedItems, 0, 0, 100, 100);

    return { layout: rawLayout, totalLOC };
  }, [metrics]);

  if (layout.length === 0) {
    return (
      <div className="w-full h-full min-h-[500px] flex items-center justify-center rounded-2xl border border-white/5 bg-black/40">
        <p className="text-slate-500 font-mono text-sm">No size metrics available.</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[500px] rounded-2xl border border-white/5 bg-[#0e0e0e] relative overflow-hidden p-4">
      {}
      <div className="absolute top-4 left-4 z-10 flex gap-2 pointer-events-none">
        <div className="text-[10px] font-mono text-slate-400 bg-[#141414] px-3 py-1.5 rounded-lg border border-white/5 flex items-center gap-2 shadow-lg">
          Total Estimated LOC: <span className="text-white font-bold">{totalLOC.toLocaleString()}</span>
        </div>
      </div>

      {}
      <div className="relative w-full h-[600px] mt-10 rounded-xl overflow-hidden border border-white/10 shadow-2xl">
        {layout.map((box, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, delay: idx * 0.005 }}
            onMouseEnter={() => setHoveredFile(box)}
            onMouseLeave={() => setHoveredFile(null)}
            className={`absolute border-[0.5px] border-black/40 overflow-hidden cursor-crosshair hover:z-30 hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-all ${box.color}`}
            style={{
              left: `${box.x}%`,
              top: `${box.y}%`,
              width: `${box.width}%`,
              height: `${box.height}%`,
            }}
          >
            {}
            {box.width > 6 && box.height > 6 && (
              <div className="p-2 w-full h-full flex flex-col items-start justify-start bg-black/20 hover:bg-transparent transition-colors">
                <span className="text-white font-bold text-xs truncate w-full shadow-black drop-shadow-md">
                  {box.name}
                </span>
                <span className="text-white/80 font-mono text-[9px] truncate w-full mt-0.5 shadow-black drop-shadow-md">
                  {box.loc.toLocaleString()} lines
                </span>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {}
      {hoveredFile && (
        <div className="absolute bottom-6 right-6 z-40 bg-[#141414]/95 border border-white/10 p-4 rounded-xl shadow-2xl backdrop-blur-xl min-w-[250px] pointer-events-none">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-2 h-2 rounded-full ${hoveredFile.color}`} />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{hoveredFile.folder}</span>
          </div>
          <div className="text-sm text-white font-mono break-all mb-4 leading-tight">{hoveredFile.path}</div>
          <div className="flex justify-between items-end border-t border-white/5 pt-3">
            <span className="text-[10px] text-slate-500 font-mono tracking-widest">WEIGHT</span>
            <span className="text-sm text-emerald-400 font-bold font-mono">{hoveredFile.loc.toLocaleString()} Lines</span>
          </div>
        </div>
      )}
    </div>
  );
}