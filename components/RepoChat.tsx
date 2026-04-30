"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Terminal,
  Send,
  Database,
  Lock,
  Unlock,
  ChevronRight,
  Maximize2,
  Minimize2,
} from "lucide-react";

interface RepoContextType {
  repo?: string;
  [key: string]: string | undefined;
}

export default function RepoChat({
  repoContext,
}: {
  repoContext: RepoContextType;
}) {
  const [messages, setMessages] = useState<
    { id: string; role: "user" | "ai"; content: string }[]
  >([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // ✨ NEW: Fullscreen State
  const [isMaximized, setIsMaximized] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  useEffect(() => {
    if (messages.length > 0) {
      const timer = setTimeout(() => scrollToBottom(), 50);
      return () => clearTimeout(timer);
    }
  }, [messages]);

  // ✨ NEW: Handle Escape key and body scroll locking
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsMaximized(false);
    };

    if (isMaximized) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleEscape);
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isMaximized]);

  const handleSubmit = async (e?: React.FormEvent, overrideQuery?: string) => {
    e?.preventDefault();
    const query = overrideQuery || input;
    if (!query.trim() || isLoading) return;

    const newUserMsg = {
      id: Date.now().toString(),
      role: "user" as const,
      content: query,
    };
    setMessages((prev) => [...prev, newUserMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: query, repoContext: repoContext }),
      });

      if (!response.ok) throw new Error("Network response was not ok");
      const data = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "ai",
          content: data.answer || "No response received.",
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "ai",
          content: "[SYSTEM ERROR: Uplink failed.]",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickScripts = [
    {
      label: "System Architecture",
      query: "Provide a complete architectural breakdown of this repository.",
    },
    {
      label: "Trace Auth Flow",
      query: "Locate and explain the authentication and authorization logic.",
    },
    {
      label: "Extract DB Schema",
      query:
        "Map out the database models, relationships, and ORM configuration.",
    },
    {
      label: "Identify Entry Points",
      query: "Where are the primary entry points and routing definitions?",
    },
  ];

  return (
    <>
      {/* ✨ NEW: Backdrop for maximized mode */}
      {isMaximized && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[90]"
          onClick={() => setIsMaximized(false)}
        />
      )}

      {/* ✨ UPDATED: Dynamic classes for full screen */}
      <div
        className={`flex flex-col bg-[#020202] border border-white/10 rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.8)] group transition-all duration-500 ${
          isMaximized
            ? "fixed inset-4 md:inset-8 z-[100] h-[calc(100vh-32px)] md:h-[calc(100vh-64px)] w-[calc(100vw-32px)] md:w-[calc(100vw-64px)] m-auto"
            : "relative w-full h-[600px]"
        }`}
      >
        <div className="absolute inset-0 overflow-hidden pointer-events-none [perspective:800px] z-0">
          <motion.div
            animate={{ backgroundPosition: ["0px 0px", "0px 60px"] }}
            transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
            className="absolute -inset-[50%] opacity-30"
            style={{
              backgroundImage:
                "linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
              transform: "rotateX(60deg) translateZ(-100px)",
              transformOrigin: "center top",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#020202] via-transparent to-[#020202]" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#020202] via-transparent to-[#020202]" />
        </div>

        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/5 bg-[#020202]/80 backdrop-blur-md relative z-10">
          <div className="flex items-center gap-3">
            <Database className="w-4 h-4 text-slate-300" />
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-[0.2em] font-mono drop-shadow-[0_0_5px_rgba(255,255,255,0.2)]">
                Terminal_Uplink
              </h3>
              <p className="text-[9px] text-slate-500 uppercase tracking-widest font-mono mt-0.5">
                Target: {repoContext?.repo || "UNKNOWN_REPO"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {isLoading ? (
              <span className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-white font-mono">
                <Unlock className="w-3 h-3 text-white animate-pulse" />{" "}
                Decrypting...
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-slate-500 font-mono">
                <Lock className="w-3 h-3 text-slate-500" /> Secure Link
              </span>
            )}

            {/* ✨ NEW: Maximize/Minimize Button */}
            <div className="w-px h-4 bg-white/10 mx-1" />
            <button
              onClick={() => setIsMaximized(!isMaximized)}
              className="p-1.5 hover:bg-white/10 rounded-md text-slate-400 hover:text-white transition-all"
              title={isMaximized ? "Minimize" : "Maximize"}
              aria-label={isMaximized ? "Minimize chat" : "Maximize chat"}
            >
              {isMaximized ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto p-6 space-y-6 relative z-10 scrollbar-hide"
        >
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-60">
              <Terminal className="w-12 h-12 text-slate-600 mb-4 drop-shadow-xl" />
              <p className="text-sm font-mono text-slate-300 tracking-widest uppercase">
                Stream Offline
              </p>
              <p className="text-xs font-mono text-slate-500 mt-2 max-w-xs">
                Awaiting data extraction protocol to initiate uplink.
              </p>
            </div>
          ) : (
            <AnimatePresence>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className={`flex flex-col w-full ${msg.role === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[85%] font-mono text-sm leading-relaxed p-4 rounded-xl backdrop-blur-md shadow-2xl ${msg.role === "user" ? "text-slate-300 bg-white/5 border border-white/10" : "text-slate-200 bg-[#0a0a0a]/80 border-l-4 border-l-slate-400 border-y border-r border-y-white/5 border-r-white/5"}`}
                  >
                    {msg.role === "user" && (
                      <span className="block text-[9px] text-slate-500 mb-2 uppercase tracking-widest text-right">
                        Sys_User // Query
                      </span>
                    )}
                    {msg.role === "ai" && (
                      <span className="block text-[9px] text-white/50 mb-2 uppercase tracking-widest flex items-center gap-2">
                        <ChevronRight className="w-3 h-3" /> Core_Response
                      </span>
                    )}
                    <span className={msg.role === "user" ? "italic" : ""}>
                      {msg.content}
                    </span>
                  </div>
                </motion.div>
              ))}
              {isLoading && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-4 rounded-xl backdrop-blur-md bg-white/5 border-l-4 border-l-slate-500"
                >
                  <span className="block text-[9px] text-white/50 mb-2 uppercase tracking-widest flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping" />{" "}
                    Synchronizing...
                  </span>
                  <div className="h-4 w-40 bg-white/10 rounded animate-pulse" />
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>

        {messages.length === 0 && (
          <div className="px-6 pb-4 relative z-10 flex flex-wrap gap-2 justify-center">
            {quickScripts.map((script, i) => (
              <button
                key={i}
                onClick={() => handleSubmit(undefined, script.query)}
                className="text-[10px] font-mono text-slate-400 uppercase tracking-widest bg-[#0a0a0a] border border-white/10 px-3 py-2 rounded-lg hover:bg-white/10 hover:border-white/20 hover:text-white hover:shadow-[0_0_15px_rgba(255,255,255,0.05)] transition-all flex items-center gap-2 group/script"
              >
                <span className="text-slate-500 group-hover/script:text-white transition-colors">
                  {">"}
                </span>{" "}
                {script.label}
              </button>
            ))}
          </div>
        )}

        <div className="p-4 relative z-10 bg-[#020202]/90 backdrop-blur-xl border-t border-white/5">
          <form onSubmit={(e) => handleSubmit(e)} className="relative">
            <div className="relative flex items-center bg-[#0a0a0a] rounded-xl border border-white/10 p-2 shadow-inner focus-within:border-white/30 focus-within:shadow-[0_0_20px_rgba(255,255,255,0.03)] transition-all">
              <span className="text-slate-500 font-mono text-sm ml-3 font-bold select-none">
                $$
              </span>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
                placeholder="Inject query protocol..."
                className="flex-1 bg-transparent border-none outline-none text-slate-200 font-mono text-sm placeholder:text-slate-600 disabled:opacity-50 ml-3 py-2"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="mr-1 p-2 bg-white/5 text-slate-400 rounded-lg hover:bg-white/10 hover:text-white disabled:opacity-50 disabled:bg-transparent disabled:text-slate-700 transition-all"
                title="Send message"
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
