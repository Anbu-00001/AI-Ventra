"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Camera, Upload, ShieldAlert, Activity, Scan, Target, CheckCircle,
  AlertTriangle, Cpu, Users, Car, Smartphone, ChevronRight, RefreshCw,
  Zap, Eye, TrendingUp,
} from "lucide-react";
import { uploadVideoForAnalysis, createVideoAnalysisWS } from "@/lib/api";
import type { VideoAnalysisReport } from "@/lib/api";

type Phase = "idle" | "analyzing" | "complete" | "error";

interface WsMsg {
  type: string;
  stage?: string;
  progress?: number;
  detail?: string;
  detections?: Array<{ label: string; confidence: number }>;
  report?: VideoAnalysisReport;
}

interface LiveEvent { label: string; conf: number; ts: string; }

const STAGE_LABELS: Record<string, string> = {
  video_loaded: "Video Loaded — Initializing YOLOv8",
  yolo_motion_scan: "YOLOv8 Frame Scan + Optical Flow Analysis",
  anomaly_fusion: "Forensic Anomaly Timeline Fusion",
  overlay_render: "Rendering Tactical HUD Overlay",
  complete: "Intelligence Analysis Complete",
};

const ENTITY_ICONS: Record<string, React.ElementType> = {
  person: Users, car: Car, motorcycle: Zap, truck: Car,
  cellphone: Smartphone, handbag: Target,
};

