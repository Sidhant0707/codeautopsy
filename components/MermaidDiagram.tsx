"use client";

import { useEffect, useRef } from "react";

interface Props {
  chart: string;
}

export default function MermaidDiagram({ chart }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function render() {
      if (!ref.current) return;

      const mermaid = (await import("mermaid")).default;

      mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
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
      });

      const id = `mermaid-${Math.random().toString(36).slice(2)}`;

      try {
        const { svg } = await mermaid.render(id, chart);
        if (ref.current) {
          ref.current.innerHTML = svg;
        }
      } catch (err) {
        console.error("Mermaid render error:", err);
        if (ref.current) {
          ref.current.innerHTML = `<p class="text-slate-500 text-sm">Could not render diagram</p>`;
        }
      }
    }

    render();
  }, [chart]);

  return (
    <div
      ref={ref}
      className="w-full flex items-center justify-center min-h-[200px] overflow-x-auto"
    />
  );
}