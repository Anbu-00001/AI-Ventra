/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react/no-unescaped-entities */

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play, Pause, SkipBack, SkipForward, ChevronDown,
  Phone, Camera, WifiOff, Car, MapPin,
  Activity, BatteryLow, Info, Target, MessageSquare,
  AlertCircle, Loader2, RefreshCw,
} from "lucide-react";
import { getTimelineFromCase, queryRAG } from "@/lib/api";
import type { ReconstructedTimeline, RAGResult } from "@/lib/api";

// ─── Fallback data (used if backend is unavailable) ──────────────────────────
const FALLBACK_EVENTS = [
  { id: 1, timestamp: "01:52 AM", type: "PHONE_CALL", title: "Last Call Received", description: "Final incoming call from unknown number registered 47 seconds before signal loss", confidence: 82, icon: "Phone", color: "slate", is_anomaly: false, location: null },
  { id: 2, timestamp: "02:05 AM", type: "CCTV_SIGHTING", title: "CCTV Sighting", description: "Subject identified on service road camera feed — unaccompanied, walking east", confidence: 91, icon: "Camera", color: "cyan", is_anomaly: false, location: "Service Road East" },
  { id: 3, timestamp: "02:14 AM", type: "SIGNAL_BLACKOUT", title: "Signal Blackout", description: "Complete communication silence initiated — 27-minute blackout window begins", confidence: 97, icon: "WifiOff", color: "red", is_anomaly: true, location: null },
  { id: 4, timestamp: "02:17 AM", type: "VEHICLE_MOVEMENT", title: "Vehicle Movement", description: "Suspect vehicle detected heading south at 48 km/h — CCTV confirms registration partial match", confidence: 88, icon: "Car", color: "orange", is_anomaly: false, location: "Southbound" },
  { id: 5, timestamp: "02:26 AM", type: "GPS_PING", title: "GPS Ping Detected", description: "Device trace shows deviation from last known route — geofence breach confirmed", confidence: 94, icon: "MapPin", color: "purple", is_anomaly: true, location: "Whitefield Sector 4" },
  { id: 6, timestamp: "02:41 AM", type: "BEHAVIOR_ANOMALY", title: "Behavioral Shift", description: "Suspect profile behavioral deviation flagged — 3 overlapping pattern conflicts identified", confidence: 79, icon: "Activity", color: "red", is_anomaly: true, location: null },
  { id: 7, timestamp: "02:53 AM", type: "SUSPECT_SIGHTING", title: "Suspect Sighting", description: "High-confidence facial match at incident perimeter — corroborated by GPS trace data", confidence: 93, icon: "Activity", color: "slate", is_anomaly: false, location: null },
  { id: 8, timestamp: "03:30 AM", type: "DEVICE_RECOVERY", title: "Device Power-On", description: "Subject device reactivated — call log analysis shows manual data deletion attempt", confidence: 86, icon: "BatteryLow", color: "slate", is_anomaly: false, location: null },
];

// ─── Utilities ────────────────────────────────────────────────────────────────

// Parse "HH:MM AM/PM" or ISO datetime → minutes from midnight
function parseTimeToMinutes(ts: string): number {
  if (!ts) return 0;
  // ISO: "2025-05-08T01:52:00" → extract time part
  const isoMatch = ts.match(/T(\d{2}):(\d{2})/);
  if (isoMatch) return parseInt(isoMatch[1]) * 60 + parseInt(isoMatch[2]);
  const m = ts.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return 0;
  let h = parseInt(m[1]);
  const min = parseInt(m[2]);
  const period = m[3].toUpperCase();
  if (period === "AM" && h === 12) h = 0;
  if (period === "PM" && h !== 12) h += 12;
  return h * 60 + min;
}

function minutesToLabel(t: number): string {
  const h = Math.floor(t / 60) % 24;
  const m = Math.floor(t % 60);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")} ${period}`;
}

