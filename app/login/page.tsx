"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Zap, GitBranch, Terminal, Loader2, Check } from "lucide-react";
import { FaGithub } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";
import { createClient } from "@/lib/supabase-browser";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"github" | "google" | null>(
    null,
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  async function handleEmailLogin(e: React.SyntheticEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setIsLoading(false);
    } else {
      const params = new URLSearchParams(window.location.search);
      const redirect = params.get("redirect") || "/";
      window.location.href = redirect;
    }
  }

  async function handleOAuth(provider: "github" | "google") {
    setOauthLoading(provider);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        // ✨ THE FIX: Only ask for the 'repo' scope if the provider is GitHub
        scopes: provider === "github" ? "repo" : undefined,
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setOauthLoading(null);
    }
  }

  // ✨ Added the Forgot Password handler we discussed earlier
  const handleForgotPassword = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your email address first to reset your password.");
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    setIsLoading(false);
    if (error) {
      setError(error.message);
    } else {
      alert("Password reset link sent! Check your email.");
    }
  };

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-[#f1f5f9] flex flex-col md:flex-row">
      <div className="hidden md:flex md:w-1/2 lg:w-3/5 p-12 lg:p-24 flex-col justify-between relative overflow-hidden border-r border-white/5">
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(circle at 2px 2px, rgba(255,255,255,0.05) 1px, transparent 0)",
            backgroundSize: "40px 40px",
          }}
        />
        <div
          className="absolute top-1/4 -left-20 w-96 h-96 bg-white/5 rounded-full blur-[120px] animate-pulse"
          style={{ animationDuration: "4s" }}
        />

        <div className="relative z-10">
          <Link href="/" className="flex items-center gap-3 mb-16 group">
            <Image
              src="/codeautopsy-logo1.png"
              alt="CodeAutopsy Logo"
              width={32}
              height={32}
              className="transition-transform group-hover:scale-110"
            />
            <span className="cabinet text-2xl font-bold tracking-tight text-slate-100">
              CodeAutopsy
            </span>
          </Link>

          <div className="max-w-xl">
            <h1 className="cabinet text-5xl lg:text-6xl font-extrabold leading-[1.1] mb-8 tracking-tight">
              Decode the complexity of{" "}
              <span className="text-slate-500">any codebase.</span>
            </h1>
            <p className="text-xl text-slate-400 leading-relaxed mb-12">
              AI-powered intelligence that transforms sprawling repositories
              into clear, actionable insights in seconds.
            </p>

            <div className="flex flex-col gap-6">
              {[
                { icon: Zap, text: "Instant architecture mapping" },
                {
                  icon: GitBranch,
                  text: "Dependency relationship visualization",
                },
                { icon: Terminal, text: "Developer-first technical clarity" },
              ].map(({ icon: Icon, text }) => (
                <div key={text} className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span className="font-medium text-slate-300">{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-sm text-slate-500 font-medium">
            &copy; 2026 CodeAutopsy Inc. All rights reserved.
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-12 lg:p-24">
        <div className="md:hidden mb-12">
          <Link href="/" className="flex items-center gap-3 group">
            <Image
              src="/codeautopsy-logo1.png"
              alt="CodeAutopsy Logo"
              width={28}
              height={28}
              className="transition-transform group-hover:scale-110"
            />
            <span className="cabinet text-xl font-bold text-slate-100">
              CodeAutopsy
            </span>
          </Link>
        </div>

        <div className="w-full max-w-[440px]">
          <div className="mb-10 text-center md:text-left">
            <h2 className="cabinet text-3xl font-bold mb-2 tracking-tight">
              Welcome back
            </h2>
            <p className="text-slate-400">
              Sign in to continue your codebase autopsy.
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            <button
              onClick={() => handleOAuth("github")}
              disabled={oauthLoading !== null}
              className="btn-gray px-4 py-3 rounded-xl flex items-center justify-center gap-3 text-sm font-bold active:scale-95 disabled:opacity-50"
            >
              {oauthLoading === "github" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FaGithub className="text-xl" />
              )}
              GitHub
            </button>
            <button
              onClick={() => handleOAuth("google")}
              disabled={oauthLoading !== null}
              className="btn-gray px-4 py-3 rounded-xl flex items-center justify-center gap-3 text-sm font-bold active:scale-95 disabled:opacity-50"
            >
              {oauthLoading === "google" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FcGoogle className="text-xl" />
              )}
              Google
            </button>
          </div>

          <div className="relative mb-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/5"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase tracking-widest">
              <span className="bg-[#0e0e0e] px-4 text-slate-500 font-bold">
                Or email
              </span>
            </div>
          </div>

          <form className="space-y-5" onSubmit={handleEmailLogin}>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-slate-500">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/5 transition-all focus:outline-none focus:border-white/20 text-sm placeholder:text-slate-700"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold uppercase tracking-widest text-slate-500">
                  Password
                </label>
                <button
                  onClick={handleForgotPassword}
                  className="text-xs font-bold text-slate-400 hover:text-white transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl bg-black/30 border border-white/5 transition-all focus:outline-none focus:border-white/20 text-sm placeholder:text-slate-700"
              />
            </div>

            <div className="flex items-center gap-3">
              <div className="relative flex items-center">
                <input
                  type="checkbox"
                  id="remember"
                  className="peer w-4 h-4 rounded border-white/10 bg-white/5 checked:bg-white checked:border-white transition-all appearance-none cursor-pointer"
                />
                <Check className="w-3 h-3 absolute text-black pointer-events-none opacity-0 peer-checked:opacity-100 left-[2px]" />
              </div>
              <label
                htmlFor="remember"
                className="text-sm text-slate-400 cursor-pointer select-none"
              >
                Keep me logged in
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#f1f5f9] text-[#0e0e0e] py-3.5 rounded-xl cabinet font-bold text-sm tracking-tight hover:bg-white transition-all transform active:scale-[0.98] mt-4 flex items-center justify-center disabled:opacity-80"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <div className="mt-10 text-center">
            <p className="text-sm text-slate-500">
              Do not have an account?{" "}
              <Link
                href="/signup"
                className="text-white font-bold hover:underline"
              >
                Create an account
              </Link>
            </p>
          </div>

          <div className="mt-16 flex justify-center gap-6">
            {/* ✨ Linked up your footer as discussed */}
            <Link
              href="/terms"
              className="text-[11px] text-slate-600 hover:text-slate-400 uppercase tracking-widest transition-colors"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="text-[11px] text-slate-600 hover:text-slate-400 uppercase tracking-widest transition-colors"
            >
              Privacy
            </Link>
            <a
              href="mailto:support@codeautopsy.app"
              className="text-[11px] text-slate-600 hover:text-slate-400 uppercase tracking-widest transition-colors"
            >
              Support
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
