"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, AlertTriangle, TrendingUp, ShieldAlert, Radio, Zap,
  Smartphone, MapPin, Loader2, RefreshCw, Cpu, Wifi, Thermometer,
  Volume2, Navigation, Clock, CheckCircle, Fingerprint, Layers
} from "lucide-react";
import { getAnomalyFromEvidence, explainConclusion } from "@/lib/api";
import type { AnomalyReport, AnomalyFinding } from "@/lib/api";
import GlassCard from "@/components/ui/GlassCard";

// ── Chart helpers — 100% deterministic, no Math.random() ─────────────────────

function CallSeriesChart({ series }: { series: any[] }) {
  if (!series?.length) return null;
  const maxMin = Math.max(...series.map((s: any) => s.minute), 90);
  const W = 640, H = 100;
  const x = (m: number) => (m / maxMin) * W;
  const y = (a: number) => H - (a / 100) * H;

  const colorFor = (label: string) => {
    if (label.startsWith("VOICE")) return "#ef4444";
    if (label.startsWith("SMS")) return "#f59e0b";
    if (label.startsWith("MISSED")) return "#6b7280";
    if (label.startsWith("POWER")) return "#7c3aed";
    return "#14b8a6";
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
      <defs>
        <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* Grid lines */}
      {[25, 50, 75].map(pct => (
        <line key={pct} x1={0} y1={y(pct)} x2={W} y2={y(pct)}
          stroke="rgba(255,255,255,0.04)" strokeDasharray="4 4" />
      ))}
      {/* Area fill under the line */}
      {series.length > 1 && (
        <path
          d={`M ${x(series[0].minute)} ${y(series[0].activity)} ${series.slice(1).map((s: any) => `L ${x(s.minute)} ${y(s.activity)}`).join(" ")} L ${x(series[series.length - 1].minute)} ${H} L ${x(series[0].minute)} ${H} Z`}
          fill="url(#actGrad)"
        />
      )}
      {/* Line */}
      {series.length > 1 && (
        <path
          d={`M ${series.map((s: any) => `${x(s.minute)},${y(s.activity)}`).join(" L ")}`}
          fill="none" stroke="#f87171" strokeWidth="1.5"
        />
      )}
      {/* Data points */}
      {series.map((s: any, i: number) => (
        <g key={i} transform={`translate(${x(s.minute)},${y(s.activity)})`}>
          <circle r="3" fill={colorFor(s.label)} />
          <text x="0" y="-8" textAnchor="middle" fontSize="7" fill={colorFor(s.label)}
            className="font-mono">{s.label.split(" ")[0]}</text>
          <text x="0" y="16" textAnchor="middle" fontSize="6" fill="#64748b"
            className="font-mono">{s.tower?.replace("TOWER_BLR_", "T-") ?? ""}</text>
        </g>
      ))}
    </svg>
  );
}

function DriftChart({ points }: { points: any[] }) {
  if (!points?.length) return null;
  const maxMin = Math.max(...points.map((p: any) => p.minute), 90);
  const W = 640, H = 80;
  const x = (m: number) => (m / maxMin) * W;
  const y = (d: number) => H - (d / 100) * H;

  const pathD = points.map((p: any, i: number) =>
    `${i === 0 ? "M" : "L"} ${x(p.minute)},${y(p.drift)}`
  ).join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
      <defs>
        <linearGradient id="driftLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#14b8a6" />
          <stop offset="55%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>
        <linearGradient id="driftFill" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0.25" />
        </linearGradient>
      </defs>
      {/* Stable zone */}
      <rect x={0} y={y(30)} width={x(50)} height={y(0) - y(30)}
        fill="rgba(20,184,166,0.04)" />
      {/* Instability zone */}
      <rect x={x(60)} y={0} width={W - x(60)} height={H}
        fill="rgba(239,68,68,0.06)" />
      <path
        d={`${pathD} L ${x(points[points.length - 1].minute)},${H} L ${x(points[0].minute)},${H} Z`}
        fill="url(#driftFill)"
      />
      <path d={pathD} fill="none" stroke="url(#driftLine)" strokeWidth="2" />
      {points.map((p: any, i: number) => (
        <circle key={i} cx={x(p.minute)} cy={y(p.drift)} r="2.5"
          fill={p.drift > 80 ? "#ef4444" : p.drift > 40 ? "#f59e0b" : "#14b8a6"} />
      ))}
    </svg>
  );
}

