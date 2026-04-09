"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const supabase = createClient();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
    }

    setIsLoading(false);
  }

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-[#f1f5f9] flex items-center justify-center px-4">
      <div className="w-full max-w-[440px]">

        <Link href="/" className="flex items-center gap-3 mb-12 justify-center">
          <span className="text-2xl">🔬</span>
          <span className="cabinet text-xl font-bold">CodeAutopsy</span>
        </Link>

        {success ? (
          <div className="glass-card p-8 rounded-2xl text-center">
            <div className="text-4xl mb-4">📬</div>
            <h2 className="cabinet text-2xl font-bold mb-2">Check your email</h2>
            <p className="text-slate-400 text-sm">
              We sent a confirmation link to <strong className="text-white">{email}</strong>. Click it to activate your account.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-10 text-center">
              <h2 className="cabinet text-3xl font-bold mb-2">Create an account</h2>
              <p className="text-slate-400">Start analyzing codebases for free.</p>
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            <form className="space-y-5" onSubmit={handleSignup}>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  required
                  className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/5 transition-all focus:outline-none focus:border-white/20 text-sm placeholder:text-slate-700"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/5 transition-all focus:outline-none focus:border-white/20 text-sm placeholder:text-slate-700"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#f1f5f9] text-[#0e0e0e] py-3.5 rounded-xl cabinet font-bold text-sm tracking-tight hover:bg-white transition-all transform active:scale-[0.98] mt-4 flex items-center justify-center disabled:opacity-80"
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Create Account"}
              </button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-sm text-slate-500">
                Already have an account?{" "}
                <Link href="/login" className="text-white font-bold hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}