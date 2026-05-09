"use client";

import React from "react";
import { motion } from "framer-motion";
import StatusBadge from "@/components/ui/StatusBadge";
import { EVIDENCE_CARDS } from "@/lib/constants";

export default function HeroFloatingCards() {
  const rotations = [-2, 1, 3];

  return (
    <motion.div
      initial={{ opacity: 0, x: 60 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.8, delay: 1.4 }}
      className="absolute right-6 top-1/2 -translate-y-1/2 hidden xl:flex flex-col gap-4 z-10 pointer-events-auto"
    >
      {EVIDENCE_CARDS.map((card, i) => (
        <motion.div
          key={card.id}
          initial={{ opacity: 0, x: 40, rotate: rotations[i] }}
          animate={{ opacity: 1, x: 0, rotate: rotations[i] }}
          transition={{ duration: 0.6, delay: 1.6 + i * 0.15 }}
          whileHover={{
            scale: 1.03,
            rotate: 0,
            borderColor: "rgba(192,24,42,0.5)",
            boxShadow: "0 0 30px rgba(192,24,42,0.3)",
          }}
          className="w-64 p-4 bg-white/[0.05] backdrop-blur-xl border border-white/[0.08] rounded-xl cursor-pointer transition-all duration-300"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[10px] text-muted">{card.id}</span>
            <StatusBadge status={card.status} />
          </div>
          <div className="font-orbitron text-[11px] tracking-wider text-amber mb-1.5">
            {card.type}
          </div>
          <p className="text-[12px] text-dim leading-relaxed">{card.detail}</p>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-crimson to-amber rounded-full"
                style={{ width: `${card.confidence}%` }}
              />
            </div>
            <span className="font-mono text-[10px] text-amber">{card.confidence}%</span>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
}
