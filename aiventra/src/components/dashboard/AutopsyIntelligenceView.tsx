/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, AlertTriangle, ArrowLeft, Beaker,
  Clock3, FlaskConical, Loader2, RefreshCw,
  Shield, Skull, Thermometer, Weight, Wind, Zap,
} from "lucide-react";
import {
  getAutopsyFromEvidence, getHenssgeDemo, calculateHenssge, explainConclusion,
} from "@/lib/api";
import type { AutopsyFindings, HenssgeResult, HenssgeInput } from "@/lib/api";

// ─── Region map ───────────────────────────────────────────────────────────────
const BODY_REGIONS = [
  { id: "head",    label: "Cranial Region",   x: "4%",  y: "5%",  side: "left"  },
  { id: "neck",    label: "Neck Region",      x: "72%", y: "16%", side: "right" },
  { id: "chest",   label: "Thoracic Region",  x: "2%",  y: "28%", side: "left"  },
  { id: "arm",     label: "Upper Limb",       x: "77%", y: "38%", side: "right" },
  { id: "abdomen", label: "Abdominal Region", x: "2%",  y: "51%", side: "left"  },
  { id: "leg",     label: "Lower Limb",       x: "74%", y: "68%", side: "right" },
];
const SEV_COLOR: Record<string, string> = {
  SEVERE: "#ff2848", MODERATE: "#f5a400", MILD: "#18f3e2", NORMAL: "#334155",
};
const CLOTHING_OPTS = [
  { v: 1.0, l: "Naked" }, { v: 0.85, l: "Light" },
  { v: 0.65, l: "Heavy" }, { v: 0.40, l: "Jacket" },
];
const ENV_OPTS = [
  { v: 1.0, l: "Still air" }, { v: 1.2, l: "Moving air" },
  { v: 1.5, l: "Wet / rain" }, { v: 2.0, l: "Water" },
];

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function AutopsyIntelligenceView({ embedded = false }: { embedded?: boolean }) {
  const [findings, setFindings]       = useState<(AutopsyFindings & { rag_forensic_context?: string }) | null>(null);
  const [henssge, setHenssge]         = useState<HenssgeResult | null>(null);
  const [ragExplain, setRagExplain]   = useState("");
  const [loading, setLoading]         = useState(true);
  const [nomLoading, setNomLoading]   = useState(false);
  const [selectedId, setSelectedId]   = useState<string | null>(null);
  const [showNomInputs, setShowNomInputs] = useState(false);
  const [nomInput, setNomInput]       = useState<HenssgeInput>({
    body_temp: 22.1, ambient_temp: 24.2, body_weight_kg: 72.0,
    clothing_factor: 0.85, environment_factor: 1.1,
  });

  // ── load everything ────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    const [afRes, hRes] = await Promise.allSettled([
      getAutopsyFromEvidence(),
      getHenssgeDemo(),
    ]);
    const af = afRes.status === "fulfilled" ? afRes.value.data : null;
    const h  = hRes.status  === "fulfilled" ? hRes.value.data  : null;
    setFindings(af);
    setHenssge(h);
    if (h?.inputs) setNomInput(h.inputs as HenssgeInput);
    setLoading(false);
    if (af) {
      explainConclusion(
        `${af.cause_of_death} — PMI ${af.postmortem_interval_hours}h — ${af.rigor_mortis_stage}`
      ).then(r => setRagExplain(r.data?.explanation ?? "")).catch(() => {});
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const runHenssge = useCallback(async () => {
    setNomLoading(true);
    try { const r = await calculateHenssge(nomInput); setHenssge(r.data); }
    catch {/* keep previous */}
    finally { setNomLoading(false); }
  }, [nomInput]);

  // ── derived ────────────────────────────────────────────────────────────────
  const confidence = Math.round(findings?.confidence ?? 88);
  const pmi        = findings?.postmortem_interval_hours ?? 7;
  const injuryMap  = useMemo(() => {
    const m: Record<string, { description: string; severity: string; confidence: number }> = {};
    (findings?.injuries ?? []).forEach((inj, i) => {
      const id = BODY_REGIONS[i]?.id;
      if (id) m[id] = inj;
    });
    return m;
  }, [findings]);
  const toxDetected = (findings?.toxicity_flags ?? []).filter(t => t.detected);

  const reasoningFactors = useMemo(() => {
    const cf = findings?.contributing_factors ?? [];
    if (cf.length >= 3) return cf;
    return [
      `Body temp ${nomInput.body_temp}°C vs normal 37.2°C — differential of ${(37.2 - nomInput.body_temp).toFixed(1)}°C`,
      `Ambient ${nomInput.ambient_temp}°C — cooling rate k=${henssge?.cooling_rate_k ?? "…"}`,
      findings?.rigor_mortis_stage ?? "Rigor mortis state: full",
      findings?.livor_mortis_pattern ?? "Livor mortis: fixed",
      ...(findings?.environmental_conflicts ?? []).slice(0, 2),
    ].filter(Boolean).slice(0, 5);
  }, [findings, henssge, nomInput]);

  // ── Henssge SVG chart values ───────────────────────────────────────────────
  const curve   = henssge?.curve ?? [];
  const SVG_W   = 300;
  const SVG_H   = 110;
  const T_MAX   = 24;
  const TEMP_MIN = Math.min(nomInput.ambient_temp - 2, 16);
  const TEMP_MAX = 38;
  const sx = (t: number)    => (t / T_MAX) * SVG_W;
  const sy = (temp: number) => SVG_H - ((temp - TEMP_MIN) / (TEMP_MAX - TEMP_MIN)) * SVG_H;
  const curvePath = curve.length
    ? "M " + curve.map(p => `${sx(p.t).toFixed(1)},${sy(p.temp).toFixed(1)}`).join(" L ")
    : "";
  const pmiX = henssge?.estimated_pmi_hours != null ? sx(henssge.estimated_pmi_hours) : null;
  const pmiY = pmiX != null ? sy(nomInput.body_temp) : null;

  // ─────────────────────────────────────────────────────────────────────────
  const Wrap = embedded ? React.Fragment : "div";
  const wrapProps = embedded ? {} : { className: "min-h-screen overflow-hidden bg-[#05070b] text-slate-100" };

  return (
    <main className={embedded
      ? "h-full min-h-0 overflow-hidden bg-transparent text-slate-100"
      : "min-h-screen overflow-hidden bg-[#05070b] text-slate-100"
    }>
      {!embedded && (
        <>
          <div className="fixed inset-0 bg-[radial-gradient(circle_at_48%_40%,rgba(255,40,72,0.13),transparent_34%),linear-gradient(145deg,#040609,#080d14_46%,#030406)]" />
          <div className="fixed inset-0 dashboard-grid opacity-50" />
          <div className="fixed inset-0 crt-overlay pointer-events-none" />
        </>
      )}

      <section className={embedded ? "relative z-10 h-full min-h-0" : "relative z-10 flex min-h-screen items-center justify-center p-3 sm:p-5 lg:p-8"}>
        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55 }}
          className={embedded
            ? "relative flex h-full min-h-0 w-full flex-col overflow-hidden bg-transparent"
            : "dashboard-shell relative flex h-[calc(100vh-24px)] min-h-[760px] w-full max-w-[1440px] flex-col overflow-hidden border border-white/10 bg-black/72 shadow-[0_0_80px_rgba(255,25,54,0.14)] backdrop-blur-xl"
          }
        >
          {/* header (standalone only) */}
          {!embedded && (
            <header className="flex h-[78px] shrink-0 items-center justify-between border-b border-white/8 px-7">
              <div className="flex items-center gap-4">
                <Link href="/dashboard" className="grid h-10 w-10 place-items-center border border-white/10 text-slate-400 hover:border-crimson/60 hover:text-white transition">
                  <ArrowLeft size={18} />
                </Link>
                <div className="flex items-center gap-3">
                  <div className="relative grid h-11 w-11 place-items-center">
                    <div className="absolute inset-0 clip-hexagon bg-crimson/25 shadow-[0_0_22px_rgba(255,25,54,0.4)]" />
                    <Shield className="relative text-crimson-glow" size={24} />
                  </div>
                  <div>
                    <div className="font-orbitron text-xl font-bold tracking-[0.16em] text-white">AIVENTRA</div>
                    <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">Forensic Intelligence System</div>
                  </div>
                </div>
              </div>
              <span className="font-orbitron text-sm uppercase tracking-[0.18em] text-crimson-glow">Autopsy Intelligence</span>
              <div className="flex items-center gap-5 font-mono text-[10px] uppercase text-slate-400">
                <span>Case: AIV-2041-77</span>
                <span className="text-teal-data">{loading ? "Analyzing…" : "Complete"}</span>
                {loading ? <Loader2 size={13} className="animate-spin text-teal-400" /> : <span className="h-2 w-2 rounded-full bg-teal-data shadow-[0_0_10px_rgba(24,243,226,0.8)]" />}
              </div>
            </header>
          )}

          {/* ── toolbar ─────────────────────────────────────────────────────── */}
          <div className="flex shrink-0 items-center gap-3 border-b border-white/8 px-4 py-2">
            <span className="font-orbitron text-[11px] uppercase tracking-widest text-crimson-glow">
              ● Postmortem Analysis Engine
            </span>
            {findings && (
              <span className="font-mono text-[10px] text-slate-400">
                Subject: {findings.case_id} · PMI: {pmi}h · Confidence: {confidence}%
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              {loading && <Loader2 size={13} className="animate-spin text-teal-400" />}
              <button
                onClick={loadAll}
                disabled={loading}
                className="flex h-7 items-center gap-1.5 border border-white/10 px-3 font-mono text-[10px] text-slate-400 hover:border-crimson/40 hover:text-crimson transition disabled:opacity-40"
              >
                <RefreshCw size={10} className={loading ? "animate-spin" : ""} />
                Re-analyse
              </button>
            </div>
          </div>

          {/* ── main content ─────────────────────────────────────────────── */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {loading && !findings ? (
              <div className="flex h-full items-center justify-center gap-4">
                <Loader2 size={26} className="animate-spin text-teal-400" />
                <span className="font-orbitron text-xs uppercase tracking-widest text-slate-400 animate-pulse">
                  Analysing evidence from uploaded files…
                </span>
              </div>
            ) : (
              /* ── 3-column grid ─────────────────────────────────────────── */
              <div className="grid h-full min-h-0 overflow-auto
                grid-cols-1
                lg:grid-cols-[380px_1fr_252px]
                gap-3 p-3">

                {/* ═══ COL 1: Body Scan ═══════════════════════════════════ */}
                <section className="relative min-h-[540px] overflow-hidden border border-white/8 bg-[#050910]/84">
                  <div className="absolute inset-0 autopsy-grid opacity-70" />
                  <div className="absolute inset-x-0 bottom-0 h-1/3 dashboard-floor opacity-50" />

                  {/* label */}
                  <div className="absolute left-4 top-4 z-20 flex items-center gap-2 font-orbitron text-[11px] uppercase tracking-[0.12em] text-slate-200">
                    <span className="h-2 w-2 rounded-full bg-crimson-glow shadow-[0_0_10px_rgba(255,40,72,0.9)]" />
                    Body Scan Overview
                  </div>

                  {/* SVG body */}
                  <HumanBodySVG
                    injuries={injuryMap}
                    selectedId={selectedId}
                    onRegionClick={id => setSelectedId(p => p === id ? null : id)}
                  />

                  {/* callout labels */}
                  {BODY_REGIONS.map((region, i) => {
                    const inj = injuryMap[region.id];
                    const color = inj ? (SEV_COLOR[inj.severity] ?? "#18f3e2") : "#475569";
                    const isSelected = selectedId === region.id;
                    return (
                      <motion.button
                        key={region.id}
                        initial={{ opacity: 0, x: region.side === "left" ? -8 : 8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.08 + i * 0.06 }}
                        onClick={() => setSelectedId(p => p === region.id ? null : region.id)}
                        className="autopsy-callout absolute z-20 hidden w-[160px] border bg-black/65 p-2.5 backdrop-blur-md lg:block text-left transition-all"
                        style={{
                          left: region.x, top: region.y,
                          borderColor: `${color}${isSelected ? "cc" : "44"}`,
                          boxShadow: isSelected ? `0 0 18px ${color}44` : undefined,
                        }}
                      >
                        <div className="font-orbitron text-[10px] uppercase tracking-[0.1em]" style={{ color }}>
                          {region.label}
                        </div>
                        <div className="mt-1 font-mono text-[10px] text-slate-300 leading-snug">
                          {inj?.description?.slice(0, 40) ?? "No significant findings"}
                        </div>
                        <div className="mt-0.5 font-mono text-[9px] text-slate-500">
                          {inj ? `${inj.severity} · ${Math.round(inj.confidence)}%` : "N/A"}
                        </div>
                      </motion.button>
                    );
                  })}

                  {/* selected region detail */}
                  <AnimatePresence>
                    {selectedId && injuryMap[selectedId] && (
                      <motion.div
                        key="detail"
                        initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                        className="absolute bottom-4 right-4 z-30 w-52 border border-crimson/40 bg-black/85 p-4 backdrop-blur-md"
                      >
                        <div className="font-orbitron text-[10px] uppercase text-crimson-glow mb-1">
                          {BODY_REGIONS.find(r => r.id === selectedId)?.label}
                        </div>
                        <div className="font-mono text-xs text-slate-200 mb-2">{injuryMap[selectedId].description}</div>
                        <div className="flex justify-between font-mono text-[10px]">
                          <span style={{ color: SEV_COLOR[injuryMap[selectedId].severity] }}>{injuryMap[selectedId].severity}</span>
                          <span className="text-slate-400">{Math.round(injuryMap[selectedId].confidence)}% conf</span>
                        </div>
                        <div className="mt-2 h-1 bg-white/8">
                          <div className="h-full" style={{ width: `${injuryMap[selectedId].confidence}%`, backgroundColor: SEV_COLOR[injuryMap[selectedId].severity] }} />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* vital indicators */}
                  <div className="absolute bottom-4 left-4 z-20 w-[190px] border border-white/10 bg-black/65 p-4 backdrop-blur-md">
                    <div className="mb-3 flex items-center gap-2 font-orbitron text-[11px] uppercase text-slate-200">
                      <span className="h-2 w-2 rounded-full bg-crimson-glow" /> Vital Indicators
                    </div>
                    <div className="space-y-2">
                      {(findings ? [
                        ["Cause",   findings.manner_of_death.toUpperCase()],
                        ["TOD",     findings.tod_estimate],
                        ["PMI",     `${pmi}h`],
                        ["Conf.",   `${confidence}%`],
                      ] : [["—","—"],["—","—"],["—","—"],["—","—"]]).map(([l,v]) => (
                        <div key={l} className="grid grid-cols-[64px_1fr]">
                          <span className="font-mono text-[9px] uppercase text-slate-500">{l}</span>
                          <span className="font-mono text-[10px] text-teal-data truncate">{v}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* ═══ COL 2: Findings + Henssge Graph ═══════════════════ */}
                <div className="flex flex-col min-h-0 gap-3">

                  {/* AI Extracted Findings */}
                  <APanel title="AI Extracted Findings — Evidence Data">
                    <div className="space-y-2">
                      {findings ? [
                        { label: "Probable Cause",  value: findings.cause_of_death.slice(0, 32),      sub: `Confidence: ${confidence}%`,                                     color: "#ff2848", Icon: Skull,         pct: confidence },
                        { label: "Rigor Mortis",    value: findings.rigor_mortis_stage.slice(0, 24),  sub: `PMI: ${pmi}h`,                                                    color: "#f5a400", Icon: Clock3,        pct: 76 },
                        { label: "Time Of Death",   value: findings.tod_estimate,                     sub: `Window: ±${findings.tod_window_hours}h`,                          color: "#f5a400", Icon: Activity,      pct: 84 },
                        { label: "Env. Conflicts",  value: `${findings.environmental_conflicts.length} Detected`, sub: findings.livor_mortis_pattern.slice(0, 32),            color: "#ff2848", Icon: Wind,          pct: 68 },
                        { label: "Toxicology",      value: toxDetected[0]?.substance?.slice(0, 22) ?? "No flag", sub: `Confidence: ${Math.round(toxDetected[0]?.confidence ?? 55)}%`, color: "#18f3e2", Icon: FlaskConical, pct: toxDetected[0]?.confidence ?? 55 },
                      ].map(({ label, value, sub, color, Icon, pct }) => (
                        <div key={label} className="grid grid-cols-[38px_1fr] gap-2.5 border border-white/8 bg-white/[0.02] p-2.5">
                          <div className="grid h-8 w-8 place-items-center rounded-full border" style={{ borderColor: `${color}60`, color }}>
                            <Icon size={14} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-orbitron text-[10px] uppercase text-slate-300 truncate">{label}</span>
                              <span className="font-orbitron text-[10px] shrink-0" style={{ color }}>{value}</span>
                            </div>
                            <div className="mt-0.5 font-mono text-[9px] text-slate-500">{sub}</div>
                            <div className="mt-1.5 h-[3px] bg-white/8">
                              <motion.div
                                initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.8, delay: 0.1 }}
                                className="h-full"
                                style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
                              />
                            </div>
                          </div>
                        </div>
                      )) : <div className="py-4 text-center font-mono text-xs text-slate-500">Loading…</div>}
                    </div>
                  </APanel>

                  {/* ── Henssge Nomogram Graph ────────────────────────── */}
                  <APanel title={`Henssge Nomogram — PMI Estimation · Est. ${henssge?.estimated_pmi_hours?.toFixed(1) ?? "…"}h`}>
                    <div className="flex flex-col gap-3">

                      {/* Cooling curve chart */}
                      <div className="relative h-[118px] border border-white/8 bg-black/50">
                        <svg
                          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                          className="absolute inset-0 w-full h-full"
                          preserveAspectRatio="none"
                        >
                          <defs>
                            <filter id="hglow">
                              <feGaussianBlur stdDeviation="1.8" result="b"/>
                              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                            </filter>
                            <linearGradient id="curveGrad" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="#18f3e2" stopOpacity="0.9"/>
                              <stop offset="100%" stopColor="#f5a400" stopOpacity="0.9"/>
                            </linearGradient>
                          </defs>

                          {/* grid */}
                          {[0,6,12,18,24].map(t => (
                            <line key={t} x1={sx(t)} y1={0} x2={sx(t)} y2={SVG_H}
                              stroke="#ffffff09" strokeWidth="1"/>
                          ))}
                          {[10,20,30,37].map(temp => (
                            <line key={temp} x1={0} y1={sy(temp)} x2={SVG_W} y2={sy(temp)}
                              stroke="#ffffff09" strokeWidth="1"/>
                          ))}

                          {/* ambient line */}
                          <line x1={0} y1={sy(nomInput.ambient_temp)} x2={SVG_W} y2={sy(nomInput.ambient_temp)}
                            stroke="#18f3e2" strokeWidth="0.9" strokeDasharray="4 5" opacity="0.5"/>

                          {/* uncertainty band */}
                          {henssge?.pmi_lower != null && henssge?.pmi_upper != null && (
                            <rect
                              x={sx(henssge.pmi_lower)} y={0}
                              width={Math.max(1, sx(henssge.pmi_upper) - sx(henssge.pmi_lower))}
                              height={SVG_H}
                              fill="#ff2848" opacity="0.08"
                            />
                          )}

                          {/* cooling curve */}
                          {curvePath && (
                            <path d={curvePath} fill="none"
                              stroke="url(#curveGrad)" strokeWidth="1.6"
                              filter="url(#hglow)"/>
                          )}

                          {/* body temp line */}
                          <line x1={0} y1={sy(nomInput.body_temp)} x2={SVG_W} y2={sy(nomInput.body_temp)}
                            stroke="#ff2848" strokeWidth="0.8" strokeDasharray="3 5" opacity="0.7"/>

                          {/* PMI marker */}
                          {pmiX != null && pmiY != null && (
                            <>
                              <line x1={pmiX} y1={0} x2={pmiX} y2={SVG_H}
                                stroke="#ff2848" strokeWidth="1.2" strokeDasharray="2 3" opacity="0.85"/>
                              <circle cx={pmiX} cy={pmiY} r="4.5"
                                fill="#ff2848" filter="url(#hglow)"/>
                              <circle cx={pmiX} cy={pmiY} r="7"
                                fill="none" stroke="#ff2848" strokeWidth="0.8" opacity="0.4"/>
                            </>
                          )}

                          {/* T0 = 37.2 dot at t=0 */}
                          <circle cx={sx(0)} cy={sy(37.2)} r="3" fill="#64748b" opacity="0.6"/>
                        </svg>

                        {/* axis labels */}
                        <div className="absolute bottom-0.5 left-0 right-0 flex justify-between px-2 font-mono text-[8px] text-slate-600">
                          {[0,6,12,18,24].map(t => <span key={t}>{t}h</span>)}
                        </div>
                        <div className="absolute top-0.5 right-1 font-mono text-[8px] text-slate-600">37°C</div>
                        <div className="absolute bottom-3 right-1 font-mono text-[8px] text-teal-600">
                          {nomInput.ambient_temp}°C
                        </div>
                      </div>

                      {/* Metric pills */}
                      <div className="grid grid-cols-4 gap-2">
                        {[
                          { l: "Est. PMI",    v: henssge?.estimated_pmi_hours ? `${henssge.estimated_pmi_hours.toFixed(1)}h` : "—",            c: "#ff2848" },
                          { l: "PMI Window",  v: henssge?.tod_window ?? "—",                                                                     c: "#f5a400" },
                          { l: "Cooling k",   v: henssge?.cooling_rate_k?.toFixed(4) ?? "—",                                                     c: "#18f3e2" },
                          { l: "Confidence",  v: henssge?.estimated_pmi_hours ? "78%" : "—",                                                     c: "#c084fc" },
                        ].map(({ l, v, c }) => (
                          <div key={l} className="border border-white/8 bg-black/30 px-2 py-2 text-center">
                            <div className="font-mono text-[8px] uppercase text-slate-500 mb-0.5">{l}</div>
                            <div className="font-orbitron text-[11px] font-bold leading-tight" style={{ color: c }}>{v}</div>
                          </div>
                        ))}
                      </div>

                      {/* Legend + configure toggle */}
                      <div className="flex items-center justify-between">
                        <div className="flex flex-wrap gap-3 font-mono text-[9px] text-slate-500">
                          <span className="flex items-center gap-1"><span className="h-px w-4 bg-gradient-to-r from-teal-400 to-amber-400 inline-block"/>Cooling curve</span>
                          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-crimson-glow inline-block"/>PMI intercept</span>
                          <span className="flex items-center gap-1"><span className="h-px w-4 border-t border-dashed border-teal-400 inline-block"/>Ambient Tₐ</span>
                        </div>
                        <button
                          onClick={() => setShowNomInputs(p => !p)}
                          className="flex items-center gap-1.5 font-mono text-[10px] text-crimson/80 hover:text-crimson transition"
                        >
                          <Zap size={10}/>{showNomInputs ? "Hide inputs" : "Configure"}
                        </button>
                      </div>

                      {/* Collapsible input controls */}
                      <AnimatePresence>
                        {showNomInputs && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="border-t border-white/8 pt-3 space-y-3">
                              <NomSlider label="Body Temp (Tb)" icon={Thermometer} value={nomInput.body_temp}
                                min={10} max={37} step={0.1} unit="°C" color="#ff2848"
                                onChange={v => setNomInput(p => ({ ...p, body_temp: v }))} />
                              <NomSlider label="Ambient Temp (Ta)" icon={Wind} value={nomInput.ambient_temp}
                                min={0} max={40} step={0.5} unit="°C" color="#18f3e2"
                                onChange={v => setNomInput(p => ({ ...p, ambient_temp: v }))} />
                              <NomSlider label="Body Weight" icon={Weight} value={nomInput.body_weight_kg}
                                min={30} max={150} step={1} unit="kg" color="#f5a400"
                                onChange={v => setNomInput(p => ({ ...p, body_weight_kg: v }))} />

                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <div className="font-mono text-[9px] uppercase text-slate-500 mb-1.5">Clothing</div>
                                  <div className="grid grid-cols-2 gap-1">
                                    {CLOTHING_OPTS.map(o => (
                                      <button key={o.v} onClick={() => setNomInput(p => ({...p, clothing_factor: o.v}))}
                                        className={`px-1.5 py-1 font-mono text-[9px] border transition ${nomInput.clothing_factor === o.v ? "border-crimson/50 bg-crimson/10 text-crimson-glow" : "border-white/8 text-slate-400 hover:border-white/20"}`}>
                                        {o.l}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <div>
                                  <div className="font-mono text-[9px] uppercase text-slate-500 mb-1.5">Environment</div>
                                  <div className="grid grid-cols-2 gap-1">
                                    {ENV_OPTS.map(o => (
                                      <button key={o.v} onClick={() => setNomInput(p => ({...p, environment_factor: o.v}))}
                                        className={`px-1.5 py-1 font-mono text-[9px] border transition ${nomInput.environment_factor === o.v ? "border-teal-data/50 bg-teal-data/10 text-teal-data" : "border-white/8 text-slate-400 hover:border-white/20"}`}>
                                        {o.l}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              <button
                                onClick={runHenssge}
                                disabled={nomLoading}
                                className="flex h-9 w-full items-center justify-center gap-2 bg-crimson/15 border border-crimson/40 font-orbitron text-[10px] uppercase tracking-wide text-crimson-glow hover:bg-crimson/25 transition disabled:opacity-50"
                              >
                                {nomLoading ? <><Loader2 size={11} className="animate-spin"/>Computing…</> : <><Zap size={11}/>Calculate PMI</>}
                              </button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* note */}
                      {henssge?.note && (
                        <div className="flex items-start gap-2 border border-amber-400/15 bg-amber-400/5 p-2">
                          <AlertTriangle size={11} className="text-amber-400 shrink-0 mt-0.5"/>
                          <span className="font-mono text-[10px] text-amber-300 leading-snug">{henssge.note}</span>
                        </div>
                      )}
                    </div>
                  </APanel>

                  {/* Why This Estimation */}
                  <APanel title="Why This Estimation?">
                    <div className="space-y-2.5">
                      {reasoningFactors.map((factor, i) => (
                        <div key={i} className="grid grid-cols-[1fr_80px_36px] items-center gap-2.5">
                          <div className="font-mono text-[10px] text-slate-300 truncate">{factor.slice(0, 44)}</div>
                          <div className="h-[3px] bg-white/8">
                            <motion.div
                              className="h-full bg-crimson-glow"
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.max(40, confidence - i * 9)}%` }}
                              transition={{ duration: 0.7, delay: i * 0.08 }}
                              style={{ boxShadow: "0 0 6px #ff2848" }}
                            />
                          </div>
                          <div className="text-right font-mono text-[9px] text-slate-400">+{24 - i * 4}%</div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex items-end justify-between border-t border-white/8 pt-3">
                      <span className="font-orbitron text-[10px] uppercase text-slate-400">Total Confidence</span>
                      <span className="font-orbitron text-xl text-crimson-glow">{confidence}%</span>
                    </div>
                  </APanel>

                  {/* RAG context if available */}
                  {(ragExplain || henssge?.rag_context || findings?.rag_forensic_context) && (
                    <APanel title="RAG · Forensic Literature Context">
                      <p className="font-mono text-[10px] leading-relaxed text-slate-300 line-clamp-3">
                        {ragExplain || henssge?.rag_context || findings?.rag_forensic_context}
                      </p>
                    </APanel>
                  )}
                </div>

                {/* ═══ COL 3: Severity Map + Toxicology + Notes ══════════ */}
                <aside className="flex flex-col min-h-0 gap-3">
                  <APanel title="Injury Severity Map">
                    <div className="flex gap-3">
                      <div className="space-y-1.5 font-mono text-[9px] uppercase text-slate-400 shrink-0">
                        {[["Severe","#ff2848"],["Moderate","#f5a400"],["Mild","#18f3e2"],["N/A","#334155"]].map(([l,c]) => (
                          <div key={l} className="flex items-center gap-1.5">
                            <span className="h-2 w-2 shrink-0" style={{ backgroundColor: c }}/>{l}
                          </div>
                        ))}
                      </div>
                      <MiniBodySVG injuries={injuryMap}/>
                    </div>
                  </APanel>

                  <APanel title="Trauma Distribution">
                    <TraumaDonut injuries={findings?.injuries ?? []}/>
                  </APanel>

                  <APanel title="Toxicology">
                    {findings?.toxicity_flags?.length ? (
                      <div className="space-y-2.5">
                        {findings.toxicity_flags.map((flag, i) => (
                          <div key={i} className="border border-white/8 bg-white/[0.02] p-2.5">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2">
                                <Beaker size={12} style={{ color: flag.detected ? "#ff2848" : "#18f3e2" }}/>
                                <span className="font-orbitron text-[10px] uppercase text-slate-100">{flag.substance}</span>
                              </div>
                              <span className={`font-mono text-[9px] font-bold px-1.5 py-0.5 ${flag.detected ? "text-crimson-glow bg-crimson/10 border border-crimson/30" : "text-teal-data bg-teal-data/5 border border-teal-data/20"}`}>
                                {flag.detected ? "DETECTED" : "NEG"}
                              </span>
                            </div>
                            {flag.note && <div className="font-mono text-[9px] text-slate-400 mb-1.5">{flag.note}</div>}
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1 bg-white/8">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${flag.confidence}%` }}
                                  transition={{ duration: 0.7, delay: i * 0.1 }}
                                  className="h-full"
                                  style={{ backgroundColor: flag.detected ? "#ff2848" : "#18f3e2", boxShadow: `0 0 5px ${flag.detected ? "#ff2848" : "#18f3e2"}` }}
                                />
                              </div>
                              <span className="font-mono text-[9px] text-slate-500">{flag.confidence}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="font-mono text-[10px] text-slate-500 text-center py-3">No toxicology data</div>
                    )}
                  </APanel>

                  <APanel title="Forensic Notes">
                    <p className="font-mono text-[10px] leading-relaxed text-slate-400 line-clamp-6">
                      {findings?.reasoning ?? "Analysis based on available postmortem indicators."}
                    </p>
                    {(findings?.contributing_factors?.[0] || findings?.environmental_conflicts?.[0]) && (
                      <p className="mt-2.5 font-mono text-[10px] leading-relaxed text-slate-300">
                        <span className="text-teal-data">Rec:</span>{" "}
                        {findings.contributing_factors?.[0] ?? findings.environmental_conflicts?.[0]}
                      </p>
                    )}
                  </APanel>
                </aside>
              </div>
            )}
          </div>

          {/* ── footer ──────────────────────────────────────────────────── */}
          <footer className="grid shrink-0 gap-3 border-t border-white/8 p-3 lg:grid-cols-[1fr_auto]">
            <div className="border border-white/10 bg-[#060b13] px-5 py-3">
              <div className="mb-2.5 flex items-center gap-2 font-orbitron text-[11px] uppercase text-slate-200">
                <span className="h-2 w-2 rounded-full bg-crimson-glow"/>Analysis Progress
              </div>
              <div className="flex items-center gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-2 border-crimson-glow font-orbitron text-sm text-slate-100 shadow-[0_0_20px_rgba(255,40,72,0.4)]">
                  100%
                </div>
                {["Scanning","Extraction","Analysis","Correlation","Report"].map((label, i) => (
                  <div key={label} className="text-center">
                    <div className="mx-auto grid h-9 w-9 place-items-center rounded-full border border-crimson/50 bg-black font-orbitron text-xs">
                      {i + 1}
                    </div>
                    <div className="mt-1 font-mono text-[8px] uppercase text-slate-400">{label}</div>
                    <div className="font-mono text-[8px] text-teal-data">Done</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between gap-8 border border-white/10 bg-[#060b13] px-6 py-3 min-w-[180px]">
              <div>
                <div className="mb-1 font-orbitron text-[10px] uppercase text-slate-400">AI Confidence</div>
                <div className="font-orbitron text-4xl leading-none text-crimson-glow">
                  {confidence}<span className="text-xl">%</span>
                </div>
              </div>
              <Skull size={52} className="text-crimson-glow opacity-75 drop-shadow-[0_0_14px_rgba(255,40,72,0.6)]"/>
            </div>
          </footer>
        </motion.div>
      </section>
    </main>
  );
}

// ─── Anatomical human body SVG ─────────────────────────────────────────────────
function HumanBodySVG({ injuries, selectedId, onRegionClick }: {
  injuries: Record<string, { severity: string }>;
  selectedId: string | null;
  onRegionClick: (id: string) => void;
}) {
  const col = (id: string) => injuries[id] ? (SEV_COLOR[injuries[id].severity] ?? "#334155") : "#1e293b";
  const glow = (id: string) => { const c = col(id); return c !== "#1e293b" ? `0 0 16px ${c}99` : "none"; };

  return (
    <div className="absolute inset-0 flex items-center justify-center pt-12 pb-4">
      <svg viewBox="0 0 200 530" className="h-full max-h-[490px] w-auto select-none"
        style={{ filter: "drop-shadow(0 0 30px rgba(24,243,226,0.06))" }}>
        <defs>
          <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#18f3e2" stopOpacity="0.14"/>
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0.04"/>
          </linearGradient>
          <filter id="ig"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="sel"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>

        {/* ── head ── */}
        <ellipse cx="100" cy="30" rx="22" ry="25" fill="url(#bg)" stroke="#18f3e2" strokeWidth="0.9" strokeOpacity="0.38"
          style={{ cursor:"pointer", filter: selectedId==="head" ? glow("head") : undefined }}
          onClick={() => onRegionClick("head")}/>
        <ellipse cx="100" cy="27" rx="13" ry="11" fill={col("head")} fillOpacity="0.28" filter="url(#ig)"
          onClick={() => onRegionClick("head")} style={{ cursor:"pointer" }}/>
        {/* skull structure */}
        <path d="M86,22 Q100,14 114,22" fill="none" stroke="#18f3e2" strokeWidth="0.4" strokeOpacity="0.3"/>
        <circle cx="93" cy="31" r="3" fill="none" stroke="#18f3e2" strokeWidth="0.3" strokeOpacity="0.25"/>
        <circle cx="107" cy="31" r="3" fill="none" stroke="#18f3e2" strokeWidth="0.3" strokeOpacity="0.25"/>

        {/* ── neck ── */}
        <rect x="91" y="53" width="18" height="16" rx="4" fill="url(#bg)" stroke="#18f3e2" strokeWidth="0.7" strokeOpacity="0.3"
          onClick={() => onRegionClick("neck")} style={{ cursor:"pointer" }}/>
        {col("neck") !== "#1e293b" && (
          <rect x="91" y="53" width="18" height="16" rx="4" fill={col("neck")} fillOpacity="0.3" filter="url(#ig)"
            onClick={() => onRegionClick("neck")} style={{ cursor:"pointer" }}/>
        )}

        {/* ── shoulders ── */}
        <path d="M91,55 Q65,60 57,76 L57,95" fill="url(#bg)" stroke="#18f3e2" strokeWidth="0.7" strokeOpacity="0.32"/>
        <path d="M109,55 Q135,60 143,76 L143,95" fill="url(#bg)" stroke="#18f3e2" strokeWidth="0.7" strokeOpacity="0.32"/>

        {/* ── torso / chest ── */}
        <path d="M57,76 L57,205 L143,205 L143,76 Q122,55 100,55 Q78,55 57,76 Z"
          fill="url(#bg)" stroke="#18f3e2" strokeWidth="0.85" strokeOpacity="0.4"
          onClick={() => onRegionClick("chest")} style={{ cursor:"pointer" }}/>
        {/* chest injury overlay */}
        <ellipse cx="100" cy="133" rx="30" ry="35" fill={col("chest")} fillOpacity="0.22" filter="url(#ig)"
          onClick={() => onRegionClick("chest")} style={{ cursor:"pointer" }}/>
        {/* collarbones */}
        <path d="M68,75 Q100,82 132,75" fill="none" stroke="#18f3e2" strokeWidth="0.5" strokeOpacity="0.3"/>
        {/* pec lines */}
        <path d="M70,96 Q100,106 130,96" fill="none" stroke="#18f3e2" strokeWidth="0.35" strokeOpacity="0.2"/>
        <path d="M70,115 Q100,125 130,115" fill="none" stroke="#18f3e2" strokeWidth="0.3" strokeOpacity="0.18"/>
        {/* ribs */}
        {[102,114,126,138,150].map((y,i) => (
          <path key={y} d={`M70,${y} Q100,${y+6} 130,${y}`} fill="none"
            stroke="#18f3e2" strokeWidth="0.3" strokeOpacity={0.14 - i*0.02}/>
        ))}

        {/* ── abdomen ── */}
        <path d="M59,203 L59,290 Q78,308 100,308 Q122,308 141,290 L141,203 Z"
          fill="url(#bg)" stroke="#18f3e2" strokeWidth="0.75" strokeOpacity="0.35"
          onClick={() => onRegionClick("abdomen")} style={{ cursor:"pointer" }}/>
        <ellipse cx="100" cy="247" rx="26" ry="30" fill={col("abdomen")} fillOpacity="0.2" filter="url(#ig)"
          onClick={() => onRegionClick("abdomen")} style={{ cursor:"pointer" }}/>
        {/* navel */}
        <circle cx="100" cy="254" r="2.5" fill="none" stroke="#18f3e2" strokeWidth="0.4" strokeOpacity="0.28"/>
        {/* midline */}
        <line x1="100" y1="205" x2="100" y2="307" stroke="#18f3e2" strokeWidth="0.3" strokeOpacity="0.18" strokeDasharray="4 5"/>
        {/* abs */}
        {[218,236,255,273].map(y => (
          <path key={y} d={`M76,${y} Q100,${y+4} 124,${y}`} fill="none" stroke="#18f3e2" strokeWidth="0.25" strokeOpacity="0.13"/>
        ))}

        {/* ── left arm ── */}
        <path d="M57,76 L42,80 L30,132 L27,215 L40,215 L50,140 L58,108 Z"
          fill="url(#bg)" stroke="#18f3e2" strokeWidth="0.7" strokeOpacity="0.32"
          onClick={() => onRegionClick("arm")} style={{ cursor:"pointer" }}/>
        <path d="M27,215 L22,295 L30,305 L43,300 L40,215 Z"
          fill="url(#bg)" stroke="#18f3e2" strokeWidth="0.6" strokeOpacity="0.28"
          onClick={() => onRegionClick("arm")} style={{ cursor:"pointer" }}/>
        <ellipse cx="26" cy="313" rx="9" ry="12" fill="url(#bg)" stroke="#18f3e2" strokeWidth="0.6" strokeOpacity="0.28"/>

        {/* ── right arm ── */}
        <path d="M143,76 L158,80 L170,132 L173,215 L160,215 L150,140 L142,108 Z"
          fill="url(#bg)" stroke="#18f3e2" strokeWidth="0.7" strokeOpacity="0.32"
          onClick={() => onRegionClick("arm")} style={{ cursor:"pointer" }}/>
        <path d="M173,215 L178,295 L170,305 L157,300 L160,215 Z"
          fill="url(#bg)" stroke="#18f3e2" strokeWidth="0.6" strokeOpacity="0.28"
          onClick={() => onRegionClick("arm")} style={{ cursor:"pointer" }}/>
        <ellipse cx="174" cy="313" rx="9" ry="12" fill="url(#bg)" stroke="#18f3e2" strokeWidth="0.6" strokeOpacity="0.28"/>
        {/* arm injury */}
        {col("arm") !== "#1e293b" && (
          <>
            <ellipse cx="34" cy="165" rx="13" ry="28" fill={col("arm")} fillOpacity="0.25" filter="url(#ig)"
              onClick={() => onRegionClick("arm")} style={{ cursor:"pointer" }}/>
            <ellipse cx="166" cy="165" rx="13" ry="28" fill={col("arm")} fillOpacity="0.25" filter="url(#ig)"
              onClick={() => onRegionClick("arm")} style={{ cursor:"pointer" }}/>
          </>
        )}

        {/* ── hips / pelvis ── */}
        <path d="M59,286 Q46,298 46,318 L46,340 L154,340 L154,318 Q154,298 141,286 Q122,308 100,308 Q78,308 59,286 Z"
          fill="url(#bg)" stroke="#18f3e2" strokeWidth="0.7" strokeOpacity="0.32"/>

        {/* ── left leg upper ── */}
        <path d="M46,340 L44,447 Q56,466 72,466 L80,340 Z"
          fill="url(#bg)" stroke="#18f3e2" strokeWidth="0.7" strokeOpacity="0.32"
          onClick={() => onRegionClick("leg")} style={{ cursor:"pointer" }}/>
        {/* left leg lower */}
        <path d="M44,447 L40,516 L56,521 L72,466 L72,446 Z"
          fill="url(#bg)" stroke="#18f3e2" strokeWidth="0.6" strokeOpacity="0.28"
          onClick={() => onRegionClick("leg")} style={{ cursor:"pointer" }}/>
        <ellipse cx="48" cy="524" rx="12" ry="6" fill="url(#bg)" stroke="#18f3e2" strokeWidth="0.6" strokeOpacity="0.28"/>

        {/* ── right leg upper ── */}
        <path d="M154,340 L156,447 Q144,466 128,466 L120,340 Z"
          fill="url(#bg)" stroke="#18f3e2" strokeWidth="0.7" strokeOpacity="0.32"
          onClick={() => onRegionClick("leg")} style={{ cursor:"pointer" }}/>
        {/* right leg lower */}
        <path d="M156,447 L160,516 L144,521 L128,466 L128,446 Z"
          fill="url(#bg)" stroke="#18f3e2" strokeWidth="0.6" strokeOpacity="0.28"
          onClick={() => onRegionClick("leg")} style={{ cursor:"pointer" }}/>
        <ellipse cx="152" cy="524" rx="12" ry="6" fill="url(#bg)" stroke="#18f3e2" strokeWidth="0.6" strokeOpacity="0.28"/>

        {/* leg injury */}
        {col("leg") !== "#1e293b" && (
          <>
            <ellipse cx="58" cy="400" rx="16" ry="36" fill={col("leg")} fillOpacity="0.22" filter="url(#ig)"
              onClick={() => onRegionClick("leg")} style={{ cursor:"pointer" }}/>
            <ellipse cx="142" cy="400" rx="16" ry="36" fill={col("leg")} fillOpacity="0.22" filter="url(#ig)"
              onClick={() => onRegionClick("leg")} style={{ cursor:"pointer" }}/>
          </>
        )}

        {/* ── spine ── */}
        <line x1="100" y1="55" x2="100" y2="308" stroke="#18f3e2" strokeWidth="0.4"
          strokeOpacity="0.17" strokeDasharray="4 6"/>

        {/* ── injury indicators ── */}
        {Object.entries(injuries).map(([id, inj]) => {
          const region = BODY_REGIONS.find(r => r.id === id);
          if (!region) return null;
          const c = SEV_COLOR[inj.severity] ?? "#fff";
          // approximate SVG coordinates for each region's dot
          const coords: Record<string, [number,number]> = {
            head: [100,28], neck: [100,60], chest: [100,130],
            arm: [28,160], abdomen: [100,248], leg: [58,400],
          };
          const [cx, cy] = coords[id] ?? [100,200];
          return (
            <motion.g key={id} style={{ cursor:"pointer" }} onClick={() => onRegionClick(id)}>
              <motion.circle cx={cx} cy={cy}
                r={selectedId === id ? 8 : 5.5}
                fill={c} fillOpacity={0.88}
                filter="url(#ig)"
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300 }}
              />
              {selectedId === id && (
                <motion.circle cx={cx} cy={cy} r={13}
                  fill="none" stroke={c} strokeWidth="1" opacity="0.4"
                  animate={{ r: [13, 20, 13], opacity: [0.4, 0, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
            </motion.g>
          );
        })}
      </svg>
    </div>
  );
}

// ─── Mini body (severity map) ─────────────────────────────────────────────────
function MiniBodySVG({ injuries }: { injuries: Record<string, { severity: string }> }) {
  const c = (id: string) => injuries[id] ? (SEV_COLOR[injuries[id].severity] ?? "#64748b") : "#1e2d3d";
  return (
    <svg viewBox="0 0 80 210" className="h-44 w-auto mx-auto">
      <defs>
        <linearGradient id="mg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#18f3e2" stopOpacity="0.12"/>
          <stop offset="100%" stopColor="#0f172a" stopOpacity="0.04"/>
        </linearGradient>
      </defs>
      <ellipse cx="40" cy="11" rx="10" ry="11" fill={c("head")} fillOpacity="0.75" stroke="#18f3e2" strokeWidth="0.5" strokeOpacity="0.3"/>
      <rect x="36" y="21" width="8" height="8" rx="2" fill={c("neck")} fillOpacity="0.75" stroke="#18f3e2" strokeWidth="0.4" strokeOpacity="0.25"/>
      <path d="M26,29 L26,82 L54,82 L54,29 Q40,22 26,29 Z" fill={c("chest")} fillOpacity="0.55" stroke="#18f3e2" strokeWidth="0.5" strokeOpacity="0.28"/>
      <path d="M26,82 L26,120 Q40,128 54,120 L54,82 Z" fill={c("abdomen")} fillOpacity="0.55" stroke="#18f3e2" strokeWidth="0.5" strokeOpacity="0.28"/>
      <path d="M26,29 L14,27 L10,76 L20,76 L24,32 Z" fill={c("arm")} fillOpacity="0.55" stroke="#18f3e2" strokeWidth="0.4" strokeOpacity="0.22"/>
      <path d="M54,29 L66,27 L70,76 L60,76 L56,32 Z" fill={c("arm")} fillOpacity="0.55" stroke="#18f3e2" strokeWidth="0.4" strokeOpacity="0.22"/>
      <path d="M26,120 L22,176 L30,178 L38,124 Z" fill={c("leg")} fillOpacity="0.55" stroke="#18f3e2" strokeWidth="0.4" strokeOpacity="0.22"/>
      <path d="M54,120 L58,176 L50,178 L42,124 Z" fill={c("leg")} fillOpacity="0.55" stroke="#18f3e2" strokeWidth="0.4" strokeOpacity="0.22"/>
    </svg>
  );
}

// ─── Trauma donut chart ────────────────────────────────────────────────────────
function TraumaDonut({ injuries }: { injuries: Array<{ severity: string }> }) {
  const counts = { SEVERE: 0, MODERATE: 0, MILD: 0, NORMAL: 0 };
  injuries.forEach(inj => { const k = inj.severity as keyof typeof counts; if (k in counts) counts[k]++; });
  const total = Math.max(injuries.length, 1);
  const R = 28, CX = 36, CY = 36, SW = 11;
  const circ = 2 * Math.PI * R;
  const segs = [
    { label:"Severe",   k:"SEVERE",   color:"#ff2848" },
    { label:"Moderate", k:"MODERATE", color:"#f5a400" },
    { label:"Mild",     k:"MILD",     color:"#18f3e2" },
    { label:"Normal",   k:"NORMAL",   color:"#334155" },
  ];
  let off = 0;
  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 72 72" className="h-14 w-14 shrink-0" style={{ transform:"rotate(-90deg)" }}>
        {segs.map(s => {
          const cnt = counts[s.k as keyof typeof counts];
          const len = (cnt / total) * circ;
          const el = <circle key={s.k} cx={CX} cy={CY} r={R} fill="none"
            stroke={s.color} strokeWidth={SW}
            strokeDasharray={`${len} ${circ - len}`}
            strokeDashoffset={-off}
            opacity={cnt > 0 ? 0.85 : 0}/>;
          off += len;
          return el;
        })}
        <circle cx={CX} cy={CY} r={R - SW / 2} fill="#070e17" stroke="none"/>
      </svg>
      <div className="space-y-1 font-mono text-[9px] text-slate-400">
        {segs.map(s => {
          const cnt = counts[s.k as keyof typeof counts];
          return (
            <div key={s.k} className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 shrink-0" style={{ backgroundColor: s.color }}/>
              <span style={{ color: cnt > 0 ? s.color : "#475569" }}>
                {Math.round((cnt / total) * 100)}%
              </span>
              <span>{s.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Nomogram slider ──────────────────────────────────────────────────────────
function NomSlider({ label, icon: Icon, value, min, max, step, unit, color, onChange }: {
  label: string; icon: any; value: number; min: number; max: number;
  step: number; unit: string; color: string; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase text-slate-400">
          <Icon size={10} style={{ color }}/>{label}
        </div>
        <span className="font-orbitron text-[11px] font-bold" style={{ color }}>
          {value.toFixed(step < 1 ? 1 : 0)}{unit}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1 bg-white/10 rounded appearance-none cursor-pointer"
        style={{ accentColor: color }}/>
    </div>
  );
}

// ─── Panel wrapper ────────────────────────────────────────────────────────────
function APanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="relative overflow-hidden border border-white/10 bg-[#07101a]/78 p-4
      shadow-[inset_0_0_30px_rgba(255,255,255,0.018)] backdrop-blur-md">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-crimson/60 to-transparent"/>
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2 w-2 shrink-0 rounded-full bg-crimson-glow shadow-[0_0_8px_rgba(255,40,72,0.9)]"/>
        <h2 className="font-orbitron text-[10px] font-semibold uppercase tracking-[0.13em] text-slate-100 truncate">{title}</h2>
      </div>
      {children}
    </section>
  );
}
