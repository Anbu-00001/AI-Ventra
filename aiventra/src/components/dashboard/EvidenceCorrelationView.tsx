/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useEffect, useMemo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, ChevronRight, Expand, FileText, Laptop,
  Layers, RadioTower, Search, Smartphone, UserRound,
  Loader2, RefreshCw, X, Activity, MapPin, Car, Cpu,
} from "lucide-react";
import { getEvidenceCorrelation, queryRAG } from "@/lib/api";
import { EmptyState } from "./EmptyState";
import type { CorrelationGraph, CorrelationNode, CorrelationEdge } from "@/lib/api";

// ─── Constants ────────────────────────────────────────────────────────────────

const NODE_COLORS: Record<string, string> = {
  suspect:   "#ff2848",
  device:    "#18f3e2",
  location:  "#f5a400",
  timestamp: "#f8fafc",
  document:  "#c084fc",
};

const STRENGTH_STYLE: Record<string, { color: string; dash: string; width: number }> = {
  "very-high": { color: "#ff2848", dash: "0",   width: 0.38 },
  high:        { color: "#f5a400", dash: "0",   width: 0.22 },
  medium:      { color: "#f5a400", dash: "8 6", width: 0.18 },
  low:         { color: "#18f3e2", dash: "5 7", width: 0.14 },
  "very-low":  { color: "#f8fafc", dash: "3 8", width: 0.10 },
};

// ─── Node Icon Resolver ────────────────────────────────────────────────────────

function resolveIcon(node: CorrelationNode) {
  const id = node.id.toLowerCase();
  const meta = (node.meta || "").toLowerCase();
  const label = (node.label || "").toLowerCase();
  if (node.node_type === "suspect") return UserRound;
  if (node.node_type === "location") return MapPin;
  if (node.node_type === "document") return FileText;
  if (node.node_type === "timestamp") return null;
  // device subtypes
  if (id.includes("vehicle") || meta.includes("ka-") || label.includes("vehicle")) return Car;
  if (id.includes("cctv") || label.includes("cam")) return Camera;
  if (id.includes("tower") || label.includes("tower")) return RadioTower;
  if (id.includes("laptop") || meta.includes("laptop")) return Laptop;
  if (id.includes("sensor") || id.includes("sn_")) return Activity;
  if (id.includes("gps") || meta.includes("gps")) return MapPin;
  if (id.includes("phone") || meta.match(/\d{10}/)) return Smartphone;
  return Cpu;
}

// ─── Force Layout ─────────────────────────────────────────────────────────────
// Simple force-directed simulation: repulsion between all nodes, attraction along edges

interface LayoutNode { id: string; x: number; y: number; vx: number; vy: number }