function fmtStage(k: string) { return STAGE_LABELS[k] ?? k.replace(/_/g, " ").toUpperCase(); }
function fmtSize(b: number) { return b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${(b / 1e3).toFixed(0)} KB`; }

function sevBadge(s: string) {
  if (s === "CRITICAL") return "bg-red-500/20 text-red-500 border-red-500/20";
  if (s === "HIGH") return "bg-orange-500/20 text-orange-500 border-orange-500/20";
  if (s === "ELEVATED") return "bg-amber-500/20 text-amber-500 border-amber-500/20";
  return "bg-teal-400/20 text-teal-400 border-teal-400/20";
}
function threatColor(s: string) {
  if (s === "CRITICAL") return "text-red-500";
  if (s === "HIGH") return "text-orange-500";
  if (s === "ELEVATED") return "text-amber-500";
  return "text-teal-400";
}
function threatBarColor(score: number) {
  if (score >= 80) return "bg-red-500 shadow-[0_0_8px_#ef4444]";
  if (score >= 60) return "bg-orange-500";
  if (score >= 35) return "bg-amber-500";
  return "bg-teal-400";
}

export default function VisualIntelligenceView() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [stageLabel, setStageLabel] = useState("");
  const [stageDetail, setStageDetail] = useState("");
  const [report, setReport] = useState<VideoAnalysisReport | null>(null);
  const [liveDetections, setLiveDetections] = useState<Array<{ label: string; confidence: number }>>([]);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeSnapshot, setActiveSnapshot] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [glitch, setGlitch] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reportRef = useRef<VideoAnalysisReport | null>(null);

  // Periodic glitch effect
  useEffect(() => {
    const id = setInterval(() => {
      setGlitch(true);
      setTimeout(() => setGlitch(false), 120);
    }, 5500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => () => { wsRef.current?.close(); }, []);

  const startAnalysis = useCallback(async (file: File) => {
    setSelectedFile(file);
    setPhase("analyzing");
    setProgress(2);
    setStageLabel("Connecting to AIVENTRA Neural Core...");
    setStageDetail("");
    setLiveDetections([]);
    setLiveEvents([]);
    reportRef.current = null;
    setVideoError(false);

    // Connect WebSocket for real-time frame updates
    try {
      const ws = createVideoAnalysisWS();
      wsRef.current = ws;
      ws.onmessage = (e) => {
        try {
          const msg: WsMsg = JSON.parse(e.data);
          if (msg.type === "stage" || msg.type === "detection") {
            if (msg.progress !== undefined) setProgress(msg.progress);
            if (msg.stage) setStageLabel(fmtStage(msg.stage));
            if (msg.detail) setStageDetail(msg.detail);
            if (msg.detections?.length) {
              setLiveDetections(msg.detections);
              const newEvts: LiveEvent[] = msg.detections.slice(0, 3).map(d => ({
                label: d.label,
                conf: Math.round(d.confidence * 100),
                ts: new Date().toLocaleTimeString("en-US", { hour12: false }),
              }));
              setLiveEvents(prev => [...newEvts, ...prev].slice(0, 16));
            }
          } else if (msg.type === "complete" && msg.report) {
            reportRef.current = msg.report;
            setReport(msg.report);
            setProgress(100);
            setStageLabel("Analysis Complete");
            setPhase("complete");
            ws.close();
          }
        } catch {}
      };
      await new Promise<void>(resolve => {
        ws.onopen = () => resolve();
        ws.onerror = () => resolve();
        setTimeout(resolve, 2500);
      });
    } catch {}

    // POST video to backend
    try {
      setStageLabel("Uploading video to AIVENTRA pipeline...");
      setProgress(5);
      const res = await uploadVideoForAnalysis(file);
      if (!reportRef.current && res.data) {
        reportRef.current = res.data;
        setReport(res.data);
        setProgress(100);
        setStageLabel("Analysis Complete");
        setPhase("complete");
      }
    } catch (err: any) {
      setErrorMsg(err.message ?? "Video analysis failed");
      setPhase("error");
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) startAnalysis(file);
  }, [startAnalysis]);

  const reset = () => {
    wsRef.current?.close();
    reportRef.current = null;
    setPhase("idle");
    setReport(null);
    setProgress(0);
    setSelectedFile(null);
    setLiveDetections([]);
    setLiveEvents([]);
    setVideoError(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="flex flex-col h-full bg-[#05070b] text-slate-200 font-sans overflow-hidden">
      {/* ── Header ────────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/20 flex-shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-crimson font-bold">
            <Camera size={20} />
            <span className="font-orbitron text-lg tracking-[0.15em] uppercase">Visual Intelligence</span>
          </div>
          <div className="h-4 w-px bg-white/10" />
          <div className="font-mono text-[10px] text-slate-500 uppercase tracking-widest">
            // YOLOv8n · Forensic Object Detection · Optical Flow
          </div>
        </div>
        <div className="flex items-center gap-4">
          {phase === "complete" && (
            <div className="px-3 py-1 bg-teal-400/10 border border-teal-400/30 rounded text-[10px] font-mono text-teal-400">
              ✓ YOLO ANALYSIS COMPLETE
            </div>
          )}
          {phase === "analyzing" && (
            <div className="px-3 py-1 bg-crimson/10 border border-crimson/30 rounded text-[10px] font-mono text-crimson animate-pulse">
              ◉ ANALYZING — {progress}%
            </div>
          )}
          {phase === "idle" && (
            <div className="px-3 py-1 bg-white/5 border border-white/10 rounded text-[10px] font-mono text-slate-500">
              STANDBY — AWAITING UPLOAD
            </div>
          )}
          {(phase === "complete" || phase === "error") && (
            <button onClick={reset} className="flex items-center gap-1.5 text-slate-500 hover:text-white transition px-3 py-1 border border-white/10 rounded">
              <RefreshCw size={13} />
              <span className="text-[10px] font-mono uppercase">New Analysis</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_320px] overflow-hidden min-h-0">
        {/* ── Main Area ──────────────────────────────────────────────────────── */}
        <div className="relative overflow-y-auto custom-scrollbar flex flex-col gap-4 p-5">

          {/* ══ IDLE: Upload Drop Zone ══ */}
          {phase === "idle" && (
            <div
              className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-14 text-center cursor-pointer transition-all duration-200 ${isDragging ? "border-crimson/70 bg-crimson/5 scale-[1.01]" : "border-white/10 hover:border-white/25 bg-black/20"}`}
              style={{ minHeight: "400px" }}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,video/webm,.mp4,.mov,.avi,.mkv,.webm"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) startAnalysis(f); }}
              />
              <motion.div animate={{ scale: isDragging ? 1.12 : 1, rotate: isDragging ? 5 : 0 }} className="mb-6">
                <div className="w-28 h-28 rounded-full border-2 border-white/10 bg-white/5 flex items-center justify-center mx-auto">
                  <Upload size={46} className={isDragging ? "text-crimson" : "text-slate-500"} />
                </div>
              </motion.div>
              <div className="font-orbitron text-2xl text-slate-200 uppercase tracking-widest mb-3">
                Upload Incident Video
              </div>
              <div className="text-sm text-slate-400 mb-2 max-w-md">
                Drag & drop a CCTV / dashcam / incident video clip — AIVENTRA will run YOLOv8 forensic analysis, detect suspects, vehicles, and objects, and generate a full intelligence report.
              </div>
              <div className="text-[10px] font-mono text-slate-600 uppercase tracking-widest mb-8">
                MP4 · MOV · AVI · MKV · WEBM supported
              </div>
              <div className="flex items-center gap-8 text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                <span className="flex items-center gap-2"><Scan size={14} className="text-teal-400" /> YOLOv8 Object Detection</span>
                <span className="flex items-center gap-2"><Activity size={14} className="text-teal-400" /> Optical Flow Motion</span>
                <span className="flex items-center gap-2"><Cpu size={14} className="text-teal-400" /> Forensic Reasoning + RAG</span>
              </div>
            </div>
          )}

          {/* ══ ANALYZING: Live Progress ══ */}
          {phase === "analyzing" && (
            <div className="flex flex-col gap-4">
              {/* Main analysis panel */}
              <div className={`relative border border-white/10 rounded-xl bg-black/50 p-6 overflow-hidden ${glitch ? "opacity-92" : ""}`} style={{ minHeight: "340px" }}>
                {/* Animated scanlines */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-xl">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <motion.div key={i} className="absolute left-0 right-0 h-px bg-teal-400/8"
                      style={{ top: `${i * 10 + 5}%` }}
                      animate={{ opacity: [0.2, 0.7, 0.2] }}
                      transition={{ duration: 2.5, delay: i * 0.18, repeat: Infinity }} />
                  ))}
                  {/* Horizontal sweep line */}
                  <motion.div className="absolute left-0 right-0 h-0.5 bg-teal-400/20"
                    animate={{ top: ["0%", "100%", "0%"] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }} />
                </div>

                {/* Corner accents */}
                <div className="absolute top-0 left-0 w-10 h-10 border-t-2 border-l-2 border-crimson/40" />
                <div className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 border-crimson/40" />
                <div className="absolute bottom-0 left-0 w-10 h-10 border-b-2 border-l-2 border-crimson/40" />
                <div className="absolute bottom-0 right-0 w-10 h-10 border-b-2 border-r-2 border-crimson/40" />

                <div className="relative z-10">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <div className="flex items-center gap-2 font-orbitron text-sm text-slate-200 uppercase tracking-widest mb-1">
                        <div className="w-2 h-2 rounded-full bg-crimson animate-pulse" />
                        YOLO Neural Analysis Active
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 uppercase">{selectedFile?.name} · {fmtSize(selectedFile?.size ?? 0)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-mono font-bold text-crimson">{progress}%</div>
                      <div className="text-[9px] font-mono text-slate-500 uppercase mt-1">{stageLabel}</div>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mb-5">
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-2">
                      <motion.div
                        className="h-full bg-gradient-to-r from-teal-500 via-teal-400 to-crimson rounded-full"
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.4 }}
                      />
                    </div>
                    {stageDetail && <div className="text-[9px] font-mono text-slate-500">{stageDetail}</div>}
                  </div>

                  {/* Pipeline stages */}
                  <div className="flex gap-3 mb-6">
                    {[
                      { key: "yolo", label: "YOLOv8", threshold: 8 },
                      { key: "motion", label: "Motion", threshold: 20 },
                      { key: "anomaly", label: "Anomaly", threshold: 68 },
                      { key: "rag", label: "RAG+LLM", threshold: 85 },
                      { key: "done", label: "Complete", threshold: 100 },
                    ].map(s => (
                      <div key={s.key} className="flex-1 flex flex-col items-center gap-1.5">
                        <div className={`w-full h-8 rounded border flex items-center justify-center text-[9px] font-orbitron transition-all duration-700 ${progress >= s.threshold ? "border-teal-400/60 bg-teal-400/10 text-teal-400" : "border-white/5 text-slate-700 bg-white/[0.02]"}`}>
                          {progress >= s.threshold ? "✓" : "·"}
                        </div>
                        <div className="text-[8px] font-mono text-slate-600 uppercase tracking-wider text-center">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Live detections */}
                  {liveDetections.length > 0 && (
                    <div>
                      <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-2">Current Frame Detections:</div>
                      <div className="flex flex-wrap gap-2">
                        {liveDetections.map((d, i) => (
                          <div key={i} className="flex items-center gap-1.5 px-2.5 py-1 bg-teal-400/10 border border-teal-400/20 rounded text-[10px] font-mono text-teal-400 uppercase">
                            <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                            {d.label} {Math.round(d.confidence * 100)}%
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Live detection event feed */}
              {liveEvents.length > 0 && (
                <div className="bg-black/40 rounded-xl border border-white/5 p-4">
                  <div className="flex items-center gap-2 font-orbitron text-[10px] text-slate-400 uppercase tracking-widest mb-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                    Live YOLO Detection Feed
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                    {liveEvents.map((ev, i) => (
                      <div key={i} className="flex items-center gap-4 text-[9px] font-mono py-0.5">
                        <span className="text-slate-600 w-16 flex-shrink-0">{ev.ts}</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-400 flex-shrink-0" />
                        <span className="text-teal-400 uppercase flex-shrink-0 w-20">{ev.label}</span>
                        <span className="text-slate-500">{ev.conf}% confidence</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ COMPLETE: Results ══ */}
          {phase === "complete" && report && (
            <div className="flex flex-col gap-4">
              {/* Primary video/snapshot display */}
              <div className={`relative border border-white/10 rounded-xl bg-black/70 overflow-hidden ${glitch ? "opacity-95" : ""}`} style={{ minHeight: "340px" }}>
                {/* Corner accents */}
                <div className="absolute top-0 left-0 w-10 h-10 border-t-2 border-l-2 border-teal-400/40 z-10" />
                <div className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 border-teal-400/40 z-10" />
                <div className="absolute bottom-0 left-0 w-10 h-10 border-b-2 border-l-2 border-teal-400/40 z-10" />
                <div className="absolute bottom-0 right-0 w-10 h-10 border-b-2 border-r-2 border-teal-400/40 z-10" />

                {/* HUD info */}
                <div className="absolute top-3 left-4 z-20 flex flex-col gap-0.5">
                  <div className="font-mono text-xs text-teal-400">FEED_ID: AIVENTRA-YOLO-PROCESSED</div>
                  <div className="font-mono text-[10px] text-slate-500 uppercase tracking-tighter">{report.source_video}</div>
                </div>
                <div className="absolute top-3 right-4 z-20 font-mono text-xs text-crimson">
                  {report.duration_seconds.toFixed(1)}s · {Math.round(report.fps)}fps · {report.frame_count} frames
                </div>

                {/* Processed video player (with YOLO HUD overlays) */}
                {report.processed_video_url && !videoError && (
                  <video
                    className="w-full object-contain bg-black"
                    style={{ maxHeight: "420px" }}
                    controls
                    autoPlay
                    loop
                    muted
                    src={report.processed_video_url}
                    onError={() => setVideoError(true)}
                  />
                )}

                {/* Snapshot display if video fails or no URL */}
                {(videoError || !report.processed_video_url) && report.snapshots.length > 0 && (
                  <img
                    src={report.snapshots[activeSnapshot]}
                    className="w-full object-contain bg-black"
                    style={{ maxHeight: "420px" }}
                    alt="YOLO detection frame"
                  />
                )}

                {/* Status badges */}
                <div className="absolute bottom-4 left-4 flex gap-2 z-20">
                  <StatusBadge icon={Scan} label="YOLO Active" />
                  <StatusBadge icon={Activity} label="Motion Analyzed" />
                  <StatusBadge icon={CheckCircle} label="Report Ready" color="text-teal-400" />
                </div>
              </div>

              {/* Confidence waveform */}
              {report.confidence_waveform.length > 0 && (
                <div className="bg-black/40 rounded-xl border border-white/5 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-orbitron text-[10px] text-slate-400 uppercase tracking-widest">
                      Motion / Confidence Waveform
                    </div>
                    <div className="text-[9px] font-mono text-slate-600 uppercase">
                      {report.processed_frames} frames analyzed · {report.duration_seconds.toFixed(1)}s
                    </div>
                  </div>
                  <div className="h-16 flex items-end gap-0.5">
                    {report.confidence_waveform.slice(0, 160).map((v, i) => (
                      <div
                        key={i}
                        className="flex-1 rounded-t transition-all"
                        style={{
                          height: `${Math.max(5, v * 100)}%`,
                          background: v > 0.7 ? "rgba(239,68,68,0.7)" : v > 0.4 ? "rgba(245,158,11,0.6)" : "rgba(20,184,166,0.45)",
                        }}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between text-[8px] font-mono text-slate-600 mt-1.5">
                    <span>00:00:00</span>
                    <span className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-sm inline-block bg-teal-400/60" /> Normal
                      <span className="w-2 h-2 rounded-sm inline-block bg-amber-500/60" /> Elevated
                      <span className="w-2 h-2 rounded-sm inline-block bg-red-500/60" /> Anomaly
                    </span>
                    <span>{report.duration_seconds.toFixed(0)}s</span>
                  </div>
                </div>
              )}

              {/* Snapshots grid */}
              {report.snapshots.length > 0 && (
                <div className="bg-black/40 rounded-xl border border-white/5 p-4">
                  <div className="font-orbitron text-[10px] text-slate-400 uppercase tracking-widest mb-3">
                    YOLO Detection Keyframes — {report.snapshots.length} captured
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {report.snapshots.slice(0, 8).map((snap, i) => (
                      <div
                        key={i}
                        onClick={() => { setActiveSnapshot(i); setVideoError(true); }}
                        className={`relative cursor-pointer border rounded overflow-hidden transition-all ${activeSnapshot === i && videoError ? "border-teal-400/60 ring-1 ring-teal-400/30" : "border-white/5 hover:border-white/20"}`}
                        style={{ aspectRatio: "16/9" }}
                      >
                        <img src={snap} className="w-full h-full object-cover" alt={`Frame ${i + 1}`} />
                        <div className="absolute bottom-1 left-1 text-[7px] font-mono text-teal-400 bg-black/75 px-1 rounded">
                          KF-{String(i + 1).padStart(2, "0")}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Forensic Event Timeline */}
              {report.event_timeline.length > 0 && (
                <div className="bg-black/40 rounded-xl border border-white/5 p-4">
                  <div className="font-orbitron text-[10px] text-slate-400 uppercase tracking-widest mb-3">
                    Forensic Event Timeline — {report.event_timeline.length} events detected
                  </div>
                  <div className="space-y-2">
                    {report.event_timeline.slice(0, 8).map((ev) => (
                      <div key={ev.id} className="flex items-start gap-3 p-2.5 bg-white/[0.02] rounded border border-white/5">
                        <div className="flex-shrink-0 mt-0.5">
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${sevBadge(ev.severity)}`}>{ev.severity}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-[11px] font-bold text-slate-200">{ev.event}</div>
                            <div className="text-[8px] font-mono text-slate-500 flex-shrink-0">{ev.timestamp}</div>
                          </div>
                          {ev.evidence[0] && (
                            <div className="text-[9px] text-slate-500 mt-0.5">{ev.evidence[0]}</div>
                          )}
                          <div className="text-[8px] font-mono text-slate-600 mt-0.5">
                            Confidence: {Math.round(ev.confidence * 100)}% · Category: {ev.category}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reasoning Engine */}
              {report.reasoning_engine.reasoning.length > 0 && (
                <div className="bg-black/40 rounded-xl border border-white/5 p-4">
                  <div className="flex items-center gap-2 font-orbitron text-[10px] text-slate-400 uppercase tracking-widest mb-3">
                    <Cpu size={12} />
                    Forensic Reasoning Engine
                    <div className="ml-auto flex items-center gap-2">
                      {report.reasoning_engine.ollama_used ? (
                        <span className="text-[8px] text-teal-400 border border-teal-400/30 bg-teal-400/5 px-1.5 py-0.5 rounded">OLLAMA LLM</span>
                      ) : (
                        <span className="text-[8px] text-amber-400 border border-amber-400/30 bg-amber-400/5 px-1.5 py-0.5 rounded">RAG FALLBACK</span>
                      )}
                      {report.reasoning_engine.rag_context.length > 0 && (
                        <span className="text-[8px] text-teal-400/70 border border-teal-400/20 px-1.5 py-0.5 rounded">RAG ✓</span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2 mb-4">
                    {report.reasoning_engine.reasoning.map((r, i) => (
                      <div key={i} className="flex items-start gap-2 text-[10px] text-slate-400 leading-relaxed">
                        <ChevronRight size={12} className="text-teal-400 flex-shrink-0 mt-0.5" />
                        {r}
                      </div>
                    ))}
                  </div>
                  {report.reasoning_engine.narration.length > 0 && (
                    <div className="pt-3 border-t border-white/5">
                      <div className="text-[9px] font-orbitron text-slate-500 uppercase tracking-widest mb-2">AI Narration</div>
                      {report.reasoning_engine.narration.map((n, i) => (
                        <p key={i} className="text-[10px] text-slate-400 italic leading-relaxed mb-1">{n}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Analysis meta */}
              <div className="bg-black/40 rounded-xl border border-white/5 p-4">
                <div className="font-orbitron text-[10px] text-slate-400 uppercase tracking-widest mb-3">Analysis Metadata</div>
                <div className="grid grid-cols-3 gap-3">
                  <MetaBox label="Analysis ID" value={report.analysis_id.slice(0, 16)} />
                  <MetaBox label="Detector" value={String(report.meta?.detector ?? "YOLOv8n COCO")} />
                  <MetaBox label="YOLO Status" value={report.meta?.yolo ? (report.meta.yolo as any).available ? "✓ ACTIVE" : "FALLBACK" : "N/A"} />
                  <MetaBox label="Sample Stride" value={String(report.meta?.sample_stride ?? "–")} />
                  <MetaBox label="Movement Anomalies" value={String(report.movement_anomalies.length)} />
                  <MetaBox label="Entities Detected" value={String(report.detected_entities.length)} />
                </div>
              </div>
            </div>
          )}

          {/* ══ ERROR ══ */}
          {phase === "error" && (
            <div className="flex-1 flex items-center justify-center" style={{ minHeight: "380px" }}>
              <div className="text-center max-w-md">
                <AlertTriangle size={52} className="mx-auto text-crimson mb-4" />
                <div className="font-orbitron text-sm text-red-400 uppercase tracking-widest mb-2">Analysis Failed</div>
                <div className="text-[11px] text-slate-500 mb-6 leading-relaxed">{errorMsg}</div>
                <button onClick={reset} className="px-5 py-2 border border-white/10 text-[10px] font-orbitron text-slate-400 hover:text-white uppercase tracking-widest transition rounded">
                  Try Again
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Sidebar ────────────────────────────────────────────────────────── */}
        <div className="border-l border-white/5 bg-black/20 flex flex-col overflow-y-auto custom-scrollbar min-h-0">

          {/* Detection Events */}
          <div className="p-5 border-b border-white/5 flex-shrink-0">
            <h3 className="font-orbitron text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Detection Events</h3>

            {phase === "complete" && report?.event_timeline.length ? (
              <div className="space-y-3">
                {report.event_timeline.slice(0, 5).map((ev) => (
                  <div key={ev.id} className="bg-white/[0.03] border border-white/5 p-3 rounded">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-mono text-[9px] text-slate-500">{ev.timestamp}</span>
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border ${sevBadge(ev.severity)}`}>{ev.severity}</span>
                    </div>
                    <div className="font-orbitron text-[10px] text-slate-200 mb-0.5">{ev.event}</div>
                    <div className="font-mono text-[9px] text-slate-400 italic">
                      {ev.evidence[0]?.slice(0, 55) ?? ev.category} · {Math.round(ev.confidence * 100)}%
                    </div>
                  </div>
                ))}
              </div>
            ) : phase === "analyzing" && liveEvents.length > 0 ? (
              <div className="space-y-2">
                {liveEvents.slice(0, 6).map((ev, i) => (
                  <div key={i} className="bg-white/[0.03] border border-white/5 p-2.5 rounded">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-mono text-[9px] text-slate-500">{ev.ts}</span>
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded border bg-teal-400/20 text-teal-400 border-teal-400/20">LIVE</span>
                    </div>
                    <div className="font-orbitron text-[10px] text-slate-200 uppercase">{ev.label}</div>
                    <div className="font-mono text-[9px] text-slate-400">Confidence: {ev.conf}%</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[10px] font-mono text-slate-600 text-center py-10 uppercase leading-relaxed">
                Upload a video<br />to see live detections
              </div>
            )}
          </div>

          {/* Neural Analytics */}
          <div className="p-5 flex-1">
            <h3 className="font-orbitron text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Neural Analytics</h3>

            {phase === "complete" && report ? (
              <div className="space-y-4">
                {/* Threat score */}
                <div>
                  <div className="flex justify-between text-[10px] font-mono mb-2 uppercase">
                    <span className="text-slate-500">Threat Score</span>
                    <span className={`font-bold ${threatColor(report.threat_level)}`}>{report.threat_score}/100</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-1">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${report.threat_score}%` }}
                      transition={{ duration: 1.2, ease: "easeOut" }}
                      className={`h-full rounded-full ${threatBarColor(report.threat_score)}`}
                    />
                  </div>
                  <div className={`text-[9px] font-orbitron uppercase tracking-widest ${threatColor(report.threat_level)}`}>
                    {report.threat_level}
                  </div>
                </div>

                {/* Detected entities */}
                {report.detected_entities.map(ent => {
                  const Icon = ENTITY_ICONS[ent.label] ?? Eye;
                  return (
                    <div key={ent.label}>
                      <div className="flex justify-between text-[10px] font-mono mb-1.5 uppercase">
                        <span className="flex items-center gap-1.5 text-slate-500">
                          <Icon size={11} /> {ent.label} <span className="text-slate-600">×{ent.count}</span>
                        </span>
                        <span className="text-slate-400">{Math.round(ent.max_confidence * 100)}%</span>
                      </div>
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.round(ent.max_confidence * 100)}%` }}
                          transition={{ duration: 0.9 }}
                          className="h-full bg-teal-400 shadow-[0_0_6px_rgba(20,184,166,0.4)] rounded-full"
                        />
                      </div>
                    </div>
                  );
                })}

                {/* Stats grid */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <StatBox label="Frames" value={report.processed_frames.toString()} />
                  <StatBox label="Anomalies" value={report.movement_anomalies.length.toString()} />
                  <StatBox label="Duration" value={`${report.duration_seconds.toFixed(1)}s`} />
                  <StatBox label="FPS" value={Math.round(report.fps).toString()} />
                </div>

                {/* Threat assessment box */}
                <div className="pt-3 border-t border-white/5">
                  <div className={`p-3 border rounded ${report.threat_score >= 60 ? "bg-crimson/5 border-crimson/20" : "bg-teal-400/5 border-teal-400/20"}`}>
                    <div className={`flex items-center gap-2 mb-2 font-orbitron text-[10px] font-bold uppercase tracking-widest ${report.threat_score >= 60 ? "text-crimson" : "text-teal-400"}`}>
                      <ShieldAlert size={14} />
                      {report.threat_score >= 80 ? "Active Threat" : report.threat_score >= 35 ? "Elevated Risk" : "Scene Clear"}
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono leading-relaxed">
                      {report.reasoning_engine.narration[0] ?? "Analysis complete. Review detection timeline for forensic intelligence."}
                    </p>
                  </div>
                </div>

                {/* Movement anomalies */}
                {report.movement_anomalies.length > 0 && (
                  <div className="pt-2 border-t border-white/5">
                    <div className="text-[9px] font-orbitron text-slate-500 uppercase tracking-widest mb-2">
                      Movement Anomalies ({report.movement_anomalies.length})
                    </div>
                    <div className="space-y-1.5">
                      {report.movement_anomalies.slice(0, 4).map((a, i) => (
                        <div key={i} className="flex items-start gap-2 text-[9px]">
                          <TrendingUp size={10} className="text-amber-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <div className="font-mono text-slate-400 uppercase">{a.type.replace(/_/g, " ")}</div>
                            <div className="text-slate-600">{a.timestamp} · {Math.round(a.confidence * 100)}%</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : phase === "analyzing" ? (
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-[10px] font-mono text-slate-500 mb-2 uppercase">
                    <span>Pipeline Progress</span>
                    <span className="text-teal-400">{progress}%</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      animate={{ width: `${progress}%` }}
                      className="h-full bg-gradient-to-r from-teal-500 to-crimson rounded-full"
                    />
                  </div>
                  <div className="text-[9px] font-mono text-slate-600 uppercase mt-2 leading-relaxed">{stageLabel}</div>
                </div>
                <div className="text-[10px] font-mono text-slate-600 uppercase leading-relaxed">
                  YOLOv8 scanning every 3rd frame for forensic-class objects: person, car, motorcycle, truck, handbag, cellphone
                </div>
              </div>
            ) : (
              <div className="text-[10px] font-mono text-slate-600 text-center py-10 uppercase leading-relaxed">
                Upload an incident video<br />to activate neural analytics
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ icon: Icon, label, color = "text-slate-300" }: { icon: any; label: string; color?: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-black/70 border border-white/10 rounded-full">
      <Icon size={11} className={color} />
      <span className={`font-mono text-[10px] uppercase tracking-widest ${color}`}>{label}</span>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-black/30 border border-white/5 p-2.5 text-center rounded">
      <div className="text-[8px] font-orbitron text-slate-500 uppercase tracking-tighter mb-1">{label}</div>
      <div className="text-xs font-mono font-bold text-slate-300">{value}</div>
    </div>
  );
}

function MetaBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-black/30 border border-white/5 p-2 rounded">
      <div className="text-[8px] font-orbitron text-slate-600 uppercase tracking-tighter mb-1">{label}</div>
      <div className="text-[10px] font-mono text-slate-300 truncate">{value}</div>
    </div>
  );
}
