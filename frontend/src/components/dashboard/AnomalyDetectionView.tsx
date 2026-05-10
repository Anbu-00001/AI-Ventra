"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react/jsx-no-comment-textnodes */

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Activity, AlertTriangle, MessageSquare, MapPin, 
  DollarSign, Smartphone, Users, Info, TrendingUp,
  ShieldAlert, Radio, Zap
} from "lucide-react";
import { getDemoAnomalies } from "@/lib/api";
import type { AnomalyReport } from "@/lib/api";

// Mock data generators
const generateChartData = (points: number, variance: number = 20) => {
  return Array.from({ length: points }, (_, i) => ({
    x: i,
    current: 40 + Math.sin(i * 0.3) * 30 + (Math.random() - 0.5) * variance,
    baseline: 30 + Math.sin(i * 0.25) * 20
  }));
};

const liveStreamData = generateChartData(60, 40);
const baselineComparisonData = generateChartData(40, 15);

export default function AnomalyDetectionView() {
  const [report, setReport] = useState<AnomalyReport | null>(null);
  const [threatScore, setThreatScore] = useState(82);
  const [time, setTime] = useState("14:32:07");

  useEffect(() => {
    getDemoAnomalies()
      .then((response) => {
        setReport(response.data);
        setThreatScore(Math.round(response.data.overall_threat_score));
      })
      .catch(() => setReport(null));
  }, []);

  return (
    <div className="flex flex-col h-full bg-[#05070b] text-slate-200 font-sans overflow-hidden">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/20">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-crimson font-bold">
             <ShieldAlert size={20} />
             <span className="font-orbitron text-lg tracking-[0.15em] uppercase">Anomaly Detection</span>
          </div>
          <div className="h-4 w-px bg-white/10" />
          <div className="font-mono text-[10px] text-slate-500 uppercase tracking-widest">
            // Behavioral Threat Analysis Engine
          </div>
        </div>
        
        <div className="flex items-center gap-8">
           <div className="text-right">
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-tighter">Case ID: <span className="text-slate-300">AIV-2041-77</span></div>
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-tighter">Case: <span className="text-teal-400">{report?.case_id ?? "AIV-2041-77"} ●</span></div>
           </div>
           <div className="text-right">
              <div className="text-sm font-mono text-slate-300">{time}</div>
              <div className="text-[10px] font-mono text-slate-500 uppercase">May 28, 2025</div>
           </div>
        </div>
      </div>

      <div className="flex-1 p-6 grid grid-cols-[1fr_300px_320px] gap-6 overflow-y-auto custom-scrollbar">
        {/* Left Column: Live Stream & Drift Wave */}
        <div className="flex flex-col gap-6">
          {/* Live Anomaly Stream */}
          <div className="bg-black/40 rounded-xl border border-white/5 p-5 relative">
            <div className="flex items-center justify-between mb-6">
              <div className="flex flex-col">
                 <div className="flex items-center gap-2 font-orbitron text-xs text-slate-300 uppercase tracking-widest">
                   <div className="w-1.5 h-1.5 rounded-full bg-crimson animate-pulse" />
                   Live Anomaly Stream
                 </div>
                 <div className="text-[9px] font-mono text-slate-500 mt-1 uppercase">Real-time behavioral monitoring & threat intelligence</div>
              </div>
              <div className="flex items-center gap-4">
                 <StatusIndicator label="Stream Status" value="LIVE" color="bg-teal-500" />
                 <StatusIndicator label="Data Feed" value="ACTIVE" color="bg-teal-500" />
                 <div className="text-[9px] font-mono text-slate-500 uppercase">Update Rate: <span className="text-slate-300">250ms</span></div>
              </div>
            </div>

            <div className="h-64 relative w-full">
               {/* Chart Axis */}
               <div className="absolute left-0 top-0 bottom-0 w-8 flex flex-col justify-between text-[8px] font-mono text-slate-600 border-r border-white/5 pr-2">
                  <span>100</span><span>75</span><span>50</span><span>25</span><span>0</span><span>-25</span><span>-50</span><span>-75</span><span>-100</span>
               </div>
               
               {/* Y-Axis Labels (Right side within chart) */}
               <div className="absolute right-0 top-0 bottom-0 w-12 flex flex-col justify-between text-[8px] font-orbitron text-slate-500 text-right uppercase py-4 pr-2">
                  <span className="text-crimson/80">Extreme</span>
                  <span>High</span>
                  <span className="text-amber-500/80">Elevated</span>
                  <span>Normal</span>
                  <span>Low</span>
                  <span>Minimal</span>
               </div>

               {/* Legend */}
               <div className="absolute top-0 right-16 flex items-center gap-4 text-[8px] font-mono text-slate-500">
                  <div className="flex items-center gap-1"><div className="w-2 h-[1px] bg-teal-500" /> Baseline Behavior</div>
                  <div className="flex items-center gap-1"><div className="w-2 h-[1px] bg-white" /> Current Behavior</div>
               </div>

               <svg className="absolute left-8 right-12 top-0 bottom-0 w-[calc(100%-80px)] h-full overflow-visible">
                  {/* Grid Lines */}
                  {[25, 50, 75].map(y => (
                    <line key={y} x1="0" y1={`${y}%`} x2="100%" y2={`${y}%`} stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
                  ))}
                  <line x1="0" y1="50%" x2="100%" y2="50%" stroke="rgba(255,255,255,0.1)" />

                  {/* Threshold Line */}
                  <line x1="0" y1="30%" x2="100%" y2="30%" stroke="rgba(245,158,11,0.3)" strokeDasharray="2 2" />

                  {/* Baseline Path */}
                  <path 
                    d={`M ${liveStreamData.map(d => `${d.x * 12},${50 - (d.baseline * 0.4)}`).join(' L ')}`}
                    fill="none" stroke="#14B8A6" strokeWidth="1" strokeOpacity="0.4"
                  />

                  {/* Current Path */}
                  <path 
                    d={`M ${liveStreamData.map(d => `${d.x * 12},${50 - (d.current * 0.4)}`).join(' L ')}`}
                    fill="none" stroke="#F8FAFC" strokeWidth="1.5"
                  />

                  {/* Anomaly Bursts */}
                  <AnomalyBurst x={150} y={40} label="Anomaly Burst" />
                  <AnomalyBurst x={320} y={25} label="Anomaly Burst" />
                  <AnomalyBurst x={480} y={45} label="Anomaly Burst" />
                  <AnomalyBurst x={600} y={35} label="Anomaly Burst" />

                  {/* Live Cursor */}
                  <rect x="740" y="0" width="1" height="100%" fill="#F59E0B" className="animate-pulse" />
                  <circle cx="740" cy="42" r="4" fill="#F59E0B" className="shadow-[0_0_10px_#F59E0B]" />
               </svg>

               {/* X-Axis Ticks */}
               <div className="absolute left-8 right-12 -bottom-6 flex justify-between text-[8px] font-mono text-slate-600 w-[calc(100%-80px)]">
                  <span>13:50:00</span><span>13:55:00</span><span>14:00:00</span><span>14:05:00</span><span>14:10:00</span><span>14:15:00</span><span>14:20:00</span><span>14:30:00</span><span className="text-amber-500 font-bold">LIVE</span><span>14:32:00</span>
               </div>
            </div>
          </div>

          {/* Behavioral Drift Wave */}
          <div className="bg-black/40 rounded-xl border border-white/5 p-5 flex-1 min-h-[160px] relative">
             <div className="font-orbitron text-[10px] text-slate-400 uppercase tracking-widest mb-4">Behavioral Drift Wave</div>
             <div className="absolute inset-x-5 bottom-10 top-12">
                <svg className="w-full h-full" preserveAspectRatio="none">
                   <defs>
                      <linearGradient id="driftGradient" x1="0" y1="0" x2="1" y2="0">
                         <stop offset="0%" stopColor="#14B8A6" stopOpacity="0.8" />
                         <stop offset="40%" stopColor="#14B8A6" stopOpacity="0.2" />
                         <stop offset="60%" stopColor="#C0182A" stopOpacity="0.2" />
                         <stop offset="100%" stopColor="#C0182A" stopOpacity="0.8" />
                      </linearGradient>
                   </defs>
                   <path 
                     d={`M 0 40 ${Array.from({length: 20}).map((_, i) => `Q ${i * 40 + 20} ${i % 2 === 0 ? 10 : 70}, ${i * 40 + 40} 40`).join(' ')}`}
                     stroke="url(#driftGradient)" strokeWidth="2" fill="none"
                   />
                </svg>
             </div>
             <div className="absolute bottom-5 left-5 right-5 flex justify-between font-orbitron text-[8px] tracking-widest uppercase">
                <span className="text-teal-400">Stability</span>
                <span className="text-crimson">Instability</span>
             </div>
          </div>

          {/* Anomaly Event Feed */}
          <div className="bg-black/40 rounded-xl border border-white/5 p-5">
             <div className="flex items-center gap-2 font-orbitron text-[10px] text-slate-300 uppercase tracking-widest mb-4">
                <div className="w-1.5 h-1.5 rounded-full bg-crimson" />
                Anomaly Event Feed
             </div>
             <div className="space-y-2">
                {(report?.anomalies ?? []).slice(0, 5).map((anomaly) => (
                  <FeedItem
                    key={anomaly.anomaly_id}
                    time={anomaly.detected_at}
                    label={anomaly.anomaly_type.replace(/_/g, " ")}
                    sub={anomaly.description}
                    severity={anomaly.severity === "CRITICAL" ? "SEVERE" : anomaly.severity}
                  />
                ))}
                {!report ? (
                  <>
                    <FeedItem time="14:31:45" label="Anomaly Burst Detected" sub="Neural pattern deviation spike" severity="SEVERE" />
                    <FeedItem time="14:29:12" label="Communication Silence" sub="No outbound communication" severity="MODERATE" />
                    <FeedItem time="14:26:38" label="Route Inconsistency" sub="Unexpected location deviation" severity="SEVERE" />
                  </>
                ) : null}
             </div>
             <button className="w-full mt-4 py-2 border border-white/5 bg-white/[0.02] text-[9px] font-orbitron text-slate-500 hover:text-slate-300 transition uppercase tracking-widest">
               + View Full Log
             </button>
          </div>
        </div>

        {/* Middle Column: Escalation Meter & Threat Projection */}
        <div className="flex flex-col gap-6">
           {/* Threat Escalation Meter */}
           <div className="bg-black/40 rounded-xl border border-white/5 p-5 flex flex-col items-center flex-1">
              <div className="font-orbitron text-[10px] text-slate-400 uppercase tracking-widest mb-8">Threat Escalation Meter</div>
              
              <div className="relative w-16 flex-1 max-h-[400px] mb-8">
                 {/* Meter Glass */}
                 <div className="absolute inset-0 rounded-full border border-white/10 bg-gradient-to-b from-white/5 to-transparent flex flex-col justify-end p-1">
                    <div className="w-full rounded-full bg-gradient-to-t from-green-500 via-yellow-500 via-orange-500 to-red-500" style={{ height: `${threatScore}%` }}>
                       <div className="w-full h-full animate-pulse bg-white/20" />
                    </div>
                 </div>
                 
                 {/* Meter Marks */}
                 <div className="absolute left-full ml-4 top-0 bottom-0 flex flex-col justify-between font-mono text-[9px] text-slate-500 py-2">
                    <div className="flex items-center gap-2"><span className="text-crimson">Critical</span><span>{'>'} 90</span></div>
                    <div className="flex items-center gap-2"><span className="text-red-500">Severe</span><span>70 - 90</span></div>
                    <div className="flex items-center gap-2"><span className="text-amber-500">Moderate</span><span>40 - 70</span></div>
                    <div className="flex items-center gap-2"><span className="text-yellow-500">Low</span><span>10 - 40</span></div>
                    <div className="flex items-center gap-2"><span className="text-teal-400">Minimal</span><span>{'<'} 10</span></div>
                 </div>
              </div>

              <div className="text-center">
                 <div className="text-4xl font-mono font-bold text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)] bg-red-500/10 px-4 py-2 rounded-lg border border-red-500/20">{threatScore}</div>
                 <div className="mt-2 font-orbitron text-[10px] text-slate-500 uppercase tracking-widest">Threat Score</div>
              </div>
           </div>

           {/* Predictive Threat Projection */}
           <div className="bg-black/40 rounded-xl border border-white/5 p-5 h-[340px]">
              <div className="font-orbitron text-[10px] text-slate-400 uppercase tracking-widest mb-4">Predictive Threat Projection</div>
              <div className="flex gap-4 items-center">
                 <div className="w-40 h-40 relative">
                    <div className="absolute inset-0 border border-white/5 rounded-full" />
                    <div className="absolute inset-2 border border-white/5 rounded-full" />
                    <div className="absolute inset-4 border border-white/5 rounded-full" />
                    <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                       <circle cx="50" cy="50" r="50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                       <path d="M 50 0 L 50 100 M 0 50 L 100 50" stroke="rgba(255,255,255,0.05)" />
                       <path 
                         d="M 50 50 L 60 40 L 75 35 L 85 20 L 95 10" 
                         fill="none" stroke="#ef4444" strokeWidth="1.5" 
                       />
                       <circle cx="95" cy="10" r="2" fill="#ef4444" className="animate-ping" />
                    </svg>
                 </div>
                 <div className="flex-1 flex flex-col justify-center">
                    <div className="text-[9px] font-mono text-slate-500 uppercase mb-1">Probability of Escalation</div>
                    <div className="text-4xl font-mono font-bold text-red-500">{Math.round(report?.escalation_probability ?? 87)}%</div>
                    <div className="mt-4 space-y-2">
                       <ProjectionStat label="Next 5 MIN" value="72%" color="text-red-400" />
                       <ProjectionStat label="Next 15 MIN" value="81%" color="text-red-500" />
                       <ProjectionStat label="Next 30 MIN" value="87%" color="text-red-500" />
                       <ProjectionStat label="Next 60 MIN" value="91%" color="text-red-600" />
                    </div>
                 </div>
              </div>
              <div className="mt-6 flex items-center gap-3 bg-red-500/5 border border-red-500/20 px-3 py-2 rounded">
                 <AlertTriangle size={14} className="text-red-500" />
                 <span className="font-orbitron text-[10px] text-red-500 uppercase tracking-widest">Trajectory: Escalating</span>
              </div>
           </div>
        </div>

        {/* Right Column: Reasons & Baseline Comparison */}
        <div className="flex flex-col gap-6">
           {/* Anomaly Reasons */}
           <div className="bg-black/40 rounded-xl border border-white/5 p-5 flex flex-col flex-1">
              <div className="font-orbitron text-[10px] text-slate-400 uppercase tracking-widest mb-4">Anomaly Reasons</div>
              
              <div className="flex items-center gap-3 text-red-500 bg-red-500/10 p-3 border border-red-500/20 mb-6">
                 <AlertTriangle size={16} />
                 <span className="font-orbitron text-[11px] font-bold uppercase tracking-widest">Anomaly Detected</span>
              </div>
              
              <p className="text-[11px] text-slate-400 mb-6 leading-relaxed">
                {report?.behavioral_profile?.baseline_comparison ?? "Behavior deviated from baseline pattern across multiple vectors."}
              </p>

              <div className="space-y-4">
                 {(report?.anomalies?.[0]?.contributing_factors ?? [
                   { factor: "Route Inconsistency", weight: 32, explanation: "Movement pattern deviates significantly from usual travel behavior." },
                   { factor: "Communication Silence", weight: 27, explanation: "Unusual gap in communications detected during critical window." },
                   { factor: "Device Behavior Drift", weight: 12, explanation: "Device usage pattern significantly changed." },
                 ]).map((factor, index) => (
                   <ReasonItem
                     key={factor.factor}
                     icon={[TrendingUp, Radio, Smartphone, DollarSign, Users][index] ?? Activity}
                     label={factor.factor}
                     impact={`${factor.weight}%`}
                     desc={factor.explanation}
                   />
                 ))}
              </div>
           </div>

           {/* Behavior Baseline Comparison */}
           <div className="bg-black/40 rounded-xl border border-white/5 p-5 h-[340px]">
              <div className="font-orbitron text-[10px] text-slate-400 uppercase tracking-widest mb-6">Behavior Baseline Comparison</div>
              
              <div className="grid grid-cols-3 gap-2 mb-6">
                 <StatBox label="Deviation Score" value={`+${Math.round(report?.behavioral_profile?.deviation_score ?? 68.4)}%`} color="text-red-500" />
                 <StatBox label="Pattern Shift" value={report?.behavioral_profile?.pattern_shift ?? "HIGH"} color="text-red-500" />
                 <StatBox label="Confidence" value={`${Math.round(report?.anomalies?.[0]?.confidence ?? 89)}%`} color="text-teal-400" />
              </div>

              <div className="h-28 relative">
                 <div className="absolute top-0 right-0 flex items-center gap-4 text-[8px] font-mono text-slate-500 mb-2">
                    <div className="flex items-center gap-1"><div className="w-2 h-[1px] bg-teal-500" /> Baseline</div>
                    <div className="flex items-center gap-1"><div className="w-2 h-[1px] bg-white" /> Current</div>
                 </div>
                 <svg className="w-full h-full overflow-visible pt-6">
                    <path 
                      d={`M ${baselineComparisonData.map(d => `${d.x * 8},${60 - (d.baseline * 0.5)}`).join(' L ')}`}
                      fill="none" stroke="#14B8A6" strokeWidth="1" strokeOpacity="0.6"
                    />
                    <path 
                      d={`M ${baselineComparisonData.map(d => `${d.x * 8},${60 - (d.current * 0.5)}`).join(' L ')}`}
                      fill="none" stroke="#F8FAFC" strokeWidth="1.5"
                    />
                    {/* Anomaly Highlight */}
                    <rect x="200" y="0" width="40" height="100%" fill="rgba(239,68,68,0.1)" />
                 </svg>
                 <div className="absolute bottom-0 right-0 font-orbitron text-[8px] text-red-500 uppercase tracking-widest">Anomaly Zone</div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

function StatusIndicator({ label, value, color }: { label: string, value: string, color: string }) {
  return (
    <div className="flex items-center gap-2">
       <span className="text-[9px] font-mono text-slate-500 uppercase">{label}:</span>
       <span className={`text-[9px] font-mono font-bold ${color.replace('bg-', 'text-')} flex items-center gap-1`}>
         {value} <div className={`w-1 h-1 rounded-full ${color}`} />
       </span>
    </div>
  );
}

function AnomalyBurst({ x, y, label }: { x: number, y: number, label: string }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
       <path d="M -20 -10 L 0 -30 L 20 -10 L -20 -10" fill="rgba(239,68,68,0.1)" stroke="#ef4444" strokeWidth="0.5" />
       <text x="0" y="-15" textAnchor="middle" fontSize="6" className="font-orbitron fill-red-500 uppercase tracking-tighter">{label}</text>
       <circle r="2" fill="#ef4444" className="animate-pulse" />
    </g>
  );
}

function FeedItem({ time, label, sub, severity }: { time: string, label: string, sub: string, severity: string }) {
  const sevColor = severity === "SEVERE" ? "text-red-500" : severity === "MODERATE" ? "text-amber-500" : "text-teal-400";
  return (
    <div className="flex items-center justify-between group cursor-pointer hover:bg-white/[0.02] p-1 rounded transition">
       <div className="flex items-center gap-4">
          <div className="text-[9px] font-mono text-slate-500">{time}</div>
          <div className="flex flex-col">
             <div className="text-[10px] font-bold text-slate-200">{label}</div>
             <div className="text-[8px] text-slate-500">{sub}</div>
          </div>
       </div>
       <div className={`text-[8px] font-orbitron font-bold ${sevColor} tracking-widest`}>{severity}</div>
    </div>
  );
}

function ProjectionStat({ label, value, color }: { label: string, value: string, color: string }) {
  return (
    <div className="flex items-center justify-between">
       <span className="text-[9px] font-mono text-slate-500 uppercase tracking-tighter">{label}</span>
       <span className={`text-xs font-mono font-bold ${color}`}>{value}</span>
    </div>
  );
}

function ReasonItem({ icon: Icon, label, impact, desc }: { icon: any, label: string, impact: string, desc: string }) {
  return (
    <div className="flex items-start gap-4 p-2 hover:bg-white/[0.02] transition rounded group">
       <div className="mt-1 w-10 h-10 shrink-0 rounded-lg border border-white/5 bg-white/[0.03] flex items-center justify-center text-red-500 group-hover:border-red-500/30 transition">
          <Icon size={20} strokeWidth={1.5} />
       </div>
       <div className="flex flex-col">
          <div className="flex items-center justify-between mb-1">
             <span className="font-orbitron text-[10px] font-bold text-slate-300 uppercase">{label}</span>
             <span className="text-[10px] font-mono text-red-500">Impact: {impact}</span>
          </div>
          <p className="text-[9px] text-slate-500 leading-relaxed">{desc}</p>
       </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string, value: string, color: string }) {
  return (
    <div className="bg-black/30 border border-white/5 p-2 text-center">
       <div className="text-[8px] font-orbitron text-slate-500 uppercase tracking-tighter mb-1">{label}</div>
       <div className={`text-sm font-mono font-bold ${color}`}>{value}</div>
    </div>
  );
}
