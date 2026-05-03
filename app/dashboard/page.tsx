import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import BackButton from "@/components/BackButton";
import Link from "next/link";
import {
  Database,
  Clock,
  GitBranch,
  ArrowRight,
  LayoutGrid,
  Plus,
  GitPullRequest,
} from "lucide-react";

export const metadata = {
  title: "Dashboard | CodeAutopsy",
};

export default async function DashboardPage() {
  const supabase = await createClient();

  // Secure the route
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // Fetch past autopsies for the authenticated user
  const { data: analyses, error } = await supabase
    .from("analyses")
    .select("id, repo_url, repo_name, commit_sha, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-[#050505] text-[#f1f5f9] p-8 md:p-12 lg:p-24 font-satoshi relative overflow-hidden">
      {/* Background aesthetics */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#111_1px,transparent_1px),linear-gradient(to_bottom,#111_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none z-0" />
      <div className="absolute top-0 left-0 right-0 h-[500px] bg-gradient-to-b from-indigo-500/10 via-transparent to-transparent pointer-events-none z-0 blur-3xl" />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* ✨ Our new Client-Side Back Button Island ✨ */}
        <BackButton />

        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-12 border-b border-white/5 pb-8">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-white/5 border border-white/10 rounded-xl">
                <LayoutGrid className="w-6 h-6 text-indigo-400" />
              </div>
              <h1 className="cabinet text-3xl md:text-4xl font-bold text-white tracking-tight">
                Command Center
              </h1>
            </div>
            <p className="text-slate-400 text-sm max-w-xl leading-relaxed">
              Access your historical codebase autopsies. All dependency graphs,
              AI diagnostics, and execution flows are cached and ready for
              instant deployment.
            </p>
          </div>
          <Link
            href="/"
            className="px-6 py-3 rounded-xl bg-slate-200 text-black font-bold text-xs uppercase tracking-[0.15em] hover:bg-white transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.05)] w-fit"
          >
            <Plus className="w-4 h-4" /> New Autopsy
          </Link>
        </header>

        {/* Workspace Tools Section for PR Analyzer */}
        <div className="mb-12">
          <h2 className="text-sm font-mono text-slate-500 uppercase tracking-widest mb-4">
            Workspace Tools
          </h2>
          <div className="flex">
            <Link
              href="/pr-scan"
              className="flex items-center gap-4 bg-[#0a0a0a] border border-white/10 hover:border-white/20 hover:bg-white/[0.02] transition-all px-6 py-5 rounded-2xl w-full sm:w-auto shadow-xl group"
            >
              <div className="p-3 bg-slate-200/10 border border-slate-200/20 rounded-xl group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(241,245,249,0.05)]">
                <GitPullRequest className="w-6 h-6 text-slate-200" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-slate-200 font-bold text-base">
                    PR Impact Analyzer
                  </h3>
                  {/* The Luminous NEW Badge */}
                  <span className="px-2 py-0.5 rounded-md bg-slate-200/20 border border-slate-200/50 text-slate-100 text-[10px] font-black tracking-widest uppercase animate-pulse shadow-[0_0_10px_rgba(241,245,249,0.15)]">
                    New
                  </span>
                </div>
                <p className="text-slate-400 text-sm mt-1">
                  Scan a Pull Request for breaking changes
                </p>
              </div>
            </Link>
          </div>
        </div>

        {/* Historical Autopsies Section */}
        <div>
          <h2 className="text-sm font-mono text-slate-500 uppercase tracking-widest mb-4">
            Historical Scans
          </h2>

          {error ? (
            <div className="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400">
              <p className="font-mono text-sm uppercase tracking-widest font-bold mb-2">
                Database Error
              </p>
              <p className="text-xs opacity-80">{error.message}</p>
            </div>
          ) : !analyses || analyses.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 rounded-3xl border border-white/5 bg-white/[0.02] text-center">
              <Database className="w-12 h-12 text-slate-600 mb-6" />
              <h3 className="text-xl font-bold text-white mb-2">
                No Autopsies Found
              </h3>
              <p className="text-slate-400 text-sm mb-8 max-w-md">
                You haven&apos;t analyzed any repositories yet. Start your first scan
                to generate an architecture blueprint and diagnostic report.
              </p>
              <Link
                href="/"
                className="px-6 py-3 rounded-xl bg-white/5 text-white border border-white/10 font-bold text-xs uppercase tracking-[0.15em] hover:bg-white/10 transition-all"
              >
                Initiate Scan
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {analyses.map((analysis) => (
                <div
                  key={analysis.id}
                  className="group flex flex-col p-6 rounded-2xl border border-white/10 bg-[#0a0a0a] hover:bg-white/[0.02] hover:border-white/20 transition-all duration-300 shadow-xl"
                >
                  <div className="flex items-start justify-between mb-6">
                    <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg group-hover:scale-110 transition-transform">
                      <Database className="w-5 h-5 text-indigo-400" />
                    </div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      {new Date(analysis.created_at).toLocaleDateString(
                        undefined,
                        {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        },
                      )}
                    </span>
                  </div>

                  <div className="flex-1">
                    <h3
                      className="text-lg font-bold text-white mb-2 truncate"
                      title={analysis.repo_name}
                    >
                      {analysis.repo_name}
                    </h3>
                    <div className="flex items-center gap-2 text-xs font-mono text-slate-400 mb-6 bg-black/50 w-fit px-2 py-1 rounded-md border border-white/5">
                      <GitBranch className="w-3.5 h-3.5" />
                      <span className="truncate max-w-[150px]">
                        {analysis.commit_sha.substring(0, 7)}
                      </span>
                    </div>
                  </div>

                  <Link
                    href={`/analyze?url=${encodeURIComponent(analysis.repo_url)}`}
                    className="w-full py-3 rounded-xl bg-white/5 text-slate-300 border border-white/10 font-bold text-xs uppercase tracking-[0.15em] group-hover:bg-slate-200 group-hover:text-black group-hover:border-transparent transition-all flex items-center justify-center gap-2 mt-auto"
                  >
                    Load Report <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}