"use client";

import React from "react";
import { motion } from "framer-motion";
import { Bot, Lock, TrendingUp, type LucideIcon } from "lucide-react";
import { fadeInUp, staggerContainer } from "@/lib/animations";
import { FUTURE_CAPABILITIES, TICKER_TAGS } from "@/lib/constants";
import StatusBadge from "@/components/ui/StatusBadge";

const iconMap: Record<string, LucideIcon> = {
  Bot,
  Lock,
  TrendingUp,
};

export default function FutureSection() {
  return (
    <section className="relative py-32 bg-surface overflow-hidden">
      {/* Large background text */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
        <span className="font-orbitron text-[20vw] font-black text-white/[0.02] whitespace-nowrap select-none">
          2025 →
        </span>
      </div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="relative max-w-7xl mx-auto px-6"
      >
        {/* Header */}
        <div className="text-center mb-8">
          <motion.span
            variants={fadeInUp}
            className="font-orbitron text-[11px] tracking-[0.25em] text-amber uppercase"
          >
            ROADMAP
          </motion.span>
          <motion.h2
            variants={fadeInUp}
            className="font-orbitron text-3xl sm:text-4xl lg:text-5xl font-semibold mt-4"
            style={{ textShadow: "0 0 30px rgba(192,24,42,0.3)" }}
          >
            Future of AI Forensics
          </motion.h2>
        </div>

        {/* Ticker marquee */}
        <motion.div
          variants={fadeInUp}
          className="relative overflow-hidden mb-16 py-4"
        >
          <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-surface to-transparent z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-surface to-transparent z-10" />
          <div className="ticker-track">
            {[...TICKER_TAGS, ...TICKER_TAGS].map((tag, i) => (
              <span
                key={i}
                className="flex-shrink-0 px-6 py-2 mx-2 rounded-full
                  border border-white/[0.06] bg-white/[0.02]
                  font-orbitron text-[10px] tracking-wider text-dim
                  whitespace-nowrap"
              >
                {tag}
              </span>
            ))}
          </div>
        </motion.div>

        {/* 3 Future capability cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {FUTURE_CAPABILITIES.map((cap, i) => {
            const Icon = iconMap[cap.icon];
            return (
              <motion.div
                key={cap.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.15 * i }}
                whileHover={{
                  y: -8,
                  borderColor: "rgba(192,24,42,0.5)",
                  boxShadow: "0 0 40px rgba(192,24,42,0.15), inset 0 0 40px rgba(192,24,42,0.05)",
                }}
                className="group relative p-8 rounded-2xl
                  bg-white/[0.04] backdrop-blur-sm
                  border border-white/[0.08]
                  transition-all duration-300
                  flex flex-col min-h-[340px]"
              >
                {/* Icon */}
                <div className="w-14 h-14 rounded-xl bg-amber/10 border border-amber/20 flex items-center justify-center mb-6 group-hover:bg-amber/15 transition-colors">
                  <Icon size={28} className="text-amber" />
                </div>

                {/* Title */}
                <h3 className="font-orbitron text-lg font-semibold text-pure mb-3">
                  {cap.title}
                </h3>

                {/* Description */}
                <p className="text-sm text-muted leading-relaxed flex-1">
                  {cap.description}
                </p>

                {/* Status badge */}
                <div className="mt-6">
                  <StatusBadge status={cap.status} />
                </div>

                {/* Inner glow pulse on hover */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                  <div className="absolute inset-0 rounded-2xl border border-crimson/20 animate-pulse-glow" />
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </section>
  );
}
