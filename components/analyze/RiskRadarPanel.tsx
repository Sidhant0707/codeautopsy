"use client";

import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { RepoData } from "@/lib/types/analyze";
import SkeletonLoader from "@/components/analyze/SkeletonLoader";
import {
  computeArticulationPoints,
  getRankedArticulationPoints,
} from "@/lib/algorithms/articulationPoints";
import { useMemo } from "react";

const RiskDashboard = dynamic(() => import("@/components/RiskDashboard"), {
  loading: () => <SkeletonLoader />,
  ssr: false,
});

interface RiskRadarPanelProps {
  data: RepoData;
  isPro: boolean;
}

export default function RiskRadarPanel({ data, isPro }: RiskRadarPanelProps) {
  const apResult = useMemo(
    () =>
      data.dependencyGraph
        ? computeArticulationPoints(data.dependencyGraph)
        : {
            articulationPoints: new Set<string>(),
            bridges: [] as Array<[string, string]>,
            componentSizes: new Map<string, number>(),
          },
    [data.dependencyGraph],
  );

  const rankedAPs = useMemo(
    () => getRankedArticulationPoints(apResult),
    [apResult],
  );

  const hasAPs = rankedAPs.length > 0;
  const hasBridges = apResult.bridges.length > 0;

  return (
    <motion.div
      key="risk_radar"
      role="tabpanel"
      id="tabpanel-risk_radar"
      aria-labelledby="tab-risk_radar"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ type: "spring", stiffness: 380, damping: 30, mass: 0.8 }}
      className="absolute inset-0 p-4 sm:p-6 overflow-y-auto custom-scrollbar"
    >
      <div className="space-y-6">
        {/* ── Fragile Points Panel ── */}
        {data.dependencyGraph && (
          <div className="rounded-xl border border-white/[0.06] bg-[#0e0e0e] overflow-hidden">
            <div className="px-5 py-4 border-b border-white/[0.04] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span className="text-[11px] font-mono font-bold text-slate-400 uppercase tracking-widest">
                  Fragile Points
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border ${
                    hasAPs
                      ? "bg-red-500/10 text-red-400 border-red-500/20"
                      : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  }`}
                >
                  {hasAPs ? `${rankedAPs.length} APs` : "CLEAN"}
                </span>
                <span
                  className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border ${
                    hasBridges
                      ? "bg-red-600/10 text-red-500/80 border-red-600/20"
                      : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                  }`}
                >
                  {hasBridges
                    ? `${apResult.bridges.length} bridges`
                    : "NO BRIDGES"}
                </span>
              </div>
            </div>

            {!hasAPs && !hasBridges ? (
              <div className="px-5 py-8 flex flex-col items-center gap-2 text-center">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-emerald-400"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path
                      d="M3 8l3.5 3.5L13 4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>
                <p className="text-[11px] font-mono text-slate-500">
                  No structural single points of failure detected
                </p>
              </div>
            ) : (
              <div className="divide-y divide-white/[0.04]">
                {/* AP ranked list */}
                {hasAPs && (
                  <div className="px-5 py-4">
                    <p className="text-[9px] font-mono text-slate-600 uppercase tracking-widest mb-3">
                      Articulation points — ranked by severity
                    </p>
                    <div className="space-y-3">
                      {rankedAPs.map(({ path, disconnects }, i) => {
                        const pct =
                          rankedAPs[0].disconnects > 0
                            ? (disconnects / rankedAPs[0].disconnects) * 100
                            : 0;
                        return (
                          <div key={path}>
                            <div className="flex items-center gap-3 mb-1">
                              <span className="text-[9px] font-mono text-slate-700 w-4 flex-shrink-0">
                                {i + 1}
                              </span>
                              <span
                                className="text-[11px] font-mono text-red-300/80 truncate flex-1"
                                title={path}
                              >
                                {path.split("/").pop()}
                              </span>
                              <span className="text-[9px] font-mono text-slate-500 flex-shrink-0">
                                {disconnects} files
                              </span>
                            </div>
                            <div className="ml-7 h-0.5 bg-white/[0.04] rounded-full overflow-hidden">
                              <motion.div
                                className="h-full bg-red-500/40 rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{
                                  duration: 0.6,
                                  delay: i * 0.05,
                                  ease: "easeOut",
                                }}
                              />
                            </div>
                            <p
                              className="ml-7 mt-0.5 text-[9px] font-mono text-slate-700 truncate"
                              title={path}
                            >
                              {path}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Bridge list */}
                {hasBridges && (
                  <div className="px-5 py-4">
                    <p className="text-[9px] font-mono text-slate-600 uppercase tracking-widest mb-3">
                      Bridge edges — critical import paths
                    </p>
                    <div className="space-y-1.5">
                      {apResult.bridges.slice(0, 12).map(([src, tgt]) => (
                        <div
                          key={`${src}-${tgt}`}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.04]"
                        >
                          <span
                            className="text-[10px] font-mono text-slate-400 truncate flex-1"
                            title={src}
                          >
                            {src.split("/").pop()}
                          </span>
                          <svg
                            className="w-3 h-3 text-red-500/60 flex-shrink-0"
                            viewBox="0 0 16 16"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.5"
                          >
                            <path
                              d="M3 8h10M9 4l4 4-4 4"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                          <span
                            className="text-[10px] font-mono text-slate-400 truncate flex-1 text-right"
                            title={tgt}
                          >
                            {tgt.split("/").pop()}
                          </span>
                        </div>
                      ))}
                      {apResult.bridges.length > 12 && (
                        <p className="text-[9px] font-mono text-slate-600 px-2">
                          +{apResult.bridges.length - 12} more bridges
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Existing RiskDashboard ── */}
        {data.coverageGaps && data.fileContents ? (
          <ErrorBoundary fallbackMessage="Risk dashboard failed to load.">
            <RiskDashboard
              coverageGaps={data.coverageGaps}
              fileContents={data.fileContents}
              isPro={isPro}
            />
          </ErrorBoundary>
        ) : (
          !data.dependencyGraph && (
            <div className="flex items-center justify-center h-40 text-slate-500 font-mono text-sm">
              No risk data available for this codebase.
            </div>
          )
        )}
      </div>
    </motion.div>
  );
}
