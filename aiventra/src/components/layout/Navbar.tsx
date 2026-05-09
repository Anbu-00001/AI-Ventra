"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { NAV_LINKS } from "@/lib/constants";
import ScanLine from "@/components/ui/ScanLine";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={`
        fixed top-0 left-0 right-0 z-50
        transition-all duration-500
        ${scrolled
          ? "bg-black/70 backdrop-blur-xl border-b border-white/5 shadow-[0_4px_30px_rgba(0,0,0,0.5)]"
          : "bg-transparent"
        }
      `}
    >
      <div className="relative max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <a href="#" className="flex items-center gap-3 group">
          {/* Crimson pentagon logo */}
          <svg width="28" height="28" viewBox="0 0 28 28" className="transition-transform duration-300 group-hover:scale-110">
            <polygon
              points="14,1 26,9 22,23 6,23 2,9"
              fill="none"
              stroke="#C0182A"
              strokeWidth="1.5"
              className="drop-shadow-[0_0_8px_rgba(192,24,42,0.6)]"
            />
            <polygon
              points="14,6 21,11 19,20 9,20 7,11"
              fill="#C0182A"
              opacity="0.3"
            />
            <circle cx="14" cy="14" r="2" fill="#C0182A" />
          </svg>
          <span className="font-orbitron text-lg font-bold tracking-wider text-pure">
            AIVENTRA
          </span>
        </a>

        {/* Center nav links */}
        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="font-inter text-sm text-muted hover:text-pure transition-colors duration-200 relative group"
            >
              {link.label}
              <span className="absolute -bottom-1 left-0 w-0 h-[1px] bg-crimson transition-all duration-300 group-hover:w-full" />
            </a>
          ))}
        </div>

        {/* CTA */}
        <a
          href="/dashboard"
          className="hidden md:flex font-orbitron text-xs tracking-wider uppercase
            px-5 py-2.5 rounded-md
            border border-crimson/60 text-crimson
            hover:bg-crimson hover:text-white
            transition-all duration-300
            shadow-[0_0_15px_rgba(192,24,42,0.2)]
            hover:shadow-[0_0_25px_rgba(192,24,42,0.5)]"
        >
          Request Access
        </a>

        {/* Mobile hamburger */}
        <button className="md:hidden flex flex-col gap-1.5 p-2">
          <span className="w-5 h-[1.5px] bg-pure" />
          <span className="w-4 h-[1.5px] bg-crimson" />
          <span className="w-5 h-[1.5px] bg-pure" />
        </button>
      </div>

      {/* Scan line effect */}
      <ScanLine />
    </motion.nav>
  );
}
