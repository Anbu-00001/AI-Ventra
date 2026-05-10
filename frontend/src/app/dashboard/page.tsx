/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
"use client";
/* eslint-disable @typescript-eslint/no-unused-vars */

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import {
  Activity,
  ArrowLeft,
  Brain,
  Camera,
  Clock3,
  Cpu,
  FileText,
  Fingerprint,
  FolderUp,
  Globe,
  HelpCircle,
  Leaf,
  Lock,
  MapPin,
  Network,
  Phone,
  ScanSearch,
  Settings,
  Shield,
  ShieldAlert,
  Thermometer,
  UploadCloud,
  UserRound,
  Users,
  Video,
} from "lucide-react";
import {
  checkHealth,
  createAnalysisWebSocket,
  createProgressStream,
  generateReport,
  getRagStats,
  indexSyntheticData,
  uploadEvidence,
} from "@/lib/api";
import type { HealthResponse, RAGStats, TriageReport } from "@/lib/api";

const evidenceFiles = [
  {
    title: "Autopsy Report",
    type: "PDF",
    size: "3.2 MB",
    meta: "Medical Examiner Report",
    color: "crimson",
    icon: FileText,
    delay: 0.05,
  },
  {
    title: "CCTV Footage",
    type: "MP4",
    size: "2.48 GB",
    meta: "Camera_12_02.mp4",
    color: "amber",
    icon: Video,
    delay: 0.12,
  },
  {
    title: "GPS Metadata",
    type: "JSON",
    size: "1.6 MB",
    meta: "device_meta.json",
    color: "teal",
    icon: MapPin,
    delay: 0.18,
  },
  {
    title: "Call Logs",
    type: "LOG",
    size: "512 KB",
    meta: "call_records.log",
    color: "white",
    icon: Phone,
    delay: 0.24,
  },
  {
    title: "Environmental Data",
    type: "CSV",
    size: "820 KB",
    meta: "env_readings.csv",
    color: "green",
    icon: Thermometer,
    delay: 0.3,
  },
];

const parsingSteps = [
  {
    label: "Decrypting Evidence",
    sub: "AES-256 encryption detected",
    value: 100,
    state: "Complete",
    color: "teal",
    icon: Lock,
  },
  {
    label: "Extracting Entities",
    sub: "Identifying key data points",
    value: 75,
    state: "In Progress",
    color: "green",
    icon: Activity,
  },
  {
    label: "Building Evidence Graph",
    sub: "Correlating relationships",
    value: 45,
    state: "In Progress",
    color: "amber",
    icon: Network,
  },
  {
    label: "Estimating Time Of Death",
    sub: "Analyzing postmortem indicators",
    value: 15,
    state: "Pending",
    color: "blue",
    icon: Clock3,
  },
];

const classifiers = [
  {
    label: "Physical Evidence",
    confidence: 94,
    color: "crimson",
    icon: Fingerprint,
  },
  {
    label: "Digital Evidence",
    confidence: 98,
    color: "teal",
    icon: Cpu,
  },
  {
    label: "Behavioral Evidence",
    confidence: 87,
    color: "amber",
    icon: Brain,
  },
  {
    label: "Environmental Data",
    confidence: 91,
    color: "green",
    icon: Leaf,
  },
];

const railItems = [
  { icon: ScanSearch, label: "Intake Terminal", view: "intake" },
  { icon: FolderUp, label: "Evidence Upload", view: "intake" },
  { icon: UserRound, label: "Autopsy Intelligence", view: "autopsy" },
  { icon: Network, label: "Evidence Correlation", view: "correlation" },
  { icon: Clock3, label: "Timeline Analysis", view: "timeline" },
  { icon: Camera, label: "Visual Intelligence", view: "visual" },
  { icon: ShieldAlert, label: "Anomaly Detection", view: "anomaly" },
  { icon: Globe, label: "Geo Intelligence", view: "map" },
  { icon: FileText, label: "Triage Report", view: "triage" },
] as const;

const colorMap: Record<string, string> = {
  crimson: "#ff2848",
  amber: "#f5a400",
  teal: "#18f3e2",
  green: "#5df45a",
  blue: "#8aa0ff",
  white: "#f8fafc",
};

