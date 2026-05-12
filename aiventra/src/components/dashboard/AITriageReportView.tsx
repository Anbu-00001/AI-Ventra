/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, AlertTriangle, CheckCircle, Target, FileText,
  Brain, Activity, TrendingUp, Zap, RefreshCw, Search,
  Lock, Cpu, Fingerprint, Layers, ChevronRight
} from "lucide-react";
import { getDemoReport, getDemoAnomalies, queryRAG, explainConclusion, apiFetch } from "@/lib/api";
import type { TriageReport, AnomalyReport, ApiResponse } from "@/lib/api";
import GlassCard from "@/components/ui/GlassCard";

export default function AITriageReportView({ initialReport = null }: { initialReport?: TriageReport | null }) {
  const [report, setReport] = useState<TriageReport | null>(initialReport);
  const [anomaly, setAnomaly] = useState<AnomalyReport | null>(null);
  const [loading, setLoading] = useState(!initialReport);
  const [ragQuery, setRagQuery] = useState("");
  const [ragResult, setRagResult] = useState<any | null>(null);
  const [ragLoading, setRagLoading] = useState(false);

  useEffect(() => {
    if (initialReport) {
      setReport(initialReport);
      setLoading(false);
      const realAnomaly = {
        case_id: initialReport.case_id,
        overall_threat_level: initialReport.threat_level || "HIGH",
        overall_threat_score: initialReport.risk_score || 85,
        anomalies: (initialReport.supporting_evidence || []).map((ev: any, i: number) => ({
          anomaly_id: `real-${i}`,
          anomaly_type: ev.evidence_type?.toLowerCase().replace(/\s+/g, "_") || "unknown",
          description: ev.description || "Evidence anomaly detected",
          severity: ev.weight >= 90 ? "CRITICAL" : ev.weight >= 75 ? "HIGH" : "MODERATE",
          threat_score: ev.weight || 80,
          detected_at: new Date().toISOString(),
          confidence: ev.weight || 80,
          contributing_factors: [],
          recommended_action: "Cross-reference with correlated evidence streams",
        })),
        behavioral_profile: {
          deviation_score: Math.min(100, (initialReport.risk_score || 70) * 0.8),
          pattern_shift: initialReport.risk_score >= 85 ? "HIGH" : "MEDIUM",
          baseline_comparison: `${(initialReport.supporting_evidence || []).length} evidence vectors analyzed via RAG`,
        },
        escalation_probability: Math.min(100, (initialReport.risk_score || 70) + 5),
      };
      setAnomaly(realAnomaly as any);
    } else {
      const fetchLatestReport = async () => {
        try {
          const listRes = await apiFetch<ApiResponse<any[]>>("/reports/list");
          if (listRes.data && listRes.data.length > 0) {
            const genRes = await apiFetch<ApiResponse<TriageReport>>("/report/generate", {
              method: "POST",
              body: JSON.stringify({ case_id: "AIV-2041-77" }),
            });
            if (genRes.data) {
              setReport(genRes.data);
              setLoading(false);
              return;
            }
          }
        } catch {}
        getDemoReport()
          .then(res => setReport(res.data))
          .catch(() => setReport(STATIC_REPORT))
          .finally(() => setLoading(false));
      };
      fetchLatestReport();
      getDemoAnomalies()
        .then(res => setAnomaly(res.data))
        .catch(() => setAnomaly(STATIC_ANOMALY));
    }
  }, [initialReport]);

  const handleRAGQuery = async () => {
    if (!ragQuery.trim()) return;
    setRagLoading(true);
    setRagResult(null);
    try {
      const res = await queryRAG(ragQuery);
      setRagResult(res.data ?? null);
    } catch {
      setRagResult({
        answer: "AI intelligence query unavailable — ensure backend is running and evidence is indexed via 'Prime RAG'.",
        confidence: 0,
        evidence_basis: [],
        follow_up_queries: [],
        chunk_count: 0,
      });
    } finally {
      setRagLoading(false);
    }
  };

  const threatColor = (level: string) => {
    if (level === "CRITICAL") return "text-red-500";
    if (level === "HIGH") return "text-red-500";
    if (level === "ELEVATED") return "text-amber-400";
    return "text-teal-400";
  };

  const glowColor = (level: string) => {
    if (level === "CRITICAL" || level === "HIGH") return "crimson";
    if (level === "ELEVATED") return "amber";
    return "teal";
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-[#020408] text-slate-400 gap-6">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-crimson/20 blur-2xl animate-pulse" />
          <Loader2 size={48} className="animate-spin text-crimson-glow relative" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="font-orbitron text-sm text-white uppercase tracking-[0.3em] animate-pulse">Generating Forensic Verdict</div>
          <div className="font-mono text-[10px] text-slate-500 uppercase tracking-widest">Synthesizing multi-source evidence...</div>
        </div>
      </div>
    );
  }

  const r = report ?? STATIC_REPORT;
  const a = anomaly ?? STATIC_ANOMALY;
  const tColor = threatColor(r.threat_level);
  const gColor = glowColor(r.threat_level);

  return (
    <div className="flex flex-col h-full bg-[#020408] text-slate-200 overflow-auto custom-scrollbar">
      {/* Header */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-white/5 bg-black/40 backdrop-blur-md shrink-0 sticky top-0 z-20">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-crimson/10 border border-crimson/20">
              <Shield className="text-crimson-glow" size={20} />
            </div>
            <div>
              <h1 className="font-orbitron text-lg font-bold tracking-[0.2em] uppercase text-white leading-none">
                Forensic <span className="text-crimson-glow">Verdict</span>
              </h1>
              <p className="font-mono text-[9px] text-slate-500 uppercase tracking-widest mt-1.5">
                // Final Intelligence Synthesis Report
              </p>
            </div>
          </div>
          <div className="h-8 w-px bg-white/10 hidden md:block" />
          <div className="hidden md:flex gap-6 items-center">
            <div className="flex flex-col">
              <span className="text-[8px] font-mono text-slate-500 uppercase tracking-tighter">Case Reference</span>
              <span className="text-xs font-mono text-teal-400">{r.case_id}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] font-mono text-slate-500 uppercase tracking-tighter">Assigned Analyst</span>
              <span className="text-xs font-mono text-slate-300">{(r as any).analyst_id ?? "AIVENTRA-OMEGA-7"}</span>
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className={`font-orbitron text-3xl font-bold ${tColor} tracking-tighter`}>
            {Math.round(r.risk_score)}
            <span className="text-sm text-slate-500 ml-1">/100</span>
          </div>
          <div className={`font-orbitron text-[10px] uppercase tracking-[0.2em] mt-1 ${tColor}`}>
            {r.threat_level} PROBABILITY
          </div>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 p-6 min-h-0">
        {/* Left Column: Verdict Details */}
        <div className="flex flex-col gap-6">
          {/* Main Verdict */}
          <GlassCard glowColor={gColor} className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Brain size={18} className="text-crimson-glow" />
              <h2 className="font-orbitron text-[11px] font-bold uppercase tracking-widest text-white">AI Forensic Conclusion</h2>
            </div>
            <div className="relative p-6 rounded-xl bg-white/[0.02] border border-white/5">
              <div className="absolute top-4 left-4 text-4xl text-white/5 font-serif select-none">“</div>
              <p className="font-mono text-base text-slate-100 leading-relaxed italic relative z-10 px-4">
                {r.verdict}
              </p>
              <div className="absolute bottom-4 right-4 text-4xl text-white/5 font-serif select-none rotate-180">“</div>
              <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-4">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-mono text-slate-500 uppercase">Certainty Index</span>
                  <div className="flex gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className={`w-3 h-1 rounded-full ${i < Math.floor(r.confidence_score / 20) ? "bg-teal-400" : "bg-white/10"}`} />
                    ))}
                  </div>
                </div>
                <span className="text-[10px] font-mono text-teal-400">{r.confidence_score}% CONFIDENCE</span>
              </div>
            </div>
          </GlassCard>

          {/* Detailed Reasoning */}
          <GlassCard className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <FileText size={18} className="text-amber-400" />
              <h2 className="font-orbitron text-[11px] font-bold uppercase tracking-widest text-white">Neural Reasoning Path</h2>
            </div>
            <div className="space-y-4">
              <p className="font-mono text-[11px] text-slate-400 leading-relaxed">
                {r.reasoning}
              </p>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                <div className="flex flex-col gap-1">
                  <span className="text-[8px] font-mono text-slate-600 uppercase">Analysis Engine</span>
                  <span className="text-[10px] font-mono text-teal-400 uppercase">RAG + OLLAMA v3.1</span>
                </div>
                <div className="flex flex-col gap-1 text-right">
                  <span className="text-[8px] font-mono text-slate-600 uppercase">Generation Date</span>
                  <span className="text-[10px] font-mono text-slate-400 uppercase">{new Date(r.generated_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </GlassCard>

          {/* Key Findings List */}
          <GlassCard glowColor="teal" className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Target size={18} className="text-teal-400" />
              <h2 className="font-orbitron text-[11px] font-bold uppercase tracking-widest text-white">Critical Indicators</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {r.key_findings.map((f, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-start gap-3 p-3 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all group"
                >
                  <CheckCircle size={14} className="text-teal-500 shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                  <span className="font-mono text-[10px] text-slate-300 leading-tight uppercase tracking-tight">{f}</span>
                </motion.div>
              ))}
            </div>
          </GlassCard>

          {/* Evidence Grid */}
          <GlassCard className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Activity size={18} className="text-violet-400" />
              <h2 className="font-orbitron text-[11px] font-bold uppercase tracking-widest text-white">Evidence Weight Distribution</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {r.supporting_evidence.map((ev, i) => (
                <div key={i} className="flex flex-col gap-3 p-4 border border-white/5 bg-black/40 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="font-orbitron text-[10px] text-slate-300 uppercase tracking-wider">{ev.evidence_type}</div>
                    <span className="text-[10px] font-mono text-slate-500">#{i + 1}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-mono leading-relaxed line-clamp-2">{ev.description}</p>
                  <div className="mt-1 space-y-1.5">
                    <div className="flex justify-between text-[9px] font-mono">
                      <span className="text-slate-600 uppercase">Impact Weight</span>
                      <span className={tColor}>{ev.weight}%</span>
                    </div>
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        className={`h-full ${tColor.replace('text', 'bg')}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${ev.weight}%` }}
                        transition={{ duration: 1, delay: 0.5 + i * 0.1 }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* RAG Query Terminal */}
          <GlassCard glowColor="teal" className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Search size={18} className="text-teal-400" />
              <h2 className="font-orbitron text-[11px] font-bold uppercase tracking-widest text-white">AI Intelligence Query Terminal</h2>
            </div>
            
            <div className="flex flex-wrap gap-2 mb-6">
              {["Cause of death?", "Suspect profiles?", "GPS anomalies?", "Timeline gaps?"].map((q) => (
                <button
                  key={q}
                  onClick={() => { setRagQuery(q); }}
                  className="px-3 py-1.5 border border-white/10 bg-white/[0.03] rounded-full font-mono text-[9px] text-slate-400 hover:border-teal-data/60 hover:text-teal-data hover:bg-teal-data/5 transition-all active:scale-95"
                >
                  {q}
                </button>
              ))}
            </div>

            <div className="flex gap-3 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" size={14} />
                <input
                  type="text"
                  value={ragQuery}
                  onChange={(e) => setRagQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleRAGQuery()}
                  placeholder="Query the forensic knowledge base..."
                  className="w-full bg-black/40 border border-white/10 pl-9 pr-4 py-2.5 font-mono text-[11px] text-slate-200 placeholder-slate-700 rounded-lg outline-none focus:border-teal-data/40 transition-all shadow-inner"
                />
              </div>
              <button
                onClick={handleRAGQuery}
                disabled={ragLoading || !ragQuery.trim()}
                className="px-6 py-2.5 rounded-lg border border-teal-data/40 bg-teal-data/10 font-orbitron text-[10px] text-teal-data uppercase tracking-widest hover:bg-teal-data/20 transition-all active:scale-95 disabled:opacity-40"
              >
                {ragLoading ? <RefreshCw size={14} className="animate-spin" /> : "QUERY"}
              </button>
            </div>

            <AnimatePresence>
              {ragResult && (
                <RAGResponsePanel result={ragResult} onFollowUp={(q) => setRagQuery(q)} />
              )}
            </AnimatePresence>
          </GlassCard>
        </div>

        {/* Right Column: Gauges and Actions */}
        <div className="flex flex-col gap-6">
          {/* Threat Gauge */}
          <GlassCard glowColor={gColor} className="p-6 flex flex-col items-center">
            <h3 className="font-orbitron text-[10px] text-slate-400 uppercase tracking-widest mb-8">Composite Risk Level</h3>
            <div className="relative w-40 h-40 group">
              <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="8" />
                <motion.circle
                  cx="60" cy="60" r="54" fill="none" strokeWidth="8"
                  stroke="currentColor"
                  className={tColor}
                  strokeDasharray={339}
                  initial={{ strokeDashoffset: 339 }}
                  animate={{ strokeDashoffset: 339 - (339 * r.risk_score / 100) }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                  strokeLinecap="round"
                  style={{ filter: `drop-shadow(0 0 12px currentColor)` }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.div 
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`font-orbitron text-4xl font-bold ${tColor} tabular-nums`}
                >
                  {Math.round(r.risk_score)}
                </motion.div>
                <div className="font-mono text-[9px] text-slate-600 uppercase tracking-tighter">Aggregate Risk</div>
              </div>
            </div>
            <div className={`mt-8 font-orbitron text-xl uppercase tracking-[0.2em] font-bold ${tColor}`}>
              {r.threat_level}
            </div>
            <div className="mt-2 flex gap-4 w-full pt-6 border-t border-white/5">
              <div className="flex-1 text-center">
                <div className="text-[8px] font-mono text-slate-600 uppercase mb-1">Escalation</div>
                <div className="text-[11px] font-mono text-red-400 font-bold">{Math.round(a.escalation_probability)}%</div>
              </div>
              <div className="w-px h-8 bg-white/5" />
              <div className="flex-1 text-center">
                <div className="text-[8px] font-mono text-slate-600 uppercase mb-1">Anomalies</div>
                <div className="text-[11px] font-mono text-amber-400 font-bold">{a.anomalies.length} VECTORS</div>
              </div>
            </div>
          </GlassCard>

          {/* Actions */}
          <GlassCard glowColor="amber" className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <Zap size={18} className="text-amber-400" />
              <h2 className="font-orbitron text-[11px] font-bold uppercase tracking-widest text-white">Priority Recommendations</h2>
            </div>
            <div className="space-y-4">
              {r.recommended_actions.map((action, i) => (
                <div key={i} className="flex gap-4 p-3 rounded-lg bg-white/[0.02] border border-white/5 group hover:bg-white/[0.04] transition-all">
                  <div className="flex-shrink-0 grid h-6 w-6 place-items-center rounded-lg border border-amber/40 bg-amber/10 font-orbitron text-[10px] text-amber font-bold group-hover:scale-110 transition-transform">
                    {i + 1}
                  </div>
                  <p className="font-mono text-[10px] text-slate-300 leading-relaxed uppercase tracking-tight">
                    {action}
                  </p>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* Anomaly Timeline Summary */}
          <GlassCard glowColor="crimson" className="p-6 flex-1">
            <div className="flex items-center gap-3 mb-6">
              <TrendingUp size={18} className="text-crimson-glow" />
              <h2 className="font-orbitron text-[11px] font-bold uppercase tracking-widest text-white">Neural Anomaly Breakdown</h2>
            </div>
            <div className="space-y-3">
              {a.anomalies.slice(0, 4).map((an, i) => (
                <div key={i} className="group relative p-3 border border-white/5 bg-black/40 rounded-xl overflow-hidden hover:border-crimson/30 transition-all">
                  <div className="absolute top-0 left-0 w-1 h-full bg-crimson/50" />
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-orbitron text-[9px] text-slate-200 uppercase font-bold tracking-wider truncate">
                      {an.anomaly_type.replace(/_/g, " ")}
                    </span>
                    <span className={`font-mono text-[8px] px-1.5 py-0.5 rounded border ${an.severity === 'CRITICAL' ? 'text-red-400 border-red-400/30 bg-red-400/5' : 'text-amber-400 border-amber-400/30 bg-amber-400/5'}`}>
                      {an.severity}
                    </span>
                  </div>
                  <p className="text-[10px] font-mono text-slate-500 leading-tight line-clamp-2 mb-2">
                    {an.description}
                  </p>
                  <div className="flex items-center justify-between text-[8px] font-mono text-slate-600 mt-2 pt-2 border-t border-white/5">
                    <span>SCORE: {Math.round(an.threat_score)}</span>
                    <span className="flex items-center gap-1"><ChevronRight size={8} /> DETAILS</span>
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full mt-4 py-2 border border-white/10 font-orbitron text-[9px] text-slate-500 uppercase tracking-widest hover:text-white hover:border-white/30 transition-all">
              View Full Anomaly Log
            </button>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

function Loader2({ size, className }: { size: number; className?: string }) {
  return <RefreshCw size={size} className={className} />;
}

function RAGResponsePanel({ result, onFollowUp }: { result: any; onFollowUp: (q: string) => void }) {
  const confidence: number = result?.confidence ?? 0;
  const chunks: number = result?.chunk_count ?? 0;
  const rawAnswer: string = result?.answer ?? "";
  const evidenceBasis: string[] = result?.evidence_basis ?? [];
  const followUps: string[] = result?.follow_up_queries ?? [];

  const confidenceColor =
    confidence >= 80 ? "#18f3e2" : confidence >= 60 ? "#f5a400" : "#ff2848";

  // Split the answer on newlines and render each line smartly
  const lines = rawAnswer
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const renderLine = (line: string, i: number) => {
    const isBullet = line.startsWith("•");
    const isIndented = line.startsWith("  •") || line.startsWith("    •");
    const isLabel = /^[A-Z][A-Za-z ]+:/.test(line) && !isBullet;

    if (isLabel) {
      const colon = line.indexOf(":");
      const label = line.slice(0, colon);
      const value = line.slice(colon + 1).trim();
      return (
        <div key={i} className="flex items-start gap-2 py-1.5 border-b border-white/[0.04] last:border-0">
          <span className="font-orbitron text-[9px] uppercase tracking-widest text-teal-data shrink-0 mt-0.5 w-28">{label}</span>
          <span className="font-mono text-[11px] text-slate-200 leading-relaxed">{value}</span>
        </div>
      );
    }
    if (isIndented) {
      return (
        <div key={i} className="flex items-start gap-2 pl-5 py-0.5">
          <span className="text-teal-data text-[8px] mt-1">▸</span>
          <span className="font-mono text-[10px] text-slate-400 leading-relaxed">{line.replace(/^[\s•]+/, "")}</span>
        </div>
      );
    }
    if (isBullet) {
      return (
        <div key={i} className="flex items-start gap-2 py-0.5">
          <span className="text-teal-data text-[9px] mt-1 shrink-0">◆</span>
          <span className="font-mono text-[11px] text-slate-300 leading-relaxed">{line.replace(/^•\s*/, "")}</span>
        </div>
      );
    }
    return (
      <p key={i} className="font-mono text-[11px] text-slate-400 leading-relaxed py-0.5">{line}</p>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="border border-teal-data/20 bg-[#040e14] overflow-hidden"
    >
      {/* Response header bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-teal-data/15 bg-teal-data/5">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-teal-data animate-pulse" />
          <span className="font-orbitron text-[9px] uppercase tracking-widest text-teal-data">
            AI Forensic Response
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[9px] text-slate-500">{chunks} chunks</span>
          <div className="flex items-center gap-1">
            <span className="font-mono text-[9px] text-slate-500">Confidence</span>
            <span className="font-orbitron text-[10px]" style={{ color: confidenceColor }}>
              {confidence}%
            </span>
          </div>
          {/* Mini confidence bar */}
          <div className="w-12 h-1 bg-white/10">
            <div
              className="h-full transition-all"
              style={{ width: `${confidence}%`, backgroundColor: confidenceColor }}
            />
          </div>
        </div>
      </div>

      {/* Answer body */}
      <div className="px-4 py-3 space-y-0.5">
        {lines.map((line, i) => renderLine(line, i))}
      </div>

      {/* Evidence basis tags + follow-up queries */}
      {(evidenceBasis.length > 0 || followUps.length > 0) && (
        <div className="px-4 pb-3 pt-2 border-t border-white/[0.05] space-y-2">
          {evidenceBasis.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-orbitron text-[8px] uppercase text-slate-600 tracking-widest">Sources</span>
              {evidenceBasis.map((src, i) => (
                <span key={i} className="px-2 py-0.5 border border-teal-data/20 bg-teal-data/5 font-mono text-[8px] text-teal-data">
                  {src}
                </span>
              ))}
            </div>
          )}
          {followUps.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-orbitron text-[8px] uppercase text-slate-600 tracking-widest">Follow-up</span>
              {followUps.slice(0, 3).map((q, i) => (
                <button
                  key={i}
                  onClick={() => onFollowUp(q)}
                  className="px-2 py-0.5 border border-amber/20 bg-amber/5 font-mono text-[8px] text-amber hover:bg-amber/15 transition"
                >
                  {q}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

function Panel({ title, icon: Icon, iconColor, children }: {
  title: string;
  icon: React.ComponentType<{ size?: number }>;
  iconColor: string;
  children: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden border border-white/8 bg-[#07101a]/78 p-4">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-crimson/50 to-transparent" />
      <div className="flex items-center gap-2 mb-4">
        <Icon size={14} style={{ color: iconColor }} />
        <h2 className="font-orbitron text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-200">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

// ─── Static fallback data (used when backend is offline) ─────────────────────
const STATIC_REPORT = {
  report_id: "demo-001",
  case_id: "AIV-2041-77",
  risk_score: 88,
  threat_level: "HIGH",
  verdict: "Evidence strongly indicates premeditated homicide with deliberate post-mortem evidence concealment.",
  reasoning: "Multi-source forensic analysis reveals a coordinated criminal operation. The 27-minute communication blackout precisely aligns with the estimated TOD window. Body repositioning confirmed via lividity analysis indicates deliberate concealment. Two suspects identified with 94% geospatial correlation confidence.",
  supporting_evidence: [
    { evidence_type: "Autopsy Report", description: "Blunt force trauma + sedative toxicology", weight: 94 },
    { evidence_type: "CCTV Footage", description: "Suspect at scene within TOD window", weight: 91 },
    { evidence_type: "GPS Correlation", description: "Device trace confirms presence", weight: 88 },
    { evidence_type: "Behavioral Anomaly", description: "27-min communication blackout", weight: 96 },
  ],
  key_findings: [
    "Cause of death: blunt force trauma — homicidal assault pattern confirmed",
    "Victim sedated prior to fatal assault — indicates premeditation",
    "Body repositioned post-mortem — deliberate evidence concealment",
    "Digital blackout aligns with TOD window — coordinated suppression",
    "Two suspects with high-confidence geospatial correlation",
  ],
  recommended_actions: [
    "Issue arrest warrants for SUSPECT_01 and SUSPECT_02",
    "Obtain tower dump from BLR_2231",
    "Submit device for forensic image recovery",
    "Conduct secondary autopsy — sedative quantification",
    "Review all CCTV within 500m of service road",
  ],
  confidence_score: 91,
  generated_at: new Date().toISOString(),
  analyst_id: "AIVENTRA-OMEGA-7",
} as any;

const STATIC_ANOMALY = {
  case_id: "AIV-2041-77",
  overall_threat_level: "HIGH",
  overall_threat_score: 82,
  anomalies: [
    {
      anomaly_id: "a1", anomaly_type: "route_deviation",
      description: "Vehicle detected 8km off expected route — inconsistent with alibi",
      severity: "HIGH", threat_score: 79, detected_at: "02:17:00",
      confidence: 88, contributing_factors: [], recommended_action: "Cross-reference with CCTV",
    },
    {
      anomaly_id: "a2", anomaly_type: "communication_silence",
      description: "27-minute gap in all outbound communications during TOD window",
      severity: "CRITICAL", threat_score: 91, detected_at: "02:14:00",
      confidence: 96, contributing_factors: [], recommended_action: "Obtain tower dump",
    },
    {
      anomaly_id: "a3", anomaly_type: "behavioral_deviation",
      description: "Device usage dropped from 22 interactions/hour to zero for 34 minutes",
      severity: "HIGH", threat_score: 82, detected_at: "02:14:35",
      confidence: 84, contributing_factors: [], recommended_action: "Device forensic image",
    },
  ],
  behavioral_profile: { deviation_score: 68.4, pattern_shift: "HIGH", baseline_comparison: "5 vectors deviated" },
  escalation_probability: 87,
} as any;
