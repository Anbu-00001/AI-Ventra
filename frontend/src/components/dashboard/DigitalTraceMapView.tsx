"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react/jsx-no-comment-textnodes */

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  MapPin, Play, Pause, Square, ChevronDown, 
  Wifi, Camera, Map as MapIcon, Globe, Info,
  TrendingUp, AlertCircle, Clock, Zap, Target
} from "lucide-react";
import { getGPSTraces, getGPSSummary } from "@/lib/api";
import type { GPSLog, GPSSummary } from "@/lib/api";

// Fallback trace path coordinates
const fallbackTracePoints = [
  { x: 200, y: 350, time: "02:14 AM", label: "Origin Detected", type: "origin", color: "#14B8A6" },
  { x: 280, y: 320, time: "02:20 AM", label: "Moving North", type: "move", color: "#14B8A6" },
  { x: 350, y: 280, time: "02:35 AM", label: "Stationary", type: "stop", color: "#14B8A6" },
  { x: 450, y: 250, time: "02:47 AM", label: "CCTV Capture", type: "cctv", color: "#14B8A6" },
  { x: 520, y: 200, time: "02:59 AM", label: "Tower Handoff", type: "tower", color: "#14B8A6" },
  { x: 580, y: 150, time: "03:02 AM", label: "Signal Lost", type: "blackout", color: "#EF4444" },
  { x: 620, y: 120, time: "03:10 AM", label: "Interference", type: "blackout", color: "#EF4444" },
  { x: 680, y: 80, time: "03:18 AM", label: "Device Active", type: "active", color: "#F59E0B" },
];

function formatPingTime(ts: string) {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
  } catch { return ts; }
}

function gpsToTracePoints(log: GPSLog) {
  const pings = log.pings ?? [];
  if (!pings.length) return fallbackTracePoints;
  const latMin = Math.min(...pings.map(p => p.latitude));
  const latMax = Math.max(...pings.map(p => p.latitude));
  const lngMin = Math.min(...pings.map(p => p.longitude));
  const lngMax = Math.max(...pings.map(p => p.longitude));
  const latRange = latMax - latMin || 0.01;
  const lngRange = lngMax - lngMin || 0.01;
  return pings.slice(0, 12).map((p, i) => {
    const x = 120 + ((p.longitude - lngMin) / lngRange) * 560;
    const y = 60 + (1 - (p.latitude - latMin) / latRange) * 340;
    const isBlackout = p.speed_kmh > 90 || p.accuracy_m > 40;
    return {
      x, y,
      time: formatPingTime(p.timestamp),
      label: i === 0 ? "Origin" : isBlackout ? "Signal Anomaly" : p.speed_kmh < 10 ? "Stationary" : `Tower ${p.tower_id}`,
      type: i === 0 ? "origin" : isBlackout ? "blackout" : "move",
      color: isBlackout ? "#EF4444" : p.speed_kmh < 10 ? "#F59E0B" : "#14B8A6",
    };
  });
}

