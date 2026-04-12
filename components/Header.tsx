"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase-browser";
import { User } from "@supabase/supabase-js";
import { LogOut, ChevronDown } from "lucide-react";

export default function Header() {
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut(); // Simplified logout call
    window.location.href = "/";
  }

  return (
    <header
      className="sticky top-0 z-50 w-full px-6 py-4 flex items-center justify-between"
      style={{
        background: "rgba(22,22,22,0.6)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid rgba(255,255,255,0.05)",
      }}
    >
      <Link href="/" className="cursor-pointer flex items-center gap-3 group">
        <Image 
          src="/codeautopsy-logo1.png" 
          alt="Logo" 
          width={32} 
          height={32}
          style={{ width: 'auto', height: 'auto' }} 
          className="transition-transform group-hover:scale-110"
        />
        <span className="text-xl font-bold tracking-tight text-slate-100">CodeAutopsy</span>
      </Link>

      <nav className="hidden md:flex items-center gap-8">
        <Link href="/about" className="cursor-pointer text-slate-400 hover:text-white transition-colors text-sm font-medium">
          About
        </Link>
        <Link href="/#features" className="cursor-pointer text-slate-400 hover:text-white transition-colors text-sm font-medium">
          Features
        </Link>
        {/* Changed from #pricing to /pricing */}
        <Link href="/pricing" className="cursor-pointer text-slate-400 hover:text-white transition-colors text-sm font-medium">
          Pricing
        </Link>
        <Link href="/history" className="cursor-pointer text-slate-400 hover:text-white transition-colors text-sm font-medium">
          History
        </Link>
      </nav>

      <div className="flex items-center gap-4">
        {user ? (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white transition-colors"
              style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              <div className="w-6 h-6 rounded-full bg-slate-600 flex items-center justify-center text-xs font-bold text-white">
                {user.email?.[0].toUpperCase()}
              </div>
              <span className="max-w-[120px] truncate">{user.email}</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {menuOpen && (
              <div
                className="absolute right-0 mt-2 w-48 rounded-xl overflow-hidden"
                style={{ background: "#141414", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                <div className="px-4 py-3 border-b border-white/5">
                  <p className="text-xs text-slate-500 truncate">{user.email}</p>
                </div>
                {/* Mobile/Menu History Link for better UX */}
                <Link
                  href="/history"
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                >
                  History
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors border-t border-white/5"
                >
                  <LogOut className="w-4 h-4" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <Link href="/login" className="cursor-pointer text-sm font-medium text-slate-400 hover:text-white transition-colors">
              Log in
            </Link>
            <Link
              href="/signup"
              className="cursor-pointer px-5 py-2 rounded-lg text-sm font-bold text-white transition-all hover:bg-[#222] active:scale-95"
              style={{ background: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)" }}
            >
              Sign up
            </Link>
          </>
        )}
      </div>
    </header>
  );
}