function BaselineChart({ deviation }: { deviation: number }) {
  const pts = Array.from({ length: 30 }, (_, i) => ({
    baseline: 40 + Math.sin(i * 0.4) * 18,
    current: 40 + Math.sin(i * 0.4) * 18 + (i > 18 ? (i - 18) * (deviation / 15) : 0),
  }));
  const W = 260, H = 80;
  const x = (i: number) => (i / 29) * W;
  const y = (v: number) => H - Math.min(H - 2, Math.max(2, (v / 100) * H));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full overflow-visible" preserveAspectRatio="none">
      <path d={`M ${pts.map((p, i) => `${x(i)},${y(p.baseline)}`).join(" L ")}`}
        fill="none" stroke="#14b8a6" strokeWidth="1" strokeOpacity="0.6" />
      <path d={`M ${pts.map((p, i) => `${x(i)},${y(p.current)}`).join(" L ")}`}
        fill="none" stroke="#f8fafc" strokeWidth="1.5" />
      <rect x={x(18)} y={0} width={W - x(18)} height={H} fill="rgba(239,68,68,0.08)" />
      <text x={W - 2} y={H - 3} textAnchor="end" fontSize="7" fill="#ef4444"
        className="font-mono uppercase tracking-widest">Anomaly Zone</text>
    </svg>
  );
}

const REASON_ICONS = [TrendingUp, Radio, Smartphone, Navigation, Activity, Zap, MapPin, Wifi];
const SEV_COLOR: Record<string, string> = {
  CRITICAL: "text-red-500 border-red-500/30 bg-red-500/10",
  HIGH: "text-orange-400 border-orange-400/30 bg-orange-400/10",
  ELEVATED: "text-amber-400 border-amber-400/30 bg-amber-400/10",
  MEDIUM: "text-amber-500 border-amber-500/30 bg-amber-500/10",
};
const SEV_DOT: Record<string, string> = {
  CRITICAL: "bg-red-500", HIGH: "bg-orange-400", ELEVATED: "bg-amber-400", MEDIUM: "bg-amber-500",
};

