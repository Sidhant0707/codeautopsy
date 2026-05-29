"use client";

import React, {
  useMemo,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  useNodesState,
  useEdgesState,
  MarkerType,
  Handle,
  Position,
  type Node,
  type Edge,
} from "reactflow";
import "reactflow/dist/style.css";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
} from "d3-force";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Ghost,
  X,
  RefreshCw,
  Flame,
  ChevronRight,
} from "lucide-react";

// ============================================================================
// ALGORITHMS
// ============================================================================

function detectCircularDependencies(graph: Record<string, string[]>): {
  cycleNodes: Set<string>;
  cycleCount: number;
} {
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const cycleNodes = new Set<string>();
  let cycleCount = 0;

  const dfs = (node: string, path: string[]) => {
    if (inStack.has(node)) {
      const cycleStart = path.indexOf(node);
      if (cycleStart !== -1) {
        cycleCount++;
        for (let i = cycleStart; i < path.length; i++) cycleNodes.add(path[i]);
        cycleNodes.add(node);
      }
      return;
    }
    if (visited.has(node)) return;
    visited.add(node);
    inStack.add(node);
    path.push(node);
    for (const dep of graph[node] || []) dfs(dep, path);
    path.pop();
    inStack.delete(node);
  };

  for (const node of Object.keys(graph)) {
    if (!visited.has(node)) dfs(node, []);
  }

  return { cycleNodes, cycleCount };
}

function computeHeatmapColors(
  fileMetrics: { path: string; size: number }[],
): Map<string, "green" | "yellow" | "red"> {
  const map = new Map<string, "green" | "yellow" | "red">();
  if (!fileMetrics || fileMetrics.length === 0) return map;
  const sizes = fileMetrics.map((f) => f.size).sort((a, b) => a - b);
  const p66 = sizes[Math.floor(sizes.length * 0.66)] ?? 0;
  const p90 = sizes[Math.floor(sizes.length * 0.9)] ?? 0;
  for (const f of fileMetrics) {
    if (f.size >= p90) map.set(f.path, "red");
    else if (f.size >= p66) map.set(f.path, "yellow");
    else map.set(f.path, "green");
  }
  return map;
}

function detectOrphans(graph: Record<string, string[]>): string[] {
  const hasOutbound = new Set<string>(
    Object.keys(graph).filter((k) => (graph[k]?.length ?? 0) > 0),
  );
  const hasInbound = new Set<string>();
  for (const deps of Object.values(graph)) {
    for (const dep of deps) hasInbound.add(dep);
  }
  return Object.keys(graph).filter(
    (f) => !hasOutbound.has(f) && !hasInbound.has(f),
  );
}

// ============================================================================
// ACTIVE MODE TYPE — single source of truth, replaces ad-hoc if/else chain
// ============================================================================
type ActiveMode = "blast" | "circular" | "orphan" | null;

// ============================================================================
// GLASS NODE
// ============================================================================

interface GlassNodeData {
  isBlastRadius: boolean;
  isDimmed: boolean;
  isEntry?: boolean;
  fullPath: string;
  label: string;
  isCircular?: boolean;
  heatmap?: "green" | "yellow" | "red";
  isOrphan?: boolean;
  isOrphanHighlighted?: boolean;
}

const HEATMAP_STYLES: Record<
  "green" | "yellow" | "red",
  { border: string; bg: string; shadow: string; text: string }
> = {
  green: {
    border: "border-emerald-500/40",
    bg: "bg-emerald-500/5",
    shadow: "shadow-[0_0_12px_rgba(16,185,129,0.1)]",
    text: "text-emerald-200",
  },
  yellow: {
    border: "border-amber-500/40",
    bg: "bg-amber-500/5",
    shadow: "shadow-[0_0_12px_rgba(245,158,11,0.1)]",
    text: "text-amber-200",
  },
  red: {
    border: "border-red-500/40",
    bg: "bg-red-500/5",
    shadow: "shadow-[0_0_12px_rgba(239,68,68,0.1)]",
    text: "text-red-200",
  },
};