// Generate smooth waveform path from event confidence scores
function buildWaveformPath(events: any[]): { points: string; fill: string; markers: { cx: number; cy: number; isAnomaly: boolean }[] } {
  if (!events.length) {
    const pts = Array.from({ length: 100 }, (_, i) => `${i * 10},${50 + Math.sin(i * 0.4) * 20}`).join(" L ");
    return { points: `M 0,50 L ${pts}`, fill: `M 0,100 L 0,50 L ${pts} L 990,100 Z`, markers: [] };
  }

  const timestamps = events.map(e => parseTimeToMinutes(e.timestamp));
  const minT = Math.min(...timestamps);
  const maxT = Math.max(...timestamps);
  const range = maxT - minT || 1;

  // Place events at their proportional x positions
  const anchors = events.map(e => {
    const t = parseTimeToMinutes(e.timestamp);
    const x = ((t - minT) / range) * 990;
    const y = 95 - (e.confidence / 100) * 85; // confidence 100 → y=10 (top), 0 → y=95 (bottom)
    return { x, y, isAnomaly: e.is_anomaly };
  }).sort((a, b) => a.x - b.x);

  // Add boundary anchors
  const all = [{ x: 0, y: anchors[0].y, isAnomaly: false }, ...anchors, { x: 990, y: anchors[anchors.length - 1].y, isAnomaly: false }];

  // Smooth cubic bezier path
  let path = `M ${all[0].x},${all[0].y}`;
  for (let i = 1; i < all.length; i++) {
    const prev = all[i - 1];
    const curr = all[i];
    const cpx = (prev.x + curr.x) / 2;
    path += ` C ${cpx},${prev.y} ${cpx},${curr.y} ${curr.x},${curr.y}`;
  }

  const fillPath = `${path} L 990,100 L 0,100 Z`;

  return { points: path, fill: fillPath, markers: all.slice(1, all.length - 1) };
}

