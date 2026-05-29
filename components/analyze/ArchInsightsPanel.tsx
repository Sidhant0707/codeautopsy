// components/analyze/ArchInsightsPanel.tsx
"use client";

import { useMemo, useState, memo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert,
  TrendingUp,
  Ghost,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { RepoData } from "@/lib/types/analyze";
import { computeArticulationPoints } from "@/lib/algorithms/articulationPoints";
import { computeStability } from "@/lib/algorithms/stability";
import { computeDeadCode } from "@/lib/algorithms/deadCode";
import InfoTooltip from "@/components/InfoTooltip";

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_BRIDGES_SHOWN = 8;
const MAX_FILES_SHOWN = 30;

const TAB_CONTENT_TRANSITION = { duration: 0.15 };

// ─── Sub-tab config ───────────────────────────────────────────────────────────

const SUB_TABS = [
  {
    id: "ap" as const,
    icon: ShieldAlert,
    label: "Critical Files",
    accentColor: "#ef4444",
    color: "text-red-400",
    activeText: "text-red-300",
    activeBg: "bg-red-500/10",
    activeBorder: "border-red-500/30",
    tooltip:
      "Files that if removed would split the codebase into disconnected pieces.",
  },
  {
    id: "stability" as const,
    icon: TrendingUp,
    label: "Stability",
    accentColor: "#3b82f6",
    color: "text-blue-400",
    activeText: "text-blue-300",
    activeBg: "bg-blue-500/10",
    activeBorder: "border-blue-500/30",
    tooltip:
      "How stable each file is based on how many files import it vs how many it imports.",
  },
  {
    id: "dead" as const,
    icon: Ghost,
    label: "Dead Code",
    accentColor: "#8b5cf6",
    color: "text-violet-400",
    activeText: "text-violet-300",
    activeBg: "bg-violet-500/10",
    activeBorder: "border-violet-500/30",
    tooltip:
      "Files that can never be reached from your entry points at runtime.",
  },
] as const;

type SubTabId = (typeof SUB_TABS)[number]["id"];

const SUB_TAB_MAP = new Map(SUB_TABS.map((t) => [t.id, t]));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fileName(path: string) {
  return path.split("/").pop() ?? path;
}

function dirName(path: string) {
  const idx = path.lastIndexOf("/");
  return idx > -1 ? path.slice(0, idx) : "";
}

// Severity is rank-based: top file = critical, second = high, rest = medium.
// This ensures visual differentiation even in small repos where absolute
// disconnect counts are all small numbers.
type Severity = "critical" | "high" | "medium";

function getSeverityByRank(index: number): Severity {
  if (index === 0) return "critical";
  if (index === 1) return "high";
  return "medium";
}

const SEVERITY_STYLES: Record<
  Severity,
  { border: string; dot: string; text: string; badge: string }
> = {
  critical: {
    border: "border-red-500/25 bg-red-500/[0.06]",
    dot: "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]",
    text: "text-red-300",
    badge: "bg-red-500/15 text-red-400 border-red-500/25",
  },
  high: {
    border: "border-orange-500/25 bg-orange-500/[0.06]",
    dot: "bg-orange-400 shadow-[0_0_6px_rgba(251,146,60,0.7)]",
    text: "text-orange-300",
    badge: "bg-orange-500/15 text-orange-400 border-orange-500/25",
  },
  medium: {
    border: "border-yellow-500/20 bg-yellow-500/[0.04]",
    dot: "bg-yellow-500",
    text: "text-yellow-200",
    badge: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  },
};

const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "CRITICAL",
  high: "HIGH",
  medium: "MEDIUM",
};

type ZoneTag = { label: string; style: string } | null;

function getZoneTag(zone: string | undefined): ZoneTag {
  if (zone === "pain")
    return {
      label: "PAIN",
      style: "bg-red-500/15 text-red-400 border-red-500/25",
    };
  if (zone === "uselessness")
    return {
      label: "UNUSED",
      style: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
    };
  return null;
}

// ─── Shared empty-state ───────────────────────────────────────────────────────

