"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence, useScroll, useTransform } from "framer-motion";
import { LayoutGrid, LogOut, Menu, X, BadgeCheck } from "lucide-react";
import { createClient } from "@/lib/supabase-browser";
import { User } from "@supabase/supabase-js";

export default function Header() {
  const [user, setUser] = useState<User | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showPulse, setShowPulse] = useState(false);
  const supabase = useMemo(() => createClient(), []);

  const [isScrolled, setIsScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("");

  const { scrollY } = useScroll();
  const navBlur = useTransform(scrollY, [0, 100], [0, 24]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

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

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);

      const sections = ["features", "pricing"];
      for (const section of sections) {
        const element = document.getElementById(section);
        if (element) {
          const { top, bottom } = element.getBoundingClientRect();
          if (top <= 150 && bottom >= 150) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (mobileNavOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [mobileNavOpen]);

  const handleDashboardClick = () => {
    if (typeof window !== "undefined") {
      localStorage.setItem("seenPRTool", "true");
    }
    setShowPulse(false);
    setMenuOpen(false);
    setMobileNavOpen(false);
  };

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setMobileNavOpen(false);
  };

  const navItems = [
    { id: "about", label: "About", href: "/about" },
    { id: "features", label: "Features", href: "/#features" },
    { id: "pricing", label: "Pricing", href: "/pricing" },
  ];

  // Helper to get avatar
  const getAvatarUrl = (user: User) => {
    return (
      user.user_metadata?.avatar_url ||
      `https://api.dicebear.com/7.x/shapes/svg?seed=${user.email}&backgroundColor=0a0a0a,141414`
    );
  };

  // Helper to get display name
  const getDisplayName = (user: User) => {
    return (
      user.user_metadata?.full_name?.split(" ")[0] ||
      user.user_metadata?.user_name ||
      user.email?.split("@")[0]
    );
  };

  return (
    <>
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 ${
          isScrolled 
            ? "bg-[#0a0a0a]/80 border-b border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.4)]" 
            : "bg-transparent"
        }`}
        style={{ backdropFilter: isScrolled ? `blur(${navBlur}px)` : "none" }}
      >
        {isScrolled && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
            className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-400/20 to-transparent"
          />
        )}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-[4.5rem] flex items-center justify-between">
          
          <Link href="/" className="flex items-center gap-3 cursor-pointer group relative z-50">
            <motion.div
              className="absolute inset-0 rounded-full blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{ background: "radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%)" }}
            />
            <div className="relative">
              <Image
                src="/codeautopsy-logo1.png"
                alt="CodeAutopsy"
                width={32}
                height={32}
                className="rounded-md drop-shadow-[0_0_12px_rgba(255,255,255,0.05)] transition-transform duration-300 group-hover:scale-105"
              />
            </div>
            <span className="text-xl font-bold tracking-tight text-white group-hover:text-slate-200 transition-colors hidden sm:block relative">
              CodeAutopsy
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1 bg-white/[0.03] rounded-full px-2 py-1.5 border border-white/[0.06] backdrop-blur-xl">
            {navItems.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                onClick={(e) => {
                  if (item.href.startsWith("/#")) {
                    e.preventDefault();
                    scrollToSection(item.id);
                  }
                }}
                className={`relative px-5 py-2 rounded-full text-sm font-semibold transition-all duration-300 ${
                  activeSection === item.id 
                    ? "text-white shadow-[0_2px_8px_rgba(0,0,0,0.3)]" 
                    : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                {activeSection === item.id && (
                  <motion.div
                    layoutId="activeNavBubble"
                    className="absolute inset-0 bg-white/[0.12] rounded-full border border-white/[0.05]"
                    transition={{ type: "spring", stiffness: 200, damping: 25 }}
                  />
                )}
                <span className="relative z-10">{item.label}</span>
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-2 sm:gap-4">
                <Link
                  href="/dashboard"
                  onClick={handleDashboardClick}
                  className="relative hidden md:flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-slate-300 hover:text-white hover:bg-white/[0.08] hover:border-white/[0.15] transition-all duration-300 font-mono text-xs uppercase tracking-widest group"
                >
                  {showPulse && (
                    <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-300 opacity-60 duration-1000"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-slate-100"></span>
                    </span>
                  )}
                  <LayoutGrid className="w-4 h-4 group-hover:scale-110 transition-transform duration-300" />
                  Dashboard
                </Link>

                <div className="relative">
                  {/* Premium Desktop Profile Button */}
                  <motion.button
                    onClick={() => setMenuOpen(!menuOpen)}
                    title={user.email || "Account settings"}
                    className="relative flex items-center gap-3 pl-3 pr-1 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-white/[0.15] transition-all duration-300 focus:outline-none z-50 shadow-lg group"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="hidden sm:flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-300 group-hover:text-white transition-colors max-w-[120px] truncate">
                        {getDisplayName(user)}
                      </span>
                      <BadgeCheck className="text-emerald-400 w-4 h-4 flex-shrink-0" />
                    </div>

                    <div className="relative">
                      <Image
                        src={getAvatarUrl(user)}
                        alt="Profile"
                        width={32}
                        height={32}
                        className="w-8 h-8 rounded-full object-cover border-2 border-[#141414] group-hover:border-white/20 transition-colors shadow-inner bg-slate-800"
                      />
                      <motion.div
                        className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#0a0a0a]"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      />
                    </div>
                  </motion.button>

                  <AnimatePresence>
                    {menuOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                        <motion.div
                          initial={{ opacity: 0, y: 8, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 8, scale: 0.96 }}
                          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                          className="absolute right-0 mt-3 w-64 rounded-2xl overflow-hidden shadow-[0_24px_48px_rgba(0,0,0,0.6)] z-50 bg-[#0a0a0a]/95 backdrop-blur-2xl border border-white/[0.08]"
                        >
                          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-400/30 to-transparent" />

                          {/* Upgraded Desktop Dropdown Header */}
                          <div className="px-4 py-4 bg-gradient-to-b from-white/[0.04] to-transparent border-b border-white/[0.06] flex items-center gap-3">
                            <Image
                              src={getAvatarUrl(user)}
                              alt="Profile"
                              width={40}
                              height={40}
                              className="w-10 h-10 rounded-xl object-cover border border-white/[0.12] shadow-sm bg-slate-800"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-slate-100 truncate flex items-center gap-1.5">
                                {getDisplayName(user)}
                                <BadgeCheck className="w-3.5 h-3.5 text-emerald-400" />
                              </p>
                              <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest mt-0.5 truncate">
                                {user.email}
                              </p>
                            </div>
                          </div>

                          <div className="py-2">
                            <Link
                              href="/dashboard"
                              onClick={handleDashboardClick}
                              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors md:hidden relative group"
                            >
                              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/[0.04] group-hover:bg-white/[0.08] border border-white/[0.06] transition-all">
                                <LayoutGrid className="w-4 h-4" />
                              </div>
                              <span className="relative flex items-center font-medium">
                                Dashboard
                                {showPulse && (
                                  <span className="absolute -right-3 -top-0.5 flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-200 opacity-60"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-slate-100"></span>
                                  </span>
                                )}
                              </span>
                            </Link>

                            <Link
                              href="/profile"
                              onClick={() => setMenuOpen(false)}
                              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors group"
                            >
                              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/[0.04] group-hover:bg-white/[0.08] border border-white/[0.06] transition-all">
                                <div className="w-4 h-4 rounded-full border-2 border-current flex items-center justify-center overflow-hidden">
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 mt-1">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                  </svg>
                                </div>
                              </div>
                              <span className="font-medium">Account Settings</span>
                            </Link>
                          </div>

                          <div className="py-2 border-t border-white/[0.06] bg-white/[0.02]">
                            <button
                              onClick={handleLogout}
                              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors group"
                            >
                              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-500/5 group-hover:bg-red-500/15 border border-red-500/20 transition-all">
                                <LogOut className="w-4 h-4" />
                              </div>
                              <span className="font-medium">Sign out</span>
                            </button>
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            ) : (
              <div className="hidden md:flex items-center gap-4">
                <Link
                  href="/login"
                  className="cursor-pointer text-sm font-semibold text-slate-400 hover:text-white transition-colors"
                >
                  Log in
                </Link>
                <Link href="/signup">
                  <motion.button
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    className="relative px-6 py-2.5 rounded-xl text-sm font-semibold bg-white text-black hover:bg-slate-200 transition-all duration-300 shadow-[0_4px_16px_rgba(255,255,255,0.1)] hover:shadow-[0_6px_24px_rgba(255,255,255,0.15)]"
                  >
                    Sign up
                  </motion.button>
                </Link>
              </div>
            )}

            <motion.button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="md:hidden relative z-50 w-10 h-10 flex items-center justify-center text-slate-300 hover:text-white rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-all"
            >
              <AnimatePresence mode="wait">
                {mobileNavOpen ? (
                  <motion.div
                    key="close"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <X className="w-5 h-5" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="menu"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Menu className="w-5 h-5" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </div>
      </motion.header>

      <AnimatePresence>
        {mobileNavOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
              onClick={() => setMobileNavOpen(false)}
            />

            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="fixed top-[4.5rem] right-0 bottom-0 w-[280px] bg-[#0a0a0a]/95 backdrop-blur-2xl border-l border-white/[0.08] shadow-[-24px_0_48px_rgba(0,0,0,0.6)] z-40 md:hidden flex flex-col overflow-y-auto"
            >
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-400/20 to-transparent" />

              <div className="flex flex-col p-6 gap-2">
                {navItems.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={(e) => {
                      if (item.href.startsWith("/#")) {
                        e.preventDefault();
                        scrollToSection(item.id);
                      } else {
                        setMobileNavOpen(false);
                      }
                    }}
                    className={`relative flex items-center w-full px-4 py-4 rounded-xl text-sm font-semibold transition-all ${
                      activeSection === item.id
                        ? "text-white bg-white/[0.06] border border-white/[0.08]"
                        : "text-slate-400 hover:text-white bg-white/[0.02] hover:bg-white/[0.06] border border-transparent hover:border-white/[0.05]"
                    }`}
                  >
                    {activeSection === item.id && (
                      <motion.div
                        layoutId="activeMobileIndicator"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-slate-300 rounded-r-full"
                      />
                    )}
                    <span className={activeSection === item.id ? "ml-2" : ""}>{item.label}</span>
                  </Link>
                ))}

                {user ? (
                  <div className="flex flex-col gap-2 pt-6 mt-4 border-t border-white/[0.06]">
                    
                    {/* Upgraded Mobile Menu Profile Header */}
                    <div className="px-1 py-3 mb-2 flex items-center gap-3">
                      <Image
                        src={getAvatarUrl(user)}
                        alt="Profile"
                        width={44}
                        height={44}
                        className="w-11 h-11 rounded-xl object-cover border border-white/[0.12] shadow-sm bg-slate-800"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-100 truncate flex items-center gap-1.5">
                          {getDisplayName(user)}
                          <BadgeCheck className="w-3.5 h-3.5 text-emerald-400" />
                        </p>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {user.email}
                        </p>
                      </div>
                    </div>

                    <Link
                      href="/dashboard"
                      onClick={() => setMobileNavOpen(false)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-slate-300 hover:text-white bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] transition-all"
                    >
                      <LayoutGrid className="w-4 h-4" />
                      Dashboard
                    </Link>
                    <Link
                      href="/profile"
                      onClick={() => setMobileNavOpen(false)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-slate-300 hover:text-white bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] transition-all"
                    >
                      <div className="w-4 h-4 rounded-full border-2 border-current flex items-center justify-center overflow-hidden">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3 h-3 mt-1">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                          <circle cx="12" cy="7" r="4" />
                        </svg>
                      </div>
                      Account Settings
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-red-400 hover:text-red-300 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 transition-all mt-2"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign out
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 pt-6 mt-4 border-t border-white/[0.06]">
                    <Link
                      href="/login"
                      onClick={() => setMobileNavOpen(false)}
                      className="w-full text-center py-3 rounded-xl text-sm font-semibold text-slate-300 hover:text-white bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.05] transition-all"
                    >
                      Log in
                    </Link>
                    <Link
                      href="/signup"
                      onClick={() => setMobileNavOpen(false)}
                      className="w-full text-center py-3 rounded-xl text-sm font-bold text-black bg-white hover:bg-slate-200 transition-all active:scale-95 shadow-[0_4px_16px_rgba(255,255,255,0.1)]"
                    >
                      Sign up
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}