// Step sizes per speed option (% per 50ms tick)
const SPEED_STEPS: Record<string, number> = {
  "0.5x": 100 / 1200,
  "1x":   100 / 600,
  "2x":   100 / 300,
  "4x":   100 / 150,
};
const SPEEDS = ["0.5x", "1x", "2x", "4x"];

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TimelineAnalysisView() {
  const [timeline, setTimeline] = useState<ReconstructedTimeline | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState("1x");
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [scanPosition, setScanPosition] = useState(0); // 0–100

  const [selectedEventId, setSelectedEventId] = useState(1);
  const [narrativeResult, setNarrativeResult] = useState<RAGResult | null>(null);
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [narrativeFeed, setNarrativeFeed] = useState<{ time: string; text: string }[]>([]);

  const playbackRef = useRef<NodeJS.Timeout | null>(null);
  const lastAutoSelectRef = useRef<number>(0);

  // ── Load timeline on mount ───────────────────────────────────────────────
  useEffect(() => { loadTimeline(); }, []);

  const loadTimeline = async () => {
    setIsLoading(true);
    setLoadError(null);
    setNarrativeFeed([]);
    setScanPosition(0);
    setSelectedEventId(1);
    try {
      const res = await getTimelineFromCase("AIV-2041-77");
      setTimeline(res.data);
      setNarrativeFeed([
        { time: new Date().toLocaleTimeString(), text: `Timeline reconstructed — ${res.data.total_events} events indexed from forensic database` },
        { time: new Date().toLocaleTimeString(), text: `${res.data.anomaly_count} anomalies flagged · Confidence: ${Math.round(res.data.confidence_score)}%` },
      ]);
    } catch {
      setLoadError("Using cached forensic data");
      setNarrativeFeed([
        { time: new Date().toLocaleTimeString(), text: "Fallback mode active — forensic event data loaded from local cache" },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Build event list ─────────────────────────────────────────────────────
  const events = useMemo(() => {
    if (!timeline?.events?.length) return FALLBACK_EVENTS;
    return timeline.events.map((event, index) => ({
      id: index + 1,
      timestamp: event.timestamp,
      type: event.event_type,
      title: event.title,
      description: event.description,
      confidence: Math.round(event.confidence),
      icon:
        event.event_type.includes("PHONE") ? "Phone" :
        event.event_type.includes("CCTV")  ? "Camera" :
        event.event_type.includes("SIGNAL") ? "WifiOff" :
        event.event_type.includes("VEHICLE") ? "Car" :
        event.event_type.includes("GPS")    ? "MapPin" :
        event.event_type.includes("DEVICE") ? "BatteryLow" : "Activity",
      color:
        event.is_anomaly ? "red" :
        event.event_type.includes("CCTV")    ? "cyan" :
        event.event_type.includes("GPS")     ? "purple" :
        event.event_type.includes("VEHICLE") ? "orange" : "slate",
      is_anomaly: event.is_anomaly,
      location: event.location ?? null,
    }));
  }, [timeline]);

  // ── Compute each event's position (0–100%) on the time axis ─────────────
  const eventPositions = useMemo(() => {
    const timestamps = events.map(e => parseTimeToMinutes(e.timestamp));
    const minT = Math.min(...timestamps);
    const maxT = Math.max(...timestamps);
    const range = maxT - minT || 1;
    return events.map(e => ({
      id: e.id,
      pos: ((parseTimeToMinutes(e.timestamp) - minT) / range) * 100,
    }));
  }, [events]);

  // ── Time axis tick labels ────────────────────────────────────────────────
  const timeLabels = useMemo(() => {
    const timestamps = events.map(e => parseTimeToMinutes(e.timestamp));
    const minT = Math.min(...timestamps) - 10;
    const maxT = Math.max(...timestamps) + 10;
    return Array.from({ length: 9 }, (_, i) => minutesToLabel(minT + ((maxT - minT) / 8) * i));
  }, [events]);

  // ── Waveform ─────────────────────────────────────────────────────────────
  const waveform = useMemo(() => buildWaveformPath(events), [events]);

  // ── Selected event ───────────────────────────────────────────────────────
  const selectedEvent = events.find(e => e.id === selectedEventId) || events[0];

  const getTimeDiff = useCallback((eventId: number): number => {
    const idx = events.findIndex(e => e.id === eventId);
    if (idx <= 0) return 0;
    return Math.abs(
      parseTimeToMinutes(events[idx].timestamp) - parseTimeToMinutes(events[idx - 1].timestamp)
    );
  }, [events]);

  // ── Playback engine ──────────────────────────────────────────────────────
  useEffect(() => {
    if (playbackRef.current) clearInterval(playbackRef.current);
    if (!isPlaying) return;

    const step = SPEED_STEPS[playbackSpeed] ?? SPEED_STEPS["1x"];
    playbackRef.current = setInterval(() => {
      setScanPosition(prev => {
        if (prev >= 100) { setIsPlaying(false); return 100; }
        return prev + step;
      });
    }, 50);

    return () => { if (playbackRef.current) clearInterval(playbackRef.current); };
  }, [isPlaying, playbackSpeed]);

  // ── Auto-select event when cursor passes it ──────────────────────────────
  useEffect(() => {
    const passed = eventPositions.filter(ep => ep.pos <= scanPosition);
    if (!passed.length) return;
    const last = passed[passed.length - 1];
    if (last.id !== lastAutoSelectRef.current) {
      lastAutoSelectRef.current = last.id;
      setSelectedEventId(last.id);
      const ev = events.find(e => e.id === last.id);
      if (ev) {
        setNarrativeFeed(prev => [
          { time: ev.timestamp, text: `${ev.title} — ${ev.description.substring(0, 60)}…` },
          ...prev.slice(0, 5),
        ]);
      }
    }
  }, [scanPosition, eventPositions, events]);

  // ── Fetch RAG narrative on event select ──────────────────────────────────
  useEffect(() => {
    if (!selectedEvent) return;
    let cancelled = false;
    setNarrativeLoading(true);
    setNarrativeResult(null);

    queryRAG(
      `Forensic significance and timeline context of: ${selectedEvent.title} — ${selectedEvent.description}`,
      5
    )
      .then(res => { if (!cancelled) setNarrativeResult(res.data); })
      .catch(() => { if (!cancelled) setNarrativeResult(null); })
      .finally(() => { if (!cancelled) setNarrativeLoading(false); });

    return () => { cancelled = true; };
  }, [selectedEventId]);

  // ── Controls ─────────────────────────────────────────────────────────────
  const handleRewind = () => {
    setScanPosition(0);
    setSelectedEventId(events[0]?.id ?? 1);
    lastAutoSelectRef.current = events[0]?.id ?? 1;
    setIsPlaying(false);
    setNarrativeFeed([]);
  };

  const handleSkipForward = () => {
    const last = events[events.length - 1];
    setScanPosition(100);
    setSelectedEventId(last?.id ?? events.length);
    lastAutoSelectRef.current = last?.id ?? events.length;
    setIsPlaying(false);
  };

  const handleEventClick = (eventId: number) => {
    const pos = eventPositions.find(ep => ep.id === eventId);
    if (pos) {
      setScanPosition(pos.pos);
      lastAutoSelectRef.current = eventId;
    }
    setSelectedEventId(eventId);
    setIsPlaying(false);
  };

  const handleScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    setScanPosition(pct);
    setIsPlaying(false);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-[#05070b] text-slate-200 font-sans overflow-hidden">

      {/* ── Top Stats Bar ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-black/20 shrink-0">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-crimson animate-pulse" />
            <span className="font-orbitron text-[10px] tracking-widest text-slate-400 uppercase">Investigation Playback Mode</span>
          </div>
          <div className="text-[10px] font-mono text-slate-500 max-w-sm truncate">
            {timeline?.narrative_summary ?? "AI reconstructing sequence of events based on correlated evidence and temporal analysis."}
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-tighter">
              Case ID: <span className="text-slate-300">AIV-2041-77</span>
            </div>
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-tighter">
              Status: <span className={timeline ? "text-teal-400" : loadError ? "text-amber-400" : "text-slate-500"}>
                {isLoading ? "Reconstructing…" : timeline ? "Backend Timeline Loaded" : loadError ? "Fallback Data Active" : "Idle"}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-mono text-slate-300">14:32:07</div>
            <div className="text-[10px] font-mono text-slate-500 uppercase">May 28, 2025</div>
          </div>
        </div>
      </div>

      {/* ── Control Panel ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-4 px-6 py-4 border-b border-white/5 shrink-0">
        {/* Reconstruct button */}
        <div className="flex items-center">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={loadTimeline}
            disabled={isLoading}
            className="flex items-center gap-3 px-8 py-3 rounded-md border border-crimson/50 bg-crimson/10 text-crimson-glow shadow-[0_0_20px_rgba(192,24,42,0.2)] disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isLoading
              ? <Loader2 size={16} className="animate-spin" />
              : <RefreshCw size={16} />}
            <span className="font-orbitron text-xs font-bold tracking-widest">
              {isLoading ? "RECONSTRUCTING…" : "RECONSTRUCT INCIDENT"}
            </span>
          </motion.button>
        </div>

        {/* Playback controls */}
        <div className="flex items-center gap-5 bg-white/5 rounded-xl px-6 py-3 border border-white/5">
          <span className="text-[10px] font-orbitron text-slate-500 uppercase tracking-widest">Playback</span>
          <div className="flex items-center gap-3">
            <button onClick={handleRewind} className="text-slate-400 hover:text-white transition"><SkipBack size={17} /></button>
            <button
              onClick={() => setIsPlaying(p => !p)}
              className="w-10 h-10 rounded-full border border-crimson/50 flex items-center justify-center text-crimson-glow bg-crimson/5 hover:bg-crimson/20 transition"
            >
              {isPlaying
                ? <Pause size={18} fill="currentColor" />
                : <Play size={18} fill="currentColor" className="ml-0.5" />}
            </button>
            <button onClick={handleSkipForward} className="text-slate-400 hover:text-white transition"><SkipForward size={17} /></button>
          </div>
          <div className="h-7 w-px bg-white/10" />
          {/* Speed selector */}
          <div className="relative">
            <button
              onClick={() => setShowSpeedMenu(s => !s)}
              className="flex items-center gap-1.5 bg-black/40 px-3 py-1.5 rounded border border-white/5 hover:bg-black/60 transition"
            >
              <span className="font-mono text-xs text-slate-300">{playbackSpeed}</span>
              <ChevronDown size={12} className={`text-slate-500 transition-transform ${showSpeedMenu ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {showSpeedMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.95 }}
                  transition={{ duration: 0.12 }}
                  className="absolute top-full mt-1 right-0 bg-[#0d0f14] border border-white/10 rounded-lg overflow-hidden z-50 min-w-[72px] shadow-xl"
                >
                  {SPEEDS.map(s => (
                    <button
                      key={s}
                      onClick={() => { setPlaybackSpeed(s); setShowSpeedMenu(false); }}
                      className={`w-full px-4 py-2 text-xs font-mono text-left hover:bg-white/10 transition ${playbackSpeed === s ? "text-amber-400 bg-white/5" : "text-slate-300"}`}
                    >
                      {s}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          {/* Progress mini-bar */}
          <div className="flex items-center gap-2">
            <div className="w-24 h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-100"
                style={{ width: `${scanPosition}%` }}
              />
            </div>
            <span className="font-mono text-[9px] text-slate-500 tabular-nums">{Math.round(scanPosition)}%</span>
          </div>
        </div>

        {/* Narrative feed */}
        <div className="flex flex-col justify-center border-l border-white/5 pl-6">
          <div className="font-orbitron text-[9px] text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
            <MessageSquare size={11} className="text-teal-400" /> Narrative Feed
          </div>
          <div className="space-y-1 overflow-hidden" style={{ maxHeight: "2.8rem" }}>
            {narrativeFeed.length > 0 ? narrativeFeed.slice(0, 3).map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px] text-slate-400">
                <span className="w-1 h-1 rounded-full bg-teal-400 shrink-0" />
                <span className="font-mono text-teal-500 shrink-0">[{item.time}]</span>
                <span className="truncate">{item.text}</span>
              </div>
            )) : (
              <>
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <span className="w-1 h-1 rounded-full bg-slate-600" /> Press play to begin reconstruction
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  <span className="w-1 h-1 rounded-full bg-slate-600" /> AI narrative generation ready
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Main Timeline Section ──────────────────────────────────────── */}
      <div className="flex-1 relative flex flex-col min-h-0">

        {/* Time axis */}
        <div className="absolute top-10 left-12 right-12 h-px bg-white/10 z-0">
          {timeLabels.map((label, i) => (
            <div
              key={i}
              className="absolute h-2 w-px bg-white/20 -top-1"
              style={{ left: `${(i / 8) * 100}%` }}
            >
              <span className="absolute top-4 left-1/2 -translate-x-1/2 font-mono text-[8px] text-slate-600 whitespace-nowrap">
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* Scrub bar (invisible overlay on axis) */}
        <div
          className="absolute top-8 left-12 right-12 h-6 z-20 cursor-crosshair"
          onClick={handleScrub}
        />

        {/* AI Scan Cursor */}
        <div
          className="absolute top-0 bottom-0 w-[2px] z-30 pointer-events-none transition-none"
          style={{
            left: `calc(3rem + ${scanPosition}% * (100% - 6rem) / 100)`,
            background: "linear-gradient(to bottom, transparent 0%, rgba(245,158,11,0.9) 8%, rgba(245,158,11,0.6) 92%, transparent 100%)",
            boxShadow: "0 0 12px rgba(245,158,11,0.5), 0 0 24px rgba(245,158,11,0.2)",
          }}
        >
          <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,1)]" />
          <div className="absolute top-8 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-amber-500/90 rounded text-[7px] font-orbitron font-bold text-black whitespace-nowrap">
            ▶ {minutesToLabel(
              Math.min(...events.map(e => parseTimeToMinutes(e.timestamp))) - 10 +
              (scanPosition / 100) * (
                (Math.max(...events.map(e => parseTimeToMinutes(e.timestamp))) + 10) -
                (Math.min(...events.map(e => parseTimeToMinutes(e.timestamp))) - 10)
              )
            )}
          </div>
        </div>

        {/* Event cards */}
        <div className="relative z-10 flex-1 flex items-center px-12 overflow-x-auto scrollbar-hide py-16">
          <div className="flex gap-8 min-w-max">
            {events.map((event) => (
              <TimelineCard
                key={event.id}
                event={event}
                isSelected={selectedEventId === event.id}
                onClick={() => handleEventClick(event.id)}
              />
            ))}
          </div>
        </div>

        {/* Confidence Waveform */}
        <div className="h-36 px-4 relative border-t border-white/5 bg-black/30 shrink-0">
          <div className="absolute top-3 left-6 flex items-center gap-3">
            <span className="font-orbitron text-[9px] text-slate-500 uppercase tracking-widest">Confidence Waveform</span>
            <span className="text-[9px] font-mono text-slate-700">derived from {events.length} event confidence scores</span>
          </div>

          <div className="absolute left-6 top-10 flex flex-col justify-between h-14 font-mono text-[7px] text-slate-700">
            <span>HIGH 80%+</span>
            <span>MED 40%</span>
            <span>LOW</span>
          </div>

          <div className="h-full pt-6 pb-10 pl-16 pr-4">
            <svg viewBox="0 0 990 90" className="w-full h-full" preserveAspectRatio="none">
              <defs>
                <linearGradient id="wfGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%"   stopColor="#94A3B8" />
                  <stop offset="40%"  stopColor="#14B8A6" />
                  <stop offset="70%"  stopColor="#F59E0B" />
                  <stop offset="100%" stopColor="#EF4444" />
                </linearGradient>
                <filter id="wfGlow">
                  <feGaussianBlur stdDeviation="1.5" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>

              {/* Fill */}
              <motion.path
                d={waveform.fill}
                fill="url(#wfGrad)"
                fillOpacity="0.08"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1.5 }}
              />
              {/* Line */}
              <motion.path
                d={waveform.points}
                fill="none"
                stroke="url(#wfGrad)"
                strokeWidth="2"
                filter="url(#wfGlow)"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: 2.5, ease: "easeInOut" }}
              />
              {/* Event markers */}
              {waveform.markers.map((mk, i) => (
                <circle
                  key={i}
                  cx={mk.cx}
                  cy={mk.cy}
                  r="4"
                  fill={mk.isAnomaly ? "#EF4444" : "#F59E0B"}
                  stroke="#000"
                  strokeWidth="1.5"
                  className="cursor-pointer"
                  onClick={() => handleEventClick(events[i]?.id)}
                />
              ))}
              {/* Scan cursor */}
              <rect
                x={(scanPosition / 100) * 990}
                y="0"
                width="2"
                height="90"
                fill="rgba(245,158,11,0.7)"
              />
            </svg>
          </div>

          {/* Legend */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-5 bg-black/40 px-5 py-1.5 rounded-full border border-white/5 backdrop-blur-md">
            <LegendItem color="#F59E0B" label="HIGH (80-100%)" />
            <LegendItem color="#14B8A6" label="MEDIUM (40-80%)" />
            <LegendItem color="#94A3B8" label="LOW (0-40%)" />
            <LegendItem color="#EF4444" label="ANOMALY" />
          </div>
        </div>
      </div>

      {/* ── Bottom Info Panels ─────────────────────────────────────────── */}
      <div className="grid grid-cols-[1fr_1.2fr_0.8fr] gap-0 border-t border-white/5 bg-black/60 backdrop-blur-xl shrink-0">

        {/* Event Details */}
        <div className="flex flex-col gap-3 px-6 py-5">
          <div className="font-orbitron text-[9px] text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Target size={11} className="text-amber-500" /> Event Details
          </div>
          <div className="flex gap-4">
            <div className="text-2xl font-mono font-bold text-amber-500/90 tabular-nums leading-none pt-1">
              {selectedEvent?.timestamp}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-orbitron text-xs font-bold text-white uppercase tracking-wider mb-1 truncate">
                {selectedEvent?.title} <span className="text-amber-500/70">Detected</span>
              </div>
              <div className="text-[10px] text-slate-400 leading-relaxed line-clamp-2">{selectedEvent?.description}</div>
              {selectedEvent?.location && (
                <div className="mt-2 flex items-center gap-2 text-[9px] font-mono text-slate-500 bg-white/5 px-2 py-1 rounded w-fit border border-white/5">
                  <MapPin size={9} className="text-teal-400" />
                  <span className="text-slate-300">{selectedEvent.location}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-6 mt-1">
            {/* CCTV thumbnail */}
            <div className="w-24 h-16 bg-black rounded border border-white/10 overflow-hidden flex items-center justify-center">
              {selectedEvent?.type?.includes("CCTV") ? (
                <div className="relative w-full h-full">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent z-10" />
                  <div className="absolute bottom-1 left-1 z-20">
                    <div className="w-1.5 h-1.5 bg-white/80 rounded-full animate-pulse" />
                  </div>
                  <img src="/api/placeholder/96/64" alt="CCTV" className="w-full h-full object-cover opacity-50" />
                </div>
              ) : (
                <Camera size={24} strokeWidth={1} className="text-slate-700" />
              )}
            </div>

            {/* Confidence ring */}
            <div className="flex flex-col items-center gap-1">
              <div className="text-[7px] font-orbitron text-slate-600 uppercase tracking-widest">Confidence</div>
              <div className="relative w-14 h-14">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 56 56">
                  <circle cx="28" cy="28" r="24" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
                  <motion.circle
                    cx="28" cy="28" r="24" fill="none" stroke="#F59E0B" strokeWidth="3"
                    strokeDasharray={150.8}
                    strokeDashoffset={150.8 - (150.8 * (selectedEvent?.confidence ?? 80)) / 100}
                    strokeLinecap="round"
                    className="drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]"
                    transition={{ duration: 0.6 }}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center font-orbitron text-[11px] font-bold text-white">
                  {selectedEvent?.confidence}%
                </span>
              </div>
            </div>

            {/* Quick stats */}
            <div className="flex flex-col gap-1.5 text-[9px] font-mono">
              <div>
                <div className="text-slate-600 uppercase text-[8px]">Time Δ</div>
                <div className="text-amber-500 font-bold">{getTimeDiff(selectedEventId)}m</div>
              </div>
              <div>
                <div className="text-slate-600 uppercase text-[8px]">Severity</div>
                <div className={`font-bold ${selectedEvent?.is_anomaly ? "text-red-400" : "text-teal-400"}`}>
                  {selectedEvent?.is_anomaly ? "ANOMALY" : "NORMAL"}
                </div>
              </div>
              <div>
                <div className="text-slate-600 uppercase text-[8px]">Event #</div>
                <div className="text-slate-300 font-bold">{selectedEvent?.id}/{events.length}</div>
              </div>
            </div>
          </div>
        </div>

        {/* AI Narrative */}
        <div className="flex flex-col gap-3 border-l border-white/5 px-6 py-5">
          <div className="font-orbitron text-[9px] text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <MessageSquare size={11} className="text-cyan-400" /> AI Narrative
            {narrativeLoading && <Loader2 size={9} className="animate-spin text-cyan-400" />}
          </div>

          <div className="flex-1 bg-gradient-to-br from-white/[0.03] to-transparent rounded-lg p-4 border border-white/5 relative overflow-hidden flex flex-col justify-between min-h-0" style={{ minHeight: "100px" }}>
            <div className="absolute top-2 right-2 text-slate-800/40"><MessageSquare size={18} /></div>

            {narrativeLoading ? (
              <div className="space-y-2">
                {[4, 3, 4, 2].map((w, i) => (
                  <div key={i} className={`h-2 bg-white/5 rounded animate-pulse`} style={{ width: `${w * 20}%` }} />
                ))}
              </div>
            ) : narrativeResult ? (
              <NarrativeContent result={narrativeResult} event={selectedEvent} timeDiff={getTimeDiff(selectedEventId)} />
            ) : (
              <p className="text-[10px] text-slate-300 leading-relaxed italic font-serif">
                "At {selectedEvent?.timestamp}, {selectedEvent?.description?.toLowerCase()}. This event occurred {getTimeDiff(selectedEventId)} minutes after the previous detection, establishing a temporal correlation consistent with deliberate, coordinated criminal behavior."
              </p>
            )}

            <div className="mt-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[8px] font-orbitron text-slate-600 uppercase tracking-widest">Narrative Confidence</div>
                <div className="font-mono text-[10px] text-amber-500">
                  {narrativeResult?.confidence != null
                    ? `${Math.round(narrativeResult.confidence * 100)}%`
                    : `${selectedEvent?.confidence ?? 89}%`}
                </div>
              </div>
              <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  key={`conf-${selectedEventId}`}
                  initial={{ width: 0 }}
                  animate={{
                    width: `${narrativeResult?.confidence != null
                      ? Math.round(narrativeResult.confidence * 100)
                      : selectedEvent?.confidence ?? 89}%`
                  }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-amber-700 to-amber-400 rounded-full"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Timeline Insights */}
        <div className="flex flex-col gap-3 border-l border-white/5 px-6 py-5">
          <div className="font-orbitron text-[9px] text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Activity size={11} className="text-red-500" /> Timeline Insights
          </div>
          <ul className="space-y-2.5">
            {([
              {
                label: `${timeline?.total_events ?? events.length} key events identified`,
                color: "bg-teal-500",
              },
              {
                label: `${timeline?.anomaly_count ?? events.filter(e => e.is_anomaly).length} anomalies flagged`,
                color: "bg-red-500",
              },
              {
                label: `${Math.round(timeline?.confidence_score ?? (events.reduce((s, e) => s + e.confidence, 0) / events.length))}% timeline confidence`,
                color: "bg-amber-500",
              },
              ...(timeline?.key_insights?.slice(0, 3) ?? [
                "Digital blackout aligns with TOD window",
                "GPS deviation confirms alibi conflict",
                "Multi-source evidence convergence active",
              ]).map(t => ({ label: t, color: "bg-purple-500" })),
            ] as { label: string; color: string }[]).slice(0, 5).map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[10px] text-slate-300">
                <span className={`w-1.5 h-1.5 rounded-full ${item.color} mt-0.5 shrink-0`} />
                <span className="leading-tight">{item.label}</span>
              </li>
            ))}
          </ul>

          {/* Radar graphic */}
          <div className="flex justify-center mt-auto pt-2">
            <div className="w-16 h-16 relative flex items-center justify-center">
              <div className="absolute inset-0 border border-white/5 rounded-full animate-[spin_25s_linear_infinite]" style={{ borderStyle: "dashed" }} />
              <div className="absolute inset-0 border border-white/5 rounded-full scale-75" />
              <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_6px_rgba(245,158,11,0.25)]">
                <polygon
                  points="50,18 82,38 72,78 28,78 18,38"
                  fill="rgba(245,158,11,0.12)"
                  stroke="#F59E0B"
                  strokeWidth="1.5"
                  className="animate-pulse"
                />
                {[[50, 18], [82, 38], [72, 78], [28, 78], [18, 38]].map(([cx, cy], i) => (
                  <circle key={i} cx={cx} cy={cy} r="2" fill="#F59E0B" />
                ))}
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Narrative Content Component ──────────────────────────────────────────────
function NarrativeContent({ result, event, timeDiff }: { result: RAGResult; event: any; timeDiff: number }) {
  const lines = (result.answer || "").split("\n").filter(l => l.trim());

  if (!lines.length) {
    return (
      <p className="text-[10px] text-slate-300 leading-relaxed italic font-serif">
        "At {event?.timestamp}, {event?.description?.toLowerCase()}. This event occurred {timeDiff} minutes after the previous detection, indicating deliberate coordination in the incident timeline."
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="space-y-1.5">
        {lines.slice(0, 6).map((line, i) => {
          const colonIdx = line.indexOf(":");
          if (colonIdx > 0 && colonIdx < 28 && !line.trim().startsWith("•")) {
            const label = line.substring(0, colonIdx).trim();
            const value = line.substring(colonIdx + 1).trim();
            return (
              <div key={i} className="flex gap-2 text-[10px] leading-snug">
                <span className="text-teal-400 font-mono shrink-0 font-semibold">{label}:</span>
                <span className="text-slate-300">{value}</span>
              </div>
            );
          }
          if (line.trim().startsWith("•") || line.trim().startsWith("▸")) {
            return (
              <div key={i} className="flex gap-2 text-[10px] leading-snug pl-1">
                <span className="text-amber-500 shrink-0">◆</span>
                <span className="text-slate-300">{line.replace(/^[•▸\s]+/, "")}</span>
              </div>
            );
          }
          return <p key={i} className="text-[10px] text-slate-300 leading-snug italic">{line}</p>;
        })}
      </div>

      {result.evidence_basis?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {result.evidence_basis.slice(0, 2).map((src, i) => (
            <span key={i} className="text-[8px] font-mono px-2 py-0.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded truncate max-w-[140px]">
              {src.length > 28 ? src.substring(0, 28) + "…" : src}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Timeline Card ────────────────────────────────────────────────────────────
function TimelineCard({ event, isSelected, onClick }: { event: any; isSelected: boolean; onClick: () => void }) {
  const Icon = ({ Phone, Camera, WifiOff, Car, MapPin, Activity, BatteryLow } as any)[event.icon] || Info;

  const colorClasses: Record<string, string> = {
    red:    "border-red-500/60 text-red-500 bg-red-500/5 shadow-[0_0_18px_rgba(239,68,68,0.12)]",
    cyan:   "border-cyan-500/50 text-cyan-400 bg-cyan-500/5",
    orange: "border-amber-500/80 text-amber-400 bg-amber-500/8 shadow-[0_0_24px_rgba(245,158,11,0.18)]",
    purple: "border-purple-500/50 text-purple-400 bg-purple-500/5",
    slate:  "border-slate-500/30 text-slate-300 bg-slate-500/5",
  };

  return (
    <motion.div
      layout
      onClick={onClick}
      whileHover={{ scale: 1.04, y: -2 }}
      whileTap={{ scale: 0.97 }}
      className={`
        relative w-44 p-3.5 rounded-xl border cursor-pointer flex flex-col gap-2.5 transition-all duration-200
        ${isSelected
          ? colorClasses[event.color] ?? colorClasses.slate
          : "border-white/8 bg-white/[0.02] opacity-70 grayscale-[0.4]"}
        hover:opacity-100 hover:grayscale-0
      `}
    >
      <div className="flex justify-between items-center">
        <div className="font-mono text-[8px] uppercase tracking-tighter opacity-60">{event.timestamp}</div>
        <Icon size={13} className={isSelected ? "" : "text-slate-600"} />
      </div>

      <div>
        <div className="font-orbitron text-[9px] font-bold uppercase tracking-wider mb-1 line-clamp-1">
          {event.title}
        </div>
        <div className="text-[8px] text-slate-500 leading-tight line-clamp-2">
          {event.description}
        </div>
      </div>

      {/* Confidence bar */}
      <div className="flex items-center gap-1.5">
        <div className="h-0.5 flex-1 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: isSelected ? `${event.confidence}%` : "0%",
              backgroundColor: event.is_anomaly ? "#ef4444" : "#f59e0b",
            }}
          />
        </div>
        <span className="text-[7px] font-mono opacity-50">{event.confidence}%</span>
      </div>

      {/* Anomaly badge */}
      {event.is_anomaly && (
        <div className="absolute -top-2 -right-2 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center shadow-[0_0_8px_rgba(239,68,68,0.8)]">
          <AlertCircle size={9} className="text-white" />
        </div>
      )}
    </motion.div>
  );
}

// ─── Legend Item ──────────────────────────────────────────────────────────────
function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-0.5 w-5 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[7px] font-orbitron text-slate-600 uppercase">{label}</span>
    </div>
  );
}
