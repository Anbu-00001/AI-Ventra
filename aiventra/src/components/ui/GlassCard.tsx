"use client";

import React from "react";
import { motion } from "framer-motion";

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  glowColor?: "crimson" | "amber" | "teal";
}

export default function GlassCard({
  children,
  className = "",
  hover = true,
  glowColor = "crimson",
}: GlassCardProps) {
  const glowMap = {
    crimson: "hover:shadow-[0_0_30px_rgba(192,24,42,0.3)]",
    amber: "hover:shadow-[0_0_30px_rgba(245,158,11,0.3)]",
    teal: "hover:shadow-[0_0_30px_rgba(20,184,166,0.3)]",
  };

  const borderGlow = {
    crimson: "hover:border-crimson/50",
    amber: "hover:border-amber/50",
    teal: "hover:border-teal-data/50",
  };

  return (
    <motion.div
      className={`
        relative overflow-hidden
        bg-white/[0.05] backdrop-blur-xl
        border border-white/[0.08] rounded-2xl
        ${hover ? `transition-all duration-300 ${glowMap[glowColor]} ${borderGlow[glowColor]}` : ""}
        ${className}
      `}
      whileHover={hover ? { y: -4, scale: 1.01 } : undefined}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
}
