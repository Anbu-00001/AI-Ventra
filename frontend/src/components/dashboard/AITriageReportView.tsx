/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Shield, AlertTriangle, CheckCircle, Target, FileText,
  Brain, Activity, TrendingUp, Zap, RefreshCw, Search
} from "lucide-react";
import { getDemoReport, getDemoAnomalies, queryRAG, explainConclusion, apiFetch } from "@/lib/api";
import type { TriageReport, AnomalyReport, ApiResponse } from "@/lib/api";

export default function AITriageReportView({ initialReport = null }: { initialReport?: TriageReport | null }) {
  const [report, setReport] = useState<TriageReport | null>(initialReport);
  const [anomaly, setAnomaly] = useState<AnomalyReport | null>(null);
  const [loading, setLoading] = useState(!initialReport);
  const [ragQuery, setRagQuery] = useState("");
  const [ragResult, setRagResult] = useState<any | null>(null);
  const [ragLoading, setRagLoading] = useState(false);

  useEffect(() => {
    if (initialReport) {
      // We have a REAL report from the dashboard — use it directly
      setReport(initialReport);
      setLoading(false);

      // Build anomaly data dynamically from the real report
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
      // No report passed — try to fetch the LATEST real report from backend
      const fetchLatestReport = async () => {
        try {
          // First try to get a list of real reports
          const listRes = await apiFetch<ApiResponse<any[]>>("/reports/list");
          if (listRes.data && listRes.data.length > 0) {
            // We have real saved reports — use the latest one
            const latestId = listRes.data[listRes.data.length - 1].report_id;
            // Generate a fresh report from real data
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
        
        // Only fall back to demo if no real reports exist
        getDemoReport()
          .then(res => setReport(res.data))
          .catch(() => setReport(STATIC_REPORT))
          .finally(() => setLoading(false));
      };
      fetchLatestReport();

      // Fetch anomalies
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
    if (level === "CRITICAL") return "#ff2848";
    if (level === "HIGH") return "#ff2848";
    if (level === "ELEVATED") return "#f5a400";
    return "#18f3e2";
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400 font-mono text-sm">
        <RefreshCw size={16} className="mr-2 animate-spin" />
        Loading AI Triage Report...
      </div>
    );
  }

  const r = report ?? STATIC_REPORT;
  const a = anomaly ?? STATIC_ANOMALY;
  const color = threatColor(r.threat_level);

  return (
    <div className="flex flex-col h-full bg-[#05070b] text-slate-200 overflow-auto custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/20 shrink-0">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center clip-hexagon border border-crimson/60 bg-crimson/15 text-crimson-glow">
            <Shield size={20} />
          </div>
          <div>
            <div className="font-orbitron text-sm font-bold uppercase tracking-[0.15em] text-white">
              AI Triage Report
            </div>
            <div className="font-mono text-[10px] text-slate-500 uppercase">
              Case: {r.case_id} | Analyst: {(r as any).analyst_id ?? "AIVENTRA-OMEGA-7"}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-orbitron text-2xl" style={{ color }}>
            {Math.round(r.risk_score)}
            <span className="text-base text-slate-400">/100</span>
          </div>
          <div className="font-orbitron text-[10px] uppercase tracking-widest" style={{ color }}>
            {r.threat_level} RISK
          </div>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 p-4 lg:p-6 min-h-0">
        {/* Left: verdict + findings + evidence */}
        <div className="flex flex-col gap-4">
          {/* Verdict */}
          <Panel title="AI Verdict" icon={Brain} iconColor="#ff2848">
            <div className="border-l-2 border-crimson/60 pl-4">
              <p className="font-mono text-sm text-slate-100 leading-relaxed">
                &ldquo;{r.verdict}&rdquo;
              </p>
              <div className="mt-3 font-mono text-[10px] text-slate-500">
                Confidence: <span className="text-teal-400">{r.confidence_score}%</span>
              </div>
            </div>
          </Panel>

          {/* Reasoning */}
          <Panel title="Forensic Reasoning" icon={FileText} iconColor="#f5a400">
            <p className="font-mono text-[11px] text-slate-300 leading-relaxed">
              {r.reasoning?.slice(0, 600)}{r.reasoning?.length > 600 ? "..." : ""}
            </p>
          </Panel>

          {/* Key findings */}
          <Panel title="Key Findings" icon={Target} iconColor="#18f3e2">
            <ul className="space-y-2">
              {r.key_findings.map((f, i) => (
                <li key={i} className="flex items-start gap-3 font-mono text-[11px] text-slate-300">
                  <CheckCircle size={12} className="text-teal-400 mt-0.5 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </Panel>

          {/* Supporting evidence */}
          <Panel title="Supporting Evidence" icon={Activity} iconColor="#c084fc">
            <div className="grid gap-2">
              {r.supporting_evidence.map((ev, i) => (
                <div key={i} className="grid grid-cols-[1fr_60px] items-center gap-3 border border-white/5 bg-black/20 p-3">
                  <div>
                    <div className="font-orbitron text-[10px] text-slate-200 uppercase">{ev.evidence_type}</div>
                    <div className="font-mono text-[9px] text-slate-500 mt-1">{ev.description}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-orbitron text-sm" style={{ color }}>{ev.weight}%</div>
                    <div className="mt-1 h-1 bg-white/8">
                      <div className="h-full" style={{ width: `${ev.weight}%`, backgroundColor: color }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          {/* RAG Intelligence Query */}
          <Panel title="AI Intelligence Query" icon={Search} iconColor="#18f3e2">
            {/* Suggested queries */}
            <div className="flex flex-wrap gap-2 mb-3">
              {["Cause of death?", "Who are the suspects?", "Toxicology findings?", "GPS anomalies?"].map((q) => (
                <button
                  key={q}
                  onClick={() => { setRagQuery(q); }}
                  className="px-2 py-1 border border-white/10 bg-white/[0.03] font-mono text-[9px] text-slate-400 hover:border-teal-data/40 hover:text-teal-data transition"
                >
                  {q}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={ragQuery}
                onChange={(e) => setRagQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRAGQuery()}
                placeholder="e.g. 'What is the cause of death?' or 'Who are the suspects?'"
                className="flex-1 bg-black/40 border border-white/10 px-3 py-2 font-mono text-[11px] text-slate-200 placeholder-slate-600 outline-none focus:border-teal-data/50"
              />
              <button
                onClick={handleRAGQuery}
                disabled={ragLoading || !ragQuery.trim()}
                className="px-4 py-2 border border-teal-data/40 bg-teal-data/10 font-orbitron text-[10px] text-teal-data uppercase tracking-widest hover:bg-teal-data/20 transition disabled:opacity-40"
              >
                {ragLoading ? <RefreshCw size={12} className="animate-spin" /> : "Query"}
              </button>
            </div>

            {ragResult && (
              <RAGResponsePanel result={ragResult} onFollowUp={(q) => setRagQuery(q)} />
            )}
          </Panel>
        </div>

        {/* Right: threat meter + actions */}
        <div className="flex flex-col gap-4">
          {/* Threat Score Gauge */}
          <Panel title="Composite Threat Score" icon={AlertTriangle} iconColor={color}>
            <div className="flex flex-col items-center py-4">
              <div className="relative w-32 h-32">
                <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" />
                  <circle
                    cx="60" cy="60" r="50" fill="none" strokeWidth="10"
                    stroke={color}
                    strokeDasharray={314}
                    strokeDashoffset={314 - (314 * r.risk_score / 100)}
                    strokeLinecap="round"
                    style={{ filter: `drop-shadow(0 0 8px ${color})` }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="font-orbitron text-2xl font-bold" style={{ color }}>{Math.round(r.risk_score)}</div>
                  <div className="font-mono text-[8px] text-slate-500 uppercase">Risk Score</div>
                </div>
              </div>
              <div className="mt-4 font-orbitron text-lg uppercase tracking-widest" style={{ color }}>
                {r.threat_level}
              </div>
              <div className="mt-1 font-mono text-[10px] text-slate-500">
                Confidence: {r.confidence_score}%
              </div>
            </div>
            {/* Anomaly sub-metrics */}
            <div className="mt-4 space-y-2">
              {[
                ["Threat Score", `${Math.round(a.overall_threat_score)}%`, a.overall_threat_score],
                ["Escalation Risk", `${Math.round(a.escalation_probability)}%`, a.escalation_probability],
                ["Anomalies Found", `${a.anomalies.length}`, Math.min(100, a.anomalies.length * 20)],
              ].map(([label, val, pct]) => (
                <div key={String(label)}>
                  <div className="flex justify-between font-mono text-[9px] text-slate-400 mb-1">
                    <span>{String(label)}</span><span style={{ color }}>{String(val)}</span>
                  </div>
                  <div className="h-1 bg-white/8">
                    <div className="h-full" style={{ width: `${Number(pct)}%`, backgroundColor: color }} />
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          {/* Recommended actions */}
          <Panel title="Recommended Actions" icon={Zap} iconColor="#f5a400">
            <ol className="space-y-3">
              {r.recommended_actions.map((action, i) => (
                <li key={i} className="flex gap-3 font-mono text-[10px] text-slate-300">
                  <span className="flex-shrink-0 grid h-5 w-5 place-items-center rounded-full border border-amber/60 font-orbitron text-[9px] text-amber">
                    {i + 1}
                  </span>
                  {action}
                </li>
              ))}
            </ol>
          </Panel>

          {/* Anomaly breakdown */}
          <Panel title="Anomaly Breakdown" icon={TrendingUp} iconColor="#ff2848">
            {a.anomalies.slice(0, 4).map((an, i) => (
              <div key={i} className="mb-3 last:mb-0 border border-white/5 bg-black/20 p-3">
                <div className="flex justify-between items-start mb-1">
                  <div className="font-orbitron text-[10px] text-slate-200 uppercase">
                    {an.anomaly_type.replace(/_/g, " ")}
                  </div>
                  <div className="font-mono text-[9px]" style={{ color: threatColor(an.severity) }}>
                    {an.severity}
                  </div>
                </div>
                <div className="font-mono text-[9px] text-slate-500 leading-tight line-clamp-2">
                  {an.description}
                </div>
                <div className="mt-2 h-px bg-white/5" />
                <div className="mt-1 font-mono text-[9px] text-amber">
                  Score: {Math.round(an.threat_score)}
                </div>
              </div>
            ))}
          </Panel>
        </div>
      </div>
    </div>
  );
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
