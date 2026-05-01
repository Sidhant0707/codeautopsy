"use client";

import React, { useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();
  const router = useRouter();

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/login");
    }
  };

  return (
    <div className="min-h-screen bg-[#0e0e0e] flex items-center justify-center p-6">
      <form
        onSubmit={handleUpdatePassword}
        className="glass-card p-8 rounded-2xl w-full max-w-md border border-white/5"
      >
        <h2 className="cabinet text-3xl font-bold text-white mb-2">
          Set New Password
        </h2>
        <p className="text-slate-400 mb-8">
          Enter your new secure password below.
        </p>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-2 mb-6">
          <label className="text-xs font-bold uppercase tracking-widest text-slate-500">
            New Password
          </label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={6}
            className="w-full bg-black/30 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-white/20 text-sm"
          />
        </div>

        <button
          disabled={loading}
          className="w-full bg-[#f1f5f9] text-[#0e0e0e] py-3.5 rounded-xl cabinet font-bold text-sm tracking-tight hover:bg-white transition-all transform active:scale-[0.98] flex items-center justify-center"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            "Update Password"
          )}
        </button>
      </form>
    </div>
  );
}
