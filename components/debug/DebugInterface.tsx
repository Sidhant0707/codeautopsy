"use client";

import { useState } from "react";
import MermaidDiagram from "@/components/MermaidDiagram";
import { CodeDoctorPanel } from "./CodeDoctorPanel";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { ZoomIn, ZoomOut, Maximize, MousePointer2 } from "lucide-react";

export default function DebugInterface({
  initialChart,
  repoUrl,
}: {
  initialChart: string;
  repoUrl: string;
}) {
  const [chart, setChart] = useState(initialChart);
  const [isHoveringGraph, setIsHoveringGraph] = useState(false);
  // ✨ NEW: Prevent scroll-trap
  const [isInteractive, setIsInteractive] = useState(false);

  return (
    <div className="space-y-12">
      {/* 1. THE DIAGNOSTIC TERMINAL */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <h3 className="text-lg font-bold text-white font-mono uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Diagnostic Terminal
          </h3>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>

        <CodeDoctorPanel
          repoUrl={repoUrl}
          onUpdateGraph={(newChart) => setChart(newChart)}
        />
      </section>

      {/* 2. THE INTERACTIVE BLUEPRINT CANVAS */}
      <section>
        <div className="flex items-center justify-between mb-4 px-2">
          <h3 className="text-sm font-bold text-slate-400 font-mono uppercase tracking-widest">
            {">"} Architecture_Blueprint
          </h3>
          <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest flex items-center gap-2">
            <MousePointer2 className="w-3 h-3" />
            Click to unlock pan & zoom
          </span>
        </div>

        {/* The Canvas Container */}
        <div
          className={`relative w-full h-[600px] border rounded-2xl bg-[#0a0a0a] overflow-hidden group shadow-2xl transition-colors ${
            isInteractive ? "border-indigo-500/50" : "border-white/10"
          }`}
          onMouseEnter={() => setIsHoveringGraph(true)}
          onMouseLeave={() => setIsHoveringGraph(false)}
          onClick={() => setIsInteractive(true)} // Unlock on click
        >
          {/* Blueprint Grid Background */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

          {/* Overlay to tell them to click */}
          {!isInteractive && (
            <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/20 backdrop-blur-[1px] cursor-pointer">
              <div className="px-4 py-2 rounded-lg bg-black/80 border border-white/10 text-white font-mono text-xs uppercase tracking-widest flex items-center gap-2 shadow-xl">
                <MousePointer2 className="w-4 h-4" />
                Click to Interact
              </div>
            </div>
          )}

          <TransformWrapper
            initialScale={1}
            minScale={0.1}
            maxScale={8}
            centerOnInit={true}
            wheel={{ step: 0.1, disabled: !isInteractive }} // Disable wheel until clicked
            panning={{ disabled: !isInteractive }} // Disable pan until clicked
          >
            {({ zoomIn, zoomOut, resetTransform }) => (
              <>
                {/* Floating Canvas Controls */}
                <div
                  className={`absolute top-4 right-4 z-30 flex flex-col gap-2 transition-opacity duration-300 ${isHoveringGraph ? "opacity-100" : "opacity-40"}`}
                >
                  <div className="p-1 rounded-lg bg-black/60 border border-white/10 backdrop-blur-md flex flex-col gap-1 shadow-xl">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsInteractive(true);
                        zoomIn();
                      }}
                      className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-md transition-all"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsInteractive(true);
                        zoomOut();
                      }}
                      className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-md transition-all"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <div className="w-full h-px bg-white/10 my-1" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsInteractive(true);
                        resetTransform();
                      }}
                      className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-md transition-all"
                      title="Reset View"
                    >
                      <Maximize className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* The Graph Itself */}
                <TransformComponent
                  wrapperClass="!w-full !h-full"
                  contentClass="!w-full !h-full flex items-center justify-center p-8"
                >
                  <MermaidDiagram chart={chart} />
                </TransformComponent>
              </>
            )}
          </TransformWrapper>

          {/* Active Status Indicator */}
          <div className="absolute bottom-4 left-4 z-10 pointer-events-none">
            <div className="px-3 py-1.5 rounded-md bg-black/60 border border-white/10 backdrop-blur-md flex items-center gap-2">
              <span
                className={`w-1.5 h-1.5 rounded-full ${isInteractive ? "bg-indigo-500 animate-pulse" : "bg-slate-500"}`}
              />
              <span className="font-mono text-[10px] font-bold text-slate-300 tracking-widest">
                SVG_RENDER_ENGINE: {isInteractive ? "ACTIVE" : "STANDBY"}
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