const GlassNode = ({ data }: { data: GlassNodeData }) => {
  const { isBlastRadius, isDimmed, isCircular, heatmap, isOrphanHighlighted } =
    data;

  let containerClass =
    "px-4 py-2 shadow-xl rounded-xl backdrop-blur-md min-w-[150px] transition-all duration-300 cursor-pointer";
  let textClass = "text-sm font-mono truncate max-w-[200px] transition-colors";
  let handleColor = "!bg-slate-500";

  if (isBlastRadius) {
    containerClass +=
      " bg-red-500/10 border border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.2)]";
    textClass += " text-red-200";
    handleColor = "!bg-red-500";
  } else if (isDimmed) {
    containerClass += " bg-[#141414]/40 border border-white/5 opacity-25";
    textClass += " text-slate-600";
  } else if (isOrphanHighlighted) {
    containerClass +=
      " bg-violet-500/10 border border-violet-400/50 shadow-[0_0_18px_rgba(139,92,246,0.25)]";
    textClass += " text-violet-200";
    handleColor = "!bg-violet-400";
  } else if (isCircular) {
    containerClass +=
      " bg-orange-500/10 border border-orange-500/50 shadow-[0_0_18px_rgba(249,115,22,0.2)]";
    textClass += " text-orange-200";
    handleColor = "!bg-orange-500";
  } else if (heatmap && HEATMAP_STYLES[heatmap]) {
    const s = HEATMAP_STYLES[heatmap];
    containerClass += ` ${s.bg} border ${s.border} ${s.shadow}`;
    textClass += ` ${s.text}`;
  } else {
    containerClass +=
      " bg-[#141414]/90 border border-white/10 hover:border-slate-500";
    textClass += " text-slate-200";
  }

  return (
    <div className={containerClass}>
      <Handle
        type="target"
        position={Position.Top}
        className={`w-2 h-2 border-none transition-colors ${handleColor}`}
      />
      <div className="flex flex-col items-center justify-center">
        {data.isEntry && (
          <div className="text-[8px] uppercase tracking-widest text-amber-500 font-bold mb-1">
            Entry Point
          </div>
        )}
        {data.isOrphan && !isBlastRadius && (
          <div className="text-[8px] uppercase tracking-widest text-violet-400 font-bold mb-1">
            Orphan
          </div>
        )}
        {isCircular && !isBlastRadius && (
          <div className="text-[8px] uppercase tracking-widest text-orange-400 font-bold mb-1">
            Circular
          </div>
        )}
        <div className={textClass} title={data.fullPath}>
          {data.label}
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className={`w-2 h-2 border-none transition-colors ${handleColor}`}
      />
    </div>
  );
};

const nodeTypes = { glass: GlassNode };

// ============================================================================
// D3-FORCE LAYOUT (unchanged from original)
// ============================================================================

interface ForceNode extends Node {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

interface ForceLinkType {
  source: string | ForceNode;
  target: string | ForceNode;
}

function getForceLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  entryPoints: string[],
): { nodes: Node[]; edges: Edge[] } {
  if (!nodes || nodes.length === 0) return { nodes: [], edges: [] };

  const nodeDegree = new Map<string, number>();
  edges.forEach((edge) => {
    nodeDegree.set(edge.source, (nodeDegree.get(edge.source) || 0) + 1);
    nodeDegree.set(edge.target, (nodeDegree.get(edge.target) || 0) + 1);
  });

  const maxDegree = Math.max(...Array.from(nodeDegree.values()), 1);
  const hubNodes = new Set(
    Array.from(nodeDegree.entries())
      .filter(([, degree]) => degree > maxDegree * 0.5)
      .map(([id]) => id),
  );

  const width = 1200;
  const height = 800;
  const centerX = width / 2;
  const centerY = height / 2;

  const forceNodes: ForceNode[] = nodes.map((node, i) => {
    const isHub = hubNodes.has(node.id);
    const isEntry = entryPoints.includes(node.id);
    let x, y;
    if (isHub) {
      const angle = (i / nodes.length) * 2 * Math.PI;
      x = centerX + Math.cos(angle) * 50;
      y = centerY + Math.sin(angle) * 50;
    } else if (isEntry) {
      const angle = (i / nodes.length) * 2 * Math.PI;
      x = centerX + Math.cos(angle) * 200;
      y = centerY + Math.sin(angle) * 200;
    } else {
      const angle = (i / nodes.length) * 2 * Math.PI;
      x = centerX + Math.cos(angle) * 150;
      y = centerY + Math.sin(angle) * 150;
    }
    return { ...node, x, y };
  });

  const forceLinks: ForceLinkType[] = edges.map((edge) => ({
    source: edge.source,
    target: edge.target,
  }));

  const simulation = forceSimulation<ForceNode>(forceNodes)
    .stop()
    .force(
      "link",
      forceLink<ForceNode, ForceLinkType>(forceLinks)
        .id((d) => d.id)
        .distance((d) => {
          const s = nodeDegree.get((d.source as ForceNode).id) || 1;
          const t = nodeDegree.get((d.target as ForceNode).id) || 1;
          return (s + t) / 2 > maxDegree * 0.5 ? 80 : 120;
        })
        .strength(1.2),
    )
    .force(
      "charge",
      forceManyBody<ForceNode>().strength((d) => {
        const degree = nodeDegree.get(d.id) || 1;
        return degree > maxDegree * 0.5 ? -600 : -300;
      }),
    )
    .force("center", forceCenter(centerX, centerY).strength(0.1))
    .force(
      "collision",
      forceCollide<ForceNode>()
        .radius((d) => {
          const degree = nodeDegree.get(d.id) || 1;
          return Math.max(80, Math.min(120, 60 + degree * 3));
        })
        .strength(0.8),
    )
    .force(
      "x",
      forceX<ForceNode>(centerX).strength((d) =>
        (nodeDegree.get(d.id) || 1) > maxDegree * 0.5 ? 0.3 : 0.1,
      ),
    )
    .force(
      "y",
      forceY<ForceNode>(centerY).strength((d) =>
        (nodeDegree.get(d.id) || 1) > maxDegree * 0.5 ? 0.3 : 0.1,
      ),
    )
    .alphaDecay(0.01)
    .velocityDecay(0.4);

  for (let i = 0; i < 500; i++) {
    simulation.tick();
    forceNodes.forEach((node) => {
      const margin = 100;
      node.x = Math.max(margin, Math.min(width - margin, node.x || centerX));
      node.y = Math.max(margin, Math.min(height - margin, node.y || centerY));
    });
  }

  return {
    nodes: forceNodes.map((node) => ({
      ...node,
      position: { x: node.x || 0, y: node.y || 0 },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    })),
    edges,
  };
}

