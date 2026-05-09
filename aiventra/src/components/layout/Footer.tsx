"use client";

import React from "react";
import { Shield, Globe, Lock } from "lucide-react";
import { FOOTER_LINKS } from "@/lib/constants";

export default function Footer() {
  return (
    <footer className="relative bg-base border-t border-transparent">
      {/* Top gradient border */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-crimson to-transparent" />

      <div className="max-w-7xl mx-auto px-6 pt-16 pb-8">
        {/* 4-column grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* Column 1: Brand */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <svg width="24" height="24" viewBox="0 0 28 28">
                <polygon
                  points="14,1 26,9 22,23 6,23 2,9"
                  fill="none"
                  stroke="#C0182A"
                  strokeWidth="1.5"
                />
                <circle cx="14" cy="14" r="2" fill="#C0182A" />
              </svg>
              <span className="font-orbitron text-base font-bold tracking-wider">
                AIVENTRA
              </span>
            </div>
            <p className="text-sm text-muted leading-relaxed mb-6">
              Next-generation AI forensic intelligence platform powering
              investigative agencies across 47 countries.
            </p>
            <div className="flex items-center gap-4">
              {[Shield, Globe, Lock].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-9 h-9 rounded-lg bg-white/5 border border-white/10
                    flex items-center justify-center
                    text-muted hover:text-crimson hover:border-crimson/30
                    transition-all duration-300"
                >
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          {/* Column 2: Platform */}
          <div>
            <h4 className="font-orbitron text-xs tracking-wider uppercase text-muted mb-5">
              Platform
            </h4>
            <ul className="space-y-3">
              {FOOTER_LINKS.platform.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-dim hover:text-pure transition-colors duration-200"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Intelligence */}
          <div>
            <h4 className="font-orbitron text-xs tracking-wider uppercase text-muted mb-5">
              Intelligence
            </h4>
            <ul className="space-y-3">
              {FOOTER_LINKS.intelligence.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-dim hover:text-pure transition-colors duration-200"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: Legal */}
          <div>
            <h4 className="font-orbitron text-xs tracking-wider uppercase text-muted mb-5">
              Compliance
            </h4>
            <ul className="space-y-3">
              {FOOTER_LINKS.legal.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-dim hover:text-pure transition-colors duration-200"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent mb-6" />

        {/* Bottom row */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-dim font-orbitron tracking-wider gradient-text-animated">
            © 2025 AIVENTRA INTELLIGENCE SYSTEMS — ALL DATA CLASSIFIED — AUTHORIZED AGENCIES ONLY
          </p>

          <div className="flex items-center gap-2 text-xs text-dim">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="font-mono text-[11px]">
              SYSTEM STATUS: ALL SYSTEMS OPERATIONAL
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