function AllClear({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <CheckCircle2 className="w-10 h-10 text-emerald-500/60" />
      <p className="text-slate-300 font-mono text-sm font-bold">{title}</p>
      <p className="text-slate-600 font-mono text-xs max-w-xs">{description}</p>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  valueColor,
  sub,
  borderColor,
  bgColor,
}: {
  label: string;
  value: string | number;
  valueColor: string;
  sub: string;
  borderColor: string;
  bgColor: string;
}) {
  return (
    <div className={`p-3 rounded-xl border ${borderColor} ${bgColor}`}>
      <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">
        {label}
      </p>
      <p className={`text-2xl font-bold font-mono ${valueColor}`}>{value}</p>
      <p className="text-[9px] font-mono text-slate-600 mt-0.5">{sub}</p>
    </div>
  );
}

// ─── Articulation Points Tab ──────────────────────────────────────────────────

function APTab({ data }: { data: RepoData }) {
  const result = useMemo(
    () => computeArticulationPoints(data.dependencyGraph ?? {}),
    [data.dependencyGraph],
  );

  const sorted = useMemo(
    () =>
      Array.from(result.articulationPoints).sort(
        (a, b) =>
          (result.componentSizes.get(b) ?? 0) -
          (result.componentSizes.get(a) ?? 0),
      ),
    [result],
  );

  if (sorted.length === 0) {
    return (
      <AllClear
        title="No Articulation Points"
        description="Your dependency graph has no single file whose removal would disconnect the codebase."
      />
    );
  }

  const topDisconnects = result.componentSizes.get(sorted[0]) ?? 0;
  const visibleBridges = result.bridges.slice(0, MAX_BRIDGES_SHOWN);
  const extraBridges = result.bridges.length - MAX_BRIDGES_SHOWN;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Critical Files"
          value={sorted.length}
          valueColor="text-red-400"
          sub={
            sorted.length === 1
              ? "single point of failure"
              : "single points of failure"
          }
          borderColor="border-red-500/20"
          bgColor="bg-red-500/[0.05]"
        />
        <StatCard
          label="Bridges"
          value={result.bridges.length}
          valueColor="text-orange-400"
          sub={
            result.bridges.length > 0
              ? "fragile dependency edges"
              : "no fragile edges"
          }
          borderColor="border-orange-500/20"
          bgColor="bg-orange-500/[0.05]"
        />
      </div>

      {/* Risk callout if top file is severe */}
      {topDisconnects >= 3 && (
        <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl border border-red-500/20 bg-red-500/[0.04]">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] font-mono text-red-300/80 leading-relaxed">
            <span className="font-bold text-red-300">
              {fileName(sorted[0])}
            </span>{" "}
            is your highest-risk file — removing it would disconnect{" "}
            {topDisconnects} parts of your codebase.
          </p>
        </div>
      )}

      {/* File list */}
      <div className="space-y-2">
        <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest px-1">
          Files — sorted by impact
        </p>
        {sorted.map((ap, idx) => {
          const disconnects = result.componentSizes.get(ap) ?? 0;
          const severity = getSeverityByRank(idx);
          const { border, dot, text, badge } = SEVERITY_STYLES[severity];

          return (
            <div
              key={ap}
              className={`px-3 py-2.5 rounded-xl border ${border} flex items-center gap-3`}
            >
              {/* Glowing dot */}
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p
                    className={`text-sm font-mono font-bold truncate ${text}`}
                    title={ap}
                  >
                    {fileName(ap)}
                  </p>
                  <span
                    className={`flex-shrink-0 text-[8px] font-mono font-black px-1.5 py-0.5 rounded border uppercase tracking-widest ${badge}`}
                  >
                    {SEVERITY_LABEL[severity]}
                  </span>
                </div>
                <p className="text-[10px] font-mono text-slate-600 truncate mt-0.5">
                  {dirName(ap)}
                </p>
              </div>

              <div className="flex-shrink-0 text-right">
                <p
                  className={`text-sm font-mono font-bold tabular-nums ${text}`}
                >
                  {disconnects}
                </p>
                <p className="text-[9px] font-mono text-slate-600">
                  {disconnects === 1 ? "component" : "components"}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bridges section */}
      {result.bridges.length > 0 && (
        <div className="space-y-2 pt-1">
          <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest px-1">
            Dependency Bridges
          </p>
          <div className="rounded-xl border border-white/5 overflow-hidden divide-y divide-white/[0.04]">
            {visibleBridges.map(([a, b]) => (
              <div
                key={`${a}→${b}`}
                className="flex items-center gap-3 px-3 py-2 bg-white/[0.01] hover:bg-white/[0.03] transition-colors"
              >
                <span
                  className="text-[11px] font-mono text-slate-400 truncate flex-1"
                  title={a}
                >
                  {fileName(a)}
                </span>
                <span className="text-slate-700 text-[10px] font-mono flex-shrink-0">
                  ──→
                </span>
                <span
                  className="text-[11px] font-mono text-slate-400 truncate flex-1 text-right"
                  title={b}
                >
                  {fileName(b)}
                </span>
              </div>
            ))}
          </div>
          {extraBridges > 0 && (
            <p className="text-[10px] font-mono text-slate-600 px-1">
              +{extraBridges} more bridges
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Scatter Plot ─────────────────────────────────────────────────────────────

const ScatterPlot = memo(function ScatterPlot({
  files,
}: {
  files: ReturnType<typeof computeStability>["files"];
}) {
  const W = 320;
  const H = 160;
  const PAD = 24;
  const innerW = W - PAD * 2;
  const innerH = H - PAD * 2;

  const maxCa = useMemo(
    () => Math.max(...files.map((f) => f.afferent), 1),
    [files],
  );

  const dots = useMemo(
    () =>
      files.map((f) => ({
        cx: PAD + f.instability * innerW,
        cy: H - PAD - (f.afferent / maxCa) * innerH,
        fill:
          f.zone === "pain"
            ? "#ef4444"
            : f.zone === "uselessness"
              ? "#eab308"
              : f.instability > 0.5
                ? "#f97316"
                : "#22d3ee",
        label: fileName(f.path),
        instability: f.instability,
        ca: f.afferent,
      })),
    [files, maxCa, innerW, innerH],
  );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-40">
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((v) => (
        <line
          key={v}
          x1={PAD + v * innerW}
          y1={PAD}
          x2={PAD + v * innerW}
          y2={H - PAD}
          stroke="#ffffff"
          strokeOpacity={0.04}
          strokeWidth={1}
        />
      ))}

      {/* Zone of Pain — edge marker only */}
      <rect
        x={PAD}
        y={PAD}
        width={innerW * 0.15}
        height={innerH}
        fill="#ef4444"
        fillOpacity={0.03}
        rx={2}
      />
      <line
        x1={PAD}
        y1={PAD}
        x2={PAD + innerW * 0.15}
        y2={PAD}
        stroke="#ef4444"
        strokeOpacity={0.3}
        strokeWidth={1.5}
      />
      <text
        x={PAD + 3}
        y={PAD + 10}
        fill="#ef4444"
        fillOpacity={0.4}
        fontSize={7}
        fontFamily="monospace"
      >
        pain
      </text>

      {/* Zone of Uselessness — edge marker only */}
      <rect
        x={PAD + innerW * 0.85}
        y={PAD}
        width={innerW * 0.12}
        height={innerH}
        fill="#eab308"
        fillOpacity={0.03}
        rx={2}
      />
      <line
        x1={PAD + innerW * 0.85}
        y1={PAD}
        x2={W - PAD}
        y2={PAD}
        stroke="#eab308"
        strokeOpacity={0.3}
        strokeWidth={1.5}
      />
      <text
        x={PAD + innerW * 0.85 + 3}
        y={PAD + 10}
        fill="#eab308"
        fillOpacity={0.4}
        fontSize={7}
        fontFamily="monospace"
      >
        unused
      </text>

      {/* Axis labels */}
      <text
        x={PAD}
        y={H - 4}
        fill="#475569"
        fontSize={8}
        fontFamily="monospace"
      >
        Stable
      </text>
      <text
        x={W - PAD - 28}
        y={H - 4}
        fill="#475569"
        fontSize={8}
        fontFamily="monospace"
      >
        Unstable
      </text>
      <text
        x={2}
        y={PAD + 8}
        fill="#475569"
        fontSize={8}
        fontFamily="monospace"
      >
        Ca↑
      </text>

      {/* Dots */}
      {dots.map((d, i) => (
        <circle
          key={i}
          cx={d.cx}
          cy={d.cy}
          r={3}
          fill={d.fill}
          fillOpacity={0.85}
        >
          <title>
            {d.label} — I:{Math.round(d.instability * 100)}% Ca:{d.ca}
          </title>
        </circle>
      ))}
    </svg>
  );
});

// ─── Stability Tab ────────────────────────────────────────────────────────────

type StabilityFilter = "all" | "pain" | "uselessness" | "unstable";

function StabilityTab({ data }: { data: RepoData }) {
  const result = useMemo(
    () => computeStability(data.dependencyGraph ?? {}),
    [data.dependencyGraph],
  );
  const [filter, setFilter] = useState<StabilityFilter>("all");

  const toggleFilter = useCallback(
    (value: Exclude<StabilityFilter, "all">) =>
      setFilter((prev) => (prev === value ? "all" : value)),
    [],
  );

  const { sortedFiles, painCount, uselessCount, unstableCount } =
    useMemo(() => {
      const sorted = [...result.files].sort(
        (a, b) => b.instability - a.instability,
      );
      return {
        sortedFiles: sorted,
        painCount: sorted.filter((f) => f.zone === "pain").length,
        uselessCount: sorted.filter((f) => f.zone === "uselessness").length,
        unstableCount: sorted.filter((f) => f.instability > 0.7).length,
      };
    }, [result.files]);

  const filtered = useMemo(() => {
    if (filter === "pain") return sortedFiles.filter((f) => f.zone === "pain");
    if (filter === "uselessness")
      return sortedFiles.filter((f) => f.zone === "uselessness");
    if (filter === "unstable")
      return sortedFiles.filter((f) => f.instability > 0.7);
    return sortedFiles;
  }, [sortedFiles, filter]);

  // Entry points never need an UNUSED badge — they have Ca:0 by definition
  // (nothing imports the root), but that's expected, not a smell.
  const entryPointSet = useMemo(
    () => new Set(data.entryPoints),
    [data.entryPoints],
  );

  if (result.files.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-slate-500 font-mono text-sm">
        No dependency data available.
      </div>
    );
  }

  const visibleFiles = filtered.slice(0, MAX_FILES_SHOWN);
  const extraFiles = filtered.length - MAX_FILES_SHOWN;

  return (
    <div className="space-y-4">
      {/* Scatter plot */}
      <div className="p-3 rounded-xl border border-white/8 bg-black/20">
        <div className="flex items-center gap-2 mb-3">
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
            Instability Distribution
          </p>
          <InfoTooltip
            content="Each dot is a file. X = instability (0 = stable, 1 = unstable). Y = how many files import it."
            side="right"
          />
        </div>
        <ScatterPlot files={result.files} />
        {/* Legend */}
        <div className="flex gap-3 mt-2 flex-wrap">
          {[
            { color: "#ef4444", label: "Zone of Pain" },
            { color: "#f97316", label: "Unstable" },
            { color: "#22d3ee", label: "Healthy" },
            { color: "#eab308", label: "Unused" },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: color }}
              />
              <span className="text-[9px] font-mono text-slate-600">
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Filter buttons */}
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            {
              key: "pain" as const,
              label: "Zone of Pain",
              count: painCount,
              countColor: "text-red-400",
              sub: "rigid & hard to change",
              activeBorder: "border-red-500/30",
              activeBg: "bg-red-500/8",
            },
            {
              key: "uselessness" as const,
              label: "Uselessness",
              count: uselessCount,
              countColor: "text-yellow-400",
              sub: "nobody imports them",
              activeBorder: "border-yellow-500/30",
              activeBg: "bg-yellow-500/8",
            },
            {
              key: "unstable" as const,
              label: "Unstable",
              count: unstableCount,
              countColor: "text-orange-400",
              sub: "instability > 70%",
              activeBorder: "border-orange-500/30",
              activeBg: "bg-orange-500/8",
            },
          ] as const
        ).map(
          ({ key, label, count, countColor, sub, activeBorder, activeBg }) => (
            <button
              key={key}
              onClick={() => toggleFilter(key)}
              className={`p-3 rounded-xl border text-left transition-all ${
                filter === key
                  ? `${activeBorder} ${activeBg}`
                  : "border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.03]"
              }`}
            >
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1">
                {label}
              </p>
              <p
                className={`text-xl font-bold font-mono tabular-nums ${countColor}`}
              >
                {count}
              </p>
              <p className="text-[9px] font-mono text-slate-600 mt-0.5 leading-relaxed">
                {sub}
              </p>
            </button>
          ),
        )}
      </div>

      {/* File list */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest px-1">
          {filter === "all"
            ? `All ${sortedFiles.length} files — sorted by instability`
            : `${filtered.length} files — filtered: ${filter}`}
        </p>
        {visibleFiles.map((f) => {
          const instPct = Math.round(f.instability * 100);
          const barColor =
            f.instability > 0.7
              ? "bg-red-500"
              : f.instability > 0.4
                ? "bg-orange-400"
                : "bg-emerald-500";

          // Suppress UNUSED badge for entry points — Ca:0 is expected for
          // roots, not a sign of uselessness.
          const zoneTag = entryPointSet.has(f.path) ? null : getZoneTag(f.zone);

          return (
            <div
              key={f.path}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-white/5 bg-white/[0.015] hover:border-white/10 hover:bg-white/[0.03] transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className="text-[11px] font-mono text-slate-300 truncate"
                    title={f.path}
                  >
                    {fileName(f.path)}
                  </span>
                  {zoneTag && (
                    <span
                      className={`flex-shrink-0 text-[8px] font-mono font-black px-1.5 py-0.5 rounded border uppercase tracking-widest ${zoneTag.style}`}
                    >
                      {zoneTag.label}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="flex-1 h-1 rounded-full bg-white/5"
                    style={{ "--inst": `${instPct}%` } as React.CSSProperties}
                  >
                    <div
                      className={`h-1 rounded-full transition-all [width:var(--inst)] ${barColor}`}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-slate-500 w-8 text-right flex-shrink-0 tabular-nums">
                    {instPct}%
                  </span>
                </div>
              </div>
              <div className="flex-shrink-0 text-right hidden sm:block">
                <p className="text-[9px] font-mono text-slate-600 tabular-nums">
                  Ca:{f.afferent} Ce:{f.efferent}
                </p>
              </div>
            </div>
          );
        })}
        {extraFiles > 0 && (
          <p className="text-[10px] font-mono text-slate-600 px-1 pt-1">
            +{extraFiles} more files
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Dead Code Tab ────────────────────────────────────────────────────────────

function DeadCodeTab({ data }: { data: RepoData }) {
  const result = useMemo(
    () => computeDeadCode(data.dependencyGraph ?? {}, data.entryPoints),
    [data.dependencyGraph, data.entryPoints],
  );

  const dirs = useMemo(
    () => Object.entries(result.unreachableByDirectory),
    [result.unreachableByDirectory],
  );
  const [openDir, setOpenDir] = useState<string | null>(
    () => dirs[0]?.[0] ?? null,
  );

  const toggleDir = useCallback(
    (dir: string) => setOpenDir((prev) => (prev === dir ? null : dir)),
    [],
  );

  if (result.unreachable.length === 0) {
    return (
      <AllClear
        title="100% Reachable"
        description="Every file in the graph is reachable from your entry points. No dead code detected."
      />
    );
  }

  const deadPct = 100 - Math.round(result.reachabilityScore);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <StatCard
          label="Reachable"
          value={result.reachable.size}
          valueColor="text-emerald-400"
          sub="from entry points"
          borderColor="border-emerald-500/20"
          bgColor="bg-emerald-500/[0.05]"
        />
        <StatCard
          label="Dead Files"
          value={result.unreachable.length}
          valueColor="text-violet-400"
          sub="never executed"
          borderColor="border-violet-500/20"
          bgColor="bg-violet-500/[0.05]"
        />
        <StatCard
          label="Coverage"
          value={`${Math.round(result.reachabilityScore)}%`}
          valueColor={
            result.reachabilityScore > 80
              ? "text-emerald-400"
              : result.reachabilityScore > 60
                ? "text-yellow-400"
                : "text-red-400"
          }
          sub={deadPct > 0 ? `${deadPct}% unreachable` : "fully covered"}
          borderColor="border-white/8"
          bgColor="bg-white/[0.02]"
        />
      </div>

      {/* Reachability bar */}
      <div>
        <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${result.reachabilityScore}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="h-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500"
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[9px] font-mono text-emerald-500/70 tabular-nums">
            {result.reachable.size} reachable
          </span>
          <span className="text-[9px] font-mono text-violet-400/70 tabular-nums">
            {result.unreachable.length} dead
          </span>
        </div>
      </div>

      {/* Entry points */}
      <div className="p-3 rounded-xl border border-white/5 bg-white/[0.015]">
        <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">
          Entry Points Traced
        </p>
        <div className="flex flex-wrap gap-1.5">
          {data.entryPoints.map((ep) => (
            <span
              key={ep}
              className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-cyan-400"
            >
              {fileName(ep)}
            </span>
          ))}
        </div>
      </div>

      {/* Dead files by directory */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-mono text-slate-600 uppercase tracking-widest px-1">
          Unreachable files by directory
        </p>
        {dirs.map(([dir, files]) => (
          <div
            key={dir}
            className="rounded-xl border border-white/5 bg-white/[0.015] overflow-hidden"
          >
            <button
              onClick={() => toggleDir(dir)}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/[0.03] transition-colors text-left"
            >
              {openDir === dir ? (
                <ChevronDown className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
              )}
              <span className="text-[11px] font-mono text-slate-400 flex-1 truncate">
                {dir || "(root)"}
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-400 border border-violet-500/20 flex-shrink-0 tabular-nums">
                {files.length}
              </span>
            </button>
            <AnimatePresence>
              {openDir === dir && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={TAB_CONTENT_TRANSITION}
                  className="overflow-hidden"
                >
                  <div className="px-3 pb-3 space-y-1 border-t border-white/5">
                    {files.map((f) => (
                      <div
                        key={f}
                        className="flex items-center gap-2 py-1.5 pl-6"
                      >
                        <div className="w-1 h-1 rounded-full bg-violet-500/50 flex-shrink-0" />
                        <span
                          className="text-[11px] font-mono text-slate-500 truncate"
                          title={f}
                        >
                          {fileName(f)}
                        </span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export default function ArchInsightsPanel({ data }: { data: RepoData }) {
  const [activeTab, setActiveTab] = useState<SubTabId>("ap");
  const current = SUB_TAB_MAP.get(activeTab)!;

  return (
    <motion.div
      key="arch_insights"
      role="tabpanel"
      id="tabpanel-arch_insights"
      aria-labelledby="tab-arch_insights"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ type: "spring", stiffness: 380, damping: 30, mass: 0.8 }}
      className="absolute inset-0 p-4 sm:p-6 overflow-y-auto [&::-webkit-scrollbar]:w-px [&::-webkit-scrollbar-thumb]:bg-white/10"
    >
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div>
          <h2 className="text-sm font-bold text-slate-200 font-mono tracking-widest uppercase">
            Architecture Insights
          </h2>
          <p className="text-[11px] font-mono text-slate-500 mt-0.5">
            Pure graph algorithms — no AI, no guessing.
          </p>
        </div>

        {/* Sub-tab strip */}
        <div className="flex gap-1 p-1 rounded-xl border border-white/8 bg-black/30 w-full">
          {SUB_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex-1 flex items-center justify-center gap-1.5 py-2 px-2 sm:px-3 rounded-lg text-[10px] font-mono font-bold uppercase tracking-widest transition-all duration-150 ${
                  isActive
                    ? `${tab.activeBg} ${tab.activeBorder} border ${tab.activeText}`
                    : "text-slate-500 hover:text-slate-300 hover:bg-white/5 border border-transparent"
                }`}
              >
                {/* Active indicator line */}
                {isActive && (
                  <span
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-[2px] rounded-full"
                    style={{ background: tab.accentColor }}
                  />
                )}
                <tab.icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden pointer-events-none" aria-hidden>
                  <InfoTooltip content={tab.tooltip} side="bottom" />
                </span>
              </button>
            );
          })}
        </div>

        {/* Active tab label */}
        <div className="flex items-center gap-2 px-1">
          <current.icon className={`w-4 h-4 ${current.color}`} />
          <span
            className={`text-xs font-mono font-bold uppercase tracking-widest ${current.color}`}
          >
            {current.label}
          </span>
          <InfoTooltip content={current.tooltip} side="right" />
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={TAB_CONTENT_TRANSITION}
          >
            {activeTab === "ap" && <APTab data={data} />}
            {activeTab === "stability" && <StabilityTab data={data} />}
            {activeTab === "dead" && <DeadCodeTab data={data} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
