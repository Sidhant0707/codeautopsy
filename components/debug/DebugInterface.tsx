"use client";

import { useState } from "react";
import MermaidDiagram from "@/components/MermaidDiagram";
import { CodeDoctorPanel } from "./CodeDoctorPanel";

export default function DebugInterface({ initialChart, repoUrl }: { initialChart: string, repoUrl: string }) {
  const [chart, setChart] = useState(initialChart);

  return (
    <div className="space-y-12">
      <section>
        <h3 className="text-lg font-bold text-white mb-4 italic uppercase tracking-widest">
          Code Doctor <span className="text-slate-600 text-xs ml-2">V1.0</span>
        </h3>
        <CodeDoctorPanel 
          repoUrl={repoUrl} 
          onUpdateGraph={(newChart) => setChart(newChart)} 
        />
      </section>

      <section>
        <h3 className="text-lg font-bold text-white mb-4 italic uppercase tracking-widest">
          Dependency Graph
        </h3>
        <div className="p-6 border border-white/5 rounded-3xl bg-white/[0.02] backdrop-blur-sm shadow-2xl">
          <MermaidDiagram chart={chart} />
        </div>
      </section>
    </div>
  );
}