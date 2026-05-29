// components/dashboard/DashboardGrid.tsx
"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Database,
  Clock,
  GitBranch,
  ArrowRight,
  ChevronDown,
  Layers,
  CalendarClock,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Analysis = {
  id: string;
  repo_url: string;
  repo_name: string;
  commit_sha: string;
  created_at: string;
};

type GroupedRepo = {
  repo_url: string;
  repo_name: string;
  latest_commit_sha: string;
  latest_created_at: string;
  oldest_created_at: string;
  analysisCount: number;
};

type SortKey = "latest-desc" | "latest-asc" | "count-desc" | "count-asc";

// ─── Sort Options Config ──────────────────────────────────────────────────────

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "latest-desc", label: "Latest First" },
  { value: "latest-asc", label: "Oldest First" },
  { value: "count-desc", label: "Most Analyzed" },
  { value: "count-asc", label: "Least Analyzed" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Groups a flat analyses array by repo_url.
 * The "representative" row for a group is the one with the latest created_at.
 */
function groupAnalysesByRepo(analyses: Analysis[]): GroupedRepo[] {
  const map = new Map<string, GroupedRepo>();

  for (const analysis of analyses) {
    const existing = map.get(analysis.repo_url);

    if (!existing) {
      map.set(analysis.repo_url, {
        repo_url: analysis.repo_url,
        repo_name: analysis.repo_name,
        latest_commit_sha: analysis.commit_sha,
        latest_created_at: analysis.created_at,
        oldest_created_at: analysis.created_at,
        analysisCount: 1,
      });
    } else {
      existing.analysisCount += 1;

      // Track the most recent entry
      if (
        new Date(analysis.created_at) > new Date(existing.latest_created_at)
      ) {
        existing.latest_created_at = analysis.created_at;
        existing.latest_commit_sha = analysis.commit_sha;
      }

      // Track the oldest entry
      if (
        new Date(analysis.created_at) < new Date(existing.oldest_created_at)
      ) {
        existing.oldest_created_at = analysis.created_at;
      }
    }
  }

  return Array.from(map.values());
}

/**
 * Formats a date string into "29 MAY 2026 • 2:30 PM"
 */
function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDate().toString().padStart(2, "0");
  const month = date.toLocaleString("en-US", { month: "short" }).toUpperCase();
  const year = date.getFullYear();
  const time = date.toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${day} ${month} ${year} • ${time}`;
}

// ─── Sort Dropdown ────────────────────────────────────────────────────────────

function SortDropdown({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (v: SortKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = SORT_OPTIONS.find((o) => o.value === value)!;

  // Split the label to show an accent on the qualifier ("First", "Analyzed")
  const [base, qualifier] = current.label.split(" ").reduce(
    (acc, word, i, arr) => {
      if (i < arr.length - 1) acc[0] = (acc[0] ? acc[0] + " " : "") + word;
      else acc[1] = word;
      return acc;
    },
    ["", ""] as [string, string],
  );

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0a0a0a] border border-white/10 hover:border-white/20 hover:bg-white/[0.03] transition-all text-sm font-mono text-slate-300 shadow-xl"
      >
        <span className="text-slate-400">{base}</span>
        <span className="text-indigo-400 font-bold">{qualifier}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          {/* Menu */}
          <div className="absolute right-0 top-full mt-2 z-20 min-w-[180px] rounded-2xl border border-white/10 bg-[#0d0d0d] shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden backdrop-blur-sm">
            {/* Group: Time */}
            <div className="px-3 pt-3 pb-1">
              <span className="flex items-center gap-1.5 text-[10px] font-mono text-slate-600 uppercase tracking-widest">
                <CalendarClock className="w-3 h-3" /> Time
              </span>
            </div>
            {SORT_OPTIONS.slice(0, 2).map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between group ${
                  value === opt.value
                    ? "text-white bg-white/[0.04]"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.03]"
                }`}
              >
                {opt.label}
                {value === opt.value && (
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                )}
              </button>
            ))}

            {/* Divider */}
            <div className="mx-3 my-1 border-t border-white/5" />

            {/* Group: Count */}
            <div className="px-3 pt-1 pb-1">
              <span className="flex items-center gap-1.5 text-[10px] font-mono text-slate-600 uppercase tracking-widest">
                <Layers className="w-3 h-3" /> Scans
              </span>
            </div>
            {SORT_OPTIONS.slice(2).map((opt) => (
              <button
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between group ${
                  value === opt.value
                    ? "text-white bg-white/[0.04]"
                    : "text-slate-400 hover:text-white hover:bg-white/[0.03]"
                }`}
              >
                {opt.label}
                {value === opt.value && (
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                )}
              </button>
            ))}
            <div className="h-2" />
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DashboardGrid({
  analyses,
  error,
}: {
  analyses: Analysis[];
  error?: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("latest-desc");

  const sortedRepos = useMemo(() => {
    const grouped = groupAnalysesByRepo(analyses);

    return grouped.sort((a, b) => {
      switch (sortKey) {
        case "latest-desc":
          return (
            new Date(b.latest_created_at).getTime() -
            new Date(a.latest_created_at).getTime()
          );
        case "latest-asc":
          return (
            new Date(a.latest_created_at).getTime() -
            new Date(b.latest_created_at).getTime()
          );
        case "count-desc":
          return b.analysisCount - a.analysisCount;
        case "count-asc":
          return a.analysisCount - b.analysisCount;
      }
    });
  }, [analyses, sortKey]);

  if (error) {
    return (
      <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400">
        <p className="font-mono text-sm uppercase tracking-widest font-bold mb-2">
          Database Error
        </p>
        <p className="text-xs opacity-80">{error}</p>
      </div>
    );
  }

  return (
    <div>
      {/* ── Section Header ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-mono text-slate-500 uppercase tracking-widest">
          Historical Scans
          {sortedRepos.length > 0 && (
            <span className="ml-3 text-slate-600">
              ({sortedRepos.length} repo{sortedRepos.length !== 1 ? "s" : ""})
            </span>
          )}
        </h2>

        {/* Sort control — only visible when there's data */}
        {sortedRepos.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-600 uppercase tracking-widest hidden sm:block">
              Sort
            </span>
            <SortDropdown value={sortKey} onChange={setSortKey} />
          </div>
        )}
      </div>

      {/* ── Empty State ────────────────────────────────────────────────── */}
      {sortedRepos.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-8 sm:p-16 rounded-3xl border border-white/5 bg-white/[0.02] text-center">
          <Database className="w-12 h-12 text-slate-600 mb-6" />
          <h3 className="text-xl font-bold text-white mb-2">
            No Autopsies Found
          </h3>
          <p className="text-slate-400 text-sm mb-8 max-w-md">
            You haven&apos;t analyzed any repositories yet. Start your first
            scan to generate an architecture blueprint and diagnostic report.
          </p>
          <Link
            href="/"
            className="px-6 py-3 rounded-xl bg-white/5 text-white border border-white/10 font-bold text-xs uppercase tracking-[0.15em] hover:bg-white/10 transition-all w-full sm:w-fit"
          >
            Initiate Scan
          </Link>
        </div>
      ) : (
        /* ── Grid ────────────────────────────────────────────────────── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedRepos.map((repo) => (
            <div
              key={repo.repo_url}
              className="group flex flex-col p-6 rounded-2xl border border-white/10 bg-[#0a0a0a] hover:bg-white/[0.02] hover:border-white/20 transition-all duration-300 shadow-xl"
            >
              {/* ── Card Header ─────────────────────────────────── */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-2">
                  {/* DB icon */}
                  <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg group-hover:scale-110 transition-transform">
                    <Database className="w-5 h-5 text-indigo-400" />
                  </div>
                  {/* Scans badge */}
                  <span
                    className={`px-2 py-1 rounded-lg border text-[10px] font-black font-mono tracking-widest uppercase ${
                      repo.analysisCount >= 5
                        ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-300"
                        : repo.analysisCount >= 2
                          ? "bg-slate-200/10 border-slate-200/20 text-slate-300"
                          : "bg-white/5 border-white/10 text-slate-500"
                    }`}
                  >
                    {repo.analysisCount} Scan
                    {repo.analysisCount !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Timestamp */}
                <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 flex items-center gap-1.5 text-right">
                  <Clock className="w-3 h-3 shrink-0" />
                  <span className="leading-tight">
                    {formatDateTime(repo.latest_created_at)}
                  </span>
                </span>
              </div>

              {/* ── Card Body ───────────────────────────────────── */}
              <div className="flex-1">
                <h3
                  className="text-lg font-bold text-white mb-2 truncate"
                  title={repo.repo_name}
                >
                  {repo.repo_name}
                </h3>
                <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mb-6 bg-black/50 w-fit px-2 py-1 rounded-md border border-white/5">
                  <GitBranch className="w-3.5 h-3.5" />
                  <span className="truncate max-w-[150px]">
                    {repo.latest_commit_sha.substring(0, 7)}
                  </span>
                </div>
              </div>

              {/* ── CTA ─────────────────────────────────────────── */}
              <Link
                href={`/analyze?url=${encodeURIComponent(repo.repo_url)}`}
                className="w-full py-3 rounded-xl bg-white/5 text-slate-300 border border-white/10 font-bold text-xs uppercase tracking-[0.15em] group-hover:bg-slate-200 group-hover:text-black group-hover:border-transparent transition-all flex items-center justify-center gap-2 mt-auto"
              >
                Load Report <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
