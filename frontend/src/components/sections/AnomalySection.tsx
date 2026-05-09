"use client";

import React, { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { fadeInUp, staggerContainer, slideInLeft, slideInRight } from "@/lib/animations";
import { ANOMALY_DATA, DETECTION_CARDS } from "@/lib/constants";
import StatusBadge from "@/components/ui/StatusBadge";

function AnomalyChart() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  const width = 700;
  const height = 300;
  const padding = { top: 20, right: 20, bottom: 30, left: 40 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  // Build normal path
  const normalPath = ANOMALY_DATA.map((d, i) => {
    const x = padding.left + (i / (ANOMALY_DATA.length - 1)) * chartW;
    const y = padding.top + chartH - (d.normal / 100) * chartH;
    return `${i === 0 ? "M" : "L"} ${x} ${y}`;
  }).join(" ");

  // Total path length for stroke animation
  const pathLength = 2000;

  return (
    <div ref={ref} className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((v) => {
          const y = padding.top + chartH - (v / 100) * chartH;
          return (
            <g key={v}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                stroke="rgba(255,255,255,0.05)"
                strokeDasharray="4 4"
              />
              <text
                x={padding.left - 8}
                y={y + 4}
                textAnchor="end"
                fill="#475569"
                fontSize="9"
                fontFamily="JetBrains Mono, monospace"
              >
                {v}
              </text>
            </g>
          );
        })}

        {/* Normal teal line */}
        <path
          d={normalPath}
          fill="none"
          stroke="#14B8A6"
          strokeWidth="2"
          strokeLinecap="round"
          style={{
            strokeDasharray: pathLength,
            strokeDashoffset: isInView ? 0 : pathLength,
            transition: "stroke-dashoffset 2s ease-out",
          }}
        />

        {/* Anomaly spikes */}
        {ANOMALY_DATA.map((d, i) => {
          if (!d.anomaly) return null;
          const x = padding.left + (i / (ANOMALY_DATA.length - 1)) * chartW;
          const y = padding.top + chartH - (d.anomaly / 100) * chartH;
          const normalY = padding.top + chartH - (d.normal / 100) * chartH;

          return (
            <g key={`anomaly-${i}`}>
              {/* Spike line */}
              <line
                x1={x}
                y1={normalY}
                x2={x}
                y2={y}
                stroke="#C0182A"
                strokeWidth="2"
                opacity={isInView ? 1 : 0}
                style={{ transition: `opacity 0.5s ease ${1 + i * 0.1}s` }}
              />
              {/* Spike dot with glow */}
              <circle
                cx={x}
                cy={y}
                r="5"
                fill="#FF1A3C"
                opacity={isInView ? 1 : 0}
                style={{ transition: `opacity 0.5s ease ${1 + i * 0.1}s` }}
              >
                <animate
                  attributeName="r"
                  values="4;7;4"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </circle>
              {/* Glow ring */}
              <circle
                cx={x}
                cy={y}
                r="12"
                fill="none"
                stroke="#FF1A3C"
                strokeWidth="1"
                opacity="0.3"
              >
                <animate
                  attributeName="r"
                  values="8;16;8"
                  dur="2s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.4;0;0.4"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </circle>
              {/* Label */}
              <text
                x={x}
                y={y - 16}
                textAnchor="middle"
                fill="#FF1A3C"
                fontSize="9"
                fontFamily="Orbitron, sans-serif"
                fontWeight="600"
                opacity={isInView ? 1 : 0}
                style={{ transition: `opacity 0.5s ease ${1.2 + i * 0.1}s` }}
              >
                ⚠ ANOMALY
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function AnomalySection() {
  return (
    <section id="anomaly" className="relative py-32 bg-base overflow-hidden">
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
            THREAT INTELLIGENCE
          </motion.span>
          <motion.h2
            variants={fadeInUp}
            className="font-orbitron text-3xl sm:text-4xl lg:text-5xl font-semibold mt-4"
            style={{ textShadow: "0 0 30px rgba(192,24,42,0.3)" }}
          >
            Suspicious Pattern Detection
          </motion.h2>
        </div>

        {/* Split layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Left: text */}
          <motion.div variants={slideInLeft}>
            <h3 className="font-orbitron text-xl font-medium text-pure mb-4">
              Real-Time Anomaly Detection
            </h3>
            <p className="text-muted leading-relaxed mb-6">
              AIVENTRA&apos;s neural network continuously monitors data streams for
              behavioral deviations, temporal anomalies, and digital trace
              correlations. When suspicious patterns emerge, the system triggers
              instant alerts with confidence scoring and forensic context.
            </p>
            <p className="text-dim text-sm leading-relaxed mb-8">
              Our proprietary algorithm processes over 142 data dimensions
              simultaneously, cross-referencing against known criminal
              signatures and predictive behavioral models to surface hidden
              threats in real-time.
            </p>

            {/* Detection cards */}
            <div className="space-y-4">
              {DETECTION_CARDS.map((card, i) => (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, x: -30 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.2 * i }}
                  className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.06] backdrop-blur-sm"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-orbitron text-xs font-medium text-pure">
                      {card.title}
                    </span>
                    <StatusBadge status={card.status} />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${card.progress}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, delay: 0.5 + 0.2 * i }}
                        className={`h-full rounded-full ${
                          card.status === "CRITICAL"
                            ? "bg-gradient-to-r from-crimson to-crimson-glow"
                            : card.status === "CONFIRMED"
                            ? "bg-gradient-to-r from-emerald-600 to-emerald-400"
                            : "bg-gradient-to-r from-amber to-amber-glow"
                        }`}
                      />
                    </div>
                    <span className="font-mono text-xs text-muted tabular-nums">
                      {card.progress}%
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Right: chart */}
          <motion.div variants={slideInRight}>
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="font-orbitron text-[10px] tracking-wider text-dim uppercase">
                  Live Data Stream
                </span>
                <span className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute h-full w-full rounded-full bg-crimson-glow opacity-75" />
                    <span className="relative rounded-full h-2 w-2 bg-crimson" />
                  </span>
                  <span className="font-mono text-[10px] text-crimson">MONITORING</span>
                </span>
              </div>
              <AnomalyChart />
              <div className="flex items-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-[2px] bg-teal-data rounded" />
                  <span className="text-[10px] text-dim">Normal Activity</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-[2px] bg-crimson rounded" />
                  <span className="text-[10px] text-dim">Anomaly Spike</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
