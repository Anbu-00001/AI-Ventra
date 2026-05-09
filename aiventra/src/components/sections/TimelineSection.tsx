"use client";

import React, { useRef, useEffect, useState } from "react";
import { motion, useInView } from "framer-motion";
import { TIMELINE_EVENTS } from "@/lib/constants";
import StatusBadge from "@/components/ui/StatusBadge";
import { fadeInUp } from "@/lib/animations";

export default function TimelineSection() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });
  const [scanPosition, setScanPosition] = useState(0);

  useEffect(() => {
    if (!isInView || !scrollRef.current) return;

    const handleScroll = () => {
      if (!scrollRef.current) return;
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      const progress = scrollLeft / (scrollWidth - clientWidth);
      setScanPosition(progress);
    };

    const el = scrollRef.current;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [isInView]);

  return (
    <section
      id="timeline"
      ref={sectionRef}
      className="relative py-32 bg-surface overflow-hidden"
    >
      {/* Header */}
      <motion.div
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="max-w-7xl mx-auto px-6 mb-16 text-center"
      >
        <motion.span
          variants={fadeInUp}
          className="font-orbitron text-[11px] tracking-[0.25em] text-amber uppercase"
        >
          TEMPORAL ANALYSIS
        </motion.span>
        <motion.h2
          variants={fadeInUp}
          className="font-orbitron text-3xl sm:text-4xl lg:text-5xl font-semibold mt-4"
          style={{ textShadow: "0 0 30px rgba(192,24,42,0.3)" }}
        >
          Timeline Analysis
        </motion.h2>
        <motion.p variants={fadeInUp} className="text-muted mt-4 max-w-xl mx-auto">
          Scroll horizontally to traverse the forensic event timeline
        </motion.p>
      </motion.div>

      {/* Horizontal scrollable timeline */}
      <div className="relative max-w-full">
        {/* Scan cursor line */}
        <div
          className="absolute top-0 bottom-0 w-[2px] bg-amber z-20 pointer-events-none transition-all duration-100"
          style={{
            left: `${10 + scanPosition * 80}%`,
            boxShadow: "0 0 20px rgba(245,158,11,0.6), 0 0 40px rgba(245,158,11,0.3)",
          }}
        />

        <div
          ref={scrollRef}
          className="flex gap-8 overflow-x-auto px-6 pb-8 snap-x snap-mandatory scrollbar-thin"
          style={{
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(192,24,42,0.4) transparent",
          }}
        >
          {/* Spacer */}
          <div className="flex-shrink-0 w-12" />

          {TIMELINE_EVENTS.map((event, i) => {
            const isActive = scanPosition * TIMELINE_EVENTS.length >= i - 0.5;

            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 40 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="flex-shrink-0 w-80 snap-center"
              >
                {/* Connector dot + line */}
                <div className="flex items-center mb-6">
                  <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent to-crimson/40" />
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
                      isActive
                        ? "border-crimson bg-crimson/30 shadow-[0_0_15px_rgba(192,24,42,0.5)]"
                        : "border-white/20 bg-transparent"
                    }`}
                  >
                    <div
                      className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${
                        isActive ? "bg-crimson-glow" : "bg-white/20"
                      }`}
                    />
                  </div>
                  <div className="flex-1 h-[1px] bg-gradient-to-r from-crimson/40 to-transparent" />
                </div>

                {/* Card */}
                <div
                  className={`
                    relative p-5 rounded-xl border transition-all duration-500
                    bg-white/[0.04] backdrop-blur-sm
                    ${isActive
                      ? "border-crimson/30 shadow-[0_0_20px_rgba(192,24,42,0.15)]"
                      : "border-white/[0.06]"
                    }
                  `}
                >
                  {/* Timestamp */}
                  <div className="font-mono text-[11px] text-muted mb-3">
                    {event.timestamp}
                  </div>

                  {/* Type badge */}
                  <StatusBadge status={event.type} className="mb-3" />

                  {/* Title */}
                  <h3 className="font-orbitron text-sm font-medium text-pure mb-2">
                    {event.title}
                  </h3>

                  {/* Description */}
                  <p className="text-xs text-dim leading-relaxed mb-4">
                    {event.description}
                  </p>

                  {/* Confidence bar */}
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={isInView ? { width: `${event.confidence}%` } : {}}
                        transition={{ duration: 1.2, delay: 0.5 + i * 0.1, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-amber to-amber-glow rounded-full"
                      />
                    </div>
                    <span className="font-orbitron text-[11px] text-amber font-bold tabular-nums">
                      {event.confidence}%
                    </span>
                  </div>

                  {/* AI confidence label */}
                  <div className="mt-1 text-right">
                    <span className="font-orbitron text-[8px] tracking-widest text-dim uppercase">
                      AI CONFIDENCE
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}

          {/* Spacer */}
          <div className="flex-shrink-0 w-12" />
        </div>
      </div>
    </section>
  );
}
