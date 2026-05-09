"use client";

import React from "react";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export default function StatusBadge({ status, className = "" }: StatusBadgeProps) {
  const colorMap: Record<string, string> = {
    ACTIVE: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    "COMING SOON": "bg-amber/20 text-amber border-amber/30",
    PROCESSING: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    FLAGGED: "bg-crimson/20 text-crimson-glow border-crimson/30",
    CONFIRMED: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    CRITICAL: "bg-crimson/20 text-crimson-glow border-crimson/30",
    ANALYZING: "bg-amber/20 text-amber border-amber/30",
    DIGITAL: "bg-teal-data/20 text-teal-data border-teal-data/30",
    PHYSICAL: "bg-amber/20 text-amber border-amber/30",
    BEHAVIORAL: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  };

  const colors = colorMap[status] || "bg-white/10 text-muted border-white/20";

  return (
    <span
      className={`
        inline-flex items-center px-2.5 py-0.5
        font-orbitron text-[10px] tracking-wider uppercase
        rounded-full border
        ${colors}
        ${className}
      `}
    >
      {status}
    </span>
  );
}
