"use client";

import React from "react";
import { motion } from "framer-motion";
import { fadeInUp, staggerContainer } from "@/lib/animations";
import {
  Search, Bell, User, Map, Clock, Database, Brain,
  Folder, Shield, BarChart3, Settings, ChevronRight,
} from "lucide-react";

function DashboardMockup() {
  return (
    <div className="relative w-full rounded-xl overflow-hidden bg-[#080810] border border-white/[0.08]">
      {/* Browser chrome / OS frame */}
      <div className="flex items-center gap-2 px-4 py-3 bg-white/[0.03] border-b border-white/[0.06]">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/60" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
          <div className="w-3 h-3 rounded-full bg-green-500/60" />
        </div>
        <div className="flex-1 flex justify-center">
          <div className="px-4 py-1 bg-white/[0.05] rounded-md text-[10px] text-dim font-mono">
            https://app.aiventra.io/dashboard
          </div>
        </div>
      </div>

      {/* Dashboard content */}
      <div className="flex">
        {/* Sidebar */}
        <div className="w-14 bg-white/[0.02] border-r border-white/[0.05] py-4 flex flex-col items-center gap-4">
          {[Folder, Map, Clock, Database, Brain, BarChart3, Shield, Settings].map((Icon, i) => (
            <div
              key={i}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                i === 0
                  ? "bg-crimson/20 text-crimson"
                  : "text-dim hover:text-muted"
              }`}
            >
              <Icon size={14} />
            </div>
          ))}
        </div>

        {/* Main content */}
        <div className="flex-1 p-4">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] w-48">
              <Search size={12} className="text-dim" />
              <span className="text-[10px] text-dim">Search cases...</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Bell size={14} className="text-muted" />
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-crimson" />
              </div>
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-crimson to-amber flex items-center justify-center">
                <User size={10} className="text-white" />
              </div>
            </div>
          </div>

          {/* Grid panels */}
          <div className="grid grid-cols-2 gap-3">
            {/* Case map */}
            <div className="col-span-1 row-span-2 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
              <div className="flex items-center justify-between mb-2">
                <span className="font-orbitron text-[8px] tracking-wider text-dim uppercase">Active Case Map</span>
                <ChevronRight size={10} className="text-dim" />
              </div>
              <div className="h-32 rounded-md bg-white/[0.02] flex items-center justify-center relative overflow-hidden">
                {/* Simplified map dots */}
                {Array.from({ length: 15 }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-1.5 h-1.5 rounded-full bg-crimson/60"
                    style={{
                      left: `${15 + Math.random() * 70}%`,
                      top: `${15 + Math.random() * 70}%`,
                    }}
                  >
                    <div className="absolute inset-0 rounded-full bg-crimson animate-ping opacity-30" />
                  </div>
                ))}
                <Map size={20} className="text-white/10" />
              </div>
            </div>

            {/* Timeline mini */}
            <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
              <span className="font-orbitron text-[8px] tracking-wider text-dim uppercase">Timeline</span>
              <div className="mt-2 space-y-1.5">
                {["02:34", "06:01", "08:45"].map((t, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="font-mono text-[8px] text-muted">{t}</span>
                    <div className="flex-1 h-1 bg-white/[0.06] rounded-full">
                      <div
                        className="h-full bg-gradient-to-r from-crimson to-amber rounded-full"
                        style={{ width: `${70 - i * 15}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Evidence count */}
            <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
              <span className="font-orbitron text-[8px] tracking-wider text-dim uppercase">Evidence</span>
              <div className="mt-1.5 flex items-end gap-1">
                <span className="font-orbitron text-xl font-bold text-amber">847</span>
                <span className="text-[9px] text-emerald-400 mb-1">+12.3%</span>
              </div>
              <div className="flex gap-0.5 mt-2">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-crimson/30 rounded-sm"
                    style={{ height: `${8 + Math.random() * 20}px` }}
                  />
                ))}
              </div>
            </div>

            {/* AI Score panel below map */}
            <div className="col-span-2 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]">
              <div className="flex items-center justify-between">
                <span className="font-orbitron text-[8px] tracking-wider text-dim uppercase">AI Confidence Score</span>
                <span className="font-orbitron text-sm font-bold text-amber">94.7%</span>
              </div>
              <div className="mt-2 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                <div className="h-full w-[94.7%] bg-gradient-to-r from-crimson via-amber to-amber-glow rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CRT scanline overlay */}
      <div className="absolute inset-0 crt-overlay opacity-30 pointer-events-none rounded-xl" />
    </div>
  );
}

export default function DashboardPreview() {
  return (
    <section className="relative py-32 bg-surface overflow-hidden">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="max-w-7xl mx-auto px-6"
      >
        {/* Header */}
        <div className="text-center mb-16">
          <motion.span
            variants={fadeInUp}
            className="font-orbitron text-[11px] tracking-[0.25em] text-amber uppercase"
          >
            COMMAND CENTER
          </motion.span>
          <motion.h2
            variants={fadeInUp}
            className="font-orbitron text-3xl sm:text-4xl lg:text-5xl font-semibold mt-4"
            style={{ textShadow: "0 0 30px rgba(192,24,42,0.3)" }}
          >
            Dashboard Preview
          </motion.h2>
        </div>

        {/* Dashboard with perspective tilt */}
        <motion.div
          initial={{ opacity: 0, rotateX: 8, y: 60 }}
          whileInView={{ opacity: 1, rotateX: 0, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 1, ease: [0.25, 0.46, 0.45, 0.94] }}
          whileHover={{
            boxShadow: "0 0 60px rgba(192,24,42,0.2)",
          }}
          style={{ perspective: 1200, transformStyle: "preserve-3d" }}
          className="max-w-5xl mx-auto rounded-xl transition-shadow duration-500"
        >
          <DashboardMockup />
        </motion.div>
      </motion.div>
    </section>
  );
}
