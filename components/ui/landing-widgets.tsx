"use client";

import React, { useRef, useState, useEffect, useMemo } from "react";
import {
  m,
  useMotionValue,
  useSpring,
  useTransform,
  useMotionTemplate,
  useReducedMotion,
  animate,
} from "framer-motion";

// ============================================================================
// ANIMATION PRESETS
// ============================================================================
export const spring = { type: "spring" as const, stiffness: 300, damping: 30 };
export const ease: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.6, ease } },
};

export const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.8, ease } },
};

export const stagger = {
  visible: {
    transition: { staggerChildren: 0.08 },
  },
};

// ============================================================================
// WIDGETS
// ============================================================================

export function SectionHeader({
  eyebrow,
  title,
  description,
  icon: Icon,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: React.ElementType;
}) {
  return (
    <m.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={stagger}
      className="mx-auto mb-16 sm:mb-24 max-w-3xl text-center"
    >
      <m.div
        variants={fadeUp}
        className="mb-6 inline-flex items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.03] px-3 py-1.5"
      >
        <Icon className="h-3.5 w-3.5 text-slate-300" />
        <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-slate-400">
          {eyebrow}
        </span>
      </m.div>
      <m.h2
        variants={fadeUp}
        className="text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl leading-tight"
      >
        {title}
      </m.h2>
      <m.p
        variants={fadeUp}
        className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg"
      >
        {description}
      </m.p>
    </m.div>
  );
}

export const Card3D = ({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [7, -7]), spring);
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-7, 7]), spring);

  const glareX = useTransform(mouseX, [-0.5, 0.5], [100, 0]);
  const glareY = useTransform(mouseY, [-0.5, 0.5], [100, 0]);
  const glareBackground = useMotionTemplate`radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255,255,255,0.08) 0%, transparent 50%)`;

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    mouseX.set((e.clientX - centerX) / rect.width);
    mouseY.set((e.clientY - centerY) / rect.height);
  };

  return (
    <m.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        mouseX.set(0);
        mouseY.set(0);
      }}
      style={{
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
        willChange: "transform",
      }}
      className={`relative ${className}`}
    >
      <m.div
        className="absolute inset-0 pointer-events-none rounded-2xl z-50 mix-blend-screen transition-opacity duration-300 hidden md:block"
        style={{ background: glareBackground }}
      />
      {children}
    </m.div>
  );
};

export const Icon3D = ({
  icon: Icon,
  className = "",
}: {
  icon: React.ElementType;
  className?: string;
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <m.div
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className={`relative ${className}`}
      style={{ transformStyle: "preserve-3d" }}
    >
      <m.div
        className="absolute inset-0 rounded-xl bg-gradient-to-br from-slate-700/30 to-slate-900/30 backdrop-blur-sm"
        animate={{ z: isHovered ? -20 : -8 }}
        transition={spring}
        style={{ transformStyle: "preserve-3d" }}
      />
      <m.div
        className="absolute inset-0 rounded-xl bg-[#0a0a0a]/90 border border-white/[0.08]"
        animate={{ z: 0 }}
        style={{ transformStyle: "preserve-3d" }}
      />
      <m.div
        className="absolute inset-0 rounded-xl bg-gradient-to-br from-slate-800/30 to-slate-900/30 border border-white/[0.12] flex items-center justify-center overflow-hidden"
        animate={{ z: isHovered ? 20 : 8 }}
        transition={spring}
        style={{ transformStyle: "preserve-3d" }}
      >
        <m.div
          animate={{
            rotateZ: -45,
            rotateX: isHovered ? -25 : -20,
            scale: isHovered ? 1.2 : 1,
          }}
          transition={spring}
        >
          <Icon className="w-6 h-6 text-slate-300 drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
        </m.div>
      </m.div>
      <m.div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-slate-200 shadow-[0_0_20px_4px_rgba(255,255,255,0.8)] hidden md:block"
        animate={{
          height: isHovered ? "80px" : "0px",
          opacity: isHovered ? 0.6 : 0,
        }}
        style={{ rotateX: 90, rotateY: -45, transformStyle: "preserve-3d" }}
        transition={spring}
      />
    </m.div>
  );
};

export const Counter = ({
  value,
  duration = 2,
}: {
  value: number;
  duration?: number;
}) => {
  const nodeRef = useRef<HTMLSpanElement>(null);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    if (shouldReduceMotion) {
      node.textContent = value.toString();
      return;
    }

    let cancelled = false;
    const controls = animate(0, value, {
      duration,
      ease: "easeOut",
      onUpdate(v) {
        if (!cancelled && nodeRef.current)
          nodeRef.current.textContent = Math.floor(v).toString();
      },
    });
    return () => {
      cancelled = true;
      controls.stop();
    };
  }, [value, duration, shouldReduceMotion]);

  return <span ref={nodeRef} />;
};

export const FloatingOrbs = () => {
  const orbs = useMemo(
    () => [
      { size: 400, duration: 20, x: "-10%", y: "-10%", delay: 0 },
      { size: 300, duration: 25, x: "80%", y: "60%", delay: 5 },
      { size: 350, duration: 30, x: "50%", y: "-5%", delay: 10 },
    ],
    [],
  );

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {orbs.map((orb, i) => (
        <m.div
          key={i}
          className="absolute rounded-full bg-white/[0.01] blur-[100px]"
          style={{ width: orb.size, height: orb.size, left: orb.x, top: orb.y }}
          animate={{ y: [0, -30, 0], x: [0, 20, 0], scale: [1, 1.1, 1] }}
          transition={{
            duration: orb.duration,
            repeat: Infinity,
            ease: "easeInOut",
            delay: orb.delay,
          }}
        />
      ))}
    </div>
  );
};
