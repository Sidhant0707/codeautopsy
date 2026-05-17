"use client";

import { useEffect, useRef, useId } from "react";

interface Props {
  chart: string;
}

// 1. Extract config outside component to prevent recreating the object on every render
const MERMAID_CONFIG = {
  startOnLoad: false,
  theme: "dark" as const,
  securityLevel: "strict" as const, // SECURITY: Sanitizes SVG to prevent XSS attacks from malicious repos
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

export default function MermaidDiagram({ chart }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  
  // 2. Use React 18's native ID hook (removes colons to make it a valid DOM ID)
  const safeId = `mermaid-${useId().replace(/:/g, "")}`;

  useEffect(() => {
    // 3. Mount flag to prevent race conditions during rapid re-renders
    let isMounted = true; 

    async function render() {
      if (!ref.current || !chart.trim()) return;

      try {
        // The bundler (Webpack/Turbopack) will cache this after the first load
        const mermaid = (await import("mermaid")).default;

        mermaid.initialize(MERMAID_CONFIG);

        // 4. Render the SVG
        const { svg } = await mermaid.render(safeId, chart);
        
        // 5. Only update DOM if the component is still mounted and this is the latest render
        if (isMounted && ref.current) {
          ref.current.innerHTML = svg;
        }
      } catch (err) {
        console.error("Mermaid render error:", err);
        if (isMounted && ref.current) {
          // Upgraded error UI to match your CodeAutopsy theme
          ref.current.innerHTML = `
            <div class="p-4 border border-red-500/20 bg-red-500/10 rounded-xl flex items-center gap-3">
              <span class="text-red-400 font-mono text-xs uppercase tracking-widest">Render Error</span>
              <p class="text-slate-400 text-xs font-mono">The AI generated invalid chart syntax.</p>
            </div>
          `;
        }
      }
    }

    render();

    // Cleanup function runs if 'chart' changes before the previous render finishes
    return () => {
      isMounted = false;
    };
  }, [chart, safeId]);

  return (
    <div
      ref={ref}
      // Added 'custom-scrollbar' to match your overall app styling
      className="w-full flex items-center justify-center min-h-[200px] overflow-auto custom-scrollbar"
    />
  );
}