// ============================================================================
// ANALYSIS SIDEBAR
// ============================================================================

interface SidebarProps {
  // graph meta
  nodeCount: number;
  // feature 1
  cycleCount: number;
  cycleNodes: Set<string>;
  // feature 2
  heatmapEnabled: boolean;
  onHeatmapToggle: () => void;
  // feature 3
  orphans: string[];
  selectedOrphan: string | null;
  onOrphanSelect: (path: string | null) => void;
  // shared
  activeMode: ActiveMode;
  onActivateMode: (mode: ActiveMode) => void;
  onClearAll: () => void;
}

function AnalysisSidebar({
  nodeCount,
  cycleCount,
  cycleNodes,
  heatmapEnabled,
  onHeatmapToggle,
  orphans,
  selectedOrphan,
  onOrphanSelect,
  activeMode,
  onActivateMode,
  onClearAll,
}: SidebarProps) {
  const [expanded, setExpanded] = useState(true);
  const [orphanListOpen, setOrphanListOpen] = useState(true);

  const hasCircular = cycleCount > 0;
  const hasOrphans = orphans.length > 0;

  // Icon rail icons for collapsed state
  const RAIL = [
    {
      key: "circular" as const,
      icon: <RefreshCw className="w-3.5 h-3.5" />,
      color: hasCircular ? "text-orange-400" : "text-emerald-400",
      active: activeMode === "circular",
      dot: hasCircular,
      dotColor: "bg-orange-500",
    },
    {
      key: "heatmap" as const,
      icon: <Flame className="w-3.5 h-3.5" />,
      color: heatmapEnabled ? "text-amber-300" : "text-slate-400",
      active: heatmapEnabled,
      dot: false,
      dotColor: "",
    },
    {
      key: "orphan" as const,
      icon: <Ghost className="w-3.5 h-3.5" />,
      color: hasOrphans ? "text-violet-400" : "text-slate-500",
      active: activeMode === "orphan",
      dot: hasOrphans,
      dotColor: "bg-violet-500",
    },
  ];

  return (
    <motion.div
      initial={false}
      animate={{ width: expanded ? 256 : 40 }}
      transition={{ type: "spring", stiffness: 340, damping: 30 }}
      className="h-full flex-shrink-0 relative z-20 flex"
      style={{ overflow: "visible" }}
    >
      {/* ── Collapsed icon rail ── */}
      <AnimatePresence>
        {!expanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="w-10 h-full flex flex-col items-center py-4 gap-1 border-l border-white/5 bg-[#0e0e0e]"
          >
            {/* Expand button */}
            <button
              onClick={() => setExpanded(true)}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/5 text-slate-500 hover:text-slate-300 transition-colors mb-2"
              title="Open analysis panel"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            <div className="w-5 h-px bg-white/5 mb-1" />

            {/* Rail icons */}
            {RAIL.map((item) => (
              <div key={item.key} className="relative">
                <button
                  onClick={() => {
                    setExpanded(true);
                  }}
                  title={item.key}
                  className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
                    item.active
                      ? "bg-white/10 " + item.color
                      : item.color + " hover:bg-white/5"
                  }`}
                >
                  {item.icon}
                </button>
                {item.dot && (
                  <span
                    className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${item.dotColor}`}
                  />
                )}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Expanded sidebar ── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.18 }}
            className="w-64 h-full flex flex-col border-l border-white/5 bg-[#0e0e0e] overflow-hidden"
          >
            {/* Sidebar header */}
            <div className="flex items-center justify-between px-4 h-11 border-b border-white/5 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                  Analysis
                </span>
              </div>
              <div className="flex items-center gap-1">
                {activeMode && (
                  <button
                    onClick={onClearAll}
                    className="text-[9px] font-mono text-slate-600 hover:text-slate-300 transition-colors px-1.5 py-0.5 rounded hover:bg-white/5 uppercase tracking-wider"
                  >
                    Clear
                  </button>
                )}
                <button
                  onClick={() => setExpanded(false)}
                  className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/5 text-slate-600 hover:text-slate-300 transition-colors"
                  title="Collapse panel"
                >
                  <ChevronRight className="w-3 h-3 rotate-180" />
                </button>
              </div>
            </div>

            {/* Graph meta */}
            <div className="px-4 py-3 border-b border-white/[0.04] flex-shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono text-slate-600 uppercase tracking-wider">
                  Nodes
                </span>
                <span className="text-[11px] font-mono font-bold text-slate-400">
                  {nodeCount}
                </span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] font-mono text-slate-600 uppercase tracking-wider">
                  Mode
                </span>
                <span
                  className={`text-[10px] font-mono font-bold uppercase tracking-wider ${
                    activeMode === "blast"
                      ? "text-red-400"
                      : activeMode === "circular"
                        ? "text-orange-400"
                        : activeMode === "orphan"
                          ? "text-violet-400"
                          : "text-slate-600"
                  }`}
                >
                  {activeMode === "blast"
                    ? "Blast Radius"
                    : activeMode === "circular"
                      ? "Circular"
                      : activeMode === "orphan"
                        ? "Orphan"
                        : heatmapEnabled
                          ? "Heatmap"
                          : "Default"}
                </span>
              </div>
            </div>

            {/* Scrollable sections */}
            <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:w-px [&::-webkit-scrollbar-thumb]:bg-white/10">
              {/* ── SECTION 1: Blast radius hint ── */}
              <div className="px-4 py-3 border-b border-white/[0.04]">
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={`w-0.5 h-3 rounded-full flex-shrink-0 ${activeMode === "blast" ? "bg-red-500" : "bg-white/10"}`}
                  />
                  <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">
                    Blast Radius
                  </span>
                </div>
                <p className="text-[10px] font-mono text-slate-600 leading-relaxed pl-3">
                  Click any node on the graph to trace all upstream dependents.
                </p>
                {activeMode === "blast" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="mt-2 pl-3"
                  >
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-red-400">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      Active — click canvas to clear
                    </div>
                  </motion.div>
                )}
              </div>

              {/* ── SECTION 2: Circular Dependencies ── */}
              <div
                className={`border-b border-white/[0.04] transition-colors ${
                  activeMode === "circular" ? "bg-orange-500/[0.03]" : ""
                }`}
              >
                <button
                  onClick={() => {
                    if (!hasCircular) return;
                    onActivateMode(
                      activeMode === "circular" ? null : "circular",
                    );
                  }}
                  className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${
                    hasCircular
                      ? "hover:bg-white/[0.02] cursor-pointer"
                      : "cursor-default"
                  }`}
                >
                  <div
                    className={`w-0.5 h-3 rounded-full flex-shrink-0 transition-colors ${
                      activeMode === "circular"
                        ? "bg-orange-500"
                        : "bg-white/10"
                    }`}
                  />
                  <RefreshCw
                    className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${
                      hasCircular
                        ? activeMode === "circular"
                          ? "text-orange-400"
                          : "text-orange-500/70"
                        : "text-slate-700"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">
                        Circular Deps
                      </span>
                      {hasCircular ? (
                        <span
                          className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded transition-colors ${
                            activeMode === "circular"
                              ? "bg-orange-500/20 text-orange-300 border border-orange-500/30"
                              : "bg-orange-500/10 text-orange-500/80 border border-orange-500/15"
                          }`}
                        >
                          {cycleCount}
                        </span>
                      ) : (
                        <CheckCircle2 className="w-3 h-3 text-emerald-500/60" />
                      )}
                    </div>
                    <p className="text-[10px] font-mono text-slate-600 mt-0.5 truncate">
                      {hasCircular
                        ? activeMode === "circular"
                          ? `${cycleNodes.size} nodes highlighted`
                          : "Click to highlight on graph"
                        : "No circular dependencies"}
                    </p>
                  </div>
                </button>

                {/* Cycle node list — shown when active */}
                <AnimatePresence>
                  {activeMode === "circular" && cycleNodes.size > 0 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-3 space-y-0.5">
                        {Array.from(cycleNodes)
                          .slice(0, 8)
                          .map((n) => (
                            <div
                              key={n}
                              className="flex items-center gap-2 px-2 py-1 rounded"
                            >
                              <div className="w-1 h-1 rounded-full bg-orange-500/60 flex-shrink-0" />
                              <span
                                className="text-[10px] font-mono text-orange-300/70 truncate"
                                title={n}
                              >
                                {n.split("/").pop()}
                              </span>
                            </div>
                          ))}
                        {cycleNodes.size > 8 && (
                          <p className="text-[9px] font-mono text-slate-600 px-2 pt-1">
                            +{cycleNodes.size - 8} more
                          </p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* ── SECTION 3: Complexity Heatmap ── */}
              <div
                className={`border-b border-white/[0.04] transition-colors ${
                  heatmapEnabled ? "bg-amber-500/[0.02]" : ""
                }`}
              >
                <div className="px-4 py-3">
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className={`w-0.5 h-3 rounded-full flex-shrink-0 transition-colors ${
                        heatmapEnabled ? "bg-amber-500" : "bg-white/10"
                      }`}
                    />
                    <Flame
                      className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${
                        heatmapEnabled ? "text-amber-400" : "text-slate-700"
                      }`}
                    />
                    <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest flex-1">
                      Complexity
                    </span>
                    {/* Toggle */}
                    <button
                      onClick={onHeatmapToggle}
                      aria-label={
                        heatmapEnabled
                          ? "Disable complexity heatmap"
                          : "Enable complexity heatmap"
                      }
                      title={
                        heatmapEnabled
                          ? "Disable complexity heatmap"
                          : "Enable complexity heatmap"
                      }
                      className={`relative w-8 h-4 rounded-full transition-colors flex-shrink-0 ${
                        heatmapEnabled ? "bg-amber-500/40" : "bg-white/10"
                      }`}
                    >
                      <motion.div
                        animate={{ x: heatmapEnabled ? 16 : 2 }}
                        transition={{
                          type: "spring",
                          stiffness: 500,
                          damping: 30,
                        }}
                        className={`absolute top-0.5 w-3 h-3 rounded-full transition-colors ${
                          heatmapEnabled ? "bg-amber-400" : "bg-slate-500"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Legend — always visible so user knows what to expect */}
                  <div className="pl-6 space-y-1.5">
                    {(
                      [
                        {
                          color: "bg-emerald-400",
                          label: "Small",
                          sub: "bottom 66%",
                        },
                        {
                          color: "bg-amber-400",
                          label: "Medium",
                          sub: "66–90th pct",
                        },
                        {
                          color: "bg-red-400",
                          label: "Large",
                          sub: "top 10%",
                        },
                      ] as const
                    ).map(({ color, label, sub }) => (
                      <div key={label} className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-sm flex-shrink-0 transition-opacity ${color} ${
                            heatmapEnabled ? "opacity-100" : "opacity-30"
                          }`}
                        />
                        <span
                          className={`text-[10px] font-mono transition-colors ${
                            heatmapEnabled ? "text-slate-400" : "text-slate-600"
                          }`}
                        >
                          {label}
                        </span>
                        <span className="text-[9px] font-mono text-slate-700 ml-auto">
                          {sub}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── SECTION 4: Orphaned Files ── */}
              <div
                className={`transition-colors ${
                  activeMode === "orphan" ? "bg-violet-500/[0.03]" : ""
                }`}
              >
                <button
                  onClick={() => {
                    if (!hasOrphans) return;
                    const next = activeMode === "orphan" ? null : "orphan";
                    onActivateMode(next);
                    if (next === null) onOrphanSelect(null);
                    setOrphanListOpen(true);
                  }}
                  className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors ${
                    hasOrphans
                      ? "hover:bg-white/[0.02] cursor-pointer"
                      : "cursor-default"
                  }`}
                >
                  <div
                    className={`w-0.5 h-3 rounded-full flex-shrink-0 transition-colors ${
                      activeMode === "orphan" ? "bg-violet-500" : "bg-white/10"
                    }`}
                  />
                  <Ghost
                    className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${
                      hasOrphans
                        ? activeMode === "orphan"
                          ? "text-violet-400"
                          : "text-violet-500/70"
                        : "text-slate-700"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">
                        Orphans
                      </span>
                      {hasOrphans ? (
                        <span
                          className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded transition-colors ${
                            activeMode === "orphan"
                              ? "bg-violet-500/20 text-violet-300 border border-violet-500/30"
                              : "bg-violet-500/10 text-violet-500/80 border border-violet-500/15"
                          }`}
                        >
                          {orphans.length}
                        </span>
                      ) : (
                        <CheckCircle2 className="w-3 h-3 text-emerald-500/60" />
                      )}
                    </div>
                    <p className="text-[10px] font-mono text-slate-600 mt-0.5 truncate">
                      {hasOrphans
                        ? activeMode === "orphan"
                          ? "Click a file to highlight"
                          : "Possible dead code"
                        : "No orphaned files"}
                    </p>
                  </div>
                </button>

                {/* Orphan file list */}
                <AnimatePresence>
                  {activeMode === "orphan" && hasOrphans && orphanListOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 space-y-0.5">
                        {orphans.map((path) => {
                          const label = path.split("/").pop() || path;
                          const dir = path.split("/").slice(-2, -1)[0] ?? "";
                          const isSelected = selectedOrphan === path;
                          return (
                            <button
                              key={path}
                              onClick={() =>
                                onOrphanSelect(isSelected ? null : path)
                              }
                              title={path}
                              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all group ${
                                isSelected
                                  ? "bg-violet-500/15 border border-violet-500/20"
                                  : "hover:bg-white/[0.03] border border-transparent"
                              }`}
                            >
                              <div
                                className={`w-1 h-1 rounded-full flex-shrink-0 transition-colors ${
                                  isSelected
                                    ? "bg-violet-400"
                                    : "bg-slate-700 group-hover:bg-slate-500"
                                }`}
                              />
                              <span
                                className={`text-[11px] font-mono truncate transition-colors ${
                                  isSelected
                                    ? "text-violet-200"
                                    : "text-slate-400 group-hover:text-slate-200"
                                }`}
                              >
                                {label}
                              </span>
                              {dir && (
                                <span className="text-[9px] font-mono text-slate-700 ml-auto flex-shrink-0 group-hover:text-slate-600">
                                  {dir}/
                                </span>
                              )}
                            </button>
                          );
                        })}
                        <p className="text-[9px] font-mono text-slate-700 px-2 pt-1.5">
                          No imports · no importers
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Sidebar footer */}
            <div className="px-4 py-2.5 border-t border-white/[0.04] flex-shrink-0">
              <p className="text-[9px] font-mono text-slate-700 uppercase tracking-widest">
                🌀 Force Layout · {nodeCount} nodes
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ArchitectureMap({
  dependencyGraph = {},
  entryPoints = [],
  fileMetrics = [],
}: {
  dependencyGraph: Record<string, string[]>;
  entryPoints: string[];
  fileMetrics?: { path: string; size: number }[];
}) {
  // ── Core state ─────────────────────────────────────────────────────────────
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const previousGraphRef = useRef<string>("");

  // ── Single enum for active highlight mode ──────────────────────────────────
  const [activeMode, setActiveMode] = useState<ActiveMode>(null);

  // ── Feature-specific state ─────────────────────────────────────────────────
  const [heatmapEnabled, setHeatmapEnabled] = useState(false);
  const [selectedOrphan, setSelectedOrphan] = useState<string | null>(null);

  // ── Algorithmic computations ───────────────────────────────────────────────
  const { cycleNodes, cycleCount } = useMemo(
    () => detectCircularDependencies(dependencyGraph),
    [dependencyGraph],
  );

  const heatmapColors = useMemo(
    () => computeHeatmapColors(fileMetrics),
    [fileMetrics],
  );

  const orphans = useMemo(
    () => detectOrphans(dependencyGraph),
    [dependencyGraph],
  );

  // ── Reverse graph for blast radius ─────────────────────────────────────────
  const adjacencyList = useMemo(() => {
    const rev: Record<string, string[]> = {};
    Object.keys(dependencyGraph).forEach((src) => {
      (dependencyGraph[src] || []).forEach((tgt) => {
        if (!rev[tgt]) rev[tgt] = [];
        rev[tgt].push(src);
      });
    });
    return rev;
  }, [dependencyGraph]);

  // ── Build initial nodes/edges (layout only, no feature data) ───────────────
  const { initialNodes, initialEdges, graphHash } = useMemo(() => {
    if (!dependencyGraph || typeof dependencyGraph !== "object")
      return { initialNodes: [], initialEdges: [], graphHash: "" };

    const nodes: Node[] = [];
    const edges: Edge[] = [];

    Object.keys(dependencyGraph).forEach((filePath) => {
      nodes.push({
        id: filePath,
        type: "glass",
        data: {
          label: filePath.split("/").pop() || filePath,
          fullPath: filePath,
          isEntry: entryPoints.includes(filePath),
          isBlastRadius: false,
          isDimmed: false,
          isCircular: false,
          heatmap: undefined,
          isOrphan: false,
          isOrphanHighlighted: false,
        },
        position: { x: 0, y: 0 },
      });
    });

    Object.keys(dependencyGraph).forEach((filePath) => {
      (dependencyGraph[filePath] || []).forEach((depPath) => {
        edges.push({
          id: `e-${filePath}-${depPath}`,
          source: filePath,
          target: depPath,
          animated: true,
          style: { stroke: "#475569", strokeWidth: 2, opacity: 1 },
          markerEnd: { type: MarkerType.ArrowClosed, color: "#475569" },
        });
      });
    });

    const { nodes: layoutNodes, edges: layoutEdges } = getForceLayoutedElements(
      nodes,
      edges,
      entryPoints,
    );

    const graphHash = JSON.stringify({
      graphKeys: Object.keys(dependencyGraph).sort(),
      edgesCount: edges.length,
      entryPoints: entryPoints.sort(),
    });

    return { initialNodes: layoutNodes, initialEdges: layoutEdges, graphHash };
  }, [dependencyGraph, entryPoints]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Guard: only re-layout when the graph actually changes
  useEffect(() => {
    if (previousGraphRef.current !== graphHash) {
      setNodes(initialNodes);
      setEdges(initialEdges);
      previousGraphRef.current = graphHash;
    }
  }, [initialNodes, initialEdges, graphHash, setNodes, setEdges]);

  // ── Apply feature overlay data (does NOT re-run layout) ───────────────────
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          isCircular: cycleNodes.has(n.id),
          heatmap: heatmapEnabled
            ? (heatmapColors.get(n.id) ?? "green")
            : undefined,
          isOrphan: orphans.includes(n.id),
        },
      })),
    );
  }, [cycleNodes, heatmapColors, heatmapEnabled, orphans, setNodes]);

  // ── Master highlight effect — driven by activeMode enum ───────────────────
  useEffect(() => {
    // Default: clear everything
    if (!activeMode && !selectedNode) {
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: {
            ...n.data,
            isBlastRadius: false,
            isDimmed: false,
            isOrphanHighlighted: false,
          },
        })),
      );
      setEdges((eds) =>
        eds.map((e) => ({
          ...e,
          style: { stroke: "#475569", strokeWidth: 2, opacity: 1 },
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed, color: "#475569" },
        })),
      );
      return;
    }

    // ORPHAN mode
    if (activeMode === "orphan") {
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: {
            ...n.data,
            isBlastRadius: false,
            isDimmed: selectedOrphan ? n.id !== selectedOrphan : false,
            isOrphanHighlighted: selectedOrphan
              ? n.id === selectedOrphan
              : false,
          },
        })),
      );
      setEdges((eds) =>
        eds.map((e) => ({
          ...e,
          style: {
            stroke: "#475569",
            strokeWidth: 2,
            opacity: selectedOrphan ? 0.1 : 0.5,
          },
          animated: false,
          markerEnd: { type: MarkerType.ArrowClosed, color: "#475569" },
        })),
      );
      return;
    }

    // CIRCULAR mode
    if (activeMode === "circular") {
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: {
            ...n.data,
            isBlastRadius: false,
            isDimmed: !cycleNodes.has(n.id),
            isOrphanHighlighted: false,
          },
        })),
      );
      setEdges((eds) =>
        eds.map((e) => {
          const isCycleEdge =
            cycleNodes.has(e.source) && cycleNodes.has(e.target);
          return {
            ...e,
            style: {
              stroke: isCycleEdge ? "#f97316" : "#475569",
              strokeWidth: isCycleEdge ? 3 : 2,
              opacity: isCycleEdge ? 1 : 0.08,
            },
            animated: isCycleEdge,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: isCycleEdge ? "#f97316" : "#475569",
            },
          };
        }),
      );
      return;
    }

    // BLAST mode (existing logic unchanged)
    if (activeMode === "blast" && selectedNode) {
      const blastNodes = new Set<string>();
      const blastEdges = new Set<string>();
      const queue = [selectedNode];
      blastNodes.add(selectedNode);
      while (queue.length > 0) {
        const cur = queue.shift()!;
        (adjacencyList[cur] || []).forEach((dep) => {
          blastEdges.add(`e-${dep}-${cur}`);
          if (!blastNodes.has(dep)) {
            blastNodes.add(dep);
            queue.push(dep);
          }
        });
      }
      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          data: {
            ...n.data,
            isBlastRadius: blastNodes.has(n.id),
            isDimmed: !blastNodes.has(n.id),
            isOrphanHighlighted: false,
          },
        })),
      );
      setEdges((eds) =>
        eds.map((e) => {
          const hit = blastEdges.has(e.id);
          return {
            ...e,
            style: {
              stroke: hit ? "#ef4444" : "#475569",
              strokeWidth: hit ? 3 : 2,
              opacity: hit ? 1 : 0.15,
            },
            animated: hit,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: hit ? "#ef4444" : "#475569",
            },
          };
        }),
      );
    }
  }, [
    activeMode,
    selectedNode,
    cycleNodes,
    selectedOrphan,
    adjacencyList,
    setNodes,
    setEdges,
  ]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedOrphan(null);
    setSelectedNode(node.id);
    setActiveMode("blast");
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedOrphan(null);
    setActiveMode(null);
  }, []);

  const handleActivateMode = useCallback((mode: ActiveMode) => {
    setActiveMode(mode);
    if (mode !== "blast") setSelectedNode(null);
    if (mode !== "orphan") setSelectedOrphan(null);
  }, []);

  const handleOrphanSelect = useCallback((path: string | null) => {
    setSelectedOrphan(path);
  }, []);

  const handleClearAll = useCallback(() => {
    setActiveMode(null);
    setSelectedNode(null);
    setSelectedOrphan(null);
  }, []);

  const handleHeatmapToggle = useCallback(() => {
    setHeatmapEnabled((v) => !v);
  }, []);

  // ── Empty state ────────────────────────────────────────────────────────────
  if (nodes.length === 0) {
    return (
      <div className="w-full h-full min-h-[500px] flex items-center justify-center rounded-2xl border border-white/5 bg-black/40">
        <p className="text-slate-500 font-mono text-sm">
          No dependency graph data available.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[500px] flex rounded-2xl overflow-hidden border border-white/5 bg-black/40">
      {/* ── Graph canvas (fills all available space) ── */}
      <div className="flex-1 relative min-w-0">
        {/* Top-left: minimal graph label only — analysis moved to sidebar */}
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-1.5 pointer-events-none">
          <h3 className="text-[10px] font-bold text-slate-400 font-mono tracking-widest uppercase bg-black/50 px-2.5 py-1 rounded-md backdrop-blur-md border border-white/10 w-fit">
            Interactive Architecture Map
          </h3>
          <div className="text-[10px] font-mono text-slate-500 bg-black/40 px-2 py-1 rounded w-fit border border-white/5 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            Click nodes to view Blast Radius
          </div>
        </div>

        {/* Active mode pill — floats top-center, always dismissible */}
        <AnimatePresence>
          {activeMode && (
            <motion.button
              key="mode-pill"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              onClick={handleClearAll}
              className={`absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 px-3 py-1.5 rounded-full border backdrop-blur-md text-[10px] font-mono font-bold uppercase tracking-widest transition-all ${
                activeMode === "blast"
                  ? "bg-red-500/10 border-red-500/25 text-red-400"
                  : activeMode === "circular"
                    ? "bg-orange-500/10 border-orange-500/25 text-orange-400"
                    : "bg-violet-500/10 border-violet-500/25 text-violet-400"
              }`}
            >
              <span>
                {activeMode === "blast"
                  ? "Blast radius active"
                  : activeMode === "circular"
                    ? "Circular deps highlighted"
                    : selectedOrphan
                      ? `Orphan: ${selectedOrphan.split("/").pop()}`
                      : "Orphan mode — select a file"}
              </span>
              <X className="w-3 h-3 opacity-60" />
            </motion.button>
          )}
        </AnimatePresence>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          nodeTypes={nodeTypes}
          fitView
          nodeOrigin={[0.5, 0.5]}
          fitViewOptions={{
            padding: 0.2,
            includeHiddenNodes: false,
            minZoom: 0.5,
            maxZoom: 1.5,
          }}
          className="bg-[#0e0e0e]"
          minZoom={0.3}
          maxZoom={2}
        >
          <Background
            variant={BackgroundVariant.Lines}
            color="#ffffff"
            gap={32}
            size={1}
            className="opacity-[0.03]"
          />
          <Controls
            className="!bg-[#141414] !rounded-lg overflow-hidden shadow-[0_0_20px_rgba(0,0,0,0.5)] border border-white/10 [&>button]:!bg-[#141414] [&>button]:!border-b-white/10 [&>button]:!fill-slate-400 hover:[&>button]:!bg-white/5 hover:[&>button]:!fill-white transition-colors"
            showInteractive={false}
          />
        </ReactFlow>
      </div>

      {/* ── Analysis sidebar (right, collapsible) ── */}
      <AnalysisSidebar
        nodeCount={nodes.length}
        cycleCount={cycleCount}
        cycleNodes={cycleNodes}
        heatmapEnabled={heatmapEnabled}
        onHeatmapToggle={handleHeatmapToggle}
        orphans={orphans}
        selectedOrphan={selectedOrphan}
        onOrphanSelect={handleOrphanSelect}
        activeMode={activeMode}
        onActivateMode={handleActivateMode}
        onClearAll={handleClearAll}
      />
    </div>
  );
}
