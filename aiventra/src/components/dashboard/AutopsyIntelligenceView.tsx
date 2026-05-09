/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowLeft,
  Beaker,
  Briefcase,
  ClipboardList,
  Clock3,
  FlaskConical,
  Home,
  Network,
  Search,
  Settings,
  Shield,
  Skull,
  UserRound,
} from "lucide-react";
import { getDemoAutopsy } from "@/lib/api";
import { EmptyState } from "./EmptyState";
import type { AutopsyFindings } from "@/lib/api";

const railItems = [Home, ClipboardList, UserRound, Network, Clock3, Briefcase, FlaskConical, Settings, Search];

const regionFindings = [
  {
    label: "Cranial Region",
    detail: "No fracture detected",
    confidence: "92%",
    color: "#18f3e2",
    x: "9%",
    y: "10%",
    side: "left",
  },
  {
    label: "Neck Region",
    detail: "Soft tissue trauma",
    confidence: "96%",
    color: "#ff2848",
    x: "76%",
    y: "17%",
    side: "right",
  },
  {
    label: "Thoracic Region",
    detail: "Blunt force impact",
    confidence: "93%",
    color: "#f5a400",
    x: "6%",
    y: "29%",
    side: "left",
  },
  {
    label: "Upper Limb",
    detail: "No major injuries",
    confidence: "90%",
    color: "#18f3e2",
    x: "83%",
    y: "40%",
    side: "right",
  },
  {
    label: "Abdominal Region",
    detail: "Internal bleeding",
    confidence: "89%",
    color: "#f5a400",
    x: "6%",
    y: "54%",
    side: "left",
  },
  {
    label: "Lower Limb",
    detail: "Multiple contusions",
    confidence: "88%",
    color: "#ff2848",
    x: "78%",
    y: "72%",
    side: "right",
  },
];

const extractedFindings = [
  ["Probable Cause", "Blunt Force Trauma", "Confidence: 94%", "#ff2848", Search, 94],
  ["Rigor Mortis", "Partial", "Score: 0.82", "#f5a400", Clock3, 62],
  ["Estimated Time Of Death", "4 - 6 Hours", "Window: 02:00 - 04:00", "#f5a400", Activity, 68],
  ["Environmental Conflict", "Detected", "Confidence: 89%", "#ff2848", Network, 72],
  ["Toxicology Alerts", "Possible Sedatives", "Confidence: 78%", "#18f3e2", Beaker, 61],
] as const;

const reasons = [
  ["Body temperature variance", "+24%", 88, "#ff2848"],
  ["Livor pattern mismatch", "+21%", 78, "#ff2848"],
  ["Ambient temperature (22.3 C)", "+18%", 70, "#ff2848"],
  ["Delayed coagulation factors", "+17%", 62, "#ff2848"],
  ["Stomach content analysis", "+12%", 48, "#ff2848"],
];

const vitals = [
  ["Body Temperature", "22.1 C", "#18f3e2"],
  ["Heart Rate (Est.)", "0 BPM", "#18f3e2"],
  ["Blood Oxygen", "N/A", "#18f3e2"],
  ["pH Level", "6.4", "#18f3e2"],
];

const progress = ["Scanning", "Extraction", "Analysis", "Correlation", "Report"];

