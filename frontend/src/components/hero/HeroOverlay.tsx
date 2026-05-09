"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import CountUp from "react-countup";
import { useRouter } from "next/navigation";
import GlowButton from "@/components/ui/GlowButton";
import { HERO_METRICS } from "@/lib/constants";

export default function HeroOverlay() {
  const [time, setTime] = useState("");
  const router = useRouter();

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("en-US", { hour12: false, timeZone: "UTC" }) + " UTC");
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="absolute inset-0 z-10 pointer-events-none">
      {/* TOP STATUS BAR */}
      <div className="absolute top-16 left-0 right-0 px-6 py-3 flex items-center justify-between border-b border-white/[0.04]">
        {/* Left: system status */}
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="font-orbitron text-[11px] tracking-wider text-amber">
            AIVENTRA SYSTEM ONLINE
          </span>
        </div>

        {/* Center: classification */}
        <span className="hidden md:block font-orbitron text-[10px] tracking-[0.25em] text-dim uppercase">
          Classified Forensic Intelligence Platform
        </span>

        {/* Right: clock */}
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-muted tabular-nums">{time}</span>
          <span className="hidden sm:block font-orbitron text-[10px] tracking-wider text-emerald-500/70">
            SECURE CONNECTION ESTABLISHED
          </span>
        </div>
      </div>

      {/* LEFT FLOATING METRICS PANEL */}
      <motion.div
        initial={{ opacity: 0, x: -40 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, delay: 1.2 }}
        className="absolute left-6 top-1/2 -translate-y-1/2 hidden lg:block pointer-events-auto"
      >
        <div className="bg-white/[0.05] backdrop-blur-xl border border-white/[0.1] rounded-2xl p-5 w-56">
          <div className="space-y-5">
            {HERO_METRICS.map((metric, i) => (
              <div key={i} className="border-l-2 border-crimson/60 pl-4">
                <div className="font-orbitron text-2xl font-bold text-amber tabular-nums">
                  <CountUp
                    end={metric.value}
                    decimals={metric.suffix === "%" || metric.suffix === "s" ? 1 : 0}
                    duration={2.5}
                    delay={1.5 + i * 0.2}
                    separator=","
                    suffix={metric.suffix}
                    prefix={metric.prefix}
                  />
                </div>
                <div className="text-xs text-muted mt-0.5 font-inter">{metric.label}</div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* CENTER HERO TEXT */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-20 px-6">
        {/* Tag */}
        <motion.span
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="font-orbitron text-[12px] tracking-[0.25em] text-amber glow-amber-text uppercase mb-6"
        >
          NEXT-GENERATION FORENSIC AI
        </motion.span>

        {/* H1 */}
        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="font-orbitron text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-center leading-tight tracking-hero max-w-5xl"
          style={{
            textShadow: "0 0 40px rgba(192,24,42,0.4), 0 0 80px rgba(192,24,42,0.2)",
          }}
        >
          AI-Powered Forensic
          <br />
          <span className="text-crimson-glow">Intelligence</span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.9 }}
          className="font-inter text-base sm:text-lg text-slate-300 text-center max-w-2xl mt-6 leading-relaxed"
        >
          Autonomous evidence correlation, real-time pattern detection, and
          AI-driven postmortem analysis — delivering actionable intelligence
          to investigative agencies worldwide.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.1 }}
          className="flex flex-col sm:flex-row items-center gap-4 mt-10 pointer-events-auto"
        >
          <GlowButton variant="primary" onClick={() => router.push("/dashboard")}>
            Initiate Investigation
          </GlowButton>
          <GlowButton variant="ghost" onClick={() => router.push("/dashboard")}>
            View Live Demo
          </GlowButton>
        </motion.div>
      </div>
    </div>
  );
}
