"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Binary,
  Camera,
  Download,
  Gauge,
  Loader2,
  Radar,
  Radio,
  Shield,
  Upload,
  Users,
  Video,
  Zap,
} from "lucide-react";
import {
  createVideoAnalysisWebSocket,
  processedVideoUrl,
  uploadVideoForAnalysis,
  type VideoAnalysisReport,
} from "@/lib/api";

type StreamEvent = {
  type?: string;
  stage?: string;
  progress?: number;
  detail?: string;
  frame?: number;
  timestamp?: string;
};

export default function VisualIntelligencePage() {
  const [file, setFile] = useState<File | null>(null);
  const [caseId, setCaseId] = useState("AIV-2041-77");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [report, setReport] = useState<VideoAnalysisReport | null>(null);
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState("");

  useEffect(() => {
    let ws: WebSocket | null = null;
    try {
      ws = createVideoAnalysisWebSocket();
      ws.onmessage = (message) => {
        const data = JSON.parse(message.data);
        setEvents((current) => [data, ...current].slice(0, 18));
        if (typeof data.progress === "number") setProgress(data.progress);
      };
    } catch {
      setEvents((current) => [{ type: "offline", detail: "Live stream unavailable" }, ...current]);
    }
    return () => ws?.close();
  }, []);

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }
    const nextUrl = URL.createObjectURL(file);
    setPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);

  const videoSrc = useMemo(() => {
    if (!report) return "";
    return processedVideoUrl(report.analysis_id);
  }, [report]);

  async function analyze() {
    if (!file) {
      setError("Select a CCTV video first.");
      return;
    }
    setBusy(true);
    setError("");
    setProgress(4);
    setReport(null);
    setEvents((current) => [{ type: "upload", detail: `Uploading ${file.name}`, progress: 4 }, ...current]);
    try {
      const response = await uploadVideoForAnalysis(file, caseId);
      setReport(response.data);
      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Video analysis failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#030407] text-slate-100">
      <div className="fixed inset-0 pointer-events-none visual-grid opacity-80" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-[1500px] flex-col border-x border-red-500/20 bg-black/55">
        <header className="flex h-20 items-center justify-between border-b border-white/10 px-5 md:px-8">
          <div className="flex items-center gap-4">
            <button className="grid h-10 w-10 place-items-center border border-white/10 bg-white/[0.03] text-slate-400">
              <Shield size={18} />
            </button>
            <div>
              <div className="font-orbitron text-xl font-bold tracking-[0.22em]">AIVENTRA</div>
              <div className="font-mono text-[10px] uppercase tracking-[0.34em] text-slate-500">Visual Forensic Intelligence System</div>
            </div>
          </div>
          <div className="hidden items-center gap-3 font-mono text-xs uppercase tracking-[0.22em] text-red-300 md:flex">
            <Radio size={16} className="text-teal-data" />
            <span>YOLOv8 CCTV Analysis</span>
          </div>
        </header>

        <section className="grid flex-1 grid-cols-1 xl:grid-cols-[320px_1fr_360px]">
          <aside className="border-b border-white/10 p-5 xl:border-b-0 xl:border-r xl:border-white/10">
            <PanelTitle icon={<Camera size={16} />} title="Camera Intake" />
            <button
              onClick={() => inputRef.current?.click()}
              className="group relative mt-4 block aspect-[4/3] w-full overflow-hidden border border-red-400/40 bg-[#05080d] text-left hover:border-red-300"
            >
              {previewUrl ? (
                <video className="h-full w-full object-cover opacity-80" src={previewUrl} muted playsInline />
              ) : (
                <div className="absolute inset-0 visual-camera-feed">
                  <div className="absolute left-[28%] top-[24%] h-[44%] w-[38%] border border-teal-300/70 bg-teal-400/5">
                    <div className="absolute -left-1 -top-1 h-3 w-3 border-l border-t border-teal-200" />
                    <div className="absolute -right-1 -top-1 h-3 w-3 border-r border-t border-teal-200" />
                    <div className="absolute -bottom-1 -left-1 h-3 w-3 border-b border-l border-teal-200" />
                    <div className="absolute -bottom-1 -right-1 h-3 w-3 border-b border-r border-teal-200" />
                  </div>
                  <div className="absolute inset-0 grid place-items-center">
                    <Camera className="text-red-300/75" size={44} />
                  </div>
                </div>
              )}
              <div className="absolute left-3 top-3 border border-teal-400/40 bg-black/75 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-teal-200">
                CAM-UPLOAD // YOLOv8
              </div>
              <div className="absolute bottom-0 left-0 right-0 border-t border-red-500/30 bg-black/80 p-3">
                <div className="flex items-center gap-2 font-orbitron text-xs uppercase tracking-[0.2em] text-red-200">
                  <Upload size={14} />
                  {file ? "Video Armed" : "Select CCTV Video"}
                </div>
                <div className="mt-1 max-w-full truncate font-mono text-[11px] text-slate-500">
                  {file?.name ?? "MP4 / MOV / AVI / WEBM"}
                </div>
              </div>
              <div className="absolute right-3 top-3 h-2 w-2 rounded-full bg-red-500 shadow-[0_0_14px_rgba(239,68,68,0.9)]" />
            </button>
            <input
              ref={inputRef}
              hidden
              type="file"
              accept="video/mp4,video/quicktime,video/x-msvideo,video/webm,video/x-matroska"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />

            <div className="mt-3 grid grid-cols-3 gap-2">
              <CameraStatus label="Detector" value="YOLO" />
              <CameraStatus label="Mode" value="CV" />
              <CameraStatus label="Stream" value={busy ? "LIVE" : "READY"} />
            </div>

            <label className="mt-5 block font-mono text-[10px] uppercase tracking-[0.24em] text-slate-500">Case ID</label>
            <input
              value={caseId}
              onChange={(event) => setCaseId(event.target.value)}
              className="mt-2 h-11 w-full border border-white/10 bg-black/50 px-3 font-mono text-sm outline-none focus:border-red-400"
            />

            <button
              onClick={analyze}
              disabled={busy}
              className="mt-5 flex h-12 w-full items-center justify-center gap-2 bg-red-600 font-orbitron text-xs font-bold uppercase tracking-[0.22em] text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
              Run Analysis
            </button>
            {error && <div className="mt-4 border border-red-500/40 bg-red-950/30 p-3 font-mono text-xs text-red-200">{error}</div>}

            <div className="mt-8">
              <PanelTitle icon={<Activity size={16} />} title="Live Stream" />
              <div className="mt-4 space-y-2">
                {events.length === 0 && <StreamLine item={{ type: "standby", detail: "Awaiting video intelligence stream" }} />}
                {events.map((item, index) => (
                  <StreamLine key={`${item.timestamp}-${index}`} item={item} />
                ))}
              </div>
            </div>
          </aside>

          <section className="min-w-0 border-b border-white/10 p-5 xl:border-b-0">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <PanelTitle icon={<Camera size={16} />} title="Visual Intelligence" />
              <div className="flex items-center gap-3 font-mono text-xs text-slate-400">
                <span className="text-red-300">REC + ANALYZE</span>
                <span>{progress}%</span>
              </div>
            </div>

            <div className="relative overflow-hidden border border-slate-700/80 bg-[#060a10] scan-line-overlay">
              {videoSrc ? (
                <video key={videoSrc} className="aspect-video w-full bg-black object-contain" controls src={videoSrc} />
              ) : (
                <div className="grid aspect-video place-items-center">
                  <div className="text-center">
                    <Radar className="mx-auto mb-4 text-teal-data" size={48} />
                    <div className="font-orbitron text-sm uppercase tracking-[0.3em] text-slate-300">Neural Video Core Standing By</div>
                    <div className="mt-3 font-mono text-xs text-slate-600">Upload suspicious CCTV footage to generate overlay playback</div>
                  </div>
                </div>
              )}
              <div className="absolute left-4 top-4 border border-teal-400/40 bg-black/70 px-3 py-2 font-mono text-xs text-teal-200">
                FEED_ID :: FORENSIC-UPLOAD
              </div>
              <div className="absolute bottom-4 left-4 right-4 h-2 border border-white/10 bg-black/60">
                <div className="h-full bg-gradient-to-r from-teal-data via-amber to-red-500" style={{ width: `${progress}%` }} />
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Metric icon={<Gauge size={16} />} label="Threat Score" value={report ? `${report.threat_score}/100` : "--"} tone="red" />
              <Metric icon={<AlertTriangle size={16} />} label="Threat Level" value={report?.threat_level ?? "STANDBY"} tone="amber" />
              <Metric icon={<Users size={16} />} label="Entities" value={String(report?.detected_entities.length ?? 0)} tone="teal" />
              <Metric icon={<Video size={16} />} label="Frames" value={String(report?.processed_frames ?? 0)} tone="slate" />
            </div>

            <div className="mt-5 border border-white/10 bg-white/[0.02] p-4">
              <div className="mb-3 flex items-center justify-between">
                <PanelTitle icon={<Binary size={16} />} title="Anomaly Waveform" />
                {report && (
                  <a className="flex items-center gap-2 font-mono text-xs text-teal-200" href={videoSrc} target="_blank">
                    <Download size={14} /> Overlay MP4
                  </a>
                )}
              </div>
              <div className="flex h-24 items-end gap-1">
                {(report?.confidence_waveform.length ? report.confidence_waveform : Array.from({ length: 80 }, (_, i) => (i % 9) / 20)).map((value, index) => (
                  <div
                    key={index}
                    className="flex-1 bg-gradient-to-t from-red-500 to-teal-300"
                    style={{ height: `${Math.max(8, value * 100)}%`, opacity: report ? 0.85 : 0.2 }}
                  />
                ))}
              </div>
            </div>
          </section>

          <aside className="p-5">
            <PanelTitle icon={<AlertTriangle size={16} />} title="Detection Events" />
            <div className="mt-4 max-h-[340px] space-y-3 overflow-auto pr-1">
              {(report?.event_timeline ?? []).map((event) => (
                <div key={event.id} className="border border-white/10 bg-white/[0.025] p-3">
                  <div className="flex items-center justify-between font-mono text-[10px] text-slate-500">
                    <span>{event.timestamp}</span>
                    <span className="text-red-300">{event.severity}</span>
                  </div>
                  <div className="mt-2 text-sm text-slate-200">{event.event}</div>
                  <div className="mt-2 font-mono text-[11px] text-teal-200">CONF {Math.round(event.confidence * 100)}%</div>
                </div>
              ))}
              {!report && <Empty text="Timeline will populate after YOLO and motion fusion." />}
            </div>

            <div className="mt-7">
              <PanelTitle icon={<Users size={16} />} title="Detected Entities" />
              <div className="mt-4 space-y-3">
                {(report?.detected_entities ?? []).map((entity) => (
                  <div key={entity.label} className="flex items-center justify-between border border-white/10 bg-white/[0.025] p-3">
                    <div>
                      <div className="font-orbitron text-xs uppercase tracking-[0.18em]">{entity.label}</div>
                      <div className="mt-1 font-mono text-[10px] text-slate-500">{entity.first_seen} - {entity.last_seen}</div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="text-lg text-teal-200">{entity.count}</div>
                      <div className="text-[10px] text-slate-500">{Math.round(entity.max_confidence * 100)}%</div>
                    </div>
                  </div>
                ))}
                {!report && <Empty text="People, vehicles, bags, and phones appear here." />}
              </div>
            </div>

            <div className="mt-7 border border-red-500/30 bg-red-950/10 p-4">
              <PanelTitle icon={<Shield size={16} />} title="Reasoning Engine" />
              <div className="mt-4 space-y-3 font-mono text-xs leading-relaxed text-slate-300">
                {(report?.reasoning_engine.reasoning ?? ["RAG + Ollama explainability will summarize visual evidence after processing."]).map((line, index) => (
                  <p key={index}>{line}</p>
                ))}
              </div>
              {report && (
                <div className="mt-4 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
                  Ollama: {report.reasoning_engine.ollama_used ? "connected" : "fallback"} / RAG chunks: {report.reasoning_engine.rag_context.length}
                </div>
              )}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}

function PanelTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 font-orbitron text-xs font-bold uppercase tracking-[0.24em] text-red-300">
      {icon}
      <span>{title}</span>
    </div>
  );
}

