"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft, Clock, Star, FileCode, Terminal, Search } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";


interface Analysis {
  id: string;
  repo_url: string;
  repo_name: string;
  created_at: string;
  result_json: {
    stars: number;
    language: string;
    totalFiles: number;
    description: string;
    analysis: {
      architecture_pattern: string;
      what_it_does: string;
    };
  };
}

const EXPO_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EXPO_OUT } },
};

export default function HistoryPage() {
  const router = useRouter();
  const supabase = createClient();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    async function fetchHistory() {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    router.push("/login");
    return;
  }

  const { data, error } = await supabase
    .from("analyses")
    .select("id, repo_url, repo_name, created_at, result_json")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (!error && data) {
    setAnalyses(data);
  }
  setLoading(false);
}

    fetchHistory();
  }, [router, supabase]);

  const filtered = analyses.filter((a) =>
    a.repo_name.toLowerCase().includes(search.toLowerCase())
  );

  function timeAgo(date: string) {
    const seconds = Math.floor((now - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-[#f1f5f9] pb-32">
      
      {/* Background glow */}
      <div className="absolute top-0 left-0 w-full h-[40vh] pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[10%] w-[40%] h-[100%] bg-white/[0.015] blur-[120px] rounded-full" />
      </div>

      <div className="max-w-5xl mx-auto px-6 pt-12 relative z-10">
        
        {/* Back button */}
        <button
          onClick={() => router.push("/")}
          className="group flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-white transition-colors mb-12"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Back to Home
        </button>

        {/* Header */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[#141414] border border-white/5 flex items-center justify-center">
              <Clock className="w-5 h-5 text-slate-400" />
            </div>
            <h1 className="cabinet text-4xl font-bold text-white">Analysis History</h1>
          </div>
          <p className="text-slate-400">
            {analyses.length} repositories analyzed
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-8">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search repositories..."
            className="w-full bg-[#141414] border border-white/5 rounded-xl pl-11 pr-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-white/20 transition-colors"
          />
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-32">
            <div className="w-6 h-6 border-2 border-white/10 border-t-white rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-32">
            <div className="w-16 h-16 rounded-2xl bg-[#141414] border border-white/5 flex items-center justify-center mx-auto mb-6">
              <Clock className="w-8 h-8 text-slate-600" />
            </div>
            <h3 className="cabinet text-2xl font-bold text-white mb-2">No analyses yet</h3>
            <p className="text-slate-500 mb-8">Start by analyzing a GitHub repository</p>
            <Link
              href="/"
              className="btn-gray px-6 py-3 rounded-xl text-sm font-bold text-white inline-block"
            >
              Analyze a Repo
            </Link>
          </div>
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="space-y-4"
          >
            {filtered.map((analysis) => (
              <motion.div
                key={analysis.id}
                variants={fadeUp}
                onClick={() => router.push(`/analyze?repo=${encodeURIComponent(analysis.repo_url)}`)}
                className="glass-card p-6 rounded-2xl cursor-pointer hover:bg-white/[0.03] hover:border-white/10 transition-all group"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="cabinet font-bold text-white text-lg group-hover:text-slate-100 truncate">
                        {analysis.repo_name}
                      </h3>
                      <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500 bg-white/5 px-2 py-1 rounded flex-shrink-0">
                        {analysis.result_json?.analysis?.architecture_pattern || "Unknown"}
                      </span>
                    </div>
                    <p className="text-slate-400 text-sm mb-4 line-clamp-2 leading-relaxed">
                      {analysis.result_json?.description || analysis.result_json?.analysis?.what_it_does || "No description"}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                      {analysis.result_json?.stars !== undefined && (
                        <span className="flex items-center gap-1.5">
                          <Star className="w-3 h-3" />
                          {analysis.result_json.stars.toLocaleString()}
                        </span>
                      )}
                      {analysis.result_json?.totalFiles && (
                        <span className="flex items-center gap-1.5">
                          <FileCode className="w-3 h-3" />
                          {analysis.result_json.totalFiles} files
                        </span>
                      )}
                      {analysis.result_json?.language && (
                        <span className="flex items-center gap-1.5">
                          <Terminal className="w-3 h-3" />
                          {analysis.result_json.language}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        {timeAgo(analysis.created_at)}
                      </span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400">
                      →
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}