function runForceLayout(
  nodes: CorrelationNode[],
  edges: CorrelationEdge[],
  iterations = 200,
): Record<string, { x: number; y: number }> {
  if (!nodes.length) return {};

  // Seed positions in a circle with jitter
  const positions: LayoutNode[] = nodes.map((n, i) => {
    const angle = (i / nodes.length) * Math.PI * 2;
    const r = 35;
    return {
      id: n.id,
      x: 50 + Math.cos(angle) * r + (Math.random() - 0.5) * 4,
      y: 50 + Math.sin(angle) * r * 0.75 + (Math.random() - 0.5) * 4,
      vx: 0,
      vy: 0,
    };
  });

  const posMap = new Map(positions.map(p => [p.id, p]));

  for (let iter = 0; iter < iterations; iter++) {
    const cooling = 1 - iter / iterations;

    // Repulsion
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const a = positions[i], b = positions[j];
        const dx = b.x - a.x, dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
        const force = (18 / (dist * dist)) * cooling;
        const fx = (dx / dist) * force, fy = (dy / dist) * force;
        a.vx -= fx; a.vy -= fy;
        b.vx += fx; b.vy += fy;
      }
    }

    // Attraction along edges
    for (const edge of edges) {
      const a = posMap.get(edge.source), b = posMap.get(edge.target);
      if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
      const strength = { "very-high": 0.06, high: 0.05, medium: 0.03, low: 0.02, "very-low": 0.01 }[edge.strength] ?? 0.03;
      const force = dist * strength * cooling;
      const fx = (dx / dist) * force, fy = (dy / dist) * force;
      a.vx += fx; a.vy += fy;
      b.vx -= fx; b.vy -= fy;
    }

    // Center gravity
    for (const p of positions) {
      p.vx += (50 - p.x) * 0.008 * cooling;
      p.vy += (50 - p.y) * 0.008 * cooling;
    }

    // Apply velocities + damping
    for (const p of positions) {
      p.x = Math.max(8, Math.min(92, p.x + p.vx));
      p.y = Math.max(8, Math.min(88, p.y + p.vy));
      p.vx *= 0.75;
      p.vy *= 0.75;
    }
  }

  return Object.fromEntries(positions.map(p => [p.id, { x: p.x, y: p.y }]));
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EvidenceCorrelationView() {
  const [graph, setGraph] = useState<CorrelationGraph | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<"Graph View" | "Chain Of Events" | "Matrix View">("Graph View");
  const [showLabels, setShowLabels] = useState(true);
  const [animateEdges, setAnimateEdges] = useState(true);
  const [highlightPaths, setHighlightPaths] = useState(true);
  const [physicsLayout, setPhysicsLayout] = useState(true);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [layout, setLayout] = useState<Record<string, { x: number; y: number }>>({});

  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);

  // ── Load data ────────────────────────────────────────────────────────────
  const loadGraph = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getEvidenceCorrelation();
      setGraph(res.data);
    } catch {
      setError("Failed to load — backend may be starting");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadGraph(); }, [loadGraph]);

  // ── Run force layout when graph/physics setting changes ──────────────────
  useEffect(() => {
    if (!graph?.nodes?.length) return;
    if (physicsLayout) {
      const computed = runForceLayout(graph.nodes, graph.edges, 250);
      setLayout(computed);
    } else {
      // Circular fallback
      const circular: Record<string, { x: number; y: number }> = {};
      graph.nodes.forEach((n, i) => {
        const angle = (i / graph.nodes.length) * Math.PI * 2;
        circular[n.id] = {
          x: 50 + Math.cos(angle) * 36,
          y: 50 + Math.sin(angle) * 34,
        };
      });
      setLayout(circular);
    }
  }, [graph, physicsLayout]);

  // ── Derived data ─────────────────────────────────────────────────────────
  const nodes = useMemo(() => graph?.nodes ?? [], [graph?.nodes]);
  const edges = useMemo(() => graph?.edges ?? [], [graph?.edges]);

  const selectedNode = nodes.find(n => n.id === selectedNodeId) ?? null;

  // ── Fetch RAG insight when a node is selected ────────────────────────────
  useEffect(() => {
    if (!selectedNode) return;
    let cancelled = false;
    setInsightLoading(true);
    setAiInsight(null);
    queryRAG(`Forensic correlation significance of ${selectedNode.label} — ${selectedNode.meta}`, 5)
      .then(res => { if (!cancelled) setAiInsight(res.data?.answer ?? null); })
      .catch(() => { if (!cancelled) setAiInsight(null); })
      .finally(() => { if (!cancelled) setInsightLoading(false); });
    return () => { cancelled = true; };
  }, [selectedNodeId, selectedNode]);

  const nodeConnections = useMemo(() => {
    if (!selectedNodeId) return { connected: [], edgesFor: [] };
    const edgesFor = edges.filter(e => e.source === selectedNodeId || e.target === selectedNodeId);
    const connected = edgesFor.map(e => (e.source === selectedNodeId ? e.target : e.source));
    return { connected, edgesFor };
  }, [selectedNodeId, edges]);

  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) return nodes;
    const q = searchQuery.toLowerCase();
    return nodes.filter(n =>
      n.label.toLowerCase().includes(q) ||
      n.meta.toLowerCase().includes(q) ||
      n.node_type.toLowerCase().includes(q)
    );
  }, [nodes, searchQuery]);

  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map(n => n.id)), [filteredNodes]);

  const nodeTypeCounts = useMemo(() =>
    Object.entries(
      nodes.reduce<Record<string, number>>((acc, n) => {
        acc[n.node_type] = (acc[n.node_type] ?? 0) + 1;
        return acc;
      }, {})
    ).sort((a, b) => b[1] - a[1]),
  [nodes]);

  // Chain of events: edges sorted by confidence descending
  const eventChain = useMemo(() => {
    return [...edges]
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 8)
      .map(e => {
        const src = nodes.find(n => n.id === e.source);
        const tgt = nodes.find(n => n.id === e.target);
        return { edge: e, src, tgt };
      });
  }, [edges, nodes]);

  // Matrix: unique node types for axes
  const matrixNodes = useMemo(() => nodes.slice(0, 10), [nodes]);
  const matrixStrengthAt = useCallback((aId: string, bId: string): string | null => {
    const e = edges.find(e =>
      (e.source === aId && e.target === bId) || (e.source === bId && e.target === aId)
    );
    return e?.strength ?? null;
  }, [edges]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="h-full min-h-0 overflow-hidden bg-transparent text-slate-100">
      <div className="grid h-full min-h-0 grid-rows-[48px_1fr_150px] gap-4 p-4">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="flex items-center gap-3 border-b border-white/8 pb-3">
          {(["Graph View", "Chain Of Events", "Matrix View"] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setMode(tab)}
              className={`h-10 border px-5 font-orbitron text-[11px] uppercase tracking-[0.12em] transition ${
                mode === tab
                  ? "border-crimson/60 bg-crimson/10 text-crimson-glow"
                  : "border-white/8 bg-white/[0.025] text-slate-400 hover:border-teal-data/40 hover:text-teal-data"
              }`}
            >
              {tab}
            </button>
          ))}

          {loading && <Loader2 size={16} className="animate-spin text-teal-400 ml-2" />}
          {error && <span className="text-[10px] font-mono text-amber-400 ml-2">{error}</span>}

          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={loadGraph}
              disabled={loading}
              className="flex h-10 items-center gap-2 border border-white/8 px-4 font-orbitron text-[10px] uppercase tracking-[0.1em] text-slate-400 hover:border-crimson/40 hover:text-crimson transition disabled:opacity-40"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
            <label className="flex h-10 w-52 items-center gap-2 border border-white/8 bg-black/35 px-3 text-slate-500">
              <Search size={14} />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-transparent font-mono text-xs uppercase outline-none placeholder:text-slate-600 text-slate-200"
                placeholder="Search node / entity"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="text-slate-600 hover:text-slate-400">
                  <X size={11} />
                </button>
              )}
            </label>
            <button className="flex h-10 items-center gap-2 border border-white/8 px-4 font-orbitron text-[10px] uppercase tracking-[0.12em] text-slate-400">
              Layers <Layers size={14} />
            </button>
            <button className="grid h-10 w-10 place-items-center border border-white/8 text-slate-400">
              <Expand size={14} />
            </button>
          </div>
        </header>

        {/* ── Main Area ──────────────────────────────────────────────────── */}
        <div className="grid min-h-0 grid-cols-[185px_minmax(0,1fr)_220px] gap-4">

          {/* Left sidebar */}
          <aside className="grid min-h-0 gap-3 content-start">
            <Panel title="Node Types">
              <div className="space-y-3">
                {nodeTypeCounts.map(([type, count]) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSearchQuery(searchQuery === type ? "" : type)}
                    className={`flex w-full items-center justify-between font-mono text-xs uppercase transition ${searchQuery === type ? "text-slate-100" : "text-slate-300 hover:text-slate-100"}`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span
                        className="h-3 w-3 rounded-full border-2 shrink-0"
                        style={{ borderColor: NODE_COLORS[type] ?? "#f8fafc" }}
                      />
                      {type}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${searchQuery === type ? "bg-white/10 text-white" : "text-slate-400"}`}>
                      {count}
                    </span>
                  </button>
                ))}
              </div>
            </Panel>

            <Panel title="Graph Controls">
              <div className="space-y-3.5">
                {([
                  ["Show Labels", showLabels, setShowLabels],
                  ["Animate Edges", animateEdges, setAnimateEdges],
                  ["Highlight Paths", highlightPaths, setHighlightPaths],
                  ["Physics Layout", physicsLayout, setPhysicsLayout],
                ] as const).map(([label, checked, setter]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setter(v => !v)}
                    className="flex w-full items-center justify-between font-mono text-xs uppercase text-slate-300 hover:text-slate-100 transition"
                  >
                    {label}
                    <span className={`relative h-5 w-9 rounded-full transition-colors shrink-0 ${checked ? "bg-teal-data/80" : "bg-slate-700"}`}>
                      <span className={`absolute top-1 h-3 w-3 rounded-full bg-white shadow transition-all ${checked ? "right-1" : "left-1"}`} />
                    </span>
                  </button>
                ))}
              </div>
            </Panel>

            <Panel title="Correlation Strength">
              <div className="space-y-3 font-mono text-xs uppercase text-slate-300">
                {([
                  ["Very High", "#ff2848", false],
                  ["High",      "#f5a400", false],
                  ["Medium",    "#f5a400", true],
                  ["Low",       "#18f3e2", true],
                  ["Very Low",  "#f8fafc", true],
                ] as const).map(([label, color, dashed]) => (
                  <div key={label} className="flex items-center gap-3">
                    <span
                      className="w-7 shrink-0"
                      style={{
                        display: "block", height: "2px",
                        borderTop: dashed ? `2px dashed ${color}` : `2px solid ${color}`,
                      }}
                    />
                    <span style={{ color }}>{label}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </aside>

          {/* ── Center: Graph / Chain / Matrix ──────────────────────────── */}
          <section className="relative min-h-0 overflow-hidden border border-white/8 bg-[#050910]/84">
            <div className="absolute inset-0 correlation-grid" />
            <div className="absolute inset-0 dashboard-noise opacity-40" />
            
            {!graph ? (
              <div className="absolute inset-0 z-50 flex items-center justify-center p-12">
                <EmptyState message="No evidence correlation graph available. Upload multiple evidence files to reveal hidden relationships." />
              </div>
            ) : (
              <>

            {/* Stats overlay */}
            <div className="absolute top-3 left-3 z-20 flex gap-2">
              <div className="bg-black/70 border border-white/10 px-3 py-1.5 rounded font-mono text-xs text-slate-300 backdrop-blur-sm">
                <span className="text-teal-400 font-bold">{nodes.length}</span> nodes
              </div>
              <div className="bg-black/70 border border-white/10 px-3 py-1.5 rounded font-mono text-xs text-slate-300 backdrop-blur-sm">
                <span className="text-amber-400 font-bold">{edges.length}</span> edges
              </div>
              {graph && (
                <div className="bg-black/70 border border-white/10 px-3 py-1.5 rounded font-mono text-xs text-slate-300 backdrop-blur-sm">
                  <span className="text-crimson font-bold">{Math.round(graph.insight_confidence)}%</span> conf
                </div>
              )}
            </div>

            {/* ── GRAPH VIEW ────────────────────────────────────────────── */}
            {mode === "Graph View" && (
              <>
                {/* SVG edges */}
                <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <defs>
                    <filter id="edgeGlow">
                      <feGaussianBlur stdDeviation="0.3" result="blur" />
                      <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                  </defs>
                  {edges.map((edge, idx) => {
                    const a = layout[edge.source];
                    const b = layout[edge.target];
                    if (!a || !b) return null;
                    const style = STRENGTH_STYLE[edge.strength] ?? STRENGTH_STYLE.medium;
                    const isHighlighted = highlightPaths &&
                      (edge.strength === "very-high" || edge.strength === "high");
                    const isConnectedToSelected = selectedNodeId &&
                      (edge.source === selectedNodeId || edge.target === selectedNodeId);
                    const isFiltered = searchQuery
                      ? filteredNodeIds.has(edge.source) && filteredNodeIds.has(edge.target)
                      : true;

                    return (
                      <motion.line
                        key={`${edge.source}-${edge.target}-${idx}`}
                        x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                        stroke={isConnectedToSelected ? "#ffffff" : style.color}
                        strokeWidth={isConnectedToSelected ? style.width * 1.8 : style.width}
                        strokeDasharray={style.dash}
                        opacity={
                          !isFiltered ? 0.05 :
                          selectedNodeId && !isConnectedToSelected ? 0.15 :
                          isHighlighted ? 0.9 : 0.45
                        }
                        filter={isConnectedToSelected ? "url(#edgeGlow)" : undefined}
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{
                          pathLength: animateEdges && isConnectedToSelected ? [0.3, 1, 0.3] : 1,
                          opacity:
                            !isFiltered ? 0.05 :
                            selectedNodeId && !isConnectedToSelected ? 0.15 :
                            isHighlighted ? 0.9 : 0.45,
                        }}
                        transition={{
                          pathLength: { duration: 2.5, repeat: animateEdges && isConnectedToSelected ? Infinity : 0 },
                          opacity: { duration: 0.3 },
                        }}
                      />
                    );
                  })}
                </svg>

                {/* Nodes */}
                {nodes.map((node, idx) => {
                  const pos = layout[node.id];
                  if (!pos) return null;
                  const Icon = resolveIcon(node);
                  const color = NODE_COLORS[node.node_type] ?? "#f8fafc";
                  const isSelected = node.id === selectedNodeId;
                  const isConnected = nodeConnections.connected.includes(node.id);
                  const isFiltered = !searchQuery || filteredNodeIds.has(node.id);
                  const isPrimary = node.node_type === "suspect" || node.confidence >= 95;
                  const isLocation = node.node_type === "location";

                  return (
                    <motion.div
                      key={node.id}
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{
                        opacity: !isFiltered ? 0.15 : selectedNodeId && !isSelected && !isConnected ? 0.35 : 1,
                        scale: isSelected ? 1.15 : 1,
                      }}
                      transition={{ delay: idx * 0.03, duration: 0.3 }}
                      className="absolute z-10 -translate-x-1/2 -translate-y-1/2 cursor-pointer"
                      style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
                      onClick={() => setSelectedNodeId(prev => prev === node.id ? null : node.id)}
                    >
                      {/* Pulse ring on selected */}
                      {isSelected && (
                        <motion.div
                          className="absolute inset-0 rounded-full"
                          style={{ borderColor: color, border: `1px solid ${color}` }}
                          animate={{ scale: [1, 1.8, 1], opacity: [0.8, 0, 0.8] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                      )}
                      <div
                        className={`grid place-items-center border bg-black/60 backdrop-blur-md transition-all ${isPrimary ? "h-12 w-12" : "h-9 w-9"} ${isLocation ? "rotate-45" : "rounded-full"}`}
                        style={{
                          borderColor: isSelected ? color : `${color}99`,
                          boxShadow: isSelected
                            ? `0 0 24px ${color}cc, 0 0 48px ${color}55`
                            : `0 0 16px ${color}44`,
                        }}
                      >
                        {Icon ? (
                          <Icon
                            className={isLocation ? "-rotate-45" : ""}
                            size={isPrimary ? 22 : 15}
                            style={{ color }}
                          />
                        ) : (
                          <span className="h-2 w-2 rounded-full shadow-[0_0_12px_rgba(255,255,255,0.8)]" style={{ backgroundColor: color }} />
                        )}
                      </div>
                      {showLabels && (
                        <div className={`absolute top-1/2 w-32 -translate-y-1/2 pointer-events-none ${pos.x > 55 ? "right-14 text-right" : "left-14"}`}>
                          <div
                            className="font-orbitron text-[11px] font-semibold uppercase tracking-wide leading-tight"
                            style={{ color, textShadow: "0 1px 6px rgba(0,0,0,0.9)" }}
                          >
                            {node.label}
                          </div>
                          <div
                            className="font-mono text-[10px] text-slate-300 leading-tight truncate mt-0.5"
                            style={{ textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}
                          >
                            {node.meta}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  );
                })}

                {/* Correlation details popup */}
                <AnimatePresence>
                  {selectedNode && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.92, y: 8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.92, y: 8 }}
                      transition={{ duration: 0.18 }}
                      className="absolute right-4 top-14 z-30 w-72 border bg-black/90 p-5 backdrop-blur-md shadow-2xl"
                      style={{ borderColor: `${NODE_COLORS[selectedNode.node_type] ?? "#fff"}55` }}
                    >
                      {/* Top gradient accent */}
                      <div
                        className="absolute inset-x-0 top-0 h-0.5"
                        style={{ background: `linear-gradient(90deg, transparent, ${NODE_COLORS[selectedNode.node_type] ?? "#fff"}, transparent)` }}
                      />
                      <button
                        onClick={() => setSelectedNodeId(null)}
                        className="absolute top-3 right-3 text-slate-500 hover:text-slate-200 transition"
                      >
                        <X size={14} />
                      </button>

                      {/* Node identity */}
                      <div className="flex items-center gap-3 mb-4">
                        <div
                          className="grid h-10 w-10 place-items-center rounded-full border-2 shrink-0"
                          style={{
                            borderColor: NODE_COLORS[selectedNode.node_type] ?? "#fff",
                            color: NODE_COLORS[selectedNode.node_type] ?? "#fff",
                            boxShadow: `0 0 16px ${NODE_COLORS[selectedNode.node_type] ?? "#fff"}55`,
                          }}
                        >
                          {(() => { const I = resolveIcon(selectedNode); return I ? <I size={18} /> : <span className="w-2.5 h-2.5 rounded-full bg-current" />; })()}
                        </div>
                        <div>
                          <div
                            className="font-orbitron text-sm font-bold uppercase tracking-wide"
                            style={{ color: NODE_COLORS[selectedNode.node_type] ?? "#fff" }}
                          >
                            {selectedNode.label}
                          </div>
                          <div className="font-mono text-xs text-slate-300 mt-0.5">{selectedNode.meta}</div>
                        </div>
                      </div>

                      {/* Connections */}
                      <div className="font-orbitron text-[11px] uppercase tracking-wider text-slate-400 mb-2.5">
                        Connections ({nodeConnections.edgesFor.length})
                      </div>
                      <ul className="space-y-2.5 max-h-44 overflow-y-auto pr-1">
                        {nodeConnections.edgesFor.map((e, i) => {
                          const otherId = e.source === selectedNodeId ? e.target : e.source;
                          const other = nodes.find(n => n.id === otherId);
                          const sColor = STRENGTH_STYLE[e.strength]?.color ?? "#fff";
                          return (
                            <li key={i} className="flex gap-2.5 text-xs leading-relaxed">
                              <span className="mt-1 shrink-0 text-sm" style={{ color: sColor }}>●</span>
                              <div>
                                <span className="font-orbitron text-[11px] font-semibold" style={{ color: sColor }}>
                                  {other?.label ?? otherId}
                                </span>
                                <span className="text-slate-400 font-mono"> — </span>
                                <span className="font-mono text-[11px] text-slate-300">
                                  {e.explanation.substring(0, 55)}
                                  {e.explanation.length > 55 ? "…" : ""}
                                </span>
                              </div>
                            </li>
                          );
                        })}
                      </ul>

                      {/* Confidence bar */}
                      <div className="mt-4 pt-3 border-t border-white/10">
                        <div className="flex justify-between font-mono text-xs mb-2">
                          <span className="text-slate-400 uppercase tracking-wider">Confidence</span>
                          <span className="font-bold text-crimson text-sm">{selectedNode.confidence}%</span>
                        </div>
                        <div className="h-2 bg-white/8 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${selectedNode.confidence}%` }}
                            transition={{ duration: 0.8 }}
                            className="h-full rounded-full"
                            style={{ backgroundColor: NODE_COLORS[selectedNode.node_type] ?? "#ff2848" }}
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Empty state */}
                {!loading && nodes.length === 0 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="font-orbitron text-[11px] text-slate-600 uppercase tracking-widest mb-3">No correlation data</div>
                      <button onClick={loadGraph} className="font-mono text-[10px] text-teal-400 hover:text-teal-300 transition">
                        Click to load →
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── CHAIN OF EVENTS VIEW ──────────────────────────────────── */}
            {mode === "Chain Of Events" && (
              <div className="absolute inset-0 overflow-y-auto p-6">
                <div className="font-orbitron text-xs text-slate-400 uppercase tracking-widest mb-6">
                  Event Chain — sorted by correlation strength
                </div>
                <div className="space-y-0">
                  {eventChain.map(({ edge, src, tgt }, i) => {
                    const srcColor = NODE_COLORS[src?.node_type ?? "device"] ?? "#18f3e2";
                    const tgtColor = NODE_COLORS[tgt?.node_type ?? "device"] ?? "#18f3e2";
                    const style = STRENGTH_STYLE[edge.strength] ?? STRENGTH_STYLE.medium;
                    return (
                      <div key={i} className="relative">
                        {i < eventChain.length - 1 && (
                          <div className="absolute left-[22px] top-16 bottom-0 w-px bg-white/10" />
                        )}
                        <div
                          className="flex gap-4 items-start py-4 hover:bg-white/[0.03] px-3 rounded-lg transition cursor-pointer"
                          onClick={() => { setMode("Graph View"); setSelectedNodeId(src?.id ?? null); }}
                        >
                          <div className="relative shrink-0">
                            <div
                              className="w-11 h-11 rounded-full border-2 flex items-center justify-center bg-black/60"
                              style={{ borderColor: `${srcColor}90`, boxShadow: `0 0 16px ${srcColor}55` }}
                            >
                              {(() => { const I = resolveIcon(src as any); return I ? <I size={18} style={{ color: srcColor }} /> : <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: srcColor }} />; })()}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                              <span className="font-orbitron text-xs font-bold uppercase" style={{ color: srcColor }}>
                                {src?.label ?? edge.source}
                              </span>
                              <span className="text-slate-500 text-xs font-mono">→</span>
                              <span className="font-orbitron text-xs font-bold uppercase" style={{ color: tgtColor }}>
                                {tgt?.label ?? edge.target}
                              </span>
                            </div>
                            <p className="font-mono text-xs text-slate-300 leading-relaxed">{edge.explanation}</p>
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              <span
                                className="font-mono text-[11px] uppercase px-2.5 py-0.5 rounded font-semibold"
                                style={{ color: style.color, border: `1px solid ${style.color}55`, backgroundColor: `${style.color}18` }}
                              >
                                {edge.strength.replace("-", " ")}
                              </span>
                              <span className="font-mono text-[11px] text-slate-400">{edge.confidence}% confidence</span>
                              <span className="font-mono text-[11px] text-slate-500 uppercase">{edge.relationship}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── MATRIX VIEW ───────────────────────────────────────────── */}
            {mode === "Matrix View" && (
              <div className="absolute inset-0 overflow-auto p-6">
                <div className="font-orbitron text-xs text-slate-400 uppercase tracking-widest mb-5">
                  Correlation Matrix — top {matrixNodes.length} nodes
                </div>
                <div className="overflow-auto">
                  <table className="border-collapse">
                    <thead>
                      <tr>
                        <td className="w-28" />
                        {matrixNodes.map(n => (
                          <th key={n.id} className="w-16 pb-2">
                            <div
                              className="font-orbitron text-[10px] uppercase -rotate-45 origin-bottom-left w-16 h-12 flex items-end truncate font-semibold"
                              style={{ color: NODE_COLORS[n.node_type] ?? "#fff" }}
                            >
                              {n.label}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {matrixNodes.map(rowNode => (
                        <tr key={rowNode.id}>
                          <td
                            className="pr-3 py-1 font-orbitron text-[11px] uppercase text-right whitespace-nowrap font-semibold"
                            style={{ color: NODE_COLORS[rowNode.node_type] ?? "#fff" }}
                          >
                            {rowNode.label}
                          </td>
                          {matrixNodes.map(colNode => {
                            const strength = matrixStrengthAt(rowNode.id, colNode.id);
                            const isSelf = rowNode.id === colNode.id;
                            const style = strength ? STRENGTH_STYLE[strength] : null;
                            return (
                              <td key={colNode.id} className="p-0.5">
                                <div
                                  className="w-14 h-9 flex items-center justify-center rounded text-[11px] font-mono font-bold transition cursor-pointer hover:brightness-125"
                                  style={{
                                    backgroundColor: isSelf
                                      ? "rgba(255,255,255,0.06)"
                                      : strength
                                        ? `${style!.color}25`
                                        : "rgba(255,255,255,0.02)",
                                    border: `1px solid ${isSelf ? "rgba(255,255,255,0.12)" : strength ? `${style!.color}60` : "rgba(255,255,255,0.06)"}`,
                                    color: style?.color ?? "#475569",
                                  }}
                                  onClick={() => { if (strength) { setMode("Graph View"); setSelectedNodeId(rowNode.id); } }}
                                  title={strength ? `${rowNode.label} ↔ ${colNode.label}: ${strength}` : "No direct link"}
                                >
                                  {isSelf ? "●" : strength ? strength.replace("very-", "V").substring(0, 4).toUpperCase() : "—"}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </section>

          {/* ── Right: Chain of Events panel ──────────────────────────── */}
          <aside className="grid min-h-0 content-start">
            <Panel title="Chain Of Events Mode">
              <div className="mb-4 flex items-center justify-between font-mono text-xs text-slate-300">
                Follow sequence
                <span className="h-5 w-9 rounded-full bg-teal-data/80 shadow-[0_0_12px_rgba(24,243,226,0.55)]" />
              </div>

              {/* Start node */}
              {(() => {
                const startNode = nodes.find(n => n.node_type === "suspect") ?? nodes[0];
                if (!startNode) return null;
                const color = NODE_COLORS[startNode.node_type] ?? "#fff";
                const Icon = resolveIcon(startNode);
                return (
                  <div className="mb-4">
                    <div className="font-orbitron text-xs uppercase tracking-wide text-slate-400 mb-2">Start Node</div>
                    <button
                      className="flex items-center gap-3 border p-3 w-full text-left hover:bg-white/5 transition rounded"
                      style={{ borderColor: `${color}55`, backgroundColor: `${color}0d` }}
                      onClick={() => { setMode("Graph View"); setSelectedNodeId(startNode.id); }}
                    >
                      <span
                        className="grid h-9 w-9 place-items-center rounded-full border-2 shrink-0"
                        style={{ borderColor: `${color}90`, color }}
                      >
                        {Icon ? <Icon size={17} /> : <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />}
                      </span>
                      <div className="font-mono text-xs uppercase text-slate-200 min-w-0">
                        <div className="truncate font-bold" style={{ color }}>{startNode.label}</div>
                        <div className="text-slate-400 truncate mt-0.5">{startNode.meta}</div>
                      </div>
                    </button>
                  </div>
                );
              })()}

              <button
                onClick={() => setSelectedNodeId(null)}
                className="mb-4 h-9 w-full border border-white/15 font-orbitron text-xs uppercase tracking-wide text-slate-200 hover:bg-white/8 transition rounded"
              >
                Clear Selection
              </button>

              <div className="space-y-2 overflow-y-auto" style={{ maxHeight: "240px" }}>
                {eventChain.slice(0, 7).map(({ edge, src }, i) => {
                  const srcColor = NODE_COLORS[src?.node_type ?? "device"] ?? "#18f3e2";
                  const SrcIcon = resolveIcon(src as any);
                  return (
                    <button
                      key={i}
                      type="button"
                      className="grid grid-cols-[34px_1fr_42px] items-center gap-2 w-full hover:bg-white/5 px-2 py-1.5 rounded transition"
                      onClick={() => { setMode("Graph View"); setSelectedNodeId(src?.id ?? null); }}
                    >
                      <span
                        className="grid h-8 w-8 place-items-center rounded border-2"
                        style={{ borderColor: `${srcColor}80`, color: srcColor }}
                      >
                        {SrcIcon ? <SrcIcon size={14} /> : <ChevronRight size={14} />}
                      </span>
                      <div className="min-w-0 font-mono text-xs uppercase text-left">
                        <div className="truncate font-semibold" style={{ color: srcColor }}>{src?.label ?? edge.source}</div>
                        <div className="truncate text-slate-400 text-[11px] mt-0.5">{src?.meta ?? ""}</div>
                      </div>
                      <div className="font-mono text-xs text-slate-300 text-right font-bold">
                        {edge.confidence}%
                      </div>
                    </button>
                  );
                })}
              </div>
            </Panel>
          </aside>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <footer className="grid min-h-0 grid-cols-[200px_1fr_1.3fr] gap-4">

          {/* Graph overview minimap */}
          <Panel title="Graph Overview">
            <div className="relative h-20 overflow-hidden border border-white/8 bg-black/35">
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                {edges.map((edge, i) => {
                  const a = layout[edge.source], b = layout[edge.target];
                  if (!a || !b) return null;
                  const style = STRENGTH_STYLE[edge.strength] ?? STRENGTH_STYLE.medium;
                  return (
                    <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                      stroke={style.color} strokeWidth="0.5" opacity="0.4" />
                  );
                })}
                {nodes.map(node => {
                  const pos = layout[node.id];
                  if (!pos) return null;
                  const color = NODE_COLORS[node.node_type] ?? "#f8fafc";
                  return <circle key={node.id} cx={pos.x} cy={pos.y} r="1.8" fill={color} opacity="0.8" />;
                })}
              </svg>
            </div>
          </Panel>

          {/* Selection info */}
          <Panel title="Selection Info">
            {selectedNode ? (
              <div className="grid grid-cols-[52px_1fr_72px_72px_110px] items-center gap-3">
                <div
                  className="grid h-12 w-12 place-items-center rounded-full border-2"
                  style={{
                    borderColor: `${NODE_COLORS[selectedNode.node_type] ?? "#fff"}90`,
                    color: NODE_COLORS[selectedNode.node_type] ?? "#fff",
                    boxShadow: `0 0 20px ${NODE_COLORS[selectedNode.node_type] ?? "#fff"}44`,
                  }}
                >
                  {(() => { const I = resolveIcon(selectedNode); return I ? <I size={22} /> : <span className="w-3 h-3 rounded-full bg-current" />; })()}
                </div>
                <div className="min-w-0">
                  <div className="font-orbitron text-sm font-bold text-slate-100 truncate">{selectedNode.label}</div>
                  <div className="font-mono text-xs text-slate-300 mt-0.5 truncate">{selectedNode.meta}</div>
                  <div className="font-mono text-xs text-slate-500 mt-0.5 capitalize">{selectedNode.node_type} · {selectedNode.confidence}%</div>
                </div>
                <Metric value={String(nodeConnections.edgesFor.length)} label="Links" />
                <Metric value={`${Math.round(nodeConnections.edgesFor.reduce((s, e) => s + e.confidence, 0) / Math.max(nodeConnections.edgesFor.length, 1))}%`} label="Avg Conf" />
                <button
                  onClick={() => setMode("Chain Of Events")}
                  className="h-10 border border-white/15 font-orbitron text-xs uppercase tracking-wide text-slate-200 hover:bg-white/8 transition rounded"
                >
                  Explore →
                </button>
              </div>
            ) : (
              <div className="flex items-center h-full font-mono text-xs text-slate-500 uppercase tracking-wide">
                Click a node on the graph to inspect connections
              </div>
            )}
          </Panel>

          {/* AI Insight */}
          <Panel title="AI Insight">
            <div className="grid grid-cols-[48px_1fr] gap-4">
              <div className="grid h-11 w-11 place-items-center border-2 border-crimson/60 bg-crimson/10 font-orbitron text-base font-bold text-crimson-glow rounded">
                AI
              </div>
              <div>
                {insightLoading ? (
                  <div className="space-y-2">
                    {[80, 60, 75].map((w, i) => (
                      <div key={i} className="h-2 bg-white/5 rounded animate-pulse" style={{ width: `${w}%` }} />
                    ))}
                  </div>
                ) : (
                  <p className="font-mono text-xs leading-relaxed text-slate-300 line-clamp-3">
                    {aiInsight ?? graph?.ai_insight ?? "Load correlation data to generate AI insight."}
                  </p>
                )}
                <div className="mt-2 flex items-center justify-between">
                  <div className="font-orbitron text-[11px] uppercase tracking-wide text-slate-400">
                    Confidence: <span className="text-crimson font-bold">{Math.round(graph?.insight_confidence ?? 0)}%</span>
                  </div>
                </div>
                <div className="mt-1.5 h-1.5 bg-white/8 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-crimson-glow rounded-full shadow-[0_0_10px_rgba(255,40,72,0.7)]"
                    initial={{ width: 0 }}
                    animate={{ width: `${graph?.insight_confidence ?? 0}%` }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                  />
                </div>
              </div>
            </div>
          </Panel>
        </footer>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="relative overflow-hidden border border-white/10 bg-[#07101a]/78 p-4 shadow-[inset_0_0_40px_rgba(255,255,255,0.02)] backdrop-blur-md">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-crimson/60 to-transparent" />
      <h2 className="mb-4 font-orbitron text-xs font-bold uppercase tracking-widest text-slate-100">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="font-orbitron text-xl font-bold text-slate-100">{value}</div>
      <div className="font-mono text-[11px] uppercase text-slate-400 mt-0.5">{label}</div>
    </div>
  );
}
