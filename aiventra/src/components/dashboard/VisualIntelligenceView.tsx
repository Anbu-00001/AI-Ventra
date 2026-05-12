"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, Upload, ShieldAlert, Activity, Scan, Target,
  CheckCircle, AlertTriangle, Cpu, Users, Car, Smartphone,
  ChevronRight, RefreshCw, Zap, Eye, TrendingUp,
} from "lucide-react";
import { uploadVideoForAnalysis, createVideoAnalysisWS } from "@/lib/api";
import type { VideoAnalysisReport } from "@/lib/api";

type Phase = "idle" | "analyzing" | "complete" | "error";

interface WsMsg {
  type: string;
  stage?: string;
  progress?: number;
  detail?: string;
  video_width?: number;
  video_height?: number;
  detections?: Array<{ label: string; confidence: number; bbox?: { x1: number; y1: number; x2: number; y2: number } }>;
  behavior?: { class: string; confidence: number; threat_tier: string };
  report?: VideoAnalysisReport;
}

interface MlAnalysis {
  dominant_class: string;
  dominant_confidence: number;
  class_distribution: Record<string, { count: number; pct: number }>;
  frames_classified: number;
}

interface LiveEvent { label: string; conf: number; ts: string; }

interface LiveBox { label: string; confidence: number; x: number; y: number; w: number; h: number; }

const STAGE_LABELS: Record<string, string> = {
  video_loaded:    "Video Loaded — Initializing YOLOv8n + ML Classifier",
  yolo_motion_scan:"YOLOv8 + ML Behavioral Scan — Optical Flow Analysis",
  yolo_ml_scan:    "YOLOv8 + ML Behavioral Scan — Optical Flow Analysis",
  anomaly_fusion:  "Forensic Anomaly Fusion Engine",
  overlay_render:  "Rendering Tactical HUD Overlay",
  complete:        "Intelligence Analysis Complete",
};

const TIER_COLOR: Record<string, string> = {
  HIGH:    "text-white border-red-500/40 bg-red-500/20",
  MEDIUM:  "text-white border-orange-500/40 bg-orange-500/20",
  LOW:     "text-white border-teal-400/40 bg-teal-400/20",
  UNKNOWN: "text-white border-slate-500/40 bg-slate-500/20",
};

const TIER_BAR: Record<string, string> = {
  HIGH:    "bg-red-500",
  MEDIUM:  "bg-orange-400",
  LOW:     "bg-teal-400",
  UNKNOWN: "bg-slate-500",
};

const ENTITY_ICONS: Record<string, React.ElementType> = {
  person: Users, car: Car, motorcycle: Zap, truck: Car,
  cellphone: Smartphone, handbag: Target,
};

const BOX_COLORS: Record<string, string> = {
  person:    "border-red-500 text-red-500 bg-red-500",
  car:       "border-teal-400 text-teal-400 bg-teal-400",
  truck:     "border-teal-300 text-teal-300 bg-teal-300",
  motorcycle:"border-cyan-400 text-cyan-400 bg-cyan-400",
  cellphone: "border-amber-400 text-amber-400 bg-amber-400",
  handbag:   "border-orange-400 text-orange-400 bg-orange-400",
};

