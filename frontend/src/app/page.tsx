"use client";

import React from "react";
import dynamic from "next/dynamic";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import HeroOverlay from "@/components/hero/HeroOverlay";
import HeroFloatingCards from "@/components/hero/HeroFloatingCards";

// Dynamic imports for heavy components
const HeroCanvas = dynamic(() => import("@/components/hero/HeroCanvas"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 bg-base flex items-center justify-center">
      <div className="text-center">
        <div className="font-orbitron text-sm text-crimson tracking-widest mb-4 animate-pulse">
          INITIALIZING SYSTEM
        </div>
        <div className="w-48 h-[2px] bg-white/10 rounded-full overflow-hidden mx-auto">
          <div className="loading-bar" />
        </div>
      </div>
    </div>
  ),
});

const WorkflowSection = dynamic(
  () => import("@/components/sections/WorkflowSection"),
  { ssr: false }
);

const EvidenceGraph = dynamic(
  () => import("@/components/sections/EvidenceGraph"),
  { ssr: false }
);

const TimelineSection = dynamic(
  () => import("@/components/sections/TimelineSection"),
  { ssr: false }
);

const AnomalySection = dynamic(
  () => import("@/components/sections/AnomalySection"),
  { ssr: false }
);

const DashboardPreview = dynamic(
  () => import("@/components/sections/DashboardPreview"),
  { ssr: false }
);

const GlobalNetwork = dynamic(
  () => import("@/components/sections/GlobalNetwork"),
  { ssr: false }
);

const FutureSection = dynamic(
  () => import("@/components/sections/FutureSection"),
  { ssr: false }
);

export default function Home() {
  return (
    <main className="relative">
      {/* Navigation */}
      <Navbar />

      {/* Hero Section */}
      <section className="relative h-screen min-h-[700px] overflow-hidden">
        <HeroCanvas />
        <HeroOverlay />
        <HeroFloatingCards />
      </section>

      {/* Section 2: AI Investigation Workflow */}
      <WorkflowSection />

      {/* Section 3: Evidence Correlation Graph */}
      <EvidenceGraph />

      {/* Section 4: Timeline Analysis */}
      <TimelineSection />

      {/* Section 5: Suspicious Pattern Detection */}
      <AnomalySection />

      {/* Section 6: Dashboard Preview */}
      <DashboardPreview />

      {/* Section 7: Global Intelligence Network */}
      <GlobalNetwork />

      {/* Section 8: Future of AI Forensics */}
      <FutureSection />

      {/* Footer */}
      <Footer />
    </main>
  );
}
