"use client";

import React from "react";

interface GlowButtonProps {
  children: React.ReactNode;
  variant?: "primary" | "ghost";
  className?: string;
  onClick?: () => void;
}

export default function GlowButton({
  children,
  variant = "primary",
  className = "",
  onClick,
}: GlowButtonProps) {
  if (variant === "ghost") {
    return (
      <button
        onClick={onClick}
        className={`
          relative font-orbitron text-[13px] tracking-wide uppercase
          px-8 py-4 rounded-lg
          border border-white/20 text-muted
          hover:border-amber/50 hover:text-amber
          transition-all duration-300
          backdrop-blur-sm
          ${className}
        `}
      >
        {children}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`
        relative font-orbitron text-[13px] tracking-wide uppercase
        px-8 py-4 rounded-lg
        bg-crimson text-white font-semibold
        border border-crimson/50
        shadow-[0_0_30px_rgba(192,24,42,0.5)]
        hover:bg-crimson/80 hover:shadow-[0_0_50px_rgba(192,24,42,0.7)]
        transition-all duration-300
        overflow-hidden group
        ${className}
      `}
    >
      {/* Scan line hover effect */}
      <span className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <span className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-white/40 to-transparent animate-scan-line" />
      </span>
      <span className="relative z-10">{children}</span>
    </button>
  );
}
