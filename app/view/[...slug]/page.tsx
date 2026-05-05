import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Metadata } from "next";
import MermaidDiagram from "@/components/MermaidDiagram";
import Header from "@/components/Header";
import DebugInterface from "@/components/debug/DebugInterface";

type Props = {
  params: Promise<{ slug: string[] }>;
};


export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;

  if (!slug || slug.length !== 2) {
    return {
      title: "Repository | CodeAutopsy",
      description: "AI powered repository architecture analysis.",
    };
  }

  const repoName = `${slug[0]}/${slug[1]}`;

  return {
    title: `${repoName} | CodeAutopsy`,
    description: `Deep architectural dissection of ${repoName} powered by AI.`,
  };
}

export default async function ViewAutopsyPage({ params }: Props) {
  const { slug } = await params;

  
  if (!slug || slug.length !== 2) notFound();

  const owner = slug[0];
  const repo = slug[1];

  const repoName = `${owner}/${repo}`.toLowerCase();

  
  const { data, error } = await supabase
    .from("analyses")
    .select("result_json")
    .ilike("repo_name", repoName)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0e0e0e] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center mb-6">
          <span className="text-2xl">⚠️</span>
        </div>

        <h1 className="text-2xl font-bold mb-2">Autopsy Not Found</h1>

        <p className="text-slate-500 max-w-xs">
          The repository{" "}
          <span className="text-slate-300 font-mono text-sm">
            {repoName}
          </span>{" "}
          has not been dissected yet.
        </p>

        <Link
          href="/"
          className="mt-8 px-6 py-2 bg-white text-black font-bold rounded-full hover:scale-105 transition-transform"
        >
          Start New Analysis
        </Link>
      </div>
    );
  }

  const result = data.result_json;

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-slate-300 relative">
      <Header />
      <div className="py-24 px-6">
      {}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/[0.01] blur-[150px] rounded-full pointer-events-none" />

      <div className="max-w-4xl mx-auto relative z-10">
        <Link
          href="/"
          className="text-slate-500 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors"
        >
          ← Back to Engine
        </Link>

        <header className="mt-8 mb-16">
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 bg-white/5 px-3 py-1 rounded mb-4 inline-block">
            Archival Report
          </span>

          <h1 className="text-5xl md:text-6xl font-bold text-white tracking-tighter italic uppercase">
            {result?.repo || repo}
          </h1>

          <p className="text-slate-500 mt-2 font-mono text-sm">
            Target: {result?.owner || owner}
          </p>
        </header>

        <section className="glass-card p-10 rounded-3xl border border-white/5 bg-white/[0.02]">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />

            <h2 className="text-xl font-bold text-white uppercase tracking-tight">
              {result?.analysis?.architecture_pattern || "Unknown Architecture"}
            </h2>
          </div>

          <p className="text-lg text-slate-400 leading-relaxed italic">
            "{result?.analysis?.what_it_does || "No description available."}"
          </p>
        </section>

        <section className="mt-12">
          <h3 className="text-lg font-bold text-white mb-4">Execution Flow</h3>

          <ul className="space-y-3 text-slate-400">
            {result?.analysis?.execution_flow?.map((step: string, i: number) => (
              <li key={i} className="flex gap-3">
                <span className="text-slate-500">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12">
  <h3 className="text-lg font-bold text-white mb-4">Tech Stack</h3>

  <div className="flex flex-wrap gap-3">
    {result?.analysis?.tech_stack?.map((tech: any, i: number) => (
      <span
        key={i}
        className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-sm"
      >
        <div>
          <p className="text-white text-sm font-semibold">{tech.name}</p>
          <p className="text-xs text-slate-500">{tech.purpose}</p>
        </div>
      </span>
    ))}
  </div>
</section>

<section className="mt-12">
  <h3 className="text-lg font-bold text-white mb-4">Key Modules</h3>

  <div className="space-y-4">
    {result?.analysis?.key_modules?.map((mod: any, i: number) => (
      <div
        key={i}
        className="p-4 border border-white/10 rounded-xl bg-white/5"
      >
        <p className="font-mono text-sm text-white">{mod.file}</p>
        <p className="text-slate-400 text-sm mt-1">{mod.why_it_exists}</p>
      </div>
    ))}
  </div>
</section>

<section className="mt-12">
  <DebugInterface 
    initialChart={result?.mermaidDiagram || "graph TD\nA[Dependency graph unavailable]"} 
    repoUrl={`https://github.com/${owner}/${repo}`}
  />
</section>

        {}
      </div>
      </div>
    </div>
  );
}