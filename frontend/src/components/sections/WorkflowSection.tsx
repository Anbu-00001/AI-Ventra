"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";
import { Database, Cpu, GitBranch, ScanSearch, FileText, type LucideIcon } from "lucide-react";
import { WORKFLOW_STEPS } from "@/lib/constants";
import { fadeInUp, staggerContainer } from "@/lib/animations";

const iconMap: Record<string, LucideIcon> = {
  Database, Cpu, GitBranch, ScanSearch, FileText,
};

export default function WorkflowSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [activeStep, setActiveStep] = useState(-1);

  useEffect(() => {
    if (!isInView) return;
    const timers: NodeJS.Timeout[] = [];
    WORKFLOW_STEPS.forEach((_, i) => {
      timers.push(setTimeout(() => setActiveStep(i), 300 * (i + 1)));
    });
    return () => timers.forEach(clearTimeout);
  }, [isInView]);

  return (
    <section id="workflow" className="relative py-32 bg-surface overflow-hidden" ref={ref}>
      {/* Section header */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="max-w-7xl mx-auto px-6 mb-20 text-center"
      >
        <motion.span
          variants={fadeInUp}
          className="font-orbitron text-[11px] tracking-[0.25em] text-amber uppercase"
        >
          INVESTIGATION PROTOCOL
        </motion.span>
        <motion.h2
          variants={fadeInUp}
          className="font-orbitron text-3xl sm:text-4xl lg:text-5xl font-semibold mt-4"
          style={{ textShadow: "0 0 30px rgba(192,24,42,0.3)" }}
        >
          How AIVENTRA Investigates
        </motion.h2>
      </motion.div>

      {/* Workflow pipeline */}
      <div className="max-w-7xl mx-auto px-6">
        <div className="relative flex flex-col lg:flex-row items-center lg:items-start justify-between gap-8 lg:gap-0">
          {/* Connecting SVG line (desktop) */}
          <svg
            className="hidden lg:block absolute top-16 left-0 right-0 h-1 w-full"
            style={{ zIndex: 0 }}
          >
            <line
              x1="10%"
              y1="50%"
              x2="90%"
              y2="50%"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="2"
              strokeDasharray="8 4"
            />
            {/* Animated traveling dot */}
            {isInView && (
              <circle r="4" fill="#F59E0B" opacity="0.9">
                <animateMotion
                  dur="3s"
                  repeatCount="indefinite"
                  path="M80,5 L720,5"
                />
              </circle>
            )}
          </svg>

          {WORKFLOW_STEPS.map((step, i) => {
            const Icon = iconMap[step.icon];
            const isActive = i <= activeStep;

            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.3 * i }}
                className="relative z-10 flex-1 flex flex-col items-center text-center max-w-[200px]"
              >
                {/* Hexagonal card */}
                <div
                  className={`
                    relative w-28 h-28 flex items-center justify-center
                    clip-hexagon transition-all duration-500
                    ${isActive
                      ? "bg-crimson/20 shadow-[0_0_30px_rgba(192,24,42,0.4)]"
                      : "bg-white/[0.05]"
                    }
                  `}
                >
                  <div
                    className={`
                      absolute inset-[2px] clip-hexagon flex items-center justify-center
                      transition-all duration-500
                      ${isActive ? "bg-surface" : "bg-base"}
                    `}
                  >
                    <Icon
                      size={28}
                      className={`transition-colors duration-500 ${isActive ? "text-crimson-glow" : "text-dim"}`}
                    />
                  </div>
                </div>

                {/* Step number */}
                <span
                  className={`
                    font-orbitron text-[10px] tracking-widest mt-4 mb-2
                    ${isActive ? "text-amber" : "text-dim"}
                  `}
                >
                  STEP {step.id.toString().padStart(2, "0")}
                </span>

                {/* Title */}
                <h3
                  className={`
                    font-orbitron text-sm font-medium mb-2
                    ${isActive ? "text-pure" : "text-muted"}
                  `}
                >
                  {step.title}
                </h3>

                {/* Description */}
                <p className="text-xs text-dim leading-relaxed">
                  {step.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
