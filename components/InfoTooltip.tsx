// components/InfoTooltip.tsx
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { HelpCircle } from "lucide-react";

interface InfoTooltipProps {
  content: string;
  side?: "top" | "bottom" | "left" | "right";
}

interface TooltipPos {
  top: number;
  left: number;
  resolvedSide: "top" | "bottom" | "left" | "right";
}

export default function InfoTooltip({
  content,
  side = "bottom",
}: InfoTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<TooltipPos | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);

  const GAP = 8;
  const MARGIN = 8;

  const computePosition = useCallback(
    (tooltipWidth: number, tooltipHeight: number): TooltipPos => {
      if (!triggerRef.current) {
        return { top: 0, left: 0, resolvedSide: side };
      }

      const btn = triggerRef.current.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const tryOrder: Array<"top" | "bottom" | "left" | "right"> = [
        side,
        side === "top"
          ? "bottom"
          : side === "bottom"
            ? "top"
            : side === "left"
              ? "right"
              : "left",
      ];

      for (const s of tryOrder) {
        let top = 0;
        let left = 0;

        if (s === "top") {
          top = btn.top - tooltipHeight - GAP;
          left = btn.left + btn.width / 2 - tooltipWidth / 2;
        } else if (s === "bottom") {
          top = btn.bottom + GAP;
          left = btn.left + btn.width / 2 - tooltipWidth / 2;
        } else if (s === "left") {
          top = btn.top + btn.height / 2 - tooltipHeight / 2;
          left = btn.left - tooltipWidth - GAP;
        } else {
          top = btn.top + btn.height / 2 - tooltipHeight / 2;
          left = btn.right + GAP;
        }

        const clampedLeft = Math.max(
          MARGIN,
          Math.min(left, vw - tooltipWidth - MARGIN),
        );
        const clampedTop = Math.max(
          MARGIN,
          Math.min(top, vh - tooltipHeight - MARGIN),
        );

        const fitsHorizontally =
          left >= MARGIN && left + tooltipWidth <= vw - MARGIN;
        const fitsVertically =
          top >= MARGIN && top + tooltipHeight <= vh - MARGIN;

        if (fitsHorizontally && fitsVertically) {
          return { top: clampedTop, left: clampedLeft, resolvedSide: s };
        }

        if (s === tryOrder[tryOrder.length - 1]) {
          return { top: clampedTop, left: clampedLeft, resolvedSide: s };
        }
      }

      return { top: 0, left: 0, resolvedSide: side };
    },
    [side],
  );

  const tooltipRefCallback = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node) return;
      const { width, height } = node.getBoundingClientRect();
      const computed = computePosition(width, height);
      setPos(computed);
    },
    [computePosition],
  );

  useEffect(() => {
    if (!visible) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (triggerRef.current?.contains(e.target as Node)) return;
      setVisible(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [visible]);

  const handleShow = useCallback(() => {
    setPos(null);
    setVisible(true);
  }, []);

  const arrowClasses: Record<string, string> = {
    top: "top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-[#1e1e1e]",
    bottom:
      "bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-[#1e1e1e]",
    left: "left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-[#1e1e1e]",
    right:
      "right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-[#1e1e1e]",
  };

  const resolvedSide = pos?.resolvedSide ?? side;

  return (
    <span className="relative inline-flex items-center">
      <span
        ref={triggerRef}
        role="button"
        tabIndex={0}
        aria-label="More information"
        onMouseEnter={handleShow}
        onMouseLeave={() => setVisible(false)}
        onFocus={handleShow}
        onBlur={() => setVisible(false)}
        onClick={(e) => {
          e.stopPropagation();
          if (visible) {
            setVisible(false);
          } else {
            handleShow();
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (visible) setVisible(false);
            else handleShow();
          }
        }}
        className="w-3.5 h-3.5 flex items-center justify-center text-slate-600 hover:text-slate-300 focus:text-slate-300 transition-colors cursor-default focus:outline-none focus-visible:ring-1 focus-visible:ring-slate-500 rounded-full"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </span>

      {visible &&
        typeof window !== "undefined" &&
        createPortal(
          <div
            ref={tooltipRefCallback}
            role="tooltip"
            className="fixed z-[9999] w-max max-w-[220px] pointer-events-none"
            style={{
              top: pos ? pos.top : -9999,
              left: pos ? pos.left : -9999,
            }}
          >
            <span
              className={`absolute w-0 h-0 border-4 ${arrowClasses[resolvedSide]}`}
            />
            <div className="bg-[#1e1e1e] border border-white/10 rounded-lg px-3 py-2 shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
              <p className="text-[11px] font-mono text-slate-300 leading-relaxed">
                {content}
              </p>
            </div>
          </div>,
          document.body,
        )}
    </span>
  );
}