const AutopsyIntelligenceView = dynamic(
  () => import("@/components/dashboard/AutopsyIntelligenceView"),
  { ssr: false }
);
const EvidenceCorrelationView = dynamic(
  () => import("@/components/dashboard/EvidenceCorrelationView"),
  { ssr: false }
);
const TimelineAnalysisView = dynamic(
  () => import("@/components/dashboard/TimelineAnalysisView"),
  { ssr: false }
);
const VisualIntelligenceView = dynamic(
  () => import("@/app/visual-intelligence/page"),
  { ssr: false }
);
const AnomalyDetectionView = dynamic(
  () => import("@/components/dashboard/AnomalyDetectionView"),
  { ssr: false }
);
const DigitalTraceMapView = dynamic(
  () => import("@/components/dashboard/DigitalTraceMapView"),
  { ssr: false }
);
const AITriageReportView = dynamic(
  () => import("@/components/dashboard/AITriageReportView"),
  { ssr: false }
);

type DashboardView = "intake" | "autopsy" | "correlation" | "timeline" | "visual" | "anomaly" | "map" | "triage";
type IntakeFile = {
  title: string;
  type: string;
  size: string;
  meta: string;
  color: string;
  icon: typeof FileText;
  delay: number;
  fileId?: string;
  status?: string;
};

type ParsingStep = (typeof parsingSteps)[number];

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
};

const evidenceIconFor = (type: string) => {
  if (type === "pdf" || type === "txt") return FileText;
  if (type === "image") return Video;
  if (type === "csv") return Thermometer;
  if (type === "json") return MapPin;
  return Phone;
};

const evidenceColorFor = (type: string) => {
  if (type === "pdf") return "crimson";
  if (type === "image") return "amber";
  if (type === "json") return "teal";
  if (type === "csv") return "green";
  return "white";
};

