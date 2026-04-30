"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, User, Loader2 } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Props {
  repoContext: {
    owner: string;
    repo: string;
    description: string;
    language: string;
    entryPoints: string[];
    analysis: {
      architecture_pattern: string;
      what_it_does: string;
      execution_flow: string[];
      tech_stack: { name: string; purpose: string }[];
      key_modules: { file: string; role: string; why_it_exists: string }[];
    };
  };
}

const SUGGESTED_QUESTIONS = [
  "Where does the app start?",
  "How is authentication handled?",
  "What database is used?",
  "How are API routes structured?",
];

export default function RepoChat({ repoContext }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(question: string) {
    if (!question.trim() || loading) return;

    const userMessage: Message = { role: "user", content: question };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    // Strip heavy fields before sending
    const lightContext = {
      owner: repoContext.owner,
      repo: repoContext.repo,
      description: repoContext.description,
      language: repoContext.language,
      entryPoints: repoContext.entryPoints,
      analysis: repoContext.analysis,
    };

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, repoContext: lightContext }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I couldn't process that question. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="glass-card rounded-3xl overflow-hidden flex flex-col"
      style={{ height: "600px" }}
    >
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[#141414] border border-white/5 flex items-center justify-center">
          <Bot className="w-4 h-4 text-slate-400" />
        </div>
        <div>
          <h3 className="cabinet font-bold text-white text-sm">Ask the Repo</h3>
          <p className="mono text-[10px] text-slate-500">
            {repoContext.owner}/{repoContext.repo}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="mono text-[10px] text-slate-500">Ready</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center gap-6">
            <div className="text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#141414] border border-white/5 flex items-center justify-center mx-auto mb-4">
                <Bot className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-slate-400 text-sm mb-1">
                Ask anything about this codebase
              </p>
              <p className="mono text-[10px] text-slate-600 uppercase tracking-widest">
                Powered by Groq{" "}
                <span className="text-indigo-400/50">Llama 3.3</span>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  title={q}
                  className="text-left px-3 py-2 rounded-xl text-xs text-slate-400 hover:text-white transition-all hover:bg-white/5"
                  style={{ border: "1px solid rgba(255,255,255,0.05)" }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${msg.role === "user" ? "bg-white" : "bg-[#141414] border border-white/10"}`}
                >
                  {msg.role === "user" ? (
                    <User className="w-3.5 h-3.5 text-black" />
                  ) : (
                    <Bot className="w-3.5 h-3.5 text-slate-400" />
                  )}
                </div>
                <div
                  className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-white text-black rounded-tr-sm"
                      : "bg-[#141414] text-slate-300 rounded-tl-sm border border-white/5"
                  }`}
                >
                  {msg.content}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}

        {loading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex gap-3"
          >
            <div className="w-7 h-7 rounded-lg bg-[#141414] border border-white/10 flex items-center justify-center">
              <Bot className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="px-4 py-3 rounded-2xl rounded-tl-sm bg-[#141414] border border-white/5 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
              <span className="mono text-[10px] text-slate-500">
                Analyzing...
              </span>
            </div>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-4 border-t border-white/5">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
            placeholder="Ask about this codebase..."
            disabled={loading}
            className="flex-1 bg-[#0a0a0a] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-white/20 disabled:opacity-50"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            aria-label="Send message"
            className="w-10 h-10 rounded-xl bg-white flex items-center justify-center hover:bg-slate-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed active:scale-95"
          >
            <Send className="w-4 h-4 text-black" />
          </button>
        </div>
      </div>
    </div>
  );
}