function fmtStage(k: string) { return STAGE_LABELS[k] ?? k.replace(/_/g, " ").toUpperCase(); }
function fmtSize(b: number) { return b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${(b / 1e3).toFixed(0)} KB`; }
function sevBadge(s: string) {
  if (s === "CRITICAL") return "bg-red-500/20 text-red-500 border-red-500/30";
  if (s === "HIGH")     return "bg-orange-500/20 text-orange-500 border-orange-500/30";
  if (s === "ELEVATED") return "bg-amber-500/20 text-amber-500 border-amber-500/30";
  return "bg-teal-400/20 text-teal-400 border-teal-400/30";
}
function threatColor(s: string) {
  if (s === "CRITICAL") return "text-red-500";
  if (s === "HIGH")     return "text-orange-500";
  if (s === "ELEVATED") return "text-amber-500";
  return "text-teal-400";
}

export default function VisualIntelligenceView() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState(0);
  const [stageLabel, setStageLabel] = useState("");
  const [stageDetail, setStageDetail] = useState("");
  const [report, setReport] = useState<VideoAnalysisReport | null>(null);
  const [liveDetections, setLiveDetections] = useState<Array<{ label: string; confidence: number }>>([]);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [liveBoxes, setLiveBoxes] = useState<LiveBox[]>([]);
  const [videoDims, setVideoDims] = useState<{ w: number; h: number } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [activeSnapshot, setActiveSnapshot] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [glitch, setGlitch] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const [scanLine, setScanLine] = useState(0);
  const [liveBehavior, setLiveBehavior] = useState<{ class: string; confidence: number; threat_tier: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reportRef = useRef<VideoAnalysisReport | null>(null);

  // Glitch effect
  useEffect(() => {
    const id = setInterval(() => { setGlitch(true); setTimeout(() => setGlitch(false), 120); }, 5000);
    return () => clearInterval(id);
  }, []);

  // Animated scan line during analysis
  useEffect(() => {
    if (phase !== "analyzing") return;
    const id = setInterval(() => setScanLine(p => (p + 2) % 100), 30);
    return () => clearInterval(id);
  }, [phase]);

  // Rotate through snapshots in complete view
  useEffect(() => {
    if (phase !== "complete" || !report?.snapshots.length) return;
    const id = setInterval(() => {
      setActiveSnapshot(p => (p + 1) % Math.min(report.snapshots.length, 8));
    }, 3000);
    return () => clearInterval(id);
  }, [phase, report?.snapshots.length]);

  useEffect(() => () => { wsRef.current?.close(); }, []);

  const startAnalysis = useCallback(async (file: File) => {
    setSelectedFile(file);
    setPhase("analyzing");
    setProgress(2);
    setStageLabel("Connecting to AIVENTRA Neural Core...");
    setStageDetail("");
    setLiveDetections([]);
    setLiveEvents([]);
    setLiveBoxes([]);
    setVideoDims(null);
    setLiveBehavior(null);
    reportRef.current = null;
    setVideoError(false);

    // WebSocket for real-time YOLO events
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
            if (msg.video_width && msg.video_height) {
              setVideoDims({ w: msg.video_width, h: msg.video_height });
            }
            if (msg.behavior?.class && msg.behavior.class !== "Unknown") {
              setLiveBehavior(msg.behavior);
            }
            if (msg.detections?.length) {
              setLiveDetections(msg.detections);
              // Use real YOLO bbox coords (convert pixel→percent using video dimensions)
              const dims = msg.video_width && msg.video_height
                ? { w: msg.video_width, h: msg.video_height }
                : null;
              const boxes: LiveBox[] = msg.detections.slice(0, 8).map((d, i) => {
                if (d.bbox && dims) {
                  return {
                    label: d.label,
                    confidence: d.confidence,
                    x: (d.bbox.x1 / dims.w) * 100,
                    y: (d.bbox.y1 / dims.h) * 100,
                    w: ((d.bbox.x2 - d.bbox.x1) / dims.w) * 100,
                    h: ((d.bbox.y2 - d.bbox.y1) / dims.h) * 100,
                  };
                }
                // Fallback: deterministic position from label if no bbox
                const seed = (d.label.charCodeAt(0) + i * 31) % 100;
                return {
                  label: d.label,
                  confidence: d.confidence,
                  x: 5 + (seed * 7) % 55,
                  y: 10 + (seed * 11) % 45,
                  w: 12 + (seed * 3) % 22,
                  h: 18 + (seed * 5) % 28,
                };
              });
              setLiveBoxes(boxes);
              const newEvts: LiveEvent[] = msg.detections.slice(0, 3).map(d => ({
                label: d.label,
                conf: Math.round(d.confidence * 100),
                ts: new Date().toLocaleTimeString("en-US", { hour12: false }),
              }));
              setLiveEvents(prev => [...newEvts, ...prev].slice(0, 18));
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

    // POST video
    try {
      setStageLabel("Uploading to AIVENTRA pipeline...");
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
    setLiveBoxes([]);
    setVideoDims(null);
    setLiveBehavior(null);
    setVideoError(false);
    setActiveSnapshot(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const currentSnapshot = report?.snapshots[activeSnapshot] ?? null;

  return (
    <div className="flex flex-col h-full bg-[#05070b] text-slate-200 font-sans overflow-hidden">
      {/* Header */}
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
        <div className="flex items-center gap-3">
          {phase === "complete" && (
            <div className="px-3 py-1 bg-teal-400/10 border border-teal-400/30 rounded text-[10px] font-mono text-teal-400">✓ YOLO + ML ANALYSIS COMPLETE</div>
          )}
          {phase === "analyzing" && (
            <div className="px-3 py-1 bg-crimson/10 border border-crimson/30 rounded text-[10px] font-mono text-crimson animate-pulse">◉ YOLO + ML SCANNING — {progress}%</div>
          )}
          {phase === "idle" && (
            <div className="px-3 py-1 bg-white/5 border border-white/10 rounded text-[10px] font-mono text-slate-500">STANDBY — AWAITING VIDEO</div>
          )}
          {(phase === "complete" || phase === "error") && (
            <button onClick={reset} className="flex items-center gap-1.5 text-slate-500 hover:text-white transition px-3 py-1 border border-white/10 rounded">
              <RefreshCw size={13} /> <span className="text-[10px] font-mono uppercase">New Analysis</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_320px] overflow-hidden min-h-0">
        {/* Main */}
        <div className="overflow-y-auto custom-scrollbar flex flex-col gap-4 p-5">

          {/* ══ IDLE ══ */}
          {phase === "idle" && (
            <div
              className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-14 text-center cursor-pointer transition-all duration-200 ${isDragging ? "border-crimson/70 bg-crimson/5 scale-[1.01]" : "border-white/10 hover:border-white/25 bg-black/20"}`}
              style={{ minHeight: "420px" }}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input ref={fileInputRef} type="file" className="hidden"
                accept="video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,video/webm,.mp4,.mov,.avi,.mkv,.webm"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) startAnalysis(f); }}
              />
              <motion.div animate={{ scale: isDragging ? 1.12 : 1, rotate: isDragging ? 4 : 0 }} className="mb-6">
                <div className="w-28 h-28 rounded-full border-2 border-white/10 bg-white/5 flex items-center justify-center mx-auto relative">
                  <Upload size={46} className={isDragging ? "text-crimson" : "text-slate-500"} />
                  <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-teal-400/20 border border-teal-400/40 flex items-center justify-center">
                    <Scan size={12} className="text-teal-400" />
                  </div>
                </div>
              </motion.div>
              <div className="font-orbitron text-2xl text-slate-200 uppercase tracking-widest mb-3">Upload Incident Video</div>
              <div className="text-sm text-slate-400 mb-2 max-w-lg leading-relaxed">
                Upload a CCTV / dashcam / incident video — AIVENTRA will run <span className="text-teal-400">YOLOv8</span> on every frame, draw <span className="text-red-400">bounding boxes</span> around suspects &amp; vehicles, classify behavior with a <span className="text-amber-400">MobileNetV2 forensic ML model</span>, detect motion anomalies, and produce a full forensic report.
              </div>
              <div className="text-[10px] font-mono text-slate-600 uppercase tracking-widest mb-8">MP4 · MOV · AVI · MKV · WEBM</div>
              <div className="flex flex-wrap items-center justify-center gap-6 text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                <span className="flex items-center gap-2"><Scan size={14} className="text-teal-400" /> YOLOv8 Object Detection</span>
                <span className="flex items-center gap-2"><Activity size={14} className="text-teal-400" /> Optical Flow Motion</span>
                <span className="flex items-center gap-2"><Cpu size={14} className="text-amber-400" /> MobileNetV2 ML Classifier</span>
                <span className="flex items-center gap-2"><Eye size={14} className="text-teal-400" /> Bounding Box Overlay</span>
              </div>
            </div>
          )}

          {/* ══ ANALYZING ══ */}
          {phase === "analyzing" && (
            <div className="flex flex-col gap-4">
              {/* Live CCTV viewport with scan animation + bounding boxes */}
              <div className={`relative border border-crimson/30 rounded-xl bg-black overflow-hidden ${glitch ? "opacity-92" : ""}`} style={{ minHeight: "340px" }}>
                {/* Scanlines */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="absolute left-0 right-0 h-px"
                      style={{ top: `${i * 12.5}%`, background: "rgba(20,184,166,0.06)" }} />
                  ))}
                  {/* Moving scan line */}
                  <div className="absolute left-0 right-0 h-0.5 bg-teal-400/30 shadow-[0_0_12px_rgba(20,184,166,0.6)]"
                    style={{ top: `${scanLine}%`, transition: "top 30ms linear" }} />
                </div>

                {/* Corner accents */}
                <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-crimson/60 z-30" />
                <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-crimson/60 z-30" />
                <div className="absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 border-teal-400/40 z-30" />
                <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-teal-400/40 z-30" />

                {/* HUD top bar */}
                <div className="absolute top-0 left-0 right-0 bg-black/80 border-b border-white/5 px-4 py-2 flex items-center justify-between z-30">
                  <div className="flex items-center gap-2 font-mono text-xs text-teal-400">
                    <div className="w-2 h-2 rounded-full bg-crimson animate-pulse" />
                    FEED_ID: {selectedFile?.name.slice(0, 30)}
                  </div>
                  <div className="font-mono text-xs text-crimson">SCANNING {progress}%</div>
                </div>

                {/* Dark CCTV noise background */}
                <div className="absolute inset-0 bg-[#080c14]" style={{
                  backgroundImage: "radial-gradient(rgba(255,255,255,0.015) 1px, transparent 1px)",
                  backgroundSize: "20px 20px",
                }} />

                {/* Animated detection boxes (simulated from WS data) */}
                <div className="absolute inset-0 z-10" style={{ top: "36px" }}>
                  <AnimatePresence>
                    {liveBoxes.map((box, i) => {
                      const colorClass = BOX_COLORS[box.label] ?? "border-white text-white bg-white";
                      const [borderC, textC, bgC] = colorClass.split(" ");
                      return (
                        <motion.div
                          key={`${box.label}-${i}`}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className={`absolute border-2 ${borderC}`}
                          style={{
                            left: `${box.x}%`, top: `${box.y}%`,
                            width: `${box.w}%`, height: `${box.h}%`,
                          }}
                        >
                          {/* Label tag */}
                          <div className={`absolute -top-6 left-0 ${bgC} px-1.5 py-0.5 text-[9px] font-bold font-mono text-black whitespace-nowrap`}>
                            {box.label.toUpperCase()} {Math.round(box.confidence * 100)}%
                          </div>
                          {/* Corner dots */}
                          <div className={`absolute -top-1 -left-1 w-2 h-2 rounded-full ${bgC}`} />
                          <div className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${bgC}`} />
                          <div className={`absolute -bottom-1 -left-1 w-2 h-2 rounded-full ${bgC}`} />
                          <div className={`absolute -bottom-1 -right-1 w-2 h-2 rounded-full ${bgC}`} />
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>

                {/* Center label when no boxes yet */}
                {liveBoxes.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center z-10" style={{ top: "36px" }}>
                    <div className="text-center">
                      <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, repeat: Infinity }}>
                        <Scan size={48} className="mx-auto text-teal-400/30 mb-3" />
                      </motion.div>
                      <div className="font-orbitron text-sm text-slate-600 uppercase tracking-widest">
                        YOLOv8 Initializing...
                      </div>
                    </div>
                  </div>
                )}

                {/* Bottom status */}
                <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between z-30">
                  <div className="flex gap-2 flex-wrap">
                    <StatusBadge icon={Scan} label="YOLO Active" color="text-teal-400" />
                    <StatusBadge icon={Activity} label={`${liveDetections.length} Objects`} color="text-amber-400" />
                    {liveBehavior && (
                      <StatusBadge icon={Cpu} label={`ML: ${liveBehavior.class.toUpperCase()} ${Math.round(liveBehavior.confidence * 100)}%`}
                        color={liveBehavior.threat_tier === "HIGH" ? "text-red-400" : liveBehavior.threat_tier === "MEDIUM" ? "text-orange-400" : "text-teal-400"} />
                    )}
                  </div>
                  <div className="font-mono text-[9px] text-slate-600 uppercase">{stageLabel}</div>
                </div>
              </div>

              {/* Progress panel */}
              <div className="bg-black/40 rounded-xl border border-white/5 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="font-orbitron text-xs text-slate-300 uppercase tracking-widest">YOLOv8 Pipeline Progress</div>
                  <div className="font-mono text-xl font-bold text-crimson">{progress}%</div>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-3">
                  <motion.div className="h-full bg-gradient-to-r from-teal-500 via-teal-400 to-crimson rounded-full"
                    animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
                </div>
                {stageDetail && <div className="text-[9px] font-mono text-slate-500 mb-4">{stageDetail}</div>}
                <div className="flex gap-3">
                  {[
                    { label: "YOLOv8", threshold: 8 },
                    { label: "Motion", threshold: 25 },
                    { label: "Anomaly", threshold: 68 },
                    { label: "RAG+LLM", threshold: 82 },
                    { label: "Overlay", threshold: 95 },
                  ].map(s => (
                    <div key={s.label} className="flex-1 flex flex-col items-center gap-1.5">
                      <div className={`w-full h-8 rounded border flex items-center justify-center text-[9px] font-orbitron transition-all duration-700 ${progress >= s.threshold ? "border-teal-400/60 bg-teal-400/10 text-teal-400" : "border-white/5 text-slate-700 bg-white/[0.02]"}`}>
                        {progress >= s.threshold ? "✓" : "…"}
                      </div>
                      <div className="text-[8px] font-mono text-slate-600 uppercase text-center">{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live detection feed */}
              {liveEvents.length > 0 && (
                <div className="bg-black/40 rounded-xl border border-white/5 p-4">
                  <div className="flex items-center gap-2 font-orbitron text-[10px] text-slate-400 uppercase tracking-widest mb-3">
                    <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                    Live YOLO Detection Feed
                    <span className="ml-auto text-slate-600">{liveEvents.length} events</span>
                  </div>
                  <div className="space-y-1.5 max-h-44 overflow-y-auto custom-scrollbar">
                    {liveEvents.map((ev, i) => {
                      const col = ev.label === "person" ? "text-red-400" : ev.label.startsWith("c") ? "text-teal-400" : "text-amber-400";
                      return (
                        <div key={i} className="flex items-center gap-4 text-[9px] font-mono py-0.5">
                          <span className="text-slate-600 w-16 flex-shrink-0">{ev.ts}</span>
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${ev.label === "person" ? "bg-red-500" : "bg-teal-400"}`} />
                          <span className={`uppercase flex-shrink-0 w-20 font-bold ${col}`}>{ev.label}</span>
                          <span className="text-slate-500">{ev.conf}% confidence</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ COMPLETE ══ */}
          {phase === "complete" && report && (
            <div className="flex flex-col gap-4">
              {/* Primary CCTV feed — rotates through annotated YOLO snapshots */}
              <div className={`relative border border-white/10 rounded-xl bg-black overflow-hidden ${glitch ? "opacity-95" : ""}`} style={{ minHeight: "360px" }}>
                {/* Corner accents */}
                <div className="absolute top-0 left-0 w-10 h-10 border-t-2 border-l-2 border-teal-400/40 z-20" />
                <div className="absolute top-0 right-0 w-10 h-10 border-t-2 border-r-2 border-teal-400/40 z-20" />
                <div className="absolute bottom-0 left-0 w-10 h-10 border-b-2 border-l-2 border-teal-400/40 z-20" />
                <div className="absolute bottom-0 right-0 w-10 h-10 border-b-2 border-r-2 border-teal-400/40 z-20" />

                {/* Scanlines overlay */}
                <div className="absolute inset-0 pointer-events-none z-10" style={{
                  backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,0,0,0.04) 3px, rgba(0,0,0,0.04) 4px)",
                }} />

                {/* HUD top */}
                <div className="absolute top-0 left-0 right-0 bg-black/70 border-b border-white/5 px-4 py-2 flex items-center justify-between z-20">
                  <div className="font-mono text-xs text-teal-400">FEED_ID: AIVENTRA-YOLO-PROCESSED</div>
                  <div className="font-mono text-xs text-crimson">{report.duration_seconds.toFixed(1)}s · {Math.round(report.fps)}fps · {report.frame_count} frames</div>
                </div>

                {/* Processed video — with YOLO HUD drawn by OpenCV */}
                {report.processed_video_url && !videoError && (
                  <video className="w-full object-contain bg-black" style={{ maxHeight: "420px", paddingTop: "36px" }}
                    controls autoPlay loop muted src={report.processed_video_url}
                    onError={() => setVideoError(true)} />
                )}

                {/* Snapshot carousel when video fails or no URL — these have YOLO boxes drawn on them */}
                {(videoError || !report.processed_video_url) && currentSnapshot && (
                  <AnimatePresence mode="wait">
                    <motion.div key={activeSnapshot} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      transition={{ duration: 0.4 }} className="w-full" style={{ paddingTop: "36px" }}>
                      <img src={currentSnapshot} className="w-full object-contain bg-black" style={{ maxHeight: "420px" }}
                        alt="YOLO detection frame" />
                    </motion.div>
                  </AnimatePresence>
                )}

                {/* Bottom status */}
                <div className="absolute bottom-3 left-4 flex gap-2 z-20">
                  <StatusBadge icon={Scan} label="YOLO Active" />
                  <StatusBadge icon={Activity} label="Motion Analyzed" />
                  <StatusBadge icon={CheckCircle} label="Report Ready" color="text-teal-400" />
                </div>
                {report.snapshots.length > 0 && (videoError || !report.processed_video_url) && (
                  <div className="absolute bottom-3 right-4 flex gap-1 z-20">
                    {report.snapshots.slice(0, 8).map((_, i) => (
                      <button key={i} onClick={() => setActiveSnapshot(i)}
                        className={`w-2 h-2 rounded-full transition-all ${i === activeSnapshot ? "bg-teal-400" : "bg-white/20 hover:bg-white/40"}`} />
                    ))}
                  </div>
                )}
              </div>

              {/* Confidence Waveform */}
              {report.confidence_waveform.length > 0 && (
                <div className="bg-black/40 rounded-xl border border-white/5 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-orbitron text-[10px] text-slate-400 uppercase tracking-widest">Motion / Confidence Waveform</div>
                    <div className="text-[9px] font-mono text-slate-600 uppercase">{report.processed_frames} frames · {report.duration_seconds.toFixed(1)}s</div>
                  </div>
                  <div className="h-16 flex items-end gap-0.5">
                    {report.confidence_waveform.slice(0, 160).map((v, i) => (
                      <div key={i} className="flex-1 rounded-t" style={{
                        height: `${Math.max(4, v * 100)}%`,
                        background: v > 0.7 ? "rgba(239,68,68,0.75)" : v > 0.4 ? "rgba(245,158,11,0.65)" : "rgba(20,184,166,0.5)",
                      }} />
                    ))}
                  </div>
                  <div className="flex justify-between text-[8px] font-mono text-slate-600 mt-1.5">
                    <span>00:00:00</span>
                    <span className="flex items-center gap-3">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block bg-teal-400/60" />Normal</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block bg-amber-500/60" />Elevated</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm inline-block bg-red-500/60" />Anomaly</span>
                    </span>
                    <span>{report.duration_seconds.toFixed(0)}s</span>
                  </div>
                </div>
              )}

              {/* ML Behavioral Classification */}
              {(() => {
                const ml = report.meta?.ml_analysis as MlAnalysis | undefined;
                if (!ml?.dominant_class) return null;
                const tierCls = TIER_COLOR[ml.dominant_class in { Abuse:1,Assault:1,Shooting:1,Robbery:1,Fighting:1 } ? "HIGH" : ml.dominant_class in { Burglary:1,Arrest:1,Explosion:1 } ? "MEDIUM" : "LOW"] ?? TIER_COLOR.LOW;
                const tier = ml.dominant_class in { Abuse:1,Assault:1,Shooting:1,Robbery:1,Fighting:1 } ? "HIGH" : ml.dominant_class in { Burglary:1,Arrest:1,Explosion:1 } ? "MEDIUM" : "LOW";
                const dist = ml.class_distribution ?? {};
                const classes = Object.entries(dist).sort((a, b) => b[1].pct - a[1].pct);
                return (
                  <div className="bg-black/40 rounded-xl border border-white/5 p-4">
                    <div className="flex items-center gap-2 font-orbitron text-[10px] text-slate-400 uppercase tracking-widest mb-4">
                      <Cpu size={12} />
                      ML Behavioral Classification
                      <span className="ml-auto text-[8px] font-mono text-slate-600">{ml.frames_classified} frames classified</span>
                    </div>
                    {/* Dominant class hero badge */}
                    <div className={`flex items-center justify-between p-4 rounded-xl border mb-4 ${tierCls} shadow-[inset_0_0_20px_rgba(0,0,0,0.2)]`}>
                      <div>
                        <div className="text-[9px] font-mono uppercase tracking-[0.2em] text-white/60 mb-1">Dominant Activity</div>
                        <div className="font-orbitron text-2xl font-bold uppercase tracking-[0.1em] text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">{ml.dominant_class}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-3xl font-bold text-white tabular-nums">{Math.round(ml.dominant_confidence * 100)}%</div>
                        <div className={`text-[10px] font-bold uppercase tracking-[0.15em] px-3 py-1 rounded-full border mt-2 inline-block ${tierCls.replace('text-white', 'text-white')}`}>{tier} THREAT</div>
                      </div>
                    </div>
                    {/* Class distribution bars */}
                    <div className="space-y-2">
                      {classes.map(([cls, info]) => {
                        const clsTier = cls in { Abuse:1,Assault:1,Shooting:1,Robbery:1,Fighting:1 } ? "HIGH" : cls in { Burglary:1,Arrest:1,Explosion:1 } ? "MEDIUM" : "LOW";
                        const barColor = TIER_BAR[clsTier];
                        return (
                          <div key={cls}>
                            <div className="flex justify-between text-[9px] font-mono mb-0.5">
                              <span className="text-slate-400 uppercase">{cls}</span>
                              <span className="text-slate-500">{info.pct}%</span>
                            </div>
                            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                              <motion.div initial={{ width: 0 }}
                                animate={{ width: `${info.pct}%` }}
                                transition={{ duration: 0.8, delay: classes.findIndex(([c]) => c === cls) * 0.05 }}
                                className={`h-full rounded-full ${barColor} opacity-70`} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Snapshots grid — these now have YOLO bounding boxes drawn by OpenCV */}
              {report.snapshots.length > 0 && (
                <div className="bg-black/40 rounded-xl border border-white/5 p-4">
                  <div className="font-orbitron text-[10px] text-slate-400 uppercase tracking-widest mb-3">
                    YOLO Detection Keyframes — {report.snapshots.length} captured with bounding boxes
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {report.snapshots.slice(0, 8).map((snap, i) => (
                      <div key={i} onClick={() => { setActiveSnapshot(i); setVideoError(true); }}
                        className={`relative cursor-pointer border rounded overflow-hidden transition-all group ${activeSnapshot === i && videoError ? "border-teal-400/60 ring-1 ring-teal-400/30" : "border-white/5 hover:border-white/20"}`}
                        style={{ aspectRatio: "16/9" }}>
                        <img src={snap} className="w-full h-full object-cover" alt={`YOLO frame ${i + 1}`} />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all" />
                        <div className="absolute bottom-1 left-1 text-[7px] font-mono text-teal-400 bg-black/75 px-1 rounded">KF-{String(i + 1).padStart(2, "0")}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Forensic Event Timeline */}
              {report.event_timeline.length > 0 && (
                <div className="bg-black/40 rounded-xl border border-white/5 p-4">
                  <div className="font-orbitron text-[10px] text-slate-400 uppercase tracking-widest mb-3">
                    Forensic Event Timeline — {report.event_timeline.length} events
                  </div>
                  <div className="space-y-2">
                    {report.event_timeline.slice(0, 10).map((ev) => (
                      <div key={ev.id} className="flex items-start gap-3 p-2.5 bg-white/[0.02] rounded border border-white/5">
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 mt-0.5 ${sevBadge(ev.severity)}`}>{ev.severity}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-[11px] font-bold text-slate-200">{ev.event}</div>
                            <div className="text-[8px] font-mono text-slate-500 flex-shrink-0">{ev.timestamp}</div>
                          </div>
                          {ev.evidence[0] && <div className="text-[9px] text-slate-400 mt-0.5 leading-relaxed">{ev.evidence[0]}</div>}
                          {ev.evidence[1] && <div className="text-[8px] font-mono text-slate-600 mt-0.5">{ev.evidence[1]}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reasoning */}
              {report.reasoning_engine.reasoning.length > 0 && (
                <div className="bg-black/40 rounded-xl border border-white/5 p-4">
                  <div className="flex items-center gap-2 font-orbitron text-[10px] text-slate-400 uppercase tracking-widest mb-3">
                    <Cpu size={12} />
                    Forensic Reasoning Engine
                    <div className="ml-auto flex gap-2">
                      {report.reasoning_engine.ollama_used
                        ? <span className="text-[8px] text-teal-400 border border-teal-400/30 bg-teal-400/5 px-1.5 py-0.5 rounded">OLLAMA LLM</span>
                        : <span className="text-[8px] text-amber-400 border border-amber-400/30 bg-amber-400/5 px-1.5 py-0.5 rounded">RAG FALLBACK</span>}
                      {report.reasoning_engine.rag_context.length > 0 &&
                        <span className="text-[8px] text-teal-400/70 border border-teal-400/20 px-1.5 py-0.5 rounded">RAG ✓</span>}
                    </div>
                  </div>
                  <div className="space-y-2">
                    {report.reasoning_engine.reasoning.map((r, i) => (
                      <div key={i} className="flex items-start gap-2 text-[10px] text-slate-400 leading-relaxed">
                        <ChevronRight size={12} className="text-teal-400 flex-shrink-0 mt-0.5" />
                        {r}
                      </div>
                    ))}
                  </div>
                  {report.reasoning_engine.narration.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-white/5">
                      <div className="text-[9px] font-orbitron text-slate-500 uppercase tracking-widest mb-2">AI Narration</div>
                      {report.reasoning_engine.narration.map((n, i) => (
                        <p key={i} className="text-[10px] text-slate-400 italic leading-relaxed mb-1">{n}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
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

        {/* Sidebar */}
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
                      {ev.evidence[1] ?? ev.evidence[0]?.slice(0, 60) ?? ev.category} · {Math.round(ev.confidence * 100)}%
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
                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded border bg-teal-400/20 text-teal-400 border-teal-400/30">LIVE</span>
                    </div>
                    <div className={`font-orbitron text-[10px] uppercase font-bold ${ev.label === "person" ? "text-red-400" : "text-teal-400"}`}>{ev.label}</div>
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
                {/* Threat Score */}
                <div>
                  <div className="flex justify-between text-[10px] font-mono mb-2 uppercase">
                    <span className="text-slate-500">Threat Score</span>
                    <span className={`font-bold ${threatColor(report.threat_level)}`}>{report.threat_score}/100</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden mb-1">
                    <motion.div initial={{ width: 0 }}
                      animate={{ width: `${report.threat_score}%` }}
                      transition={{ duration: 1.2, ease: "easeOut" }}
                      className={`h-full rounded-full ${report.threat_score >= 80 ? "bg-red-500 shadow-[0_0_10px_#ef4444]" : report.threat_score >= 60 ? "bg-orange-500" : report.threat_score >= 35 ? "bg-amber-500" : "bg-teal-400"}`} />
                  </div>
                  <div className={`text-[10px] font-orbitron uppercase tracking-widest font-bold ${threatColor(report.threat_level)}`}>{report.threat_level}</div>
                </div>

                {/* Detected entities with confidence bars */}
                {report.detected_entities.map(ent => {
                  const Icon = ENTITY_ICONS[ent.label] ?? Eye;
                  const isPersonOrVehicle = ["person", "car", "truck", "motorcycle"].includes(ent.label);
                  return (
                    <div key={ent.label}>
                      <div className="flex justify-between text-[10px] font-mono mb-1.5 uppercase">
                        <span className={`flex items-center gap-1.5 ${isPersonOrVehicle ? "text-slate-300" : "text-slate-500"}`}>
                          <Icon size={11} /> {ent.label} <span className="text-slate-600">×{ent.count}</span>
                        </span>
                        <span className="text-slate-400">{Math.round(ent.max_confidence * 100)}%</span>
                      </div>
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <motion.div initial={{ width: 0 }}
                          animate={{ width: `${Math.round(ent.max_confidence * 100)}%` }}
                          transition={{ duration: 0.9 }}
                          className={`h-full rounded-full ${ent.label === "person" ? "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]" : "bg-teal-400 shadow-[0_0_6px_rgba(20,184,166,0.4)]"}`} />
                      </div>
                    </div>
                  );
                })}

                {/* ML dominant class mini badge in sidebar */}
                {(() => {
                  const ml = report.meta?.ml_analysis as MlAnalysis | undefined;
                  if (!ml?.dominant_class) return null;
                  const tier = ml.dominant_class in { Abuse:1,Assault:1,Shooting:1,Robbery:1,Fighting:1 } ? "HIGH" : ml.dominant_class in { Burglary:1,Arrest:1,Explosion:1 } ? "MEDIUM" : "LOW";
                  const tierCls = TIER_COLOR[tier];
                  return (
                    <div className={`flex items-center justify-between p-2 rounded border text-[9px] font-mono ${tierCls}`}>
                      <span className="flex items-center gap-1.5"><Cpu size={10} /> ML CLASS</span>
                      <span className="font-bold uppercase">{ml.dominant_class} {Math.round(ml.dominant_confidence * 100)}%</span>
                    </div>
                  );
                })()}

                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <StatBox label="Frames" value={report.processed_frames.toString()} />
                  <StatBox label="Anomalies" value={report.movement_anomalies.length.toString()} />
                  <StatBox label="Duration" value={`${report.duration_seconds.toFixed(1)}s`} />
                  <StatBox label="FPS" value={Math.round(report.fps).toString()} />
                  {(report.meta?.samples_per_sec as number | undefined) && (
                    <StatBox label="Samples/s" value={String(report.meta.samples_per_sec)} />
                  )}
                  {(report.meta?.total_samples as number | undefined) && (
                    <StatBox label="ML Scanned" value={String(report.meta.total_samples)} />
                  )}
                </div>

                {/* Threat assessment */}
                <div className="pt-3 border-t border-white/5">
                  <div className={`p-3 border rounded ${report.threat_score >= 60 ? "bg-crimson/5 border-crimson/20" : "bg-teal-400/5 border-teal-400/20"}`}>
                    <div className={`flex items-center gap-2 mb-2 font-orbitron text-[10px] font-bold uppercase tracking-widest ${report.threat_score >= 60 ? "text-crimson" : "text-teal-400"}`}>
                      <ShieldAlert size={14} />
                      {report.threat_score >= 80 ? "Active Threat" : report.threat_score >= 35 ? "Elevated Risk" : "Scene Assessment"}
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono leading-relaxed">
                      {report.reasoning_engine.narration[0] ?? "Analysis complete. Review detection timeline."}
                    </p>
                  </div>
                </div>

                {/* Movement anomalies */}
                {report.movement_anomalies.length > 0 && (
                  <div className="pt-2 border-t border-white/5">
                    <div className="text-[9px] font-orbitron text-slate-500 uppercase tracking-widest mb-2">
                      Movement Anomalies ({report.movement_anomalies.length})
                    </div>
                    <div className="space-y-2">
                      {report.movement_anomalies.slice(0, 5).map((a, i) => (
                        <div key={i} className="flex items-start gap-2 text-[9px]">
                          <TrendingUp size={10} className={`flex-shrink-0 mt-0.5 ${a.severity === "CRITICAL" ? "text-red-500" : a.severity === "HIGH" ? "text-orange-500" : "text-amber-500"}`} />
                          <div>
                            <div className={`font-mono uppercase font-bold ${a.severity === "CRITICAL" ? "text-red-400" : a.severity === "HIGH" ? "text-orange-400" : "text-amber-400"}`}>
                              {a.type.replace(/_/g, " ")}
                            </div>
                            <div className="text-slate-600">{a.timestamp} · {Math.round(a.confidence * 100)}% conf</div>
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
                    <motion.div animate={{ width: `${progress}%` }} className="h-full bg-gradient-to-r from-teal-500 to-crimson rounded-full" />
                  </div>
                  <div className="text-[9px] font-mono text-slate-600 uppercase mt-2">{stageLabel}</div>
                </div>
                <div className="text-[9px] font-mono text-slate-600 uppercase leading-relaxed">
                  Scanning forensic object classes:<br />
                  <span className="text-red-400">PERSON</span> · <span className="text-teal-400">CAR</span> · <span className="text-teal-400">TRUCK</span> · <span className="text-cyan-400">MOTORCYCLE</span> · HANDBAG · CELLPHONE
                </div>
                {liveBehavior && (
                  <div className={`p-2 rounded border text-[9px] font-mono ${TIER_COLOR[liveBehavior.threat_tier] ?? TIER_COLOR.UNKNOWN}`}>
                    <div className="text-[7px] uppercase tracking-widest opacity-60 mb-0.5">Live ML Classification</div>
                    <div className="font-bold uppercase">{liveBehavior.class} — {Math.round(liveBehavior.confidence * 100)}%</div>
                    <div className="opacity-60">{liveBehavior.threat_tier} THREAT</div>
                  </div>
                )}
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