export default function DashboardPage() {
  const [time, setTime] = useState("");
  const [activeView, setActiveView] = useState<DashboardView>("intake");
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [ragStats, setRagStats] = useState<RAGStats | null>(null);
  const [files, setFiles] = useState<IntakeFile[]>(evidenceFiles);
  const [steps, setSteps] = useState<ParsingStep[]>(parsingSteps);
  const [report, setReport] = useState<TriageReport | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [statusLine, setStatusLine] = useState("Backend handshake pending");
  const [wsStage, setWsStage] = useState("Secure intelligence channel idle");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const particleColumns = useMemo(() => Array.from({ length: 42 }), []);
  const totalBytes = useMemo(
    () =>
      files.reduce((sum, file) => {
        const match = file.size.match(/([\d.]+)\s*(B|KB|MB|GB)/i);
        if (!match) return sum;
        const value = Number(match[1]);
        const unit = match[2].toUpperCase();
        const multiplier = unit === "GB" ? 1024 ** 3 : unit === "MB" ? 1024 ** 2 : unit === "KB" ? 1024 : 1;
        return sum + value * multiplier;
      }, 0),
    [files]
  );
  const completedSteps = steps.filter((step) => step.value >= 100).length;
  const aggregateProgress = Math.round(steps.reduce((sum, step) => sum + step.value, 0) / steps.length);
  const riskLevel = report?.threat_level ?? (aggregateProgress > 65 ? "ELEVATED" : "PENDING");
  const relationshipCount = report?.supporting_evidence?.length
    ? report.supporting_evidence.reduce((sum, item) => sum + Math.round(item.weight / 10), 0)
    : ragStats?.total_vectors ?? 0;

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("en-US", {
          hour12: false,
          timeZone: "Asia/Kolkata",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let mounted = true;

    const refreshBackend = async () => {
      try {
        const [h, stats] = await Promise.all([checkHealth(), getRagStats()]);
        if (!mounted) return;
        setHealth(h);
        setRagStats(stats.data);
        setStatusLine(`Featherless ${h.llm} | RAG ${stats.data.status} | ${stats.data.total_vectors} vectors`);
      } catch (error) {
        if (!mounted) return;
        setStatusLine("Backend unavailable - start FastAPI on port 8000");
      }
    };

    refreshBackend();
    const interval = setInterval(refreshBackend, 10000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const ws = createAnalysisWebSocket("AIV-2041-77");
    ws.onopen = () => {
      setWsStage("Secure intelligence stream connected");
      ws.send(JSON.stringify({ action: "start_analysis" }));
    };
    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.type === "analysis_stage") {
        setWsStage(`${payload.stage} | ${payload.progress}%`);
        setSteps((current) =>
          current.map((step) =>
            step.label.toLowerCase() === String(payload.stage).toLowerCase()
              ? { ...step, value: payload.progress, state: payload.progress >= 100 ? "Complete" : "In Progress", sub: payload.detail || step.sub }
              : step
          )
        );
      }
    };
    ws.onerror = () => setWsStage("WebSocket stream offline");
    return () => ws.close();
  }, []);

  const handlePrimeRag = async () => {
    setIsUploading(true);
    setIsScanning(true);
    setStatusLine("Initializing Forensic RAG Engine...");
    
    // Simulate step progress for visual feedback
    setSteps(current => current.map(s => ({ ...s, value: 20, state: "Scanning" })));
    
    try {
      // Step 1 & 2
      setTimeout(() => {
        setSteps(current => current.map((s, i) => i < 2 ? { ...s, value: 100, state: "Complete" } : { ...s, value: 45, state: "Indexing" }));
      }, 800);

      const res = await indexSyntheticData();
      
      if (res.data) {
        setRagStats({
          total_vectors: res.data.total_vectors,
          status: "ready",
          dimension: 384,
        });
        
        // Complete all steps
        setSteps(current => current.map(s => ({ ...s, value: 100, state: "Complete" })));
        setStatusLine(`RAG Intelligence Synced: ${res.data.total_vectors} vectors active.`);
      }
    } catch (err) {
      console.error(err);
      setStatusLine("RAG Synchronization Error - check backend API");
    } finally {
      setIsUploading(false);
      setIsScanning(false);
    }
  };

  const runIntelligenceCycle = async () => {
    setIsUploading(true);
    setIsScanning(true);
    setStatusLine("Executing Neural Forensic Inference...");
    
    // Reset steps for new cycle
    setSteps(current => current.map(s => ({ ...s, value: 10, state: "Thinking" })));
    
    try {
      // Simulate rapid progress through forensic stages
      const intervals = [500, 1200, 2000, 2800];
      intervals.forEach((ms, i) => {
        setTimeout(() => {
          setSteps(current => current.map((s, idx) => idx === i ? { ...s, value: 100, state: "Complete" } : s));
        }, ms);
      });

      const generated = await generateReport("AIV-2041-77");
      
      if (generated.data) {
        setReport(generated.data);
        setStatusLine(`Forensic Verdict: ${generated.data.threat_level} | Risk Score: ${Math.round(generated.data.risk_score)}`);
        
        // Navigation to Triage view with dramatic delay
        setTimeout(() => {
          setActiveView("triage");
          setIsUploading(false);
          setIsScanning(false);
        }, 3200);
      }
    } catch {
      setStatusLine("Forensic Engine Offline - check LLM API Key");
      setIsUploading(false);
      setIsScanning(false);
    }
  };

  const handleFiles = async (selected: FileList | null) => {
    if (!selected?.length) return;
    setIsUploading(true);
    setStatusLine(`Uploading ${selected.length} evidence file(s)`);
    const uploaded: IntakeFile[] = [];

    for (const file of Array.from(selected)) {
      const response = await uploadEvidence(file, "AIV-2041-77");
      const data = response.data;
      uploaded.push({
        title: file.name.replace(/\.[^.]+$/, "").slice(0, 28) || file.name,
        type: (data.file_type?.toUpperCase?.() ?? file.type) || "FILE",
        size: formatBytes(file.size),
        meta: data.file_id,
        color: evidenceColorFor(data.file_type),
        icon: evidenceIconFor(data.file_type),
        delay: 0.05,
        fileId: data.file_id,
        status: data.status,
      });

      createProgressStream(
        data.file_id,
        (stage, progress, detail) => {
          setStatusLine(`${stage}: ${detail}`);
          setSteps((current) =>
            current.map((step) => {
              const stageLower = stage.toLowerCase();
              const labelLower = step.label.toLowerCase();
              const matches =
                stageLower.includes(labelLower) ||
                labelLower.includes(stageLower) ||
                (stageLower.includes("graph") && labelLower.includes("graph")) ||
                (stageLower.includes("timeline") && labelLower.includes("time"));
              return matches
                ? { ...step, value: progress, state: progress >= 100 ? "Complete" : "In Progress", sub: detail }
                : step;
            })
          );
        },
        async () => {
          setStatusLine("Evidence extraction complete - refreshing RAG telemetry");
          const stats = await getRagStats();
          setRagStats(stats.data);
        }
      );
    }

    setFiles((current) => [...uploaded, ...current].slice(0, 8));
    setIsUploading(false);
  };

  return (
    <main className="min-h-screen overflow-hidden bg-[#05070b] text-slate-100">
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(192,24,42,0.2),transparent_34%),linear-gradient(130deg,#04060a_0%,#090d14_48%,#030406_100%)]" />
      <div className="fixed inset-0 dashboard-grid opacity-70" />
      <div className="fixed inset-0 scan-line-overlay crt-overlay pointer-events-none" />

      <section className="relative z-10 flex min-h-screen items-center justify-center p-3 sm:p-5 lg:p-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, rotateX: 8 }}
          animate={{ opacity: 1, scale: 1, rotateX: 0 }}
          transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
          className="dashboard-shell relative flex h-[calc(100vh-24px)] min-h-[720px] w-full max-w-[1440px] overflow-hidden border border-white/10 bg-black/70 shadow-[0_0_80px_rgba(255,25,54,0.16)] backdrop-blur-xl"
        >
          <aside className="hidden w-[74px] shrink-0 border-r border-white/8 bg-[#07101a]/90 px-2 py-20 md:block">
            <div className="flex flex-col items-center gap-4">
              {railItems.map((item, index) => {
                const Icon = item.icon;
                const selected = item.view === activeView && (activeView !== "intake" || index === 1);
                return (
                <button
                  key={index}
                  type="button"
                  onClick={() => setActiveView(item.view)}
                  className={`grid h-12 w-12 place-items-center rounded-md border transition-all duration-300 ${
                    selected
                      ? "border-crimson/60 bg-crimson/15 text-crimson-glow shadow-[0_0_24px_rgba(255,25,54,0.25)]"
                      : "border-white/8 bg-white/[0.025] text-slate-500 hover:border-teal-data/40 hover:text-teal-data"
                  }`}
                  aria-label={item.label}
                  title={item.label}
                >
                  <Icon size={22} strokeWidth={1.8} />
                </button>
                );
              })}
            </div>
          </aside>

          <div className="relative flex min-w-0 flex-1 flex-col">
            <header className="flex h-[78px] shrink-0 items-center justify-between border-b border-white/8 px-4 sm:px-7">
              <div className="flex items-center gap-4">
                <Link
                  href="/"
                  className="grid h-10 w-10 place-items-center rounded-md border border-white/10 text-slate-400 transition hover:border-crimson/60 hover:text-white"
                  aria-label="Back to landing page"
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
                <span className="font-orbitron text-sm font-semibold uppercase tracking-[0.18em] text-crimson-glow">
                  {activeView === "autopsy"
                    ? "Autopsy Intelligence"
                    : activeView === "correlation"
                      ? "Evidence Correlation Engine"
                      : activeView === "visual"
                        ? "Visual Intelligence"
                      : "Case Intake Terminal"}
                </span>
                <span className="font-mono text-xs uppercase tracking-[0.16em] text-slate-500">
                  {activeView === "autopsy"
                    ? `// Postmortem Analysis Engine`
                    : activeView === "correlation"
                      ? `// Relationship Intelligence Analysis`
                      : activeView === "visual"
                        ? `// YOLOv8 CCTV Behavioral Analysis`
                      : `// Digital Forensic Evidence Ingestion`}
                </span>
                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-teal-data/25 to-transparent" />
              </div>

                <div className="flex items-center gap-4">
                  <div className="hidden items-center gap-2 sm:flex">
                    <Shield size={20} className="text-teal-data" />
                    <div>
                      <div className="font-orbitron text-[11px] uppercase text-teal-data">
                        {health?.llm === "connected" ? "AI Connected" : "Secure Session"}
                      </div>
                      <div className="font-mono text-[10px] text-slate-500">
                        {health?.primary_model?.split("/").pop() ?? "AX-7F82-19Z"}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowSettings(true)}
                    className="group relative grid h-10 w-10 place-items-center border border-white/10 bg-white/5 transition hover:bg-white/10"
                  >
                    <Settings className="text-slate-400 group-hover:text-crimson-glow" size={20} />
                  </button>
                  <div className="text-right font-mono text-xs text-slate-300">
                    <div>{time}</div>
                    <div className="text-slate-500">MAY 09, 2026</div>
                  </div>
                </div>
            </header>

            {activeView === "autopsy" ? (
              <div className="min-h-0 flex-1 overflow-hidden">
                <AutopsyIntelligenceView embedded />
              </div>
            ) : activeView === "correlation" ? (
              <div className="min-h-0 flex-1 overflow-hidden">
                <EvidenceCorrelationView />
              </div>
            ) : activeView === "timeline" ? (
              <div className="min-h-0 flex-1 overflow-hidden">
                <TimelineAnalysisView />
              </div>
            ) : activeView === "visual" ? (
              <div className="min-h-0 flex-1 overflow-auto bg-[#030407]">
                <VisualIntelligenceView />
              </div>
            ) : activeView === "anomaly" ? (
              <div className="min-h-0 flex-1 overflow-hidden">
                <AnomalyDetectionView />
              </div>
            ) : activeView === "map" ? (
              <div className="min-h-0 flex-1 overflow-hidden">
                <DigitalTraceMapView />
              </div>
            ) : activeView === "triage" ? (
              <div className="min-h-0 flex-1 overflow-hidden">
                <AITriageReportView initialReport={report} />
              </div>
            ) : (
            <>
            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 lg:grid-cols-[minmax(0,1.72fr)_minmax(340px,0.82fr)] lg:p-6">
              <section className="relative min-h-[520px] overflow-hidden border border-white/8 bg-[#050910]/82">
                <div className="absolute left-5 top-5 z-20">
                  <h1 className="font-orbitron text-xl font-semibold uppercase tracking-[0.12em] text-slate-100 sm:text-2xl">
                    Digital Forensic <span className="text-crimson-glow">Intake Terminal</span>
                  </h1>
                  <p className="mt-2 font-mono text-xs uppercase tracking-[0.18em] text-teal-data">
                    {statusLine}
                  </p>
                </div>

                <div className="absolute inset-0 dashboard-perspective">
                  <div className="absolute inset-x-0 bottom-0 h-2/3 dashboard-floor" />
                  <div className="absolute inset-0 opacity-70 dashboard-noise" />
                  {particleColumns.map((_, index) => (
                    <span
                      key={index}
                      className="dashboard-data-pillar"
                      style={{
                        left: `${8 + ((index * 83) % 84)}%`,
                        animationDelay: `${(index % 9) * 0.25}s`,
                        height: `${24 + ((index * 17) % 130)}px`,
                      }}
                    />
                  ))}
                </div>

                <div className="absolute left-4 top-28 z-20 hidden w-[250px] flex-col gap-5 xl:flex">
                  {files.map((file, index) => {
                    const Icon = file.icon;
                    const color = colorMap[file.color];
                    return (
                      <motion.div
                        key={file.title}
                        initial={{ opacity: 0, x: -34, rotateY: -20 }}
                        animate={{ opacity: 1, x: 0, rotateY: -10 + index * 2 }}
                        transition={{ duration: 0.55, delay: file.delay }}
                        className="evidence-chip relative flex items-center gap-4 border bg-black/45 px-4 py-3 backdrop-blur-md"
                        style={{
                          borderColor: `${color}80`,
                          boxShadow: `0 0 22px ${color}22`,
                          transform: `rotate(${index % 2 === 0 ? 5 : -7}deg)`,
                        }}
                      >
                        <Icon size={34} style={{ color }} />
                        <div className="min-w-0">
                          <div className="font-orbitron text-[12px] uppercase tracking-[0.08em]" style={{ color }}>
                            {file.title}
                          </div>
                          <div className="font-mono text-[10px] text-slate-400">{file.type}</div>
                          <div className="font-mono text-[10px] text-slate-500">{file.size}</div>
                          <div className="truncate font-mono text-[10px] text-slate-500">{file.meta}</div>
                          {file.status ? (
                            <div className="mt-1 truncate font-mono text-[9px] uppercase text-teal-data">{file.status}</div>
                          ) : null}
                        </div>
                        <span
                          className="absolute -right-2 top-1/2 h-2 w-2 rounded-full"
                          style={{ backgroundColor: color, boxShadow: `0 0 14px ${color}` }}
                        />
                      </motion.div>
                    );
                  })}
                </div>

                <div className="absolute inset-0 grid place-items-center px-5 pt-16">
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.2 }}
                    className="hologram-core relative grid h-[min(62vw,520px)] max-h-[520px] min-h-[330px] w-[min(62vw,520px)] min-w-[330px] place-items-center"
                  >
                    <div className="absolute inset-[7%] rounded-full border border-crimson/70 shadow-[0_0_55px_rgba(255,25,54,0.35)]" />
                    <div className="absolute inset-[13%] rounded-full border border-teal-data/25" />
                    <div className="absolute inset-[20%] rounded-full border border-white/8" />
                    <div className="absolute bottom-[11%] h-[16%] w-[86%] rounded-full border border-crimson/80 bg-crimson/10 blur-[0.4px] shadow-[0_0_40px_rgba(255,25,54,0.5)]" />
                    <div className="absolute bottom-[13%] h-[9%] w-[68%] rounded-full border border-teal-data/35" />
                    <div className="dashboard-orbit dashboard-orbit-one" />
                    <div className="dashboard-orbit dashboard-orbit-two" />
                    <div className="dashboard-upload-beam" />
                    <motion.button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        handleFiles(event.dataTransfer.files);
                      }}
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.98 }}
                      className="relative z-10 grid h-48 w-48 place-items-center rounded-full border border-crimson/50 bg-black/35 text-center backdrop-blur-sm transition hover:border-teal-data/60"
                    >
                      <div>
                        <UploadCloud className="mx-auto mb-5 text-crimson-glow drop-shadow-[0_0_16px_rgba(255,25,54,0.8)]" size={60} />
                        <div className="font-orbitron text-lg uppercase tracking-[0.14em] text-slate-100">
                          {isUploading ? "Processing Evidence" : "Drop Evidence Here"}
                        </div>
                        <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.16em] text-teal-data">
                          {wsStage}
                        </div>
                        <div className="mx-auto mt-4 h-1 w-24 overflow-hidden bg-teal-data/15">
                          <div className="h-full w-2/3 bg-teal-data shadow-[0_0_14px_rgba(24,243,226,0.9)]" />
                        </div>
                      </div>
                    </motion.button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      accept=".pdf,.csv,.json,.jpg,.jpeg,.png,.tiff,.txt"
                      onChange={(event) => handleFiles(event.target.files)}
                    />
                  </motion.div>
                </div>
              </section>

              <aside className="grid min-h-0 gap-4">
                <Panel title="Live Parsing Status">
                  <div className="space-y-4">
                    {steps.map((step, index) => {
                      const Icon = step.icon;
                      const color = colorMap[step.color];
                      return (
                        <div key={step.label} className="grid grid-cols-[44px_1fr_54px_44px] items-center gap-3">
                          <div
                            className="grid h-9 w-9 place-items-center rounded-full border font-mono text-sm"
                            style={{ borderColor: color, color }}
                          >
                            {index + 1}
                          </div>
                          <div className="min-w-0">
                            <div className="font-orbitron text-xs uppercase tracking-[0.08em] text-slate-200">
                              {step.label}
                            </div>
                            <div className="mt-1 font-mono text-[10px] uppercase" style={{ color }}>
                              {step.sub}
                            </div>
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${step.value}%` }}
                                transition={{ duration: 1, delay: 0.25 + index * 0.1 }}
                                className="h-full"
                                style={{ backgroundColor: color, boxShadow: `0 0 12px ${color}` }}
                              />
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-orbitron text-sm" style={{ color }}>
                              {step.value}%
                            </div>
                            <div className="font-mono text-[8px] uppercase text-slate-500">{step.state}</div>
                          </div>
                          <div className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/[0.03]">
                            <Icon size={20} style={{ color }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Panel>

                <Panel title="AI Evidence Classifier" subtitle="Auto-categorization results">
                  <div className="mb-4 flex gap-2">
                    <button
                      type="button"
                      onClick={handlePrimeRag}
                      disabled={isUploading}
                      className="h-8 flex-1 border border-teal-data/35 bg-teal-data/10 font-orbitron text-[9px] uppercase tracking-[0.12em] text-teal-data transition hover:bg-teal-data/20 disabled:opacity-50"
                    >
                      Prime RAG
                    </button>
                    <button
                      type="button"
                      onClick={runIntelligenceCycle}
                      disabled={isUploading}
                      className="h-8 flex-1 border border-crimson/45 bg-crimson/10 font-orbitron text-[9px] uppercase tracking-[0.12em] text-crimson-glow transition hover:bg-crimson/20 disabled:opacity-50"
                    >
                      Generate Verdict
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {classifiers.map((item) => {
                      const Icon = item.icon;
                      const color = colorMap[item.color];
                      return (
                        <motion.div
                          key={item.label}
                          whileHover={{ y: -3, scale: 1.015 }}
                          animate={isScanning ? {
                            boxShadow: [`inset 0 0 28px ${color}10`, `inset 0 0 50px ${color}30`, `inset 0 0 28px ${color}10`],
                            borderColor: [`${color}45`, `${color}80`, `${color}45`]
                          } : {}}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="relative border bg-black/35 p-4 transition overflow-hidden"
                          style={{
                            borderColor: `${color}45`,
                            boxShadow: `inset 0 0 28px ${color}10`,
                          }}
                        >
                          {isScanning && (
                            <motion.div 
                              initial={{ y: "-100%" }}
                              animate={{ y: "100%" }}
                              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                              className="absolute inset-x-0 h-1/2 bg-gradient-to-b from-transparent via-white/5 to-transparent pointer-events-none"
                            />
                          )}
                          <div className="flex items-center gap-3">
                            <Icon size={34} style={{ color }} />
                            <div className="font-orbitron text-xs uppercase tracking-[0.1em]" style={{ color }}>
                              {item.label}
                            </div>
                          </div>
                          <div className="mt-4 font-mono text-[10px] uppercase text-slate-400">
                            Confidence: <span style={{ color }}>{isScanning ? "Scanning..." : `${item.confidence}%`}</span>
                          </div>
                          <div className="mt-2 h-1.5 bg-white/8">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: isScanning ? "100%" : `${item.confidence}%` }}
                              className="h-full"
                              style={{
                                backgroundColor: color,
                                boxShadow: `0 0 14px ${color}`,
                              }}
                            />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </Panel>
              </aside>
            </div>

            <footer className="grid shrink-0 grid-cols-2 gap-px border-t border-white/8 bg-white/5 p-px md:grid-cols-[1fr_1fr_1.15fr_1.2fr_1fr_1.1fr]">
              {[
                [String(files.length), "Files Detected"],
                [formatBytes(totalBytes), "Total Size"],
                [String(ragStats?.total_vectors ?? 0), "Vectors Indexed"],
                [String(relationshipCount), "Relationships Found"],
                [`${Math.max(health?.status === "operational" ? 98.7 : 42, aggregateProgress).toFixed(1)}%`, "Data Integrity"],
              ].map(([value, label]) => (
                <div key={label} className="bg-[#060b13] px-5 py-4">
                  <div className="font-orbitron text-xl text-slate-200">{value}</div>
                  <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-slate-500">
                    {label}
                  </div>
                </div>
              ))}
              <div className="bg-[#080c14] px-5 py-4">
                <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">Risk Level</div>
                <div className="mt-1 font-orbitron text-lg uppercase tracking-[0.16em] text-crimson-glow">
                  {riskLevel}
                </div>
                <div className="mt-2 h-1 w-full bg-[repeating-linear-gradient(90deg,#ff2848_0_4px,transparent_4px_8px)] shadow-[0_0_14px_rgba(255,40,72,0.7)]" />
              </div>
            </footer>
            </>
            )}
          </div>
        </motion.div>
      </section>

      {showSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowSettings(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative w-full max-w-lg border border-white/10 bg-[#0a111a] p-8 shadow-[0_0_80px_rgba(255,25,54,0.1)]"
          >
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Settings className="text-crimson-glow" size={24} />
                <h3 className="font-orbitron text-xl uppercase tracking-widest text-white">Intelligence Config</h3>
              </div>
              <button onClick={() => setShowSettings(false)} className="text-slate-500 hover:text-white">✕</button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-slate-400 mb-2">Featherless AI Handshake</label>
                <div className="flex gap-2">
                  <input 
                    type="password" 
                    placeholder="ENTER_BEARER_TOKEN"
                    defaultValue="••••••••••••••••"
                    className="flex-1 bg-white/5 border border-white/10 px-4 py-2 font-mono text-sm text-teal-data focus:outline-none focus:border-crimson/50"
                  />
                  <button className="bg-crimson/20 border border-crimson/50 px-4 py-2 font-orbitron text-[10px] uppercase text-crimson-glow hover:bg-crimson/30">Connect</button>
                </div>
                <div className="mt-2 font-mono text-[9px] text-slate-500 flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${health?.llm === "connected" ? "bg-green-500" : "bg-crimson"}`} />
                  Current Status: {health?.llm === "connected" ? "ENCRYPTED CHANNEL ACTIVE" : "HANDSHAKE FAILED - FALLBACK MODE"}
                </div>
              </div>

              <div className="p-4 bg-white/[0.02] border border-white/5">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-[10px] uppercase text-slate-400">RAG Vector Synchronization</span>
                  <span className="font-orbitron text-xs text-teal-data">{ragStats?.total_vectors ?? 0} VECTORS</span>
                </div>
                <div className="h-1.5 bg-white/5 overflow-hidden">
                  <div className="h-full bg-teal-data" style={{ width: '100%' }} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 border border-white/5 bg-white/[0.01]">
                  <div className="font-mono text-[8px] uppercase text-slate-500 mb-1">Primary Model</div>
                  <div className="font-orbitron text-[10px] text-slate-200">{health?.primary_model?.split("/").pop() ?? "LLAMA-3-8B"}</div>
                </div>
                <div className="p-3 border border-white/5 bg-white/[0.01]">
                  <div className="font-mono text-[8px] uppercase text-slate-500 mb-1">Provider</div>
                  <div className="font-orbitron text-[10px] text-slate-200">{health?.provider ?? "FEATHERLESS"}</div>
                </div>
              </div>

              <button 
                onClick={() => setShowSettings(false)}
                className="w-full py-3 bg-white/5 border border-white/10 font-orbitron text-xs uppercase tracking-widest text-slate-300 hover:bg-white/10 transition"
              >
                Close Terminal
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </main>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden border border-white/10 bg-[#07101a]/78 p-5 shadow-[inset_0_0_40px_rgba(255,255,255,0.02)] backdrop-blur-md">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-crimson/70 to-transparent" />
      <div className="mb-5">
        <h2 className="font-orbitron text-sm font-semibold uppercase tracking-[0.14em] text-crimson-glow">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-teal-data">
            {subtitle}
          </p>
        ) : null}
      </div>
      {children}
    </section>
  );
}
