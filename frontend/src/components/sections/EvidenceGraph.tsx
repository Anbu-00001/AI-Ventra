"use client";

import React, { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { motion, useInView } from "framer-motion";
import { fadeInUp, staggerContainer } from "@/lib/animations";
import { GRAPH_NODES, GRAPH_EDGES } from "@/lib/constants";

const NODE_COLORS: Record<string, string> = {
  suspect: "#C0182A",
  location: "#F59E0B",
  digital: "#14B8A6",
  timestamp: "#F8FAFC",
};

const NODE_LABELS: Record<string, string> = {
  suspect: "Suspect",
  location: "Location",
  digital: "Digital Artifact",
  timestamp: "Timestamp",
};

interface TooltipInfo {
  x: number;
  y: number;
  node: (typeof GRAPH_NODES)[number];
}

export default function EvidenceGraph() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);

  // Simulate spring physics positions with slight animation
  const [nodePositions, setNodePositions] = useState<Array<typeof GRAPH_NODES[number] & { cx: number; cy: number }>>(
    GRAPH_NODES.map((n) => ({ ...n, cx: n.x, cy: n.y }))
  );

  useEffect(() => {
    if (!isInView) return;
    // Animate nodes from center to final position
    const startPositions = GRAPH_NODES.map((n) => ({
      ...n,
      cx: 450,
      cy: 250,
    }));
    setNodePositions(startPositions);

    const timer = setTimeout(() => {
      setNodePositions(GRAPH_NODES.map((n) => ({ ...n, cx: n.x, cy: n.y })));
    }, 100);

    return () => clearTimeout(timer);
  }, [isInView]);

  const handleNodeHover = useCallback(
    (nodeId: string | null, e?: React.MouseEvent) => {
      setHoveredNode(nodeId);
      if (nodeId && e) {
        const node = GRAPH_NODES.find((n) => n.id === nodeId);
        if (node) {
          setTooltip({ x: node.x, y: node.y - 40, node });
        }
      } else {
        setTooltip(null);
      }
    },
    []
  );

  const connectedToHovered = useMemo(() => {
    if (!hoveredNode) return new Set<string>();
    const connected = new Set<string>();
    GRAPH_EDGES.forEach((edge) => {
      if (edge.source === hoveredNode) connected.add(edge.target);
      if (edge.target === hoveredNode) connected.add(edge.source);
    });
    return connected;
  }, [hoveredNode]);

  return (
    <section
      id="evidence"
      ref={ref}
      className="relative py-32 bg-base bg-hex-pattern overflow-hidden"
    >
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="max-w-7xl mx-auto px-6 mb-12 text-center"
      >
        <motion.span
          variants={fadeInUp}
          className="font-orbitron text-[11px] tracking-[0.25em] text-amber uppercase"
        >
          INTELLIGENCE MAPPING
        </motion.span>
        <motion.h2
          variants={fadeInUp}
          className="font-orbitron text-3xl sm:text-4xl lg:text-5xl font-semibold mt-4"
          style={{ textShadow: "0 0 30px rgba(192,24,42,0.3)" }}
        >
          Evidence Correlation Graph
        </motion.h2>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="max-w-5xl mx-auto px-6"
      >
        <div className="relative bg-black/50 rounded-2xl border border-white/[0.06] p-4 overflow-hidden">
          <svg
            viewBox="0 0 900 500"
            className="w-full h-auto"
            style={{ minHeight: 400 }}
          >
            {/* Edges */}
            {GRAPH_EDGES.map((edge, i) => {
              const source = nodePositions.find((n) => n.id === edge.source);
              const target = nodePositions.find((n) => n.id === edge.target);
              if (!source || !target) return null;

              const isHighlighted =
                hoveredNode &&
                (edge.source === hoveredNode || edge.target === hoveredNode);

              return (
                <line
                  key={`edge-${i}`}
                  x1={source.cx}
                  y1={source.cy}
                  x2={target.cx}
                  y2={target.cy}
                  stroke={isHighlighted ? "#F59E0B" : "rgba(255,255,255,0.1)"}
                  strokeWidth={isHighlighted ? 2 : 1}
                  strokeDasharray="6 4"
                  style={{
                    transition: "all 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
                  }}
                >
                  {isInView && (
                    <animate
                      attributeName="stroke-dashoffset"
                      from="20"
                      to="0"
                      dur="1.5s"
                      repeatCount="indefinite"
                    />
                  )}
                </line>
              );
            })}

            {/* Nodes */}
            {nodePositions.map((node) => {
              const color = NODE_COLORS[node.type];
              const isHovered = hoveredNode === node.id;
              const isConnected = connectedToHovered.has(node.id);
              const radius = isHovered ? 18 : isConnected ? 14 : 10;
              const nodeOpacity =
                !hoveredNode || isHovered || isConnected ? 1 : 0.3;

              return (
                <g
                  key={node.id}
                  style={{
                    transition: "all 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
                    transform: `translate(${node.cx}px, ${node.cy}px)`,
                  }}
                  onMouseEnter={(e) => handleNodeHover(node.id, e)}
                  onMouseLeave={() => handleNodeHover(null)}
                  className="cursor-pointer"
                  opacity={nodeOpacity}
                >
                  {/* Glow ring */}
                  {(isHovered || isConnected) && (
                    <circle
                      r={radius + 6}
                      fill="none"
                      stroke={color}
                      strokeWidth="1"
                      opacity="0.3"
                    />
                  )}
                  {/* Main circle */}
                  <circle r={radius} fill={color} opacity="0.2" />
                  <circle r={radius * 0.6} fill={color} />

                  {/* Label */}
                  <text
                    y={radius + 16}
                    textAnchor="middle"
                    fill="#94A3B8"
                    fontSize="10"
                    fontFamily="Inter, sans-serif"
                  >
                    {node.label}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Tooltip */}
          {tooltip && (
            <div
              className="absolute pointer-events-none bg-white/[0.08] backdrop-blur-xl border border-white/[0.15] rounded-lg px-4 py-3 z-20"
              style={{
                left: `${(tooltip.x / 900) * 100}%`,
                top: `${(tooltip.y / 500) * 100}%`,
                transform: "translate(-50%, -100%)",
              }}
            >
              <div className="font-orbitron text-[10px] tracking-wider text-amber mb-1">
                {NODE_LABELS[tooltip.node.type]}
              </div>
              <div className="font-inter text-sm text-pure">{tooltip.node.label}</div>
            </div>
          )}

          {/* Legend */}
          <div className="absolute bottom-4 right-4 bg-white/[0.05] backdrop-blur-sm border border-white/[0.08] rounded-lg px-4 py-3">
            <div className="font-orbitron text-[9px] tracking-wider text-dim uppercase mb-2">
              Correlation Strength
            </div>
            {Object.entries(NODE_COLORS).map(([type, color]) => (
              <div key={type} className="flex items-center gap-2 mb-1">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-[10px] text-muted capitalize">{type}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