export default function DigitalTraceMapView() {
  const [gpsData, setGpsData] = useState<GPSLog | null>(null);
  const [gpsSummary, setGpsSummary] = useState<GPSSummary | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState("1x");
  const [layers, setLayers] = useState({
    towers: true, cctv: true, gps: true, wifi: false, financial: false
  });

  useEffect(() => {
    getGPSTraces(1)
      .then(res => { if (res.data?.[0]) setGpsData(res.data[0]); })
      .catch(() => setGpsData(null));
    getGPSSummary()
      .then(res => setGpsSummary(res.data))
      .catch(() => setGpsSummary(null));
  }, []);

  const tracePoints = useMemo(() => gpsData ? gpsToTracePoints(gpsData) : fallbackTracePoints, [gpsData]);
  const routeStats = useMemo(() => {
    if (!gpsData?.pings?.length) return { dist: "28.7", elapsed: "1H 04M", avg: "44", max: "89" };
    const pings = gpsData.pings;
    const speeds = pings.map(p => p.speed_kmh);
    const avg = Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length);
    const max = Math.round(Math.max(...speeds));
    const mins = pings.length * 6;
    return { dist: (gpsData.coverage_area_km2 * 5.2).toFixed(1), elapsed: `${Math.floor(mins/60)}H ${mins%60}M`, avg: String(avg), max: String(max) };
  }, [gpsData]);

  return (
    <div className="flex flex-col h-full bg-[#05070b] text-slate-200 font-sans overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/20">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-crimson font-bold">
             <MapPin size={20} />
             <span className="font-orbitron text-lg tracking-[0.15em] uppercase text-white">Digital Trace Map</span>
          </div>
          <div className="h-4 w-px bg-white/10" />
          <div className="font-mono text-[10px] text-slate-500 uppercase tracking-widest">
            // Geo-Intelligence System
          </div>
        </div>
        
        <div className="flex items-center gap-8">
           <div className="flex items-center gap-2 bg-red-500/10 px-3 py-1 rounded border border-red-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="font-mono text-[10px] text-red-500 font-bold">LIVE</span>
           </div>
           <div className="text-right">
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-tighter">Case ID: <span className="text-slate-300">AIV-2041-77</span></div>
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-tighter">Analyst: <span className="text-teal-400">AGENT_07 ●</span></div>
           </div>
           <div className="text-right">
              <div className="text-sm font-mono text-slate-300">14:32:07</div>
              <div className="text-[10px] font-mono text-slate-500 uppercase">May 28, 2025</div>
           </div>
        </div>
      </div>

      <div className="flex-1 p-6 grid grid-cols-[300px_1fr_300px] gap-6 overflow-hidden">
        {/* Left Column: Trace Controls & Data Layers */}
        <div className="flex flex-col gap-6 overflow-y-auto custom-scrollbar">
           {/* Trace Controls */}
           <div className="bg-black/40 rounded-xl border border-white/5 p-5">
              <div className="flex items-center justify-between mb-6">
                 <div className="font-orbitron text-[10px] text-slate-400 uppercase tracking-widest">Trace Controls</div>
                 <div className="flex items-center gap-2">
                    <span className="text-[8px] font-mono text-slate-500">SIGNAL REPLAY</span>
                    <div className="w-8 h-4 bg-teal-500/20 rounded-full relative p-0.5 cursor-pointer">
                       <div className="absolute right-0.5 top-0.5 bottom-0.5 w-3 bg-teal-500 rounded-full shadow-[0_0_8px_rgba(20,184,166,0.6)]" />
                    </div>
                 </div>
              </div>

              <div className="flex items-center gap-3 mb-6">
                 <button className="w-8 h-8 rounded-full bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-400 hover:bg-teal-500/20 transition">
                    <Play size={14} fill="currentColor" />
                 </button>
                 <button className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400">
                    <Pause size={14} />
                 </button>
                 <button className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400">
                    <Square size={12} fill="currentColor" />
                 </button>
                 <div className="flex-1 h-1 bg-white/5 rounded-full relative">
                    <div className="absolute top-0 left-0 bottom-0 w-2/3 bg-teal-500" />
                    <div className="absolute top-1/2 left-2/3 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white border-2 border-teal-500" />
                 </div>
                 <div className="text-[9px] font-mono text-slate-500">1x <ChevronDown size={10} className="inline" /></div>
              </div>

              <div className="flex justify-between text-[8px] font-mono text-slate-500 mb-6">
                 <span>02:00 AM</span>
                 <span>03:30 AM</span>
              </div>

              <div className="mb-6">
                 <div className="text-[9px] font-mono text-slate-500 uppercase mb-2 tracking-widest">Replay Speed</div>
                 <div className="flex gap-1">
                    {["0.5x", "1x", "2x", "4x"].map(s => (
                       <button 
                         key={s} 
                         onClick={() => setReplaySpeed(s)}
                         className={`flex-1 py-1 text-[9px] font-mono border ${replaySpeed === s ? 'bg-teal-500/20 border-teal-500 text-teal-400' : 'bg-white/5 border-white/10 text-slate-500'}`}
                       >
                         {s}
                       </button>
                    ))}
                 </div>
              </div>

              <div>
                 <div className="text-[9px] font-mono text-slate-500 uppercase mb-4 tracking-widest">Data Layers</div>
                 <div className="space-y-3">
                    <LayerToggle label="Mobile Towers" active={layers.towers} />
                    <LayerToggle label="CCTV Footage" active={layers.cctv} />
                    <LayerToggle label="GPS Pings" active={layers.gps} />
                    <LayerToggle label="Wi-Fi Logs" active={layers.wifi} />
                    <LayerToggle label="Financial Traces" active={layers.financial} />
                 </div>
              </div>
           </div>

           {/* Location Intelligence */}
           <div className="bg-black/40 rounded-xl border border-white/5 p-5">
              <div className="font-orbitron text-[10px] text-slate-400 uppercase tracking-widest mb-6">Location Intelligence</div>
              <div className="flex items-center gap-6">
                 <div className="relative w-24 h-24">
                    <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                       <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
                       <circle cx="50" cy="50" r="40" fill="none" stroke="#F59E0B" strokeWidth="8" strokeDasharray="251" strokeDashoffset="251 * (1 - 0.72)" strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                       <span className="text-xl font-mono font-bold text-white">72%</span>
                       <span className="text-[6px] font-orbitron text-slate-500 uppercase">High Activity</span>
                    </div>
                 </div>
                 <div className="flex-1 space-y-2">
                    <ZoneStat label="Urban Zone" value="72%" color="bg-amber-500" />
                    <ZoneStat label="Semi-Urban" value="18%" color="bg-slate-500" />
                    <ZoneStat label="Industrial" value="7%" color="bg-slate-600" />
                    <ZoneStat label="Rural" value="3%" color="bg-slate-700" />
                 </div>
              </div>
           </div>
        </div>

        {/* Middle Column: The Map */}
        <div className="flex flex-col gap-6 relative">
           <div className="bg-[#070b14] rounded-xl border border-white/10 flex-1 relative overflow-hidden group">
              {/* Map Image Placeholder (Dark Satellite style) */}
              <div className="absolute inset-0 opacity-40 bg-[url('https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=1474&auto=format&fit=crop')] bg-cover bg-center grayscale" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60" />
              <div className="absolute inset-0 grid-overlay opacity-20" />
              
              {/* Trace Path */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                 <defs>
                    <filter id="mapGlow">
                       <feGaussianBlur stdDeviation="3" result="blur" />
                       <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                 </defs>
                 <path 
                   d={`M ${tracePoints.map(p => `${p.x},${p.y}`).join(' L ')}`}
                   fill="none" stroke="rgba(20,184,166,0.3)" strokeWidth="2" strokeDasharray="5 5"
                 />
                 <path 
                   d={`M ${tracePoints.slice(0, 5).map(p => `${p.x},${p.y}`).join(' L ')}`}
                   fill="none" stroke="#14B8A6" strokeWidth="2" filter="url(#mapGlow)"
                 />
                 <path 
                   d={`M ${tracePoints.slice(4, 7).map(p => `${p.x},${p.y}`).join(' L ')}`}
                   fill="none" stroke="#EF4444" strokeWidth="2" strokeDasharray="4 4"
                 />
                 <path 
                   d={`M ${tracePoints.slice(6).map(p => `${p.x},${p.y}`).join(' L ')}`}
                   fill="none" stroke="#F59E0B" strokeWidth="2" filter="url(#mapGlow)"
                 />
              </svg>

              {/* Map Markers */}
              {tracePoints.map((point, i) => (
                <div 
                  key={i} 
                  className="absolute cursor-pointer group/marker"
                  style={{ left: point.x, top: point.y }}
                >
                   <div className="relative -translate-x-1/2 -translate-y-1/2">
                      <div className="w-3 h-3 rounded-full border-2 border-white shadow-[0_0_10px_currentColor]" style={{ backgroundColor: point.color, color: point.color }} />
                      
                      {/* Tooltip on marker */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover/marker:opacity-100 transition-opacity whitespace-nowrap">
                         <div className="bg-black/80 backdrop-blur-md border border-white/10 px-3 py-1 rounded text-[10px]">
                            <div className="font-mono text-teal-400">{point.time}</div>
                            <div className="font-orbitron font-bold text-white uppercase tracking-tighter">{point.label}</div>
                         </div>
                         <div className="w-px h-2 bg-white/40 mx-auto" />
                      </div>
                   </div>
                </div>
              ))}

              {/* Blackout Zones */}
              <div className="absolute top-1/4 left-1/3 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full border border-red-500/20 bg-red-500/5 animate-pulse">
                 <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-orbitron text-[8px] text-red-500 uppercase font-bold">Signal Blackout</span>
                    <span className="text-[7px] text-red-500/60 uppercase">Interference Detected</span>
                 </div>
              </div>
              
              <div className="absolute bottom-1/4 right-1/3 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full border border-red-500/20 bg-red-500/5 animate-pulse delay-700">
                 <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="font-orbitron text-[8px] text-red-500 uppercase font-bold">Signal Blackout</span>
                    <span className="text-[7px] text-red-500/60 uppercase">Interference Detected</span>
                 </div>
              </div>

              {/* Floating Map Labels */}
              <MapFloatingLabel x="150" y="380" time="02:14 AM" label="Origin Detected" />
              <MapFloatingLabel x="450" y="220" time="02:47 AM" label="CCTV Capture" color="text-teal-400" />
              <MapFloatingLabel x="520" y="240" time="02:59 AM" label="Tower Handoff" />
              <MapFloatingLabel x="680" y="60" time="03:18 AM" label="Device Active" color="text-amber-500" />
           </div>

           {/* Bottom Statistics Section */}
           <div className="grid grid-cols-2 gap-6 h-48">
              {/* Route Summary */}
              <div className="bg-black/40 rounded-xl border border-white/5 p-5">
                 <div className="font-orbitron text-[10px] text-slate-400 uppercase tracking-widest mb-4">Route Summary</div>
                 <div className="grid grid-cols-4 gap-4 mb-6">
                    <RouteStat label="Distance Travelled" value={`${routeStats.dist} KM`} />
                    <RouteStat label="Time Elapsed" value={routeStats.elapsed} />
                    <RouteStat label="Avg Speed" value={`${routeStats.avg} KM/H`} />
                    <RouteStat label="Max Speed" value={`${routeStats.max} KM/H`} />
                 </div>
                 <div className="flex flex-col gap-2">
                    <div className="text-[8px] font-mono text-slate-500 uppercase tracking-widest">{gpsData ? `Device: ${gpsData.device_id} | Owner: ${gpsData.owner}` : "Primary Route"}</div>
                    <div className="flex items-center gap-2 font-mono text-[10px] text-slate-300">
                       <span>{gpsData ? `${gpsData.total_pings} pings` : "Whitefield"}</span> <div className="w-2 h-px bg-slate-700" /> 
                       <span>{gpsData?.anomalies_detected ? "⚠ Anomalies" : "Normal"}</span> <div className="w-2 h-px bg-slate-700" /> 
                       <span>{gpsSummary ? `${gpsSummary.total_devices} devices` : "N/A"}</span>
                    </div>
                 </div>
              </div>

              {/* Key Locations */}
              <div className="bg-black/40 rounded-xl border border-white/5 p-5">
                 <div className="font-orbitron text-[10px] text-slate-400 uppercase tracking-widest mb-4">Key Locations</div>
                 <div className="space-y-2 max-h-24 overflow-y-auto custom-scrollbar pr-2">
                    <LocationRow name="Whitefield Junction" time="02:14 AM" />
                    <LocationRow name="Outer Ring Road" time="02:27 AM" />
                    <LocationRow name="Marathahalli Flyover" time="02:47 AM" />
                    <LocationRow name="Phoenix Mall Zone" time="03:18 AM" />
                 </div>
              </div>
           </div>
        </div>

        {/* Right Column: Timeline & Signal Analysis */}
        <div className="flex flex-col gap-6 overflow-y-auto custom-scrollbar">
           {/* Event Timeline */}
           <div className="bg-black/40 rounded-xl border border-white/5 p-5 flex-1 flex flex-col">
              <div className="font-orbitron text-[10px] text-slate-400 uppercase tracking-widest mb-6">Event Timeline</div>
              <div className="space-y-6 relative flex-1">
                 <div className="absolute left-3.5 top-0 bottom-0 w-px bg-white/5" />
                 <TimelineItem time="02:14 AM" label="Origin Detected" sub="Device connected to Tower ID: BLR_2231" icon={Target} color="teal" active />
                 <TimelineItem time="02:27 AM" label="Route Movement" sub="Moving towards Outer Ring Road" icon={TrendingUp} color="teal" />
                 <TimelineItem time="02:47 AM" label="CCTV Capture" sub="Camera_Rear_07 Whitefield Junction" icon={Camera} color="teal" active />
                 <TimelineItem time="02:59 AM" label="Tower Handoff" sub="Connected to Tower ID: BLR_3345" icon={Globe} color="teal" />
                 <TimelineItem time="03:02 AM" label="Signal Lost" sub="Network disconnected (Interference)" icon={Wifi} color="red" />
                 <TimelineItem time="03:18 AM" label="Device Active" sub="Device connected Near Phoenix Mall" icon={MapPin} color="amber" />
              </div>
           </div>

           {/* Signal Strength Analysis */}
           <div className="bg-black/40 rounded-xl border border-white/5 p-5 h-[340px] flex flex-col">
              <div className="font-orbitron text-[10px] text-slate-400 uppercase tracking-widest mb-6">Signal Strength Over Time</div>
              
              <div className="h-24 mb-8">
                 <svg viewBox="0 0 200 60" className="w-full h-full">
                    <path 
                      d="M 0 30 Q 20 10, 40 40 T 80 20 T 120 50 T 160 30 T 200 20" 
                      fill="none" stroke="#14B8A6" strokeWidth="1.5" 
                    />
                    <path 
                      d="M 120 50 T 160 30 T 200 20" 
                      fill="none" stroke="#EF4444" strokeWidth="2" strokeDasharray="4 2"
                    />
                 </svg>
                 <div className="flex justify-between font-mono text-[7px] text-slate-600 mt-1">
                    <span>02:00 AM</span>
                    <span>02:45 AM</span>
                    <span>03:30 AM</span>
                 </div>
              </div>

              <div className="font-orbitron text-[10px] text-slate-400 uppercase tracking-widest mb-4">Signal Blackout Analysis</div>
              <div className="flex gap-4">
                 <div className="w-20 h-20 relative">
                    <div className="absolute inset-0 border border-white/5 rounded-full" />
                    <div className="absolute inset-2 border border-white/5 rounded-full" />
                    <div className="absolute inset-4 border border-white/5 rounded-full" />
                    <svg viewBox="0 0 100 100" className="w-full h-full">
                       <path d="M 50 0 L 50 100 M 0 50 L 100 50" stroke="rgba(255,255,255,0.05)" />
                       <circle cx="50" cy="50" r="10" fill="#EF4444" className="animate-ping opacity-20" />
                       <circle cx="50" cy="50" r="4" fill="#EF4444" />
                    </svg>
                 </div>
                 <div className="flex-1 flex flex-col justify-center">
                    <div className="text-red-500 font-bold text-xs uppercase mb-1">2 Blackout Zones Detected</div>
                    <ul className="text-[9px] text-slate-500 space-y-1">
                       <li>• Possible Jammer Activity</li>
                       <li>• High Interference</li>
                       <li>• Network Instability</li>
                    </ul>
                 </div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4">
                 <span className="text-[9px] font-orbitron text-slate-500 uppercase">Confidence</span>
                 <span className="text-sm font-mono font-bold text-red-500">87%</span>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

function LayerToggle({ label, active }: { label: string, active: boolean }) {
  return (
    <div className="flex items-center justify-between group cursor-pointer">
       <span className={`text-[10px] font-mono uppercase tracking-tighter ${active ? 'text-slate-200' : 'text-slate-500'} group-hover:text-slate-300 transition`}>{label}</span>
       <div className={`w-6 h-3 rounded-full relative p-0.5 transition-colors ${active ? 'bg-teal-500/20' : 'bg-white/5'}`}>
          <div className={`w-2 h-2 rounded-full shadow-sm transition-all ${active ? 'translate-x-3 bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.5)]' : 'bg-slate-700'}`} />
       </div>
    </div>
  );
}

function TimelineItem({ time, label, sub, icon: Icon, color, active = false }: { time: string, label: string, sub: string, icon: any, color: string, active?: boolean }) {
  const colors: any = {
    teal: "text-teal-400 border-teal-500/40 bg-teal-500/10",
    red: "text-red-500 border-red-500/40 bg-red-500/10",
    amber: "text-amber-500 border-amber-500/40 bg-amber-500/10"
  };

  return (
    <div className="flex gap-4 relative">
       <div className={`w-7 h-7 rounded-full border z-10 flex items-center justify-center shrink-0 ${active ? colors[color] : 'bg-black border-white/10 text-slate-600'}`}>
          <Icon size={14} />
       </div>
       <div className="flex flex-col">
          <div className="flex items-center gap-2">
             <span className={`text-[9px] font-mono font-bold ${active ? 'text-teal-500' : 'text-slate-600'}`}>{time}</span>
             <span className={`font-orbitron text-[10px] font-bold uppercase tracking-wider ${active ? 'text-slate-100' : 'text-slate-500'}`}>{label}</span>
          </div>
          <p className="text-[9px] text-slate-500 leading-tight mt-1">{sub}</p>
       </div>
    </div>
  );
}

function ZoneStat({ label, value, color }: { label: string, value: string, color: string }) {
  return (
    <div className="flex items-center justify-between">
       <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${color}`} />
          <span className="text-[9px] font-mono text-slate-500 uppercase">{label}</span>
       </div>
       <span className="text-[9px] font-mono text-slate-300">{value}</span>
    </div>
  );
}

function RouteStat({ label, value }: { label: string, value: string }) {
  return (
    <div className="flex flex-col">
       <span className="text-[7px] font-mono text-slate-500 uppercase tracking-widest">{label}</span>
       <span className="text-xs font-mono font-bold text-white tracking-tight">{value}</span>
    </div>
  );
}

function LocationRow({ name, time }: { name: string, time: string }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-white/[0.03] group hover:bg-white/[0.02] transition px-1">
       <div className="flex items-center gap-3">
          <MapPin size={10} className="text-teal-500" />
          <span className="text-[9px] font-orbitron text-slate-400 group-hover:text-slate-200 transition">{name}</span>
       </div>
       <span className="text-[9px] font-mono text-slate-600">{time}</span>
    </div>
  );
}

function MapFloatingLabel({ x, y, time, label, color = "text-slate-400" }: { x: string, y: string, time: string, label: string, color?: string }) {
  return (
    <div className="absolute pointer-events-none" style={{ left: `${x}px`, top: `${y}px` }}>
       <div className="bg-black/60 backdrop-blur-sm border border-white/5 px-2 py-0.5 rounded text-[8px] whitespace-nowrap">
          <span className="font-mono text-teal-500/80 mr-2">{time}</span>
          <span className={`font-orbitron font-bold uppercase tracking-tighter ${color}`}>{label}</span>
       </div>
    </div>
  );
}
