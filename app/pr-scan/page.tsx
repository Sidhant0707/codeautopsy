import PRAnalyzer from "@/components/PRAnalyzer";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata = {
  title: "PR Impact Analyzer | CodeAutopsy",
  description: "Calculate the blast radius of GitHub Pull Requests.",
};

export default function PRScanPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white p-8 pt-12">
      <div className="max-w-6xl mx-auto flex flex-col">
        
        <Link 
          href="/dashboard" 
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors mb-8 w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-slate-100 tracking-tight mb-4">
            Pull Request Intelligence
          </h1>
          <p className="text-slate-400 max-w-2xl mx-auto text-sm">
            Before you merge, know exactly what might break. Enter a PR URL below to map the downstream blast radius of the modified files.
          </p>
        </div>

        <div className="w-full">
          <PRAnalyzer />
        </div>

      </div>
    </div>
  );
}