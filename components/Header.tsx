"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { LayoutGrid, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";
import { User } from "@supabase/supabase-js";

export default function Header() {
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showPulse, setShowPulse] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      },
    );

    return () => listener.subscription.unsubscribe();
  }, [supabase.auth]);

  
  useEffect(() => {
    if (typeof window !== "undefined") {
      const hasSeenTool = localStorage.getItem("seenPRTool");
      if (!hasSeenTool) {
        const t = setTimeout(() => setShowPulse(true), 0);
        return () => clearTimeout(t);
      }
    }
  }, []);

  const handleDashboardClick = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("seenPRTool", "true");
    }
    setShowPulse(false);
    setMenuOpen(false);
  };

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <header className="sticky top-0 z-50 w-full px-4 sm:px-6 py-4 flex items-center justify-between bg-[rgba(22,22,22,0.6)] backdrop-blur-[12px] border-b border-white/[0.05]">
      <Link href="/" className="cursor-pointer flex items-center gap-3 group">
        <Image
          src="/codeautopsy-logo1.png"
          alt="Logo"
          width={32}
          height={32}
          className="h-auto w-auto transition-transform group-hover:scale-110"
        />
        <span className="text-xl font-bold tracking-tight text-slate-100 hidden sm:block">
          CodeAutopsy
        </span>
      </Link>

      <nav className="hidden md:flex items-center gap-8">
        <Link
          href="/about"
          className="cursor-pointer text-slate-400 hover:text-white transition-colors text-sm font-medium"
        >
          About
        </Link>
        <Link
          href="/#features"
          className="cursor-pointer text-slate-400 hover:text-white transition-colors text-sm font-medium"
        >
          Features
        </Link>
        <Link
          href="/pricing"
          className="cursor-pointer text-slate-400 hover:text-white transition-colors text-sm font-medium"
        >
          Pricing
        </Link>
      </nav>

      <div className="flex items-center gap-4">
        {user ? (
          <div className="flex items-center gap-2 sm:gap-4">
            {}
            <Link
              href="/dashboard"
              onClick={handleDashboardClick}
              className="relative hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-all font-mono text-xs uppercase tracking-widest"
            >
              {showPulse && (
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-200 opacity-80"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-slate-100 shadow-[0_0_10px_rgba(241,245,249,0.8)]"></span>
                </span>
              )}
              <LayoutGrid className="w-4 h-4" />
              Dashboard
            </Link>

            <div className="relative">
              {}
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                title={user.email || "Account settings"}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-[#1a1a1a] hover:bg-white/10 border border-white/10 transition-all focus:outline-none focus:ring-2 focus:ring-white/20 active:scale-95"
              >
                <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-sm font-bold text-white shadow-inner">
                  {user.email?.[0].toUpperCase()}
                </div>
              </button>

              {menuOpen && (
                <>
                  {}
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setMenuOpen(false)}
                  />

                  <div className="absolute right-0 mt-2 w-56 rounded-xl overflow-hidden shadow-2xl z-50 bg-[#141414] border border-white/10">
                    {}
                    <div className="px-4 py-3 border-b border-white/5 bg-[#1a1a1a]/50">
                      <p className="text-sm font-medium text-slate-200 truncate">
                        {user.email}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest mt-1">
                        Free Tier
                      </p>
                    </div>

                    {}
                    <Link
                      href="/dashboard"
                      onClick={handleDashboardClick}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors md:hidden relative"
                    >
                      <LayoutGrid className="w-4 h-4" />
                      <span className="relative flex items-center">
                        Dashboard
                        {showPulse && (
                          <span className="absolute -right-3 -top-0.5 flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-200 opacity-80"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-100 shadow-[0_0_8px_rgba(241,245,249,0.8)]"></span>
                          </span>
                        )}
                      </span>
                    </Link>

                    <Link
                      href="/profile"
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <div className="w-4 h-4 rounded-full border border-current flex items-center justify-center overflow-hidden">
                        {}
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="w-3 h-3 mt-1"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
                          />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      </div>
                      Account Settings
                    </Link>

                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-400 hover:text-white hover:bg-[#ff4444]/10 hover:text-[#ff4444] transition-colors border-t border-white/5"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <>
            <Link
              href="/login"
              className="cursor-pointer text-sm font-medium text-slate-400 hover:text-white transition-colors"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="cursor-pointer px-5 py-2 rounded-lg text-sm font-bold text-white transition-all hover:bg-[#222] active:scale-95 bg-[#1a1a1a] border border-white/10"
            >
              Sign up
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
