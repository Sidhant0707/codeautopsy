"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  User,
  History,
  Settings,
  Terminal,
  Zap,
  ArrowRight,
  Clock,
  GitBranch,
} from "lucide-react";
import Header from "@/components/Header";
import { createClient } from "@/lib/supabase-browser";
import { User as SupabaseUser } from "@supabase/supabase-js";
import Link from "next/link";

type AnalysisRecord = {
  id?: string | number;
  repo_name: string;
  created_at: string;
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
  const [activeTab, setActiveTab] = useState<TabId>("account");
  const [user, setUser] = useState<SupabaseUser | null>(null);

  // Real Database State
  const [history, setHistory] = useState<AnalysisRecord[]>([]);
  const [usageCount, setUsageCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function loadProfileData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        // Fetch real analysis history from your Supabase table
        const { data, error } = await supabase
          .from("analyses")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (data && !error) {
          setHistory(data);
          setUsageCount(data.length);
        }
      }
      setIsLoading(false);
    }

    loadProfileData();
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-slate-200 font-satoshi flex flex-col">
      <Header />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-12 flex flex-col md:flex-row gap-8">
        {/* LEFT SIDEBAR */}
        <aside className="w-full md:w-64 flex-shrink-0 space-y-2">
          <div className="mb-8 px-4">
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

        {/* MAIN CONTENT AREA */}
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
              {/* --- ACCOUNT TAB --- */}
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
                          {usageCount} / 10{" "}
                          <span className="text-slate-500 font-normal">
                            Scans Used
                          </span>
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden flex gap-[2px] p-[2px]">
                        {Array.from({ length: 10 }).map((_, index) => {
                          const filled = index < usageCount;

                          return (
                            <div
                              key={index}
                              className={`h-full flex-1 rounded-full transition-colors duration-700 ${
                                filled
                                  ? usageCount >= 10
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
                      <button className="px-4 py-2 rounded-lg bg-white/10 text-white text-xs font-bold hover:bg-white/20 transition-colors">
                        Manage
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* --- HISTORY TAB --- */}
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
                      history.map((scan, i) => (
                        <Link
                          href={`/analyze?repo=${encodeURIComponent(scan.repo_name)}`}
                          key={scan.id || i}
                          className="group flex items-center justify-between p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/5 transition-colors cursor-pointer"
                        >
                          <div className="flex flex-col gap-1">
                            <span className="text-sm font-bold text-slate-200 font-mono flex items-center gap-2">
                              <Terminal className="w-3.5 h-3.5 text-slate-500" />
                              {scan.repo_name}
                            </span>
                            <span className="text-xs text-slate-500 flex items-center gap-1.5">
                              <Clock className="w-3 h-3" />
                              {new Date(scan.created_at).toLocaleDateString()}
                            </span>
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

              {/* --- PREFERENCES TAB --- */}
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
                      <select
                        aria-label="Default view"
                        className="bg-[#141414] border border-white/10 rounded-lg px-3 py-1.5 text-sm text-slate-300 outline-none focus:border-slate-500"
                      >
                        <option>Read_Docs</option>
                        <option>Blueprint_Map</option>
                        <option>Diagnostic_Engine</option>
                      </select>
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
