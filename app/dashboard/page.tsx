// app/dashboard/page.tsx
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import BackButton from "@/components/BackButton";
import Link from "next/link";
import Image from "next/image";
import { LayoutGrid, Plus, GitPullRequest } from "lucide-react";
import DashboardGrid from "@/components/dashboard/DashboardGrid";

export const metadata = {
  title: "Dashboard | CodeAutopsy",
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: analyses, error } = await supabase
    .from("analyses")
    .select("id, repo_url, repo_name, commit_sha, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen bg-[#050505] text-[#f1f5f9] p-4 sm:p-8 md:p-12 lg:p-24 font-satoshi relative overflow-hidden">
      {/* ================================================================
          DASHBOARD NAVBAR
      ================================================================ */}
      <nav className="w-full flex items-center justify-between py-6 mb-8 border-b border-white/[0.05]">
        <Link href="/" className="flex items-center gap-3 cursor-pointer group">
          <div className="relative">
            <Image
              src="/codeautopsy-logo1.png"
              alt="CodeAutopsy"
              width={28}
              height={28}
              className="rounded-md drop-shadow-[0_0_12px_rgba(255,255,255,0.05)] transition-transform duration-300 group-hover:scale-105"
            />
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-100 group-hover:text-white transition-colors">
            CodeAutopsy
          </span>
        </Link>
      </nav>

      {/* Background effects */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#111_1px,transparent_1px),linear-gradient(to_bottom,#111_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none z-0" />
      <div className="absolute top-0 left-0 right-0 h-[500px] bg-gradient-to-b from-indigo-500/10 via-transparent to-transparent pointer-events-none z-0 blur-3xl" />

      <div className="max-w-6xl mx-auto relative z-10">
        <BackButton />

        {/* ================================================================
            HEADER
        ================================================================ */}
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
            className="px-6 py-3 rounded-xl bg-slate-200 text-black font-bold text-xs uppercase tracking-[0.15em] hover:bg-white transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,255,255,0.05)] w-full sm:w-fit"
          >
            <Plus className="w-4 h-4" /> New Autopsy
          </Link>
        </header>

        {/* ================================================================
            WORKSPACE TOOLS
        ================================================================ */}
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

        {/* ================================================================
            DASHBOARD GRID — Client Component
        ================================================================ */}
        <DashboardGrid analyses={analyses ?? []} error={error?.message} />
      </div>
    </div>
  );
}
