"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";

interface DebugFormProps {
  onSubmit: (stackTrace: string) => void;
  isLoading: boolean;
}

const EXAMPLE_TRACES = [
  {
    label: "TypeError Example",
    trace: `TypeError: Cannot read properties of undefined (reading 'map')
    at UserList (components/UserList.tsx:42:15)
    at renderWithHooks (node_modules/react-dom/cjs/react-dom.development.js:14985:18)`,
  },
  {
    label: "Reference Error",
    trace: `ReferenceError: fetchData is not defined
    at loadUsers (lib/api.ts:23:10)
    at Dashboard (app/dashboard/page.tsx:15:5)`,
  },
];

export function DebugForm({ onSubmit, isLoading }: DebugFormProps) {
  const [trace, setTrace] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (trace.trim()) {
      onSubmit(trace);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Example Traces */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-slate-500 uppercase tracking-wider">Quick Test:</span>
        {EXAMPLE_TRACES.map((example) => (
          <button
            key={example.label}
            type="button"
            onClick={() => setTrace(example.trace)}
            className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-slate-400 hover:text-white transition-all"
          >
            {example.label}
          </button>
        ))}
      </div>

      {/* Textarea */}
      <div className="flex flex-col gap-2">
        <label htmlFor="stackTrace" className="text-sm font-medium text-gray-300 ml-1">
          Paste your stack trace or error message
        </label>
        <textarea
          id="stackTrace"
          value={trace}
          onChange={(e) => setTrace(e.target.value)}
          placeholder="TypeError: Cannot read properties of undefined (reading 'map')&#10;    at UserList (components/UserList.tsx:42:15)"
          className="min-h-[200px] p-4 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl font-mono text-sm text-gray-200 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 outline-none resize-y transition-all placeholder:text-gray-600"
          disabled={isLoading}
        />
        <p className="text-xs text-slate-500 ml-1">
          💡 Tip: Include file paths and line numbers for best results
        </p>
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading || !trace.trim()}
        className="w-full px-8 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)] flex items-center justify-center gap-2"
      >
        {isLoading ? (
          <>
            <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            Analyzing Architecture...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            Diagnose Crash
          </>
        )}
      </button>
    </form>
  );
}