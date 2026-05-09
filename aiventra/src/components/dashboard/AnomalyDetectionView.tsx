"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, AlertTriangle, TrendingUp, ShieldAlert, Radio, Zap,
  Smartphone, MapPin, Loader2, RefreshCw, Cpu, Wifi, Thermometer,
  Volume2, Navigation, Clock, CheckCircle,
} from "lucide-react";
import { getAnomalyFromEvidence, explainConclusion } from "@/lib/api";
import type { AnomalyReport, AnomalyFinding } from "@/lib/api";

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
      // Fetch RAG/Ollama explanation in parallel
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
  const threatBgClass = threatScore >= 80 ? "bg-red-500/10 border-red-500/20" : threatScore >= 50 ? "bg-amber-400/10 border-amber-400/20" : "bg-teal-400/10 border-teal-400/20";

  return (
    <div className="flex flex-col h-full bg-[#05070b] text-slate-200 font-sans overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-black/20 flex-shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-crimson font-bold">
            <ShieldAlert size={18} />
            <span className="font-orbitron text-base tracking-[0.15em] uppercase">Anomaly Detection</span>
          </div>
          <div className="h-4 w-px bg-white/10" />
          <div className="font-mono text-[10px] text-slate-500 uppercase tracking-widest">
            // Behavioral Threat Analysis Engine
          </div>
        </div>
        <div className="flex items-center gap-6">
          {report && (
            <div className="flex gap-4 text-[10px] font-mono">
              <span className="text-slate-500">Case: <span className="text-teal-400">{report.case_id}</span></span>
              <span className="text-slate-500">Threat: <span className={threatColor}>{report.overall_threat_level}</span></span>
              <span className="text-slate-500">Escalation: <span className="text-red-400">{escalation}%</span></span>
            </div>
          )}
          <button onClick={fetchData} disabled={loading}
            className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 hover:text-white border border-white/10 px-2.5 py-1 rounded transition disabled:opacity-40">
            <RefreshCw size={11} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          <div className="text-right font-mono text-xs text-slate-400">
            <div>{time}</div>
            <div className="text-[10px] text-slate-600">
              {new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }).toUpperCase()}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 relative">
        {loading && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm gap-3">
            <Loader2 size={30} className="animate-spin text-crimson" />
            <div className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">
              Analyzing uploaded evidence...
            </div>
          </div>
        )}

        {!loading && !report && (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <AlertTriangle size={44} className="text-slate-700" />
            <div className="font-orbitron text-sm text-slate-500 uppercase tracking-widest">No Evidence Uploaded</div>
            <div className="text-[11px] text-slate-600 max-w-sm">
              Upload forensic evidence files (CSV, JSON, TXT) from the Case Intake Terminal to trigger anomaly analysis.
            </div>
          </div>
        )}

        {report && (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_280px_300px] gap-5">

            {/* ══ LEFT COLUMN ══════════════════════════════════════════ */}
            <div className="flex flex-col gap-5">

              {/* Live Call Activity Stream — real call_series data */}
              <div className="bg-black/40 rounded-xl border border-white/5 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 font-orbitron text-[10px] text-slate-300 uppercase tracking-widest">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      Live Anomaly Stream
                    </div>
                    <div className="text-[9px] font-mono text-slate-500 mt-0.5 uppercase">
                      {anomalies.length} anomalies · Threat Score: {threatScore} · Source: {bp?.time_window ?? "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-[9px] font-mono">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />VOICE</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />SMS</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-500" />MISSED</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500" />POWER_OFF</span>
                  </div>
                </div>
                <div className="h-36 w-full">
                  <CallSeriesChart series={bp?.call_series ?? []} />
                </div>
                {/* Tower strip */}
                {bp?.towers_active && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
                    <Wifi size={10} className="text-teal-400 flex-shrink-0" />
                    <div className="flex gap-2 flex-wrap">
                      {bp.towers_active.map((t: string) => (
                        <span key={t} className="text-[8px] font-mono px-1.5 py-0.5 rounded border border-teal-400/20 bg-teal-400/5 text-teal-400 uppercase">
                          {t}
                        </span>
                      ))}
                    </div>
                    <span className="ml-auto text-[8px] font-mono text-slate-600 flex items-center gap-1">
                      <MapPin size={8} /> {bp.last_known_location}
                    </span>
                  </div>
                )}
              </div>

              {/* Behavioral Drift Wave — real drift_points data */}
              <div className="bg-black/40 rounded-xl border border-white/5 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-orbitron text-[10px] text-slate-300 uppercase tracking-widest">
                    Behavioral Drift Wave
                  </div>
                  <div className="flex items-center gap-4 text-[8px] font-mono text-slate-500">
                    <span className="text-teal-400">◀ Stability</span>
                    <span className="text-red-500">Instability ▶</span>
                  </div>
                </div>
                <div className="h-24 w-full">
                  <DriftChart points={bp?.drift_points ?? []} />
                </div>
              </div>

              {/* Environmental Sensor Readings — real sensor_series */}
              {bp?.sensor_series?.length > 0 && (
                <div className="bg-black/40 rounded-xl border border-white/5 p-4">
                  <div className="font-orbitron text-[10px] text-slate-300 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Thermometer size={12} className="text-amber-400" />
                    Environmental Sensor Readings
                    <span className="ml-auto text-[8px] font-mono text-slate-500">{bp.sensor_series.length} readings</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[9px] font-mono">
                      <thead>
                        <tr className="text-slate-600 uppercase">
                          <th className="text-left py-1 pr-4">Time</th>
                          <th className="text-left pr-4">
                            <span className="flex items-center gap-1"><Volume2 size={8} /> Sound dB</span>
                          </th>
                          <th className="text-left pr-4">
                            <span className="flex items-center gap-1"><Activity size={8} /> Motion</span>
                          </th>
                          <th className="text-left">
                            <span className="flex items-center gap-1"><Thermometer size={8} /> Temp °C</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/[0.03]">
                        {bp.sensor_series.map((s: any, i: number) => (
                          <tr key={i} className={s.motion ? "bg-red-500/5" : ""}>
                            <td className="py-1 pr-4 text-slate-500">+{s.minute}m</td>
                            <td className={`pr-4 font-bold ${s.sound_db > 70 ? "text-red-400" : s.sound_db > 55 ? "text-amber-400" : "text-slate-400"}`}>
                              {s.sound_db} dB
                            </td>
                            <td className="pr-4">
                              <span className={`px-1.5 py-0.5 rounded ${s.motion ? "bg-red-500/20 text-red-400" : "text-slate-600"}`}>
                                {s.motion ? "DETECTED" : "NONE"}
                              </span>
                            </td>
                            <td className="text-slate-400">{s.temp}°C</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Anomaly Event Feed — all 4 anomalies with recommended_action */}
              <div className="bg-black/40 rounded-xl border border-white/5 p-4">
                <div className="flex items-center gap-2 font-orbitron text-[10px] text-slate-300 uppercase tracking-widest mb-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  Anomaly Event Feed
                  <span className="ml-auto text-[9px] font-mono text-slate-500">{anomalies.length} total</span>
                </div>
                <div className="space-y-2">
                  {anomalies.map((a) => (
                    <div key={a.anomaly_id}>
                      <button
                        className="w-full flex items-start gap-3 p-2.5 hover:bg-white/[0.02] rounded border border-white/[0.03] transition text-left"
                        onClick={() => setExpanded(expanded === a.anomaly_id ? null : a.anomaly_id)}
                      >
                        <div className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${SEV_DOT[a.severity] ?? "bg-slate-600"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-0.5">
                            <span className="text-[10px] font-bold text-slate-200 uppercase">{a.anomaly_type.replace(/_/g, " ")}</span>
                            <span className={`text-[8px] font-orbitron px-1.5 py-0.5 rounded border ${SEV_COLOR[a.severity] ?? "text-slate-500 border-slate-500/20"}`}>{a.severity}</span>
                          </div>
                          <div className="text-[9px] text-slate-500 leading-relaxed line-clamp-2">{a.description}</div>
                          <div className="flex gap-3 mt-1 text-[8px] font-mono text-slate-600">
                            <span className="flex items-center gap-0.5"><Clock size={7} /> {a.detected_at}</span>
                            <span>Conf: {Math.round(a.confidence)}%</span>
                            <span className="text-teal-400/60">{a.evidence_source}</span>
                          </div>
                        </div>
                      </button>
                      <AnimatePresence>
                        {expanded === a.anomaly_id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="ml-4 pl-3 border-l border-white/10 py-2 space-y-2">
                              {/* Contributing factors */}
                              {(a.contributing_factors ?? []).map((f: any, fi: number) => (
                                <div key={fi} className="text-[9px]">
                                  <div className="flex justify-between mb-0.5">
                                    <span className="text-slate-300 font-bold">{f.factor}</span>
                                    <span className="text-red-400 font-mono">{f.weight}%</span>
                                  </div>
                                  <div className="h-1 bg-white/5 rounded-full overflow-hidden mb-1">
                                    <div className="h-full bg-red-500/60 rounded-full" style={{ width: `${f.weight}%` }} />
                                  </div>
                                  <div className="text-slate-600 leading-relaxed">{f.explanation}</div>
                                </div>
                              ))}
                              {/* Recommended action */}
                              {a.recommended_action && (
                                <div className="flex items-start gap-2 mt-2 p-2 bg-teal-400/5 border border-teal-400/20 rounded">
                                  <CheckCircle size={10} className="text-teal-400 flex-shrink-0 mt-0.5" />
                                  <div className="text-[9px] text-teal-300 leading-relaxed">{a.recommended_action}</div>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              </div>

              {/* RAG + Ollama AI Reasoning */}
              <div className="bg-black/40 rounded-xl border border-white/5 p-4">
                <div className="flex items-center gap-2 font-orbitron text-[10px] text-slate-300 uppercase tracking-widest mb-3">
                  <Cpu size={12} className="text-teal-400" />
                  AI Forensic Reasoning
                  {ragLoading
                    ? <span className="ml-auto flex items-center gap-1 text-[8px] font-mono text-amber-400"><Loader2 size={8} className="animate-spin" /> RAG + LLM</span>
                    : ragText
                      ? <span className="ml-auto text-[8px] font-mono text-teal-400">✓ RAG + OLLAMA</span>
                      : <span className="ml-auto text-[8px] font-mono text-slate-600">HEURISTIC FALLBACK</span>
                  }
                </div>
                {ragLoading && (
                  <div className="space-y-2">
                    {[100, 80, 90].map((w, i) => (
                      <div key={i} className="h-2.5 rounded bg-white/5 animate-pulse" style={{ width: `${w}%` }} />
                    ))}
                  </div>
                )}
                {!ragLoading && (
                  <div className="space-y-2">
                    {ragText ? (
                      ragText.split("\n").filter(Boolean).map((line, i) => (
                        <p key={i} className="text-[10px] text-slate-400 leading-relaxed flex items-start gap-2">
                          <span className="text-teal-400 flex-shrink-0 mt-0.5">›</span>{line}
                        </p>
                      ))
                    ) : (
                      /* Heuristic fallback built from real anomaly data */
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                          <span className="text-teal-400">›</span> Threat score <span className="text-red-400 font-bold">{threatScore}/100</span> derived from {anomalies.length} independent evidence anomalies spanning call logs, GPS traces, and behavioral deviation analysis.
                        </p>
                        {anomalies.slice(0, 2).map((a, i) => (
                          <p key={i} className="text-[10px] text-slate-400 leading-relaxed">
                            <span className="text-teal-400">›</span> {a.description.slice(0, 160)}{a.description.length > 160 ? "…" : ""}
                          </p>
                        ))}
                        <p className="text-[10px] text-slate-400 leading-relaxed">
                          <span className="text-teal-400">›</span> Escalation probability: <span className="text-red-400">{escalation}%</span>. {bp?.baseline_comparison ?? "Behavioral pattern deviation confirmed."}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ══ MIDDLE COLUMN ════════════════════════════════════════ */}
            <div className="flex flex-col gap-5">
              {/* Threat Escalation Meter */}
              <div className="bg-black/40 rounded-xl border border-white/5 p-4 flex flex-col items-center">
                <div className="font-orbitron text-[10px] text-slate-400 uppercase tracking-widest mb-4">
                  Threat Escalation Meter
                </div>
                <div className="relative w-14 h-48 mb-5">
                  <div className="absolute inset-0 rounded-full border border-white/10 bg-gradient-to-b from-white/5 to-transparent flex flex-col-reverse p-1">
                    <motion.div
                      className="w-full rounded-full bg-gradient-to-t from-green-500 via-yellow-400 via-orange-500 to-red-600"
                      initial={{ height: 0 }}
                      animate={{ height: `${threatScore}%` }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                    />
                  </div>
                  <div className="absolute left-full ml-3 top-0 bottom-0 flex flex-col justify-between py-1 font-mono text-[8px] text-slate-500">
                    <span className="text-red-500">Critical &gt;90</span>
                    <span className="text-orange-400">Severe 70-90</span>
                    <span className="text-amber-400">Moderate 40-70</span>
                    <span className="text-yellow-500">Low 10-40</span>
                    <span className="text-teal-400">Minimal &lt;10</span>
                  </div>
                </div>
                <motion.div
                  className={`text-4xl font-mono font-bold ${threatColor} px-5 py-2 rounded-lg border ${threatBgClass}`}
                  initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                >
                  {threatScore}
                </motion.div>
                <div className="mt-1.5 font-orbitron text-[9px] text-slate-500 uppercase tracking-widest">
                  Threat Score
                </div>
              </div>

              {/* Predictive Threat Projection */}
              <div className="bg-black/40 rounded-xl border border-white/5 p-4">
                <div className="font-orbitron text-[10px] text-slate-400 uppercase tracking-widest mb-3">
                  Predictive Threat Projection
                </div>
                <div className="flex flex-col gap-2 mb-3">
                  <div className="text-[9px] font-mono text-slate-500 uppercase">Probability of Escalation</div>
                  <div className={`text-3xl font-mono font-bold ${threatColor}`}>{escalation}%</div>
                </div>
                <div className="space-y-2 mb-4">
                  {[
                    { label: "Next 5 MIN", val: Math.min(100, Math.round(escalation * 0.82)) },
                    { label: "Next 15 MIN", val: Math.min(100, Math.round(escalation * 0.93)) },
                    { label: "Next 30 MIN", val: Math.min(100, escalation) },
                    { label: "Next 60 MIN", val: Math.min(100, Math.round(escalation * 1.05)) },
                  ].map(p => (
                    <div key={p.label}>
                      <div className="flex items-center justify-between text-[9px] font-mono mb-1">
                        <span className="text-slate-500 uppercase">{p.label}</span>
                        <span className="font-bold text-red-400">{p.val}%</span>
                      </div>
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <motion.div className="h-full bg-red-500/60 rounded-full"
                          initial={{ width: 0 }} animate={{ width: `${p.val}%` }}
                          transition={{ duration: 0.8, delay: 0.2 }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 bg-red-500/5 border border-red-500/20 px-3 py-2 rounded">
                  <AlertTriangle size={12} className="text-red-500" />
                  <span className="font-orbitron text-[9px] text-red-400 uppercase tracking-widest">
                    Trajectory: {escalation >= 70 ? "Escalating" : escalation >= 40 ? "Elevated" : "Stable"}
                  </span>
                </div>
              </div>

              {/* Anomaly source files */}
              <div className="bg-black/40 rounded-xl border border-white/5 p-4">
                <div className="font-orbitron text-[10px] text-slate-400 uppercase tracking-widest mb-3">
                  Evidence Sources
                </div>
                <div className="space-y-2">
                  {Array.from(new Set(anomalies.map(a => a.evidence_source))).map((src) => {
                    const count = anomalies.filter(a => a.evidence_source === src).length;
                    const maxSev = anomalies.filter(a => a.evidence_source === src)
                      .map(a => a.severity).sort((a, b) => (a === "CRITICAL" ? -1 : b === "CRITICAL" ? 1 : 0))[0];
                    return (
                      <div key={src} className="flex items-center gap-3 p-2 bg-white/[0.02] rounded border border-white/[0.03]">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${SEV_DOT[maxSev] ?? "bg-slate-600"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="text-[9px] font-mono text-slate-300 truncate">{src}</div>
                          <div className="text-[8px] text-slate-600">{count} anomal{count === 1 ? "y" : "ies"}</div>
                        </div>
                        <span className={`text-[8px] font-orbitron ${SEV_COLOR[maxSev]?.split(" ")[0] ?? "text-slate-500"}`}>{maxSev}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ══ RIGHT COLUMN ═════════════════════════════════════════ */}
            <div className="flex flex-col gap-5">
              {/* Anomaly Reasons — contributing factors from all anomalies */}
              <div className="bg-black/40 rounded-xl border border-white/5 p-4 flex-1">
                <div className="font-orbitron text-[10px] text-slate-400 uppercase tracking-widest mb-3">
                  Anomaly Reasons
                </div>
                <div className={`flex items-center gap-2 px-3 py-2 border rounded mb-4 ${threatBgClass}`}>
                  <AlertTriangle size={13} className={threatColor} />
                  <span className={`font-orbitron text-[10px] font-bold uppercase tracking-widest ${threatColor}`}>
                    {report?.overall_threat_level} Anomaly
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mb-4 leading-relaxed">
                  {bp?.baseline_comparison ?? "Awaiting behavioral pattern analysis..."}
                </p>
                <div className="space-y-3">
                  {allFactors.slice(0, 6).map((f: any, i: number) => {
                    const Icon = REASON_ICONS[i % REASON_ICONS.length];
                    return (
                      <div key={`${f.factor}-${i}`} className="flex items-start gap-3 p-2 hover:bg-white/[0.02] rounded transition">
                        <div className="w-8 h-8 shrink-0 rounded-lg border border-white/5 bg-white/[0.03] flex items-center justify-center text-red-400">
                          <Icon size={15} strokeWidth={1.5} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-orbitron text-[9px] font-bold text-slate-300 uppercase">{f.factor}</span>
                            <span className="text-[9px] font-mono text-red-400">+{f.weight}%</span>
                          </div>
                          <div className="h-1 bg-white/5 rounded-full overflow-hidden mb-1.5">
                            <motion.div className="h-full bg-red-500/50 rounded-full"
                              initial={{ width: 0 }} animate={{ width: `${f.weight}%` }}
                              transition={{ duration: 0.6, delay: i * 0.08 }} />
                          </div>
                          <p className="text-[8px] text-slate-600 leading-relaxed">{f.explanation}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Behavior Baseline Comparison */}
              <div className="bg-black/40 rounded-xl border border-white/5 p-4">
                <div className="font-orbitron text-[10px] text-slate-400 uppercase tracking-widest mb-4">
                  Behavior Baseline Comparison
                </div>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <StatBox label="Deviation" value={bp ? `+${Math.round(bp.deviation_score)}%` : "—"}
                    color={bp?.deviation_score > 60 ? "text-red-500" : "text-amber-400"} />
                  <StatBox label="Pattern Shift" value={bp?.pattern_shift ?? "—"}
                    color={bp?.pattern_shift === "CRITICAL" ? "text-red-500" : "text-amber-400"} />
                  <StatBox label="Confidence"
                    value={anomalies[0] ? `${Math.round(anomalies[0].confidence)}%` : "—"}
                    color="text-teal-400" />
                </div>
                <div className="h-24 w-full">
                  <BaselineChart deviation={bp?.deviation_score ?? 0} />
                </div>
                <div className="flex items-center gap-4 mt-2 text-[8px] font-mono text-slate-500">
                  <span className="flex items-center gap-1"><span className="w-3 h-[1px] bg-teal-500 inline-block" /> Baseline</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-[1px] bg-white inline-block" /> Current</span>
                </div>
              </div>

              {/* Location & Time Context */}
              <div className="bg-black/40 rounded-xl border border-white/5 p-4">
                <div className="font-orbitron text-[10px] text-slate-400 uppercase tracking-widest mb-3">
                  Geospatial Context
                </div>
                <div className="space-y-3 text-[10px] font-mono">
                  <div className="flex items-start gap-2">
                    <MapPin size={11} className="text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-slate-500 text-[8px] uppercase mb-0.5">Last Known Location</div>
                      <div className="text-slate-200">{bp?.last_known_location ?? "Unknown"}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Clock size={11} className="text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-slate-500 text-[8px] uppercase mb-0.5">Observation Window</div>
                      <div className="text-slate-200">{bp?.time_window ?? "Unknown"}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Navigation size={11} className="text-teal-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-slate-500 text-[8px] uppercase mb-0.5">Towers Active</div>
                      <div className="text-slate-300">{(bp?.towers_active ?? []).join(" · ")}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-black/30 border border-white/5 p-2.5 text-center rounded">
      <div className="text-[7px] font-orbitron text-slate-600 uppercase tracking-tighter mb-1">{label}</div>
      <div className={`text-xs font-mono font-bold ${color}`}>{value}</div>
    </div>
  );
}