export default function AnomalyDetectionView() {
  const [report, setReport] = useState<AnomalyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [ragText, setRagText] = useState("");
  const [ragLoading, setRagLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [time, setTime] = useState("");

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("en-US", { hour12: false }));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setRagText("");
    try {
      const r = await getAnomalyFromEvidence();
      setReport(r.data ?? null);
      if (r.data) {
        setRagLoading(true);
        const level = r.data.overall_threat_level;
        const score = Math.round(r.data.overall_threat_score);
        const anomTypes = r.data.anomalies.map((a: AnomalyFinding) => a.anomaly_type).join(", ");
        const bp = r.data.behavioral_profile as any;
        const conclusion = `Case AIV-2041-77: ${level} threat score ${score}/100. Detected anomalies: ${anomTypes}. Communication silence window: ${bp?.time_window ?? "unknown"}. Last known location: ${bp?.last_known_location ?? "unknown"}. Behavioral deviation: ${Math.round(bp?.deviation_score ?? 0)}% from baseline.`;
        explainConclusion(conclusion)
          .then(res => setRagText(res.data?.explanation ?? ""))
          .catch(() => setRagText(""))
          .finally(() => setRagLoading(false));
      }
    } catch {
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const threatScore = report ? Math.round(report.overall_threat_score) : 0;
  const anomalies: AnomalyFinding[] = report?.anomalies ?? [];
  const bp = report?.behavioral_profile as any;
  const escalation = report ? Math.round((report as any).escalation_probability ?? 87) : 0;
  const allFactors = anomalies.flatMap(a => a.contributing_factors ?? []);

  const threatColor = threatScore >= 80 ? "text-red-500" : threatScore >= 50 ? "text-amber-400" : "text-teal-400";
  const glowColor = threatScore >= 80 ? "crimson" : threatScore >= 50 ? "amber" : "teal";

  return (
    <div className="flex flex-col h-full bg-[#020408] text-slate-200 font-sans overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-white/5 bg-black/40 backdrop-blur-md flex-shrink-0 z-20">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-crimson/10 border border-crimson/20">
              <ShieldAlert className="text-crimson-glow" size={20} />
            </div>
            <div>
              <h1 className="font-orbitron text-lg font-bold tracking-[0.2em] uppercase text-white leading-none">
                Behavioral <span className="text-crimson-glow">Anomalies</span>
              </h1>
              <p className="font-mono text-[9px] text-slate-500 uppercase tracking-widest mt-1.5">
                // Predictive Threat Intelligence Engine
              </p>
            </div>
          </div>
          <div className="h-8 w-px bg-white/10 hidden md:block" />
          {report && (
            <div className="hidden md:flex gap-6 items-center">
              <div className="flex flex-col">
                <span className="text-[8px] font-mono text-slate-500 uppercase tracking-tighter">Current Case</span>
                <span className="text-xs font-mono text-teal-400">{report.case_id}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[8px] font-mono text-slate-500 uppercase tracking-tighter">Threat Level</span>
                <span className={`text-xs font-mono font-bold ${threatColor}`}>{report.overall_threat_level}</span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-6">
          <button 
            onClick={fetchData} 
            disabled={loading}
            className="flex items-center gap-2 text-[10px] font-mono text-slate-400 hover:text-white border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-1.5 rounded-full transition-all disabled:opacity-40 active:scale-95"
          >
            <RefreshCw size={12} className={loading ? "animate-spin" : ""} /> 
            {loading ? "SCANNING..." : "RE-SCAN EVIDENCE"}
          </button>
          <div className="h-8 w-px bg-white/10" />
          <div className="text-right font-mono">
            <div className="text-sm font-bold text-white tracking-tighter">{time}</div>
            <div className="text-[9px] text-slate-500 uppercase">
              {new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" })}
            </div>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 relative">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#020408]/80 backdrop-blur-xl gap-6"
            >
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-crimson/20 blur-2xl animate-pulse" />
                <Loader2 size={48} className="animate-spin text-crimson-glow relative" />
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="font-orbitron text-sm text-white uppercase tracking-[0.3em] animate-pulse">Analyzing Neural Patterns</div>
                <div className="font-mono text-[10px] text-slate-500 uppercase tracking-widest">Processing forensic data fragments...</div>
              </div>
            </motion.div>
          ) : !report ? (
            <motion.div 
              key="empty"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center h-full gap-6 text-center max-w-lg mx-auto"
            >
              <div className="p-6 rounded-full bg-slate-900/50 border border-white/5">
                <AlertTriangle size={64} className="text-slate-700" />
              </div>
              <div>
                <h2 className="font-orbitron text-xl text-slate-300 uppercase tracking-widest mb-3">No Evidence Vector Found</h2>
                <p className="text-xs text-slate-500 leading-relaxed font-mono">
                  The anomaly detection engine requires active forensic data. Please upload evidence files (CSV, JSON, TXT) via the Intake Terminal to initialize behavioral analysis.
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="content"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="grid grid-cols-1 xl:grid-cols-[1fr_300px_320px] gap-6"
            >
              {/* ══ LEFT COLUMN: Primary Intelligence ══════════════════════════ */}
              <div className="flex flex-col gap-6">
                {/* Live Activity Stream */}
                <GlassCard glowColor="crimson" className="p-5 flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-orbitron text-[11px] text-white uppercase tracking-widest flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                        Behavioral Intelligence Stream
                      </h3>
                      <p className="text-[9px] font-mono text-slate-500 mt-1 uppercase">
                        {anomalies.length} anomalous vectors detected · Source: {bp?.time_window ?? "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-[8px] font-mono">
                      {["VOICE", "SMS", "MISSED", "POWER"].map((label, i) => (
                        <span key={label} className="flex items-center gap-1.5 opacity-80">
                          <span className={`w-2 h-2 rounded-full ${["bg-red-500", "bg-amber-500", "bg-slate-500", "bg-violet-600"][i]}`} />
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="h-40 w-full bg-black/20 rounded-lg border border-white/5 p-2 overflow-hidden">
                    <CallSeriesChart series={bp?.call_series ?? []} />
                  </div>
                  {bp?.towers_active && (
                    <div className="flex items-center gap-3 pt-3 border-t border-white/5">
                      <Wifi size={12} className="text-teal-400" />
                      <div className="flex gap-1.5 flex-wrap">
                        {bp.towers_active.map((t: string) => (
                          <span key={t} className="text-[8px] font-mono px-2 py-0.5 rounded-full border border-teal-400/30 bg-teal-400/10 text-teal-300 uppercase">
                            {t}
                          </span>
                        ))}
                      </div>
                      <div className="ml-auto text-[9px] font-mono text-slate-500 flex items-center gap-1.5">
                        <MapPin size={10} className="text-red-400" /> 
                        {bp.last_known_location}
                      </div>
                    </div>
                  )}
                </GlassCard>

                {/* Behavioral Drift Wave */}
                <GlassCard glowColor="amber" className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-orbitron text-[11px] text-white uppercase tracking-widest flex items-center gap-2">
                      <Activity size={14} className="text-amber-400" />
                      Pattern Deviation Wave
                    </h3>
                    <div className="flex items-center gap-6 text-[8px] font-mono text-slate-500 uppercase tracking-widest">
                      <span className="text-teal-400">Stable Baseline</span>
                      <span className="text-red-500">Anomaly Deviation</span>
                    </div>
                  </div>
                  <div className="h-28 w-full bg-black/20 rounded-lg border border-white/5 p-2">
                    <DriftChart points={bp?.drift_points ?? []} />
                  </div>
                </GlassCard>

                {/* Anomaly Feed */}
                <GlassCard glowColor="crimson" className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Layers size={14} className="text-crimson-glow" />
                    <h3 className="font-orbitron text-[11px] text-white uppercase tracking-widest">Anomaly Logic Fragments</h3>
                    <span className="ml-auto font-mono text-[9px] text-slate-500">{anomalies.length} TOTAL VECTORS</span>
                  </div>
                  <div className="space-y-3">
                    {anomalies.map((a) => (
                      <div key={a.anomaly_id} className="group">
                        <button
                          className={`w-full flex flex-col gap-2 p-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] transition-all text-left ${expanded === a.anomaly_id ? "ring-1 ring-white/20 bg-white/[0.05]" : ""}`}
                          onClick={() => setExpanded(expanded === a.anomaly_id ? null : a.anomaly_id)}
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full ${SEV_DOT[a.severity] ?? "bg-slate-600"} shadow-[0_0_8px_rgba(255,255,255,0.2)]`} />
                              <span className="text-[11px] font-bold text-slate-100 uppercase tracking-wide">{a.anomaly_type.replace(/_/g, " ")}</span>
                            </div>
                            <span className={`text-[8px] font-orbitron px-2 py-0.5 rounded-full border ${SEV_COLOR[a.severity] ?? "text-slate-500 border-slate-500/20"}`}>{a.severity}</span>
                          </div>
                          <p className="text-[10px] text-slate-400 leading-relaxed line-clamp-2">{a.description}</p>
                          <div className="flex items-center justify-between mt-1">
                            <div className="flex gap-3 text-[8px] font-mono text-slate-600">
                              <span className="flex items-center gap-1"><Clock size={8} /> {a.detected_at}</span>
                              <span className="text-teal-400/70">{a.evidence_source}</span>
                            </div>
                            <div className="text-[9px] font-mono text-red-400/80 font-bold">{Math.round(a.confidence)}% CONFIDENCE</div>
                          </div>
                        </button>
                        <AnimatePresence>
                          {expanded === a.anomaly_id && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="mt-2 ml-4 pl-4 border-l-2 border-white/5 py-3 space-y-4">
                                {(a.contributing_factors ?? []).map((f: any, fi: number) => (
                                  <div key={fi} className="space-y-1.5">
                                    <div className="flex justify-between items-center text-[10px]">
                                      <span className="text-slate-300 font-bold uppercase tracking-tight">{f.factor}</span>
                                      <span className="text-red-400 font-mono">Impact: +{f.weight}%</span>
                                    </div>
                                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                                      <motion.div className="h-full bg-red-500/80" initial={{ width: 0 }} animate={{ width: `${f.weight}%` }} transition={{ duration: 1 }} />
                                    </div>
                                    <p className="text-[9px] text-slate-500 leading-relaxed italic">{f.explanation}</p>
                                  </div>
                                ))}
                                {a.recommended_action && (
                                  <div className="bg-teal-400/5 border border-teal-400/20 p-3 rounded-lg flex gap-3 items-start mt-4">
                                    <CheckCircle size={14} className="text-teal-400 shrink-0 mt-0.5" />
                                    <p className="text-[10px] text-teal-300 leading-relaxed">{a.recommended_action}</p>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              </div>

              {/* ══ MIDDLE COLUMN: Predictive Analytics ═══════════════════════ */}
              <div className="flex flex-col gap-6">
                {/* Threat Meter */}
                <GlassCard glowColor={glowColor} className="p-6 flex flex-col items-center">
                  <h3 className="font-orbitron text-[10px] text-slate-400 uppercase tracking-widest mb-6">Threat Intensity Index</h3>
                  <div className="relative w-16 h-52 mb-6 group">
                    <div className="absolute inset-0 rounded-3xl border border-white/10 bg-black/40 overflow-hidden flex flex-col-reverse p-1">
                      <motion.div
                        className="w-full rounded-2xl bg-gradient-to-t from-teal-500 via-amber-400 to-red-600 shadow-[0_0_20px_rgba(255,25,54,0.3)]"
                        initial={{ height: 0 }}
                        animate={{ height: `${threatScore}%` }}
                        transition={{ duration: 2, ease: "circOut" }}
                      />
                    </div>
                    <div className="absolute left-full ml-4 top-0 bottom-0 flex flex-col justify-between py-2 font-mono text-[8px] text-slate-600 uppercase tracking-tighter">
                      <span className="text-red-500 font-bold">CRITICAL</span>
                      <span className="text-orange-400">SEVERE</span>
                      <span className="text-amber-400">MODERATE</span>
                      <span className="text-teal-400">MINIMAL</span>
                    </div>
                  </div>
                  <motion.div
                    className={`text-5xl font-mono font-bold ${threatColor} tabular-nums`}
                    initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  >
                    {threatScore}
                  </motion.div>
                  <div className="mt-2 font-orbitron text-[9px] text-slate-500 uppercase tracking-[0.2em]">Aggregate Score</div>
                </GlassCard>

                {/* Escalation Probability */}
                <GlassCard glowColor="amber" className="p-6">
                  <h3 className="font-orbitron text-[10px] text-slate-400 uppercase tracking-widest mb-4">Predictive Escalation</h3>
                  <div className="flex items-baseline gap-2 mb-4">
                    <span className={`text-4xl font-mono font-bold ${threatColor}`}>{escalation}%</span>
                    <span className="text-[10px] font-mono text-slate-600 uppercase">Probability</span>
                  </div>
                  <div className="space-y-4">
                    {[
                      { label: "T + 5 MIN", val: Math.min(100, Math.round(escalation * 0.85)) },
                      { label: "T + 15 MIN", val: Math.min(100, Math.round(escalation * 0.95)) },
                      { label: "T + 30 MIN", val: escalation },
                    ].map(p => (
                      <div key={p.label} className="space-y-1.5">
                        <div className="flex justify-between text-[9px] font-mono text-slate-500">
                          <span>{p.label}</span>
                          <span className="text-red-400 font-bold">{p.val}%</span>
                        </div>
                        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                          <motion.div className="h-full bg-red-500/60" initial={{ width: 0 }} animate={{ width: `${p.val}%` }} transition={{ duration: 1.2 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </GlassCard>

                {/* Sensor Readings */}
                {bp?.sensor_series?.length > 0 && (
                  <GlassCard glowColor="teal" className="p-5">
                    <h3 className="font-orbitron text-[10px] text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Thermometer size={14} className="text-teal-400" />
                      Environmental Log
                    </h3>
                    <div className="space-y-2.5 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                      {bp.sensor_series.slice(0, 8).map((s: any, i: number) => (
                        <div key={i} className={`flex items-center justify-between p-2 rounded-lg border border-white/5 ${s.motion ? "bg-red-500/10 border-red-500/20" : "bg-white/[0.02]"}`}>
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[8px] font-mono text-slate-600 uppercase">T + {s.minute}m</span>
                            <span className="text-[10px] font-mono text-slate-300">{s.temp}°C · {s.sound_db}dB</span>
                          </div>
                          <span className={`text-[8px] font-mono px-2 py-0.5 rounded-full ${s.motion ? "text-red-400 bg-red-500/20" : "text-slate-600"}`}>
                            {s.motion ? "MOTION DETECTED" : "STABLE"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                )}
              </div>

              {/* ══ RIGHT COLUMN: AI Reasoning ═══════════════════════════════ */}
              <div className="flex flex-col gap-6">
                {/* AI Reasoning */}
                <GlassCard glowColor="teal" className="p-6 flex-1 flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-teal-400/10 border border-teal-400/20">
                      <Cpu size={18} className="text-teal-400" />
                    </div>
                    <div>
                      <h3 className="font-orbitron text-[11px] text-white uppercase tracking-widest">Cognitive Analysis</h3>
                      <div className="flex items-center gap-2 mt-1">
                        {ragLoading ? (
                          <span className="flex items-center gap-1.5 text-[8px] font-mono text-amber-400 animate-pulse">
                            <Loader2 size={8} className="animate-spin" /> SYNTHESIZING NEURAL EVIDENCE
                          </span>
                        ) : (
                          <span className="text-[8px] font-mono text-teal-400 uppercase tracking-tighter tracking-widest flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-teal-400" /> RAG + OLLAMA ACTIVE
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 bg-black/40 rounded-xl border border-white/5 p-4 overflow-y-auto custom-scrollbar">
                    {ragLoading ? (
                      <div className="space-y-4">
                        {[90, 70, 85, 60, 40].map((w, i) => (
                          <div key={i} className="h-2 rounded bg-white/5 animate-pulse" style={{ width: `${w}%` }} />
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {(ragText || bp?.baseline_comparison || "").split("\n").filter(Boolean).map((line, i) => (
                          <div key={i} className="flex gap-3 text-[11px] text-slate-400 leading-relaxed font-sans">
                            <span className="text-teal-400 mt-1.5 shrink-0">
                              <Zap size={10} />
                            </span>
                            <p>{line.trim().startsWith("›") ? line.trim().substring(1) : line.trim()}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-auto">
                    <StatBox label="Pattern Shift" value={bp?.pattern_shift ?? "—"} color={bp?.pattern_shift === "CRITICAL" ? "text-red-500" : "text-amber-400"} />
                    <StatBox label="Deviation" value={bp ? `+${Math.round(bp.deviation_score)}%` : "—"} color="text-red-400" />
                  </div>
                </GlassCard>

                {/* Evidence Sources */}
                <GlassCard className="p-5">
                  <h3 className="font-orbitron text-[10px] text-slate-400 uppercase tracking-widest mb-4">Evidence Matrix</h3>
                  <div className="space-y-2">
                    {Array.from(new Set(anomalies.map(a => a.evidence_source))).map((src) => {
                      const count = anomalies.filter(a => a.evidence_source === src).length;
                      return (
                        <div key={src} className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.03] border border-white/5">
                          <div className="flex items-center gap-3">
                            <Fingerprint size={14} className="text-slate-500" />
                            <div className="flex flex-col">
                              <span className="text-[10px] font-mono text-slate-200 truncate max-w-[140px]">{src}</span>
                              <span className="text-[8px] font-mono text-slate-600 uppercase">{count} anomaly hits</span>
                            </div>
                          </div>
                          <div className="w-1.5 h-1.5 rounded-full bg-teal-400 shadow-[0_0_8px_rgba(20,184,166,0.6)]" />
                        </div>
                      );
                    })}
                  </div>
                </GlassCard>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-black/40 border border-white/10 p-3 rounded-xl text-center group hover:border-white/20 transition-all">
      <div className="text-[8px] font-orbitron text-slate-500 uppercase tracking-widest mb-1.5 group-hover:text-slate-400">{label}</div>
      <div className={`text-sm font-mono font-bold ${color} tabular-nums tracking-tighter`}>{value}</div>
    </div>
  );
}
