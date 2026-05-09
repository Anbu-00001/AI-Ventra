"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Camera, ShieldAlert, Zap, Activity, Scan, Target, Maximize2, RefreshCw } from "lucide-react";

export default function VisualIntelligenceView() {
  const [activeCamera, setActiveCamera] = useState(0);
  const [glitch, setGlitch] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setGlitch(true);
      setTimeout(() => setGlitch(false), 150);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const cameras = [
    { id: "CAM-01", location: "South Perimeter", status: "ACTIVE", threat: "LOW" },
    { id: "CAM-02", location: "Main Entry", status: "ACTIVE", threat: "ELEVATED" },
    { id: "CAM-03", location: "Loading Dock", status: "ACTIVE", threat: "LOW" },
    { id: "CAM-04", location: "Server Room", status: "STANDBY", threat: "NONE" },
  ];

  return (
    <div className="flex flex-col h-full bg-[#05070b] text-slate-200 font-sans overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black/20">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-crimson font-bold">
            <Camera size={20} />
            <span className="font-orbitron text-lg tracking-[0.15em] uppercase">Visual Intelligence</span>
          </div>
          <div className="h-4 w-px bg-white/10" />
          <div className="font-mono text-[10px] text-slate-500 uppercase tracking-widest">
            // Multi-Stream Neural Object Detection
          </div>
        </div>
        <div className="flex items-center gap-4">
            <div className="px-3 py-1 bg-crimson/10 border border-crimson/30 rounded text-[10px] font-mono text-crimson-glow animate-pulse">
                REC ● LIVE
            </div>
            <RefreshCw size={16} className="text-slate-500 cursor-pointer hover:text-white transition" />
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_320px] overflow-hidden">
        {/* Main Feed */}
        <div className="relative p-6 bg-black/40 overflow-hidden flex flex-col gap-4">
          <div className={`relative flex-1 border border-white/10 bg-[#080c14] overflow-hidden group ${glitch ? 'opacity-90 scale-[1.002] grayscale-[0.2]' : ''}`}>
            {/* Camera Overlay */}
            <div className="absolute inset-0 pointer-events-none z-10">
                <div className="absolute top-6 left-6 flex flex-col gap-1">
                    <div className="font-mono text-xs text-teal-400">FEED_ID: {cameras[activeCamera].id}</div>
                    <div className="font-mono text-[10px] text-slate-500 uppercase tracking-tighter">{cameras[activeCamera].location}</div>
                </div>
                <div className="absolute top-6 right-6 font-mono text-xs text-crimson-glow">00:08:42:12</div>
                
                {/* Corner Accents */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white/20" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white/20" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white/20" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white/20" />

                {/* Tracking Box */}
                <motion.div 
                    animate={{ 
                        x: [100, 400, 350, 150], 
                        y: [150, 200, 450, 300],
                        opacity: [0, 1, 1, 0]
                    }}
                    transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                    className="absolute w-32 h-48 border border-teal-400/50 bg-teal-400/5 flex flex-col justify-between p-2"
                >
                    <div className="flex justify-between items-start">
                        <Scan size={14} className="text-teal-400" />
                        <span className="bg-teal-400 text-[8px] text-black px-1 font-bold">MATCH 98%</span>
                    </div>
                    <div className="font-mono text-[8px] text-teal-400">OBJ_ID: PERSON_82</div>
                </motion.div>
            </div>

            {/* Static/Noise Background */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none dashboard-noise" />
            <div className="absolute inset-0 flex items-center justify-center">
                 <div className="text-center">
                    <Camera size={64} className="mx-auto text-white/5 mb-4" />
                    <div className="font-orbitron text-sm text-white/10 uppercase tracking-widest italic">Signal Processed via Neural Core</div>
                 </div>
            </div>
            
            <div className="absolute bottom-6 left-6 flex gap-4 z-10">
                <div className="flex items-center gap-2 px-3 py-1 bg-black/60 border border-white/10 rounded-full">
                    <Activity size={12} className="text-teal-400" />
                    <span className="font-mono text-[10px] text-slate-300 uppercase tracking-widest">Motion Detected</span>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 bg-black/60 border border-white/10 rounded-full">
                    <Target size={12} className="text-amber-400" />
                    <span className="font-mono text-[10px] text-slate-300 uppercase tracking-widest">Face Tracking Active</span>
                </div>
            </div>
            
            <div className="absolute bottom-6 right-6 z-10">
                <Maximize2 size={20} className="text-slate-500 hover:text-white cursor-pointer transition" />
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 h-32">
            {cameras.map((cam, i) => (
                <div 
                    key={cam.id}
                    onClick={() => setActiveCamera(i)}
                    className={`relative cursor-pointer border transition-all overflow-hidden ${activeCamera === i ? 'border-crimson/50 bg-crimson/5' : 'border-white/5 bg-black/20 hover:border-white/20'}`}
                >
                    <div className="absolute inset-0 flex items-center justify-center opacity-20">
                        <Camera size={24} className="text-slate-500" />
                    </div>
                    <div className="absolute top-2 left-2 font-mono text-[8px] text-slate-400">{cam.id}</div>
                    <div className={`absolute bottom-2 right-2 w-1.5 h-1.5 rounded-full ${cam.status === 'ACTIVE' ? 'bg-teal-400 shadow-[0_0_8px_#18f3e2]' : 'bg-slate-600'}`} />
                </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="border-l border-white/5 bg-black/20 flex flex-col overflow-y-auto">
            <div className="p-5 border-b border-white/5">
                <h3 className="font-orbitron text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Detection Events</h3>
                <div className="space-y-4">
                    {[
                        { time: "00:07:12", event: "Facial Match", detail: "Subject Delta-9", confidence: "99.2%", type: "MATCH" },
                        { time: "00:05:48", event: "License Plate", detail: "ABC-8219", confidence: "94.8%", type: "INFO" },
                        { time: "23:58:22", event: "Unauthorized Entry", detail: "Zone B-4", confidence: "100%", type: "ALERT" },
                    ].map((ev, i) => (
                        <div key={i} className="bg-white/[0.03] border border-white/5 p-3 rounded flex flex-col gap-1">
                            <div className="flex justify-between items-center">
                                <span className="font-mono text-[9px] text-slate-500">{ev.time}</span>
                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${ev.type === 'ALERT' ? 'bg-red-500/20 text-red-500' : 'bg-teal-400/20 text-teal-400'}`}>
                                    {ev.type}
                                </span>
                            </div>
                            <div className="font-orbitron text-[10px] text-slate-200">{ev.event}</div>
                            <div className="font-mono text-[9px] text-slate-400 italic">{ev.detail} · {ev.confidence}</div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="p-5">
                <h3 className="font-orbitron text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Neural Analytics</h3>
                <div className="space-y-6">
                    <div>
                        <div className="flex justify-between text-[10px] font-mono text-slate-500 mb-2 uppercase">
                            <span>Object Recognition</span>
                            <span>98%</span>
                        </div>
                        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: "98%" }} className="h-full bg-teal-400 shadow-[0_0_10px_#18f3e2]" />
                        </div>
                    </div>
                    <div>
                        <div className="flex justify-between text-[10px] font-mono text-slate-500 mb-2 uppercase">
                            <span>Crowd Density</span>
                            <span>12%</span>
                        </div>
                        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: "12%" }} className="h-full bg-teal-400 shadow-[0_0_10px_#18f3e2]" />
                        </div>
                    </div>
                    <div className="pt-4 border-t border-white/5">
                        <div className="p-4 bg-crimson/5 border border-crimson/20 rounded">
                            <div className="flex items-center gap-2 text-crimson-glow mb-2">
                                <ShieldAlert size={14} />
                                <span className="font-orbitron text-[10px] font-bold uppercase tracking-widest">Active Threat</span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-mono leading-relaxed">
                                Unidentified individual detected in main entry zone after hours. Neural matching suggests possible correlation with forensic case file AIV-2041.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
