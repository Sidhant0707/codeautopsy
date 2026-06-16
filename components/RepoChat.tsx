"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState, useRef, useEffect, memo, useCallback } from "react";
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
  Copy,
  Check,
} from "lucide-react";

interface RepoContextType {
  repo?: string;
  [key: string]: string | undefined;
}

// --- PRINCIPAL UPGRADE: Extract Constants (No Re-allocation) ---
const QUICK_SCRIPTS = [
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
    query: "Map out the database models, relationships, and ORM configuration.",
  },
  {
    label: "Identify Entry Points",
    query: "Where are the primary entry points and routing definitions?",
  },
] as const;

// --- PRINCIPAL UPGRADE: Memoized Code Block (Prevents ReactMarkdown Re-renders) ---
const CodeBlock = memo(
  ({
    inline,
    className,
    children,
    ...props
  }: {
    inline?: boolean;
    className?: string;
    children?: React.ReactNode;
  } & React.HTMLAttributes<HTMLElement>) => {
    const [copied, setCopied] = useState(false);
    const match = /language-(\w+)/.exec(className || "");
    const language = match ? match[1] : "text";
    const codeString = String(children).replace(/\n$/, "");

    const handleCopy = useCallback(() => {
      navigator.clipboard.writeText(codeString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }, [codeString]);

    if (inline) {
      return (
        <code
          className="px-1.5 py-0.5 rounded-md bg-white/10 text-amber-200 font-mono text-[13px]"
          {...props}
        >
          {children}
        </code>
      );
    }

    return (
      <div className="my-4 rounded-xl overflow-hidden border border-white/10 bg-[#050505] shadow-2xl">
        <div className="flex items-center justify-between px-4 py-2 bg-white/[0.04] border-b border-white/5">
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400">
            {language}
          </span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-mono text-slate-400 hover:text-white transition-colors"
            aria-label={copied ? "Code copied" : "Copy code"}
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <div className="p-4 overflow-x-auto custom-scrollbar">
          <code
            className="text-[13px] font-mono text-emerald-300/90 leading-relaxed block"
            {...props}
          >
            {children}
          </code>
        </div>
      </div>
    );
  },
);
CodeBlock.displayName = "CodeBlock";

// --- PRINCIPAL UPGRADE: Memoized Message Component (Prevents Full Re-render Tree) ---
const Message = memo(
  ({
    msg,
    isStreaming,
  }: {
    msg: { id: string; role: "user" | "ai"; content: string };
    isStreaming: boolean;
  }) => {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className={`flex flex-col w-full ${msg.role === "user" ? "items-end" : "items-start"}`}
      >
        <div
          className={`max-w-[90%] font-mono text-sm leading-relaxed p-5 rounded-2xl backdrop-blur-md shadow-2xl ${
            msg.role === "user"
              ? "text-slate-300 bg-white/[0.03] border border-white/10 rounded-tr-sm"
              : "text-slate-200 bg-[#0a0a0a]/90 border border-white/5 border-l-4 border-l-slate-400 rounded-tl-sm"
          }`}
        >
          {msg.role === "user" && (
            <span className="block text-[9px] text-slate-500 mb-3 uppercase tracking-widest text-right">
              Sys_User
            </span>
          )}
          {msg.role === "ai" && (
            <span className="block text-[9px] text-white/50 mb-3 uppercase tracking-widest flex items-center gap-2">
              <ChevronRight className="w-3 h-3" /> Core_Response
            </span>
          )}

          {msg.role === "ai" ? (
            <div className="prose prose-sm prose-invert max-w-none prose-p:mb-4 prose-p:leading-relaxed prose-headings:mt-6 prose-headings:mb-3 prose-headings:text-white prose-li:my-1 prose-strong:text-white">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code: CodeBlock,
                  p: ({ children }) => (
                    <div className="mb-4 leading-relaxed">{children}</div>
                  ),
                }}
              >
                {msg.content}
              </ReactMarkdown>

              {/* --- PRINCIPAL UPGRADE: Pure CSS Blinking Cursor (No JS Animation) --- */}
              {isStreaming && (
                <span className="inline-block w-2 h-4 bg-emerald-400 ml-1 align-middle animate-pulse" />
              )}
            </div>
          ) : (
            <span className="text-[13px]">{msg.content}</span>
          )}
        </div>
      </motion.div>
    );
  },
);
Message.displayName = "Message";

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
  const [isMaximized, setIsMaximized] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [userHasScrolledUp, setUserHasScrolledUp] = useState(false);

  // --- PRINCIPAL UPGRADE: AbortController to Cancel Streams ---
  const abortControllerRef = useRef<AbortController | null>(null);

  // --- PRINCIPAL UPGRADE: Focus Trap Refs ---
  const modalRef = useRef<HTMLDivElement>(null);
  const maximizeButtonRef = useRef<HTMLButtonElement>(null);

  // --- PRINCIPAL UPGRADE: Debounced Scroll Handler (Prevents 60fps Overhead) ---
  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } =
      scrollContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setUserHasScrolledUp(!isAtBottom);
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (!userHasScrolledUp && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, userHasScrolledUp]);

  // --- PRINCIPAL UPGRADE: Focus Trap in Maximized Modal ---
  useEffect(() => {
    if (!isMaximized) return;

    const modal = modalRef.current;
    if (!modal) return;

    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const trapFocus = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMaximized(false);
        maximizeButtonRef.current?.focus(); // Return focus to trigger
      }
    };

    firstElement?.focus();
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", trapFocus);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = "unset";
      document.removeEventListener("keydown", trapFocus);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isMaximized]);

  // --- PRINCIPAL UPGRADE: Abort Stream on Unmount ---
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent, overrideQuery?: string) => {
      e?.preventDefault();
      const query = overrideQuery || input;
      if (!query.trim() || isLoading) return;

      // --- PRINCIPAL UPGRADE: Abort Previous Stream ---
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      const newUserMsg = {
        id: Date.now().toString(),
        role: "user" as const,
        content: query,
      };

      setMessages((prev) => [...prev, newUserMsg]);
      setInput("");
      setIsLoading(true);
      setUserHasScrolledUp(false);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...messages, newUserMsg].map((msg) => ({
              role: msg.role === "ai" ? "assistant" : "user",
              content: msg.content,
            })),
            repoContext,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) throw new Error("Network response was not ok");
        if (!response.body) throw new Error("No response body");

        const aiMsgId = (Date.now() + 1).toString();
        setMessages((prev) => [
          ...prev,
          { id: aiMsgId, role: "ai", content: "" },
        ]);

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let done = false;

        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk
              .split("\n")
              .filter((line) => line.trim() !== "");

            for (const line of lines) {
              if (line.replace(/^data: /, "") === "[DONE]") {
                done = true;
                break;
              }
              if (line.startsWith("data: ")) {
                try {
                  const parsed = JSON.parse(line.replace(/^data: /, ""));
                  const token = parsed.choices[0]?.delta?.content;
                  if (token) {
                    setMessages((prev) =>
                      prev.map((msg) =>
                        msg.id === aiMsgId
                          ? { ...msg, content: msg.content + token }
                          : msg,
                      ),
                    );
                  }
                } catch {
                  // Ignore incomplete chunks
                }
              }
            }
          }
        }
      } catch (err) {
        // Only show error if not aborted by user
        if (err instanceof Error && err.name !== "AbortError") {
          setMessages((prev) => [
            ...prev,
            {
              id: (Date.now() + 1).toString(),
              role: "ai",
              content: "`[SYSTEM ERROR: Uplink failed. Stream disconnected.]`",
            },
          ]);
        }
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [input, isLoading, messages, repoContext],
  );

  const toggleMaximize = useCallback(() => {
    setIsMaximized((prev) => !prev);
  }, []);

  return (
    <>
      {isMaximized && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[90]"
          onClick={toggleMaximize}
          aria-hidden="true"
        />
      )}

      <div
        ref={modalRef}
        {...(isMaximized && {
          role: "dialog",
          "aria-modal": true,
          "aria-label": "Chat interface",
        })}
        className={`flex flex-col bg-[#020202] border border-white/10 rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.8)] group transition-all duration-500 ${
          isMaximized
            ? "fixed inset-4 md:inset-8 z-[100] h-[calc(100vh-32px)] md:h-[calc(100vh-64px)] w-[calc(100vw-32px)] md:w-[calc(100vw-64px)] m-auto"
            : "relative w-full h-[600px]"
        }`}
      >
        {/* --- PRINCIPAL UPGRADE: Pause Animation When Not Visible --- */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none [perspective:800px] z-0">
          <motion.div
            animate={
              isMaximized ? { backgroundPosition: ["0px 0px", "0px 60px"] } : {}
            }
            transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
            className="absolute -inset-[50%] opacity-20"
            style={{
              willChange: "background-position",
              backgroundImage:
                "linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
              transform: "rotateX(60deg) translateZ(-100px)",
              transformOrigin: "center top",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#020202] via-transparent to-[#020202]" />
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
            {/* --- PRINCIPAL UPGRADE: ARIA Live Region for Screen Readers --- */}
            <div aria-live="polite" aria-atomic="true" className="sr-only">
              {isLoading && "AI is responding"}
            </div>

            {isLoading ? (
              <span className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-emerald-400 font-mono animate-pulse">
                <Unlock className="w-3 h-3" />
                Receiving Data...
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-slate-500 font-mono">
                <Lock className="w-3 h-3" />
                Secure Link
              </span>
            )}
            <div className="w-px h-4 bg-white/10 mx-1" />
            <button
              type="button"
              ref={maximizeButtonRef}
              onClick={toggleMaximize}
              className="p-1.5 hover:bg-white/10 rounded-md text-slate-400 hover:text-white transition-all group"
              aria-label={isMaximized ? "Minimize chat" : "Maximize chat"}
            >
              {isMaximized ? (
                <Minimize2 className="w-4 h-4 group-hover:scale-90 transition-transform" />
              ) : (
                <Maximize2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
              )}
            </button>
          </div>
        </div>

        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-6 space-y-6 relative z-10 custom-scrollbar scroll-smooth"
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
              {messages.map((msg, idx) => (
                <Message
                  key={msg.id}
                  msg={msg}
                  isStreaming={isLoading && idx === messages.length - 1}
                />
              ))}
            </AnimatePresence>
          )}
        </div>

        {messages.length === 0 && (
          <div className="px-6 pb-4 relative z-10 flex flex-wrap gap-2 justify-center">
            {QUICK_SCRIPTS.map((script, i) => (
              <button
                key={i}
                onClick={() => handleSubmit(undefined, script.query)}
                disabled={isLoading}
                className="text-[10px] font-mono text-slate-400 uppercase tracking-widest bg-[#0a0a0a] border border-white/10 px-3 py-2 rounded-lg hover:bg-white/10 hover:border-white/20 hover:text-white hover:shadow-[0_0_15px_rgba(255,255,255,0.05)] transition-all flex items-center gap-2 group/script disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={`Quick action: ${script.label}`}
              >
                <span className="text-slate-500 group-hover/script:text-emerald-400 transition-colors">
                  {">"}
                </span>
                {script.label}
              </button>
            ))}
          </div>
        )}

        <div className="p-4 relative z-10 bg-[#020202]/90 backdrop-blur-xl border-t border-white/5">
          <form onSubmit={(e) => handleSubmit(e)} className="relative">
            <div className="relative flex items-center bg-[#0a0a0a] rounded-xl border border-white/10 p-2 shadow-inner focus-within:border-emerald-500/30 focus-within:shadow-[0_0_20px_rgba(16,185,129,0.05)] transition-all">
              <span
                className="text-emerald-500/70 font-mono text-sm ml-3 font-bold select-none"
                aria-hidden="true"
              >
                $$
              </span>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isLoading}
                placeholder="Enter your query..."
                aria-label="Chat message input"
                className="flex-1 bg-transparent border-none outline-none text-slate-200 font-mono text-[13px] placeholder:text-slate-600 disabled:opacity-50 ml-3 py-2"
              />
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                aria-label="Send message"
                className="mr-1 p-2 bg-white/5 text-slate-400 rounded-lg hover:bg-emerald-500/20 hover:text-emerald-400 disabled:opacity-50 disabled:bg-transparent disabled:text-slate-700 transition-all group"
              >
                <Send className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