export default function AutopsyIntelligenceView({ embedded = false }: { embedded?: boolean }) {
  const [findings, setFindings] = useState<AutopsyFindings | null>(null);

  useEffect(() => {
    getDemoAutopsy()
      .then((response) => setFindings(response.data))
      .catch(() => setFindings(null));
  }, []);

  const liveExtractedFindings = useMemo(() => {
    if (!findings) return [];
    const toxicity = findings.toxicity_flags.find((flag) => flag.detected);
    return [
      ["Probable Cause", findings.cause_of_death.slice(0, 28), `Confidence: ${Math.round(findings.confidence)}%`, "#ff2848", Search, findings.confidence],
      ["Rigor Mortis", findings.rigor_mortis_stage.slice(0, 18), `PMI: ${findings.postmortem_interval_hours}h`, "#f5a400", Clock3, 74],
      ["Estimated Time Of Death", findings.tod_estimate, `Window: ${findings.tod_window_hours}h`, "#f5a400", Activity, 82],
      ["Environmental Conflict", `${findings.environmental_conflicts.length} Detected`, `Confidence: ${Math.round(findings.confidence)}%`, "#ff2848", Network, 72],
      ["Toxicology Alerts", toxicity?.substance?.slice(0, 20) ?? "No critical flag", `Confidence: ${Math.round(toxicity?.confidence ?? findings.confidence)}%`, "#18f3e2", Beaker, toxicity?.confidence ?? 55],
    ] as typeof extractedFindings;
  }, [findings]);

  const liveReasons = useMemo(() => {
    if (!findings) return [];
    const factors = findings.contributing_factors.length ? findings.contributing_factors : findings.environmental_conflicts;
    return factors.slice(0, 5).map((factor, index) => [
      factor.slice(0, 34),
      `+${Math.max(12, 26 - index * 3)}%`,
      Math.max(48, findings.confidence - index * 7),
      "#ff2848",
    ]) as typeof reasons;
  }, [findings]);

  const injurySummary = findings?.injuries?.slice(0, 6) ?? [];
  const confidence = Math.round(findings?.confidence ?? 94);

  return (
    <main className={embedded ? "h-full min-h-0 overflow-hidden bg-transparent text-slate-100" : "min-h-screen overflow-hidden bg-[#05070b] text-slate-100"}>
      {!embedded ? (
        <>
          <div className="fixed inset-0 bg-[radial-gradient(circle_at_48%_42%,rgba(255,40,72,0.16),transparent_33%),linear-gradient(145deg,#040609_0%,#080d14_46%,#030406_100%)]" />
          <div className="fixed inset-0 dashboard-grid opacity-50" />
          <div className="fixed inset-0 crt-overlay pointer-events-none" />
        </>
      ) : null}

      <section className={embedded ? "relative z-10 h-full min-h-0" : "relative z-10 flex min-h-screen items-center justify-center p-3 sm:p-5 lg:p-8"}>
        <motion.div
          initial={{ opacity: 0, y: 18, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className={embedded ? "relative flex h-full min-h-0 w-full overflow-hidden bg-transparent" : "dashboard-shell relative flex h-[calc(100vh-24px)] min-h-[760px] w-full max-w-[1440px] overflow-hidden border border-white/10 bg-black/72 shadow-[0_0_90px_rgba(255,25,54,0.14)] backdrop-blur-xl"}
        >
          {!embedded ? (
          <aside className="hidden w-[70px] shrink-0 border-r border-white/8 bg-[#07101a]/95 px-2 py-20 md:block">
            <div className="flex flex-col items-center gap-4">
              {railItems.map((Icon, index) => (
                <Link
                  key={index}
                  href={index === 0 ? "/dashboard" : "/autopsy"}
                  className={`grid h-11 w-11 place-items-center rounded-md border transition-all duration-300 ${
                    index === 2
                      ? "border-crimson/60 bg-crimson/16 text-crimson-glow shadow-[0_0_24px_rgba(255,25,54,0.26)]"
                      : "border-white/8 bg-white/[0.025] text-slate-500 hover:border-teal-data/40 hover:text-teal-data"
                  }`}
                  aria-label={`Autopsy tool ${index + 1}`}
                >
                  <Icon size={21} strokeWidth={1.8} />
                </Link>
              ))}
            </div>
          </aside>
          ) : null}

          <div className="relative flex min-w-0 flex-1 flex-col">
            {!embedded ? (
            <header className="flex h-[78px] shrink-0 items-center justify-between border-b border-white/8 px-4 sm:px-7">
              <div className="flex items-center gap-4">
                <Link
                  href="/dashboard"
                  className="grid h-10 w-10 place-items-center rounded-md border border-white/10 text-slate-400 transition hover:border-crimson/60 hover:text-white"
                  aria-label="Back to intake dashboard"
                >
                  <ArrowLeft size={18} />
                </Link>
                <div className="flex items-center gap-3">
                  <div className="relative grid h-11 w-11 place-items-center">
                    <div className="absolute inset-0 clip-hexagon bg-crimson/25 shadow-[0_0_22px_rgba(255,25,54,0.4)]" />
                    <Shield className="relative text-crimson-glow" size={24} />
                  </div>
                  <div>
                    <div className="font-orbitron text-xl font-bold tracking-[0.16em] text-white">
                      AIVENTRA
                    </div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
                      Forensic Intelligence System
                    </div>
                  </div>
                </div>
              </div>

              <div className="hidden flex-1 items-center gap-4 px-10 lg:flex">
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-crimson/40 to-transparent" />
                <span className="font-orbitron text-lg font-semibold uppercase tracking-[0.12em] text-crimson-glow">
                  Autopsy Intelligence
                </span>
                <span className="font-mono text-xs uppercase tracking-[0.16em] text-slate-500">
                  {`// Postmortem Analysis Engine`}
                </span>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-teal-data/25 to-transparent" />
              </div>

              <div className="hidden items-center gap-6 font-mono text-[10px] uppercase tracking-[0.12em] text-slate-400 sm:flex">
                <span>Case ID: AIV-2041-7F</span>
                <span className="text-teal-data">Status: Analysis Complete</span>
                <span className="h-2 w-2 rounded-full bg-teal-data shadow-[0_0_12px_rgba(24,243,226,0.8)]" />
              </div>
            </header>
            ) : null}

            <div className="flex-1 overflow-hidden relative">
              {!findings && (
                <div className="absolute inset-0 z-50 p-6 flex items-center justify-center">
                  <EmptyState message="No autopsy report has been processed for this case ID." />
                </div>
              )}
              <div className={`grid min-h-0 h-full gap-4 overflow-auto p-4 xl:grid-cols-[minmax(560px,1.45fr)_minmax(330px,0.78fr)_minmax(250px,0.48fr)] ${!findings ? 'opacity-20 pointer-events-none grayscale' : ''}`}>
              <section className="relative min-h-[570px] overflow-hidden border border-white/8 bg-[#050910]/84">
                <div className="absolute left-5 top-5 z-20 flex items-center gap-2 font-orbitron text-[11px] uppercase tracking-[0.12em] text-slate-200">
                  <span className="h-2 w-2 rounded-full bg-crimson-glow shadow-[0_0_12px_rgba(255,40,72,0.9)]" />
                  Body Scan Overview
                </div>
                <div className="absolute inset-0 autopsy-grid opacity-80" />
                <div className="absolute inset-x-0 bottom-0 h-1/2 dashboard-floor opacity-60" />
                <HumanScan />
                {(injurySummary.length
                  ? regionFindings.map((region, index) => ({
                      ...region,
                      detail: injurySummary[index]?.description?.slice(0, 34) ?? region.detail,
                      confidence: `${Math.round(injurySummary[index]?.confidence ?? findings?.confidence ?? 90)}%`,
                    }))
                  : regionFindings
                ).map((item, index) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.12 + index * 0.08 }}
                    className="autopsy-callout absolute z-20 hidden w-[170px] border bg-black/50 p-3 backdrop-blur-md lg:block"
                    style={{
                      left: item.x,
                      top: item.y,
                      borderColor: `${item.color}70`,
                      boxShadow: `0 0 22px ${item.color}18`,
                    }}
                  >
                    <div className="font-orbitron text-[10px] uppercase tracking-[0.1em]" style={{ color: item.color }}>
                      {item.label}
                    </div>
                    <div className="mt-2 font-mono text-[10px] text-slate-300">{item.detail}</div>
                    <div className="font-mono text-[9px] text-slate-500">Confidence: {item.confidence}</div>
                  </motion.div>
                ))}
                <div className="absolute bottom-4 left-4 z-20 w-[200px] border border-white/10 bg-black/50 p-4 backdrop-blur-md">
                  <div className="mb-4 flex items-center gap-2 font-orbitron text-[11px] uppercase tracking-[0.12em] text-slate-200">
                    <span className="h-2 w-2 rounded-full bg-crimson-glow" />
                    Vital Indicators
                  </div>
                  <div className="space-y-3">
                    {(findings
                      ? [
                          ["Cause", findings.manner_of_death.toUpperCase(), "#18f3e2"],
                          ["TOD", findings.tod_estimate, "#18f3e2"],
                          ["PMI", `${findings.postmortem_interval_hours} H`, "#18f3e2"],
                          ["Confidence", `${confidence}%`, "#18f3e2"],
                        ]
                      : []
                    ).map(([label, value, color]) => (
                      <div key={label} className="grid grid-cols-[1fr_76px] items-end gap-3">
                        <div>
                          <div className="font-mono text-[9px] text-slate-500">{label}</div>
                          <div className="font-mono text-[10px]" style={{ color }}>{value}</div>
                        </div>
                        <div className="h-6 autopsy-wave opacity-80" />
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="grid min-h-0 gap-4">
                <Panel title="AI Extracted Findings">
                  <div className="space-y-3">
                    {liveExtractedFindings.map(([label, value, sub, color, Icon, percent]) => (
                      <div key={label} className="grid grid-cols-[44px_1fr] gap-3 border border-white/8 bg-white/[0.025] p-3">
                        <div className="grid h-9 w-9 place-items-center rounded-full border" style={{ borderColor: `${color}80`, color }}>
                          <Icon size={18} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-orbitron text-[10px] uppercase tracking-[0.12em] text-slate-300">
                              {label}
                            </span>
                            <span className="font-orbitron text-xs uppercase tracking-[0.08em]" style={{ color }}>
                              {value}
                            </span>
                          </div>
                          <div className="mt-1 font-mono text-[9px] text-slate-500">{sub}</div>
                          <div className="mt-2 h-1 bg-white/8">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${percent}%` }}
                              transition={{ duration: 1, delay: 0.2 }}
                              className="h-full"
                              style={{ backgroundColor: color, boxShadow: `0 0 12px ${color}` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>

                <Panel title="Why This Estimation?">
                  <div className="space-y-3">
                    {liveReasons.map(([label, delta, value, color]) => (
                      <div key={label} className="grid grid-cols-[1fr_120px_42px] items-center gap-3">
                        <div className="font-mono text-[11px] text-slate-300">{label}</div>
                        <div className="h-1 bg-white/8">
                          <div
                            className="h-full"
                            style={{
                              width: `${Number(value)}%`,
                              backgroundColor: String(color),
                              boxShadow: `0 0 10px ${String(color)}`,
                            }}
                          />
                        </div>
                        <div className="text-right font-mono text-[10px] text-slate-300">{delta}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 flex items-end justify-between border-t border-white/8 pt-4">
                    <span className="font-orbitron text-[11px] uppercase tracking-[0.1em] text-slate-300">
                      Total Confidence Contribution
                    </span>
                    <span className="font-orbitron text-2xl text-crimson-glow">{confidence}%</span>
                  </div>
                </Panel>
              </section>

              <aside className="grid min-h-0 gap-4">
                <Panel title="Injury Severity Map">
                  <div className="grid grid-cols-[86px_1fr] gap-3">
                    <div className="space-y-2 font-mono text-[10px] uppercase text-slate-400">
                      {[
                        ["Severe", "#ff2848"],
                        ["Moderate", "#f5a400"],
                        ["Mild", "#18f3e2"],
                        ["N/A", "#64748b"],
                      ].map(([label, color]) => (
                        <div key={label} className="flex items-center gap-2">
                          <span className="h-2 w-2" style={{ backgroundColor: color }} />
                          {label}
                        </div>
                      ))}
                    </div>
                    <MiniBody />
                  </div>
                  <div className="mt-4 h-32 w-1 bg-gradient-to-t from-teal-data via-amber to-crimson-glow shadow-[0_0_16px_rgba(255,40,72,0.4)]" />
                </Panel>

                <Panel title="Trauma Type Distribution">
                  <div className="flex items-center gap-5">
                    <div className="trauma-donut" />
                    <div className="space-y-1 font-mono text-[10px] text-slate-400">
                      <div><span className="font-orbitron text-crimson-glow">48%</span> Blunt Force</div>
                      <div><span className="font-orbitron text-amber">24%</span> Soft Tissue</div>
                      <div><span className="font-orbitron text-teal-data">16%</span> Internal Injury</div>
                      <div><span className="font-orbitron text-slate-400">12%</span> Other</div>
                    </div>
                  </div>
                </Panel>

                <Panel title="Forensic Notes">
                  <p className="font-mono text-[11px] leading-relaxed text-slate-400">
                    {findings?.reasoning ??
                      "Multiple injuries consistent with physical assault. Neck region shows signs of compression. Internal hemorrhage detected in thoracic cavity. Toxicology indicates presence of sedative substances which may have contributed to reduced resistance."}
                  </p>
                  <p className="mt-4 font-mono text-[11px] leading-relaxed text-slate-300">
                    <span className="text-slate-100">Recommendation:</span>{" "}
                    {findings?.contributing_factors?.[0] ?? "Further microscopic analysis of tissue samples and fingerprint examination."}
                  </p>
                </Panel>
              </aside>
            </div>
          </div>

            <footer className="grid shrink-0 gap-4 border-t border-white/8 p-4 lg:grid-cols-[1fr_0.48fr]">
              <div className="border border-white/10 bg-[#060b13] px-5 py-4">
                <div className="mb-4 flex items-center gap-2 font-orbitron text-[11px] uppercase tracking-[0.12em] text-slate-200">
                  <span className="h-2 w-2 rounded-full bg-crimson-glow" />
                  Analysis Progress
                </div>
                <div className="grid grid-cols-6 items-center gap-3">
                  <div className="grid h-16 w-16 place-items-center rounded-full border-2 border-crimson-glow font-orbitron text-lg text-slate-100 shadow-[0_0_26px_rgba(255,40,72,0.45)]">
                    100%
                  </div>
                  {progress.map((label, index) => (
                    <div key={label} className="relative text-center">
                      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-crimson/70 bg-black font-orbitron text-xl">
                        {index + 1}
                      </div>
                      <div className="mt-2 font-mono text-[9px] uppercase text-slate-400">{label}</div>
                      <div className="font-mono text-[9px] text-teal-data">Complete</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between border border-white/10 bg-[#060b13] px-8 py-4">
                <div>
                  <div className="mb-2 flex items-center gap-2 font-orbitron text-[11px] uppercase tracking-[0.12em] text-slate-200">
                    <span className="h-2 w-2 rounded-full bg-crimson-glow" />
                    AI Confidence Score
                  </div>
                  <div className="font-orbitron text-6xl leading-none text-crimson-glow">{confidence}<span className="text-3xl">%</span></div>
                </div>
                <div className="h-14 w-36 autopsy-ecg" />
                <Skull size={70} className="text-crimson-glow opacity-80 drop-shadow-[0_0_18px_rgba(255,40,72,0.6)]" />
              </div>
            </footer>
          </div>
        </motion.div>
      </section>
    </main>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden border border-white/10 bg-[#07101a]/78 p-4 shadow-[inset_0_0_40px_rgba(255,255,255,0.02)] backdrop-blur-md">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-crimson/70 to-transparent" />
      <div className="mb-4 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-crimson-glow shadow-[0_0_12px_rgba(255,40,72,0.9)]" />
        <h2 className="font-orbitron text-[12px] font-semibold uppercase tracking-[0.14em] text-slate-100">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function HumanScan() {
  return (
    <div className="absolute inset-0 grid place-items-center pt-8">
      <div className="human-stage relative h-[600px] w-[360px] max-w-[58vw]">
        <div className="absolute left-1/2 top-[7%] h-20 w-16 -translate-x-1/2 rounded-[45%] border border-slate-400/55 bg-slate-400/10 shadow-[inset_0_0_28px_rgba(255,255,255,0.12),0_0_28px_rgba(24,243,226,0.2)]" />
        <div className="absolute left-1/2 top-[20%] h-56 w-32 -translate-x-1/2 rounded-[44%_44%_34%_34%] border border-slate-400/40 bg-slate-300/8 shadow-[inset_0_0_54px_rgba(255,255,255,0.1)]" />
        <div className="absolute left-[25%] top-[28%] h-44 w-9 -rotate-[18deg] rounded-full border border-slate-400/35 bg-slate-300/8" />
        <div className="absolute right-[25%] top-[28%] h-44 w-9 rotate-[18deg] rounded-full border border-slate-400/35 bg-slate-300/8" />
        <div className="absolute left-[42%] top-[55%] h-56 w-11 -rotate-[3deg] rounded-full border border-slate-400/35 bg-slate-300/8" />
        <div className="absolute right-[42%] top-[55%] h-56 w-11 rotate-[3deg] rounded-full border border-slate-400/35 bg-slate-300/8" />
        <div className="absolute left-1/2 top-[19%] h-[72%] w-px -translate-x-1/2 bg-crimson-glow/65 shadow-[0_0_14px_rgba(255,40,72,0.8)]" />
        {[
          ["50%", "20%", "#ff2848", "18px"],
          ["40%", "31%", "#f5a400", "40px"],
          ["43%", "43%", "#f5a400", "34px"],
          ["77%", "41%", "#18f3e2", "18px"],
          ["57%", "70%", "#ff2848", "36px"],
        ].map(([left, top, color, size], index) => (
          <span
            key={index}
            className="absolute rounded-full"
            style={{
              left,
              top,
              width: size,
              height: size,
              backgroundColor: color,
              transform: "translate(-50%, -50%)",
              boxShadow: `0 0 24px ${color}, 0 0 60px ${color}77`,
            }}
          />
        ))}
        <div className="absolute bottom-[2%] left-1/2 h-16 w-72 -translate-x-1/2 rounded-full border border-crimson/70 bg-crimson/8 shadow-[0_0_28px_rgba(255,40,72,0.4)]" />
      </div>
    </div>
  );
}

function MiniBody() {
  return (
    <div className="relative mx-auto h-64 w-28">
      <div className="absolute left-1/2 top-2 h-10 w-8 -translate-x-1/2 rounded-full border border-teal-data/40 bg-teal-data/10" />
      <div className="absolute left-1/2 top-12 h-28 w-16 -translate-x-1/2 rounded-[44%] border border-teal-data/35 bg-teal-data/8" />
      <div className="absolute left-[22%] top-16 h-20 w-4 -rotate-[16deg] rounded-full border border-teal-data/35" />
      <div className="absolute right-[22%] top-16 h-20 w-4 rotate-[16deg] rounded-full border border-teal-data/35" />
      <div className="absolute left-[38%] top-36 h-24 w-5 rounded-full border border-teal-data/35" />
      <div className="absolute right-[38%] top-36 h-24 w-5 rounded-full border border-teal-data/35" />
      <span className="absolute left-1/2 top-[22%] h-8 w-8 -translate-x-1/2 rounded-full bg-crimson-glow/80 shadow-[0_0_25px_rgba(255,40,72,0.9)]" />
      <span className="absolute left-1/2 top-[40%] h-10 w-10 -translate-x-1/2 rounded-full bg-amber/70 shadow-[0_0_25px_rgba(245,164,0,0.8)]" />
      <span className="absolute left-[62%] top-[72%] h-8 w-8 -translate-x-1/2 rounded-full bg-crimson-glow/80 shadow-[0_0_25px_rgba(255,40,72,0.9)]" />
    </div>
  );
}
