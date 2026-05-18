"use client";

import { useEffect, useRef, useState, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, AlertTriangle } from "lucide-react";

interface Props {
  chart: string;
}

const MERMAID_CONFIG = {
  startOnLoad: false,
  theme: "dark" as const,
  securityLevel: "strict" as const,
  themeVariables: {
    primaryColor: "#1a1a1a",
    primaryTextColor: "#f1f5f9",
    primaryBorderColor: "rgba(255,255,255,0.1)",
    lineColor: "#475569",
    secondaryColor: "#141414",
    tertiaryColor: "#0e0e0e",
    background: "#0e0e0e",
    mainBkg: "#1a1a1a",
    nodeBorder: "rgba(255,255,255,0.1)",
    clusterBkg: "#141414",
    titleColor: "#f1f5f9",
    edgeLabelBackground: "#0e0e0e",
    fontFamily: "Azeret Mono, monospace",
  },
};

// --- PRINCIPAL UPGRADE: Promise Lock for Concurrent Mounts ---
// This guarantees that if 10 diagrams mount simultaneously, they all wait
// for the exact same initialization sequence without causing a race condition.
import type mermaidType from "mermaid";
let mermaidInitPromise: Promise<typeof mermaidType> | null = null;

const MermaidDiagram = memo(({ chart }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const containerEl = containerRef.current;
    setIsRendering(true);
    setRenderError(null);

    const renderId = `mermaid-${Math.random().toString(36).substring(2, 12)}`;

    async function renderChart() {
      if (!containerEl || !chart.trim()) return;

      try {
        // 1. Thread-safe initialization lock
        if (!mermaidInitPromise) {
          mermaidInitPromise = import("mermaid").then((m) => {
            m.default.initialize(MERMAID_CONFIG);
            return m.default;
          });
        }

        const mermaid = await mermaidInitPromise;

        // 2. Yield to main thread so the browser can paint the loading spinner
        await new Promise((resolve) => setTimeout(resolve, 0));

        // 3. Render SVG and extract binding functions for interactivity
        const { svg, bindFunctions } = await mermaid.render(renderId, chart);

        if (isMounted && containerEl) {
          containerEl.innerHTML = svg;

          // --- PRINCIPAL UPGRADE: Hydrate Interactive Nodes ---
          // If the AI generated clickable nodes or tooltips, this makes them work.
          if (bindFunctions) {
            bindFunctions(containerEl);
          }

          setIsRendering(false);
        }
      } catch (err) {
        console.error("Mermaid Render Exception:", err);
        if (isMounted) {
          setRenderError("The AI generated invalid flowchart syntax.");
          setIsRendering(false);
        }
      }
    }

    renderChart();

    return () => {
      isMounted = false;
      if (containerEl) {
        containerEl.innerHTML = "";
      }
    };
  }, [chart]);

  return (
    <div className="relative w-full min-h-[200px] flex items-center justify-center rounded-xl bg-black/20 border border-white/5 overflow-hidden">
      <AnimatePresence mode="wait">
        {isRendering && (
          <motion.div
            key="loader"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-[#0a0a0a]/80 backdrop-blur-sm z-10"
          >
            <Loader2 className="w-6 h-6 text-emerald-400 animate-spin mb-3" />
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest animate-pulse">
              Rendering Diagram...
            </span>
          </motion.div>
        )}

        {renderError && (
          <motion.div
            key="error"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 flex items-center justify-center z-10 bg-[#0e0e0e]"
          >
            <div className="p-4 border border-red-500/20 bg-red-500/5 rounded-xl flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <div className="flex flex-col">
                <span className="text-red-400 font-mono text-[10px] font-bold uppercase tracking-widest">
                  Render Failed
                </span>
                <span className="text-slate-400 text-[10px] font-mono mt-0.5">
                  {renderError}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        ref={containerRef}
        className={`w-full h-full overflow-auto custom-scrollbar p-6 flex items-center justify-center transition-opacity duration-500 ${
          isRendering || renderError ? "opacity-0" : "opacity-100"
        }`}
      />
    </div>
  );
});

MermaidDiagram.displayName = "MermaidDiagram";

export default MermaidDiagram;
