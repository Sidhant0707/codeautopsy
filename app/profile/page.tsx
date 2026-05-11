"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  User,
  History,
  Settings,
  Terminal,
  Zap,
  ArrowRight,
  Clock,
  GitBranch,
  GitPullRequest,
  ArrowLeft,
  ChevronDown,
} from "lucide-react";
import Header from "@/components/Header";
import { createClient } from "@/lib/supabase-browser";
import { User as SupabaseUser } from "@supabase/supabase-js";
import Link from "next/link";

type HistoryItem = {
  id: string;
  type: "repo" | "pr";
  title: string;
  subtitle: string;
  created_at: string;
  link: string;
};

type TabId = "account" | "history" | "preferences";

type TabButtonProps = {
  id: TabId;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  activeTab: TabId;
  onSelect: (id: TabId) => void;
};

function TabButton({
  id,
  icon: Icon,
  label,
  activeTab,
  onSelect,
}: TabButtonProps) {
  return (
    <button
      onClick={() => onSelect(id)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm font-medium ${
        activeTab === id
          ? "bg-white/10 text-white shadow-inner border border-white/5"
          : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("account");
  const [user, setUser] = useState<SupabaseUser | null>(null);

  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [usageCount, setUsageCount] = useState(0);
  const [maxLimit, setMaxLimit] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedView, setSelectedView] = useState("Read_Docs");

  // GitHub Link Handler
  async function handleGitHubLink() {
    const supabase = createClient();
    const { error } = await supabase.auth.linkIdentity({
      provider: "github",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/profile`,
      },
    });

    if (error) {
      console.error("Link error:", error.message);
    }
  }

  useEffect(() => {
    const supabase = createClient();

    async function loadProfileData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        fetch("/api/limits")
          .then((res) => res.json())
          .then((data) => {
            setUsageCount(data.maxTokens - data.remaining);
            setMaxLimit(data.maxTokens);
          })
          .catch((err) => console.error("Error fetching limits:", err));

        const [repoRes, prRes] = await Promise.all([
          supabase.from("analyses").select("*").eq("user_id", user.id),
          supabase.from("pr_analyses").select("*").eq("user_id", user.id),
        ]);

        type RepoRow = {
          id: number | string;
          repo_name: string;
          created_at: string;
        };
        type PRRow = {
          id: number | string;
          repo_name: string;
          pr_number: number | string;
          title: string;
          created_at: string;
        };

        const repoData = (repoRes.data ?? []) as RepoRow[];
        const prData = (prRes.data ?? []) as PRRow[];

        const formattedRepos: HistoryItem[] = repoData.map((r: RepoRow) => ({
          id: `repo-${r.id}`,
          type: "repo",
          title: r.repo_name,
          subtitle: "Full Codebase Scan",
          created_at: r.created_at,
          link: `/analyze?repo=${encodeURIComponent(r.repo_name)}`,
        }));

        const formattedPRs: HistoryItem[] = prData.map((p: PRRow) => ({
          id: `pr-${p.id}`,
          type: "pr",
          title: `${p.repo_name} #${p.pr_number}`,
          subtitle: p.title,
          created_at: p.created_at,
          link: `#`,
        }));

        const mergedHistory = [...formattedRepos, ...formattedPRs].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );

        setHistory(mergedHistory);
      }
      setIsLoading(false);
    }

    loadProfileData();
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white pt-28 pb-12">
      <Header />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-12 flex flex-col md:flex-row gap-8">
        <aside className="w-full md:w-64 flex-shrink-0 space-y-2">
          <div className="mb-8 px-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-xs font-mono tracking-widest uppercase text-slate-500 hover:text-white transition-colors mb-6 group w-fit"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              Back
            </button>
            <h1 className="text-2xl font-bold text-white tracking-tight cabinet">
              Workspace
            </h1>
            <p className="text-xs text-slate-500 font-mono mt-1 truncate">
              {user?.email || "Loading account..."}
            </p>
          </div>

          <nav className="space-y-1">
            <TabButton
              id="account"
              icon={User}
              label="Account & Limits"
              activeTab={activeTab}
              onSelect={setActiveTab}
            />
            <TabButton
              id="history"
              icon={History}
              label="Autopsy History"
              activeTab={activeTab}
              onSelect={setActiveTab}
            />
            <TabButton
              id="preferences"
              icon={Settings}
              label="Engine Preferences"
              activeTab={activeTab}
              onSelect={setActiveTab}
            />
          </nav>
        </aside>

        <section className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="glass-card p-6 md:p-8 rounded-2xl border border-white/10 bg-[#0e0e0e]"
            >
              {activeTab === "account" && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                      <Zap className="w-5 h-5 text-emerald-400" /> Usage
                      Telemetry
                    </h2>
                    <p className="text-sm text-slate-400 mb-6">
                      Your current API limits and usage cycle.
                    </p>

                    <div className="p-5 rounded-xl border border-white/5 bg-black/40">
                      <div className="flex justify-between items-end mb-2">
                        <span className="text-xs font-mono uppercase tracking-widest text-slate-500">
                          Free Tier (Intern)
                        </span>
                        <span className="text-sm font-bold text-white">
                          {usageCount} / {maxLimit}{" "}
                          <span className="text-slate-500 font-normal">
                            Scans Used
                          </span>
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden flex gap-[2px] p-[2px]">
                        {Array.from({ length: maxLimit }).map((_, index) => {
                          const filled = index < usageCount;
                          return (
                            <div
                              key={index}
                              className={`h-full flex-1 rounded-full transition-colors duration-700 ${
                                filled
                                  ? usageCount >= maxLimit
                                    ? "bg-red-500"
                                    : "bg-emerald-500"
                                  : "bg-white/10"
                              }`}
                            />
                          );
                        })}
                      </div>
                      <p className="text-[10px] text-slate-500 mt-3 font-mono uppercase">
                        Usage tied to connected account
                      </p>
                    </div>
                  </div>

                  <div className="h-px w-full bg-white/5" />

                  {/* Properly Integrated Connections Section */}
                  <div>
                    <h2 className="text-xl font-bold text-white mb-2">
                      Connections
                    </h2>
                    <div className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                      <div className="flex items-center gap-3">
                        <GitBranch className="w-6 h-6 text-white" />
                        <div>
                          <p className="text-sm font-bold text-white">
                            GitHub Account
                          </p>
                          <p className="text-xs text-slate-400">
                            Required for private repo access.
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleGitHubLink}
                        className="px-4 py-2 rounded-lg bg-white/10 text-white text-xs font-bold hover:bg-white/20 transition-colors cursor-pointer"
                      >
                        Manage
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "history" && (
                <div>
                  <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                    <History className="w-5 h-5 text-slate-400" /> Autopsy
                    History
                  </h2>
                  <p className="text-sm text-slate-400 mb-6">
                    Review your past codebase dissections without using API
                    limits.
                  </p>

                  <div className="space-y-3">
                    {isLoading ? (
                      <div className="text-sm text-slate-500 font-mono animate-pulse">
                        Loading secure records...
                      </div>
                    ) : history.length === 0 ? (
                      <div className="p-6 text-center border border-dashed border-white/10 rounded-xl bg-black/20">
                        <p className="text-slate-500 text-sm">
                          No autopsies found in your workspace.
                        </p>
                      </div>
                    ) : (
                      history.map((scan) => (
                        <Link
                          href={scan.link}
                          key={scan.id}
                          className="group flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/5 transition-colors cursor-pointer"
                        >
                          <div className="flex flex-col gap-1.5">
                            <span className="text-sm font-bold text-slate-200 font-mono flex items-center gap-2">
                              {scan.type === "repo" ? (
                                <Terminal className="w-4 h-4 text-emerald-500" />
                              ) : (
                                <GitPullRequest className="w-4 h-4 text-blue-500" />
                              )}
                              {scan.title}
                            </span>
                            <div className="flex items-center gap-3">
                              <span className="text-[11px] font-medium text-slate-400 px-2 py-0.5 rounded bg-white/5 border border-white/10">
                                {scan.subtitle}
                              </span>
                              <span className="text-xs text-slate-500 flex items-center gap-1.5">
                                <Clock className="w-3 h-3" />
                                {new Date(scan.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-white transition-transform duration-300 group-hover:translate-x-1" />
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeTab === "preferences" && (
                <div>
                  <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                    <Settings className="w-5 h-5 text-slate-400" /> Engine
                    Preferences
                  </h2>
                  <p className="text-sm text-slate-400 mb-6">
                    Customize how CodeAutopsy behaves by default.
                  </p>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                      <div>
                        <p className="text-sm font-bold text-white">
                          Default View
                        </p>
                        <p className="text-xs text-slate-400">
                          Which tab opens when an autopsy finishes?
                        </p>
                      </div>
                      <div className="relative">
                        <button
                          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                          className="flex items-center gap-4 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-all font-medium text-sm min-w-[180px] justify-between shadow-inner"
                        >
                          {selectedView.replace("_", " ")}
                          <ChevronDown
                            className={`w-4 h-4 transition-transform duration-200 ${
                              isDropdownOpen ? "rotate-180" : ""
                            }`}
                          />
                        </button>

                        {isDropdownOpen && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setIsDropdownOpen(false)}
                            />
                            <div className="absolute right-0 mt-2 w-full min-w-[180px] rounded-xl overflow-hidden shadow-2xl z-50 bg-[#141414] border border-white/10 p-1 animate-in fade-in zoom-in duration-100">
                              {[
                                "Read_Docs",
                                "Blueprint_Map",
                                "Diagnostic_Engine",
                              ].map((option) => (
                                <button
                                  key={option}
                                  onClick={() => {
                                    setSelectedView(option);
                                    setIsDropdownOpen(false);
                                  }}
                                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                                    selectedView === option
                                      ? "bg-white/10 text-white"
                                      : "text-slate-400 hover:text-white hover:bg-white/5"
                                  }`}
                                >
                                  {option.replace("_", " ")}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </section>
      </main>
    </div>
  );
}
