// components/interview/InterviewChatPanel.tsx
"use client";

import { useState, useRef, useEffect, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, ChevronRight, Cpu, X, MessageSquare } from "lucide-react";
import { useInterviewStore } from "@/lib/stores/useInterviewStore";
import {
  handleInterviewStreamResponse,
  type InterviewChatMessage,
} from "@/lib/interview/chat-logic";

// ============================================================================
// MESSAGE BUBBLE
// ============================================================================

const InterviewMessage = memo(
  ({
    msg,
    isStreaming,
  }: {
    msg: InterviewChatMessage;
    isStreaming: boolean;
  }) => (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex flex-col w-full ${msg.role === "user" ? "items-end" : "items-start"}`}
    >
      <div
        className={`max-w-[88%] font-mono text-[12px] leading-relaxed p-3.5 rounded-xl ${
          msg.role === "user"
            ? "bg-white/[0.04] border border-white/10 text-slate-300 rounded-tr-sm"
            : "bg-[#0a0a0a]/90 border border-white/5 border-l-2 border-l-cyan-400 text-slate-200 rounded-tl-sm"
        }`}
      >
        {/* Role label */}
        {msg.role === "user" ? (
          <span className="block text-[8px] uppercase tracking-widest text-slate-500 text-right mb-2">
            You
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[8px] uppercase tracking-widest text-cyan-500/70 mb-2">
            <ChevronRight className="w-2.5 h-2.5" />
            Interviewer
          </span>
        )}

        {/* Content */}
        <span className="whitespace-pre-wrap">{msg.content}</span>

        {/* Streaming cursor */}
        {isStreaming && msg.content.length > 0 && (
          <span className="inline-block w-1.5 h-3.5 bg-cyan-400 ml-1 align-middle animate-pulse" />
        )}
      </div>
    </motion.div>
  ),
);
InterviewMessage.displayName = "InterviewMessage";

// ============================================================================
// QUICK START PROMPTS
// ============================================================================

const INTERVIEW_STARTERS = [
  {
    label: "Start Interview",
    query:
      "Begin the code review interview. Ask me about the entry point of this codebase.",
  },
  {
    label: "Architecture Q&A",
    query:
      "Ask me a question about the overall architecture pattern used in this codebase.",
  },
  {
    label: "Quiz a Module",
    query: "Pick the most complex module and ask me to explain it.",
  },
] as const;

// ============================================================================
// PROPS
// ============================================================================

interface InterviewChatPanelProps {
  dependencyGraph: Record<string, string[]>;
  entryPoints: string[];
  fileContents?: Record<string, string>;
}

// ============================================================================
// PANEL
// ============================================================================

export default function InterviewChatPanel({
  dependencyGraph,
  entryPoints,
  fileContents,
}: InterviewChatPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<InterviewChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [userScrolledUp, setUserScrolledUp] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const setInterviewMode = useInterviewStore((s) => s.setInterviewMode);
  const clearActiveNodes = useInterviewStore((s) => s.clearActiveNodes);

  // ── Activate / deactivate interview mode with panel visibility ──
  useEffect(() => {
    setInterviewMode(isOpen);
    if (!isOpen) clearActiveNodes();
  }, [isOpen, setInterviewMode, clearActiveNodes]);

  // ── Focus input when panel opens ──
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // ── Auto-scroll to bottom on new messages ──
  useEffect(() => {
    if (!userScrolledUp && scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, userScrolledUp]);

  // ── Abort stream on unmount ──
  useEffect(
    () => () => {
      abortRef.current?.abort();
    },
    [],
  );

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setUserScrolledUp(scrollHeight - scrollTop - clientHeight > 60);
  }, []);

  // ============================================================================
  // SUBMIT
  // ============================================================================

  const handleSubmit = useCallback(
    async (e?: React.FormEvent, override?: string) => {
      e?.preventDefault();
      const query = override ?? input;
      if (!query.trim() || isLoading) return;

      // Cancel any in-flight request
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      const userMsg: InterviewChatMessage = {
        id: Date.now().toString(),
        role: "user",
        content: query,
      };

      const assistantMsgId = (Date.now() + 1).toString();
      const assistantMsg: InterviewChatMessage = {
        id: assistantMsgId,
        role: "assistant",
        content: "",
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput("");
      setIsLoading(true);
      setUserScrolledUp(false);

      try {
        // Build a trimmed context — enough for the interviewer, cheap on tokens
        const codebaseContext = {
          dependencyGraph,
          entryPoints,
          fileList: Object.keys(dependencyGraph),
          // First 10 files, first 500 chars each — enough for file-level questions
          fileContents: fileContents
            ? Object.fromEntries(
                Object.entries(fileContents)
                  .slice(0, 10)
                  .map(([k, v]) => [k, (v ?? "").substring(0, 500)]),
              )
            : {},
        };

        const apiMessages = [...messages, userMsg].map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const res = await fetch("/api/interview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: apiMessages, codebaseContext }),
          signal: abortRef.current.signal,
        });

        if (!res.ok || !res.body) throw new Error("Stream failed");

        await handleInterviewStreamResponse(res.body, {
          onToken: (visibleText) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId ? { ...m, content: visibleText } : m,
              ),
            );
          },
          onComplete: (finalMessage) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId ? { ...m, content: finalMessage } : m,
              ),
            );
          },
          onError: (errMsg) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId ? { ...m, content: errMsg } : m,
              ),
            );
          },
        });
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    content: "[SYSTEM ERROR: Interview stream disconnected.]",
                  }
                : m,
            ),
          );
        }
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [input, isLoading, messages, dependencyGraph, entryPoints, fileContents],
  );

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <>
      {/* ── Toggle button — bottom-right of canvas ── */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ opacity: 0, scale: 0.85, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 8 }}
            transition={{ type: "spring", stiffness: 400, damping: 28 }}
            onClick={() => setIsOpen(true)}
            className="absolute bottom-6 right-6 z-20 flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#141414]/95 border border-cyan-500/30 shadow-[0_0_20px_rgba(34,211,238,0.12)] hover:border-cyan-400/60 hover:shadow-[0_0_28px_rgba(34,211,238,0.22)] transition-all group backdrop-blur-md"
            aria-label="Open interview mode"
          >
            <div className="relative">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-cyan-300 leading-none">
                Interview Mode
              </span>
              <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest mt-0.5">
                AI Code Review
              </span>
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Floating panel ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 32, scale: 0.97 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 32, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            className="absolute bottom-4 right-4 z-20 w-[360px] h-[520px] flex flex-col rounded-2xl bg-[#0e0e0e]/97 border border-cyan-500/20 shadow-[0_0_40px_rgba(34,211,238,0.08),0_20px_60px_rgba(0,0,0,0.85)] backdrop-blur-xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#141414]/80">
              <div className="flex items-center gap-2.5">
                <div className="relative flex-shrink-0">
                  <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse" />
                </div>
                <div>
                  <h3 className="text-[10px] font-bold font-mono uppercase tracking-widest text-cyan-300 leading-none">
                    Interview Mode
                  </h3>
                  <p className="text-[8px] font-mono text-slate-500 uppercase tracking-widest mt-0.5">
                    {isLoading
                      ? "Interviewer is typing..."
                      : `${messages.length === 0 ? "Ready" : `${Math.ceil(messages.length / 2)} exchanges`}`}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-500 hover:text-white transition-colors"
                aria-label="Close interview panel"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar"
            >
              {messages.length === 0 ? (
                // ── Empty state with quick-start prompts ──
                <div className="h-full flex flex-col items-center justify-center text-center gap-4 pb-4">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shadow-[0_0_20px_rgba(34,211,238,0.1)]">
                    <MessageSquare className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-[11px] font-mono font-bold text-slate-200 uppercase tracking-widest">
                      Code Review Interview
                    </p>
                    <p className="text-[10px] font-mono text-slate-500 mt-1.5 max-w-[240px] leading-relaxed">
                      Nodes on the map light up as the AI asks about specific
                      files
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5 w-full mt-1">
                    {INTERVIEW_STARTERS.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => handleSubmit(undefined, s.query)}
                        disabled={isLoading}
                        className="w-full text-left text-[10px] font-mono text-slate-400 bg-[#141414] border border-white/5 hover:border-cyan-500/30 hover:text-cyan-300 hover:bg-cyan-500/5 px-3 py-2.5 rounded-xl transition-all flex items-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-cyan-400 transition-colors flex-shrink-0" />
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {messages.map((msg, idx) => (
                    <InterviewMessage
                      key={msg.id}
                      msg={msg}
                      isStreaming={
                        isLoading &&
                        idx === messages.length - 1 &&
                        msg.role === "assistant"
                      }
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>

            {/* Input */}
            <div className="flex-shrink-0 p-3 border-t border-white/5 bg-[#141414]/60">
              <form onSubmit={handleSubmit}>
                <div className="flex items-center bg-[#0a0a0a] rounded-xl border border-white/10 p-1.5 focus-within:border-cyan-500/40 focus-within:shadow-[0_0_15px_rgba(34,211,238,0.06)] transition-all">
                  <span
                    className="text-cyan-500/50 font-mono text-xs ml-2 font-bold select-none"
                    aria-hidden="true"
                  >
                    &gt;
                  </span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={isLoading}
                    placeholder="Answer or ask a question..."
                    aria-label="Interview message input"
                    className="flex-1 bg-transparent border-none outline-none text-slate-200 font-mono text-[12px] placeholder:text-slate-600 disabled:opacity-50 ml-2 py-1.5"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || isLoading}
                    aria-label="Send message"
                    className="mr-1 p-1.5 bg-white/5 text-slate-400 rounded-lg hover:bg-cyan-500/20 hover:text-cyan-400 disabled:opacity-30 disabled:bg-transparent disabled:cursor-not-allowed transition-all"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