function Metric({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "red" | "amber" | "teal" | "slate" }) {
  const colors = {
    red: "text-red-300 border-red-500/30",
    amber: "text-amber border-amber/30",
    teal: "text-teal-data border-teal-data/30",
    slate: "text-slate-300 border-white/10",
  };
  return (
    <div className={`border bg-white/[0.025] p-4 ${colors[tone]}`}>
      <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">
        {icon}
        {label}
      </div>
      <div className="mt-3 font-orbitron text-xl">{value}</div>
    </div>
  );
}

function StreamLine({ item }: { item: StreamEvent }) {
  return (
    <div className="border border-white/10 bg-white/[0.025] px-3 py-2 font-mono text-[11px] text-slate-400">
      <div className="flex items-center justify-between gap-2">
        <span className="uppercase text-teal-200">{item.stage ?? item.type ?? "event"}</span>
        {typeof item.progress === "number" && <span className="text-red-300">{item.progress}%</span>}
      </div>
      <div className="mt-1 truncate text-slate-500">{item.detail ?? (typeof item.frame === "number" ? `Frame ${item.frame}` : "Signal received")}</div>
    </div>
  );
}

function CameraStatus({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/10 bg-white/[0.025] px-2 py-2 text-center">
      <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-600">{label}</div>
      <div className="mt-1 font-orbitron text-[11px] uppercase tracking-[0.16em] text-teal-200">{value}</div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="border border-white/10 bg-white/[0.015] p-4 font-mono text-xs text-slate-600">{text}</div>;
}
