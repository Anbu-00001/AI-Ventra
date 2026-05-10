"use client";

import React from "react";

export default function ScanLine({ className = "" }: { className?: string }) {
  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      <div className="absolute top-0 left-0 w-1/3 h-[1px] bg-gradient-to-r from-transparent via-crimson to-transparent animate-scan-line" />
    </div>
  );
}
