"use client";

import React, { useState, useMemo } from "react";
import { motion, useInView } from "framer-motion";
import { fadeInUp, staggerContainer } from "@/lib/animations";
import { NETWORK_CITIES, NETWORK_CONNECTIONS } from "@/lib/constants";

// Simple equirectangular projection
function project(lat: number, lng: number, width: number, height: number): [number, number] {
  const x = ((lng + 180) / 360) * width;
  const y = ((90 - lat) / 180) * height;
  return [x, y];
}

// Generate curved path between two points
function arcPath(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 - Math.abs(x2 - x1) * 0.15;
  return `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`;
}

export default function GlobalNetwork() {
  const ref = React.useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [hoveredCity, setHoveredCity] = useState<number | null>(null);

  const mapWidth = 1000;
  const mapHeight = 500;

  const projectedCities = useMemo(
    () =>
      NETWORK_CITIES.map((city) => {
        const [x, y] = project(city.lat, city.lng, mapWidth, mapHeight);
        return { ...city, x, y };
      }),
    []
  );

  return (
    <section
      id="network"
      ref={ref}
      className="relative py-32 bg-base overflow-hidden"
    >
      {/* Starfield background */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 80 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-[1px] h-[1px] bg-white rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              opacity: 0.2 + Math.random() * 0.4,
            }}
          />
        ))}
        {/* Nebula blurs */}
        <div className="absolute w-64 h-64 rounded-full bg-crimson/5 blur-[80px]"
          style={{ left: "20%", top: "30%" }} />
        <div className="absolute w-48 h-48 rounded-full bg-amber/5 blur-[60px]"
          style={{ left: "70%", top: "60%" }} />
      </div>

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="relative max-w-7xl mx-auto px-6"
      >
        {/* Header */}
        <div className="text-center mb-16">
          <motion.span
            variants={fadeInUp}
            className="font-orbitron text-[11px] tracking-[0.25em] text-amber uppercase"
          >
            GLOBAL OPERATIONS
          </motion.span>
          <motion.h2
            variants={fadeInUp}
            className="font-orbitron text-3xl sm:text-4xl lg:text-5xl font-semibold mt-4"
            style={{ textShadow: "0 0 30px rgba(192,24,42,0.3)" }}
          >
            Global Forensic Intelligence Network
          </motion.h2>
          <motion.p variants={fadeInUp} className="text-muted mt-4 max-w-xl mx-auto">
            Active intelligence relays across 47 countries with real-time
            cross-jurisdictional case synchronization.
          </motion.p>
        </div>

        {/* Map */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="relative max-w-5xl mx-auto"
        >
          <svg
            viewBox={`0 0 ${mapWidth} ${mapHeight}`}
            className="w-full h-auto"
          >
            {/* Simplified world map outline using basic continent shapes */}
            <g opacity="0.08" stroke="#F8FAFC" strokeWidth="0.5" fill="none">
              {/* North America */}
              <path d="M150,100 L200,80 L260,90 L280,120 L260,180 L220,200 L180,210 L140,180 L130,140 Z" />
              {/* South America */}
              <path d="M220,230 L250,240 L270,290 L260,350 L240,380 L210,370 L200,310 L210,260 Z" />
              {/* Europe */}
              <path d="M460,90 L500,80 L530,90 L540,120 L520,140 L490,130 L470,110 Z" />
              {/* Africa */}
              <path d="M480,160 L520,150 L550,180 L560,250 L540,310 L510,320 L480,290 L470,220 Z" />
              {/* Asia */}
              <path d="M560,70 L650,60 L740,80 L780,120 L760,160 L700,180 L640,170 L580,140 L550,110 Z" />
              {/* Australia */}
              <path d="M760,290 L810,280 L840,300 L830,340 L790,350 L760,330 Z" />
            </g>

            {/* Connection arcs */}
            {NETWORK_CONNECTIONS.map((conn, i) => {
              const from = projectedCities[conn.from];
              const to = projectedCities[conn.to];
              if (!from || !to) return null;
              const path = arcPath(from.x, from.y, to.x, to.y);

              const isHighlighted =
                hoveredCity !== null &&
                (conn.from === hoveredCity || conn.to === hoveredCity);

              return (
                <g key={`conn-${i}`}>
                  <path
                    d={path}
                    fill="none"
                    stroke={isHighlighted ? "#F59E0B" : "#C0182A"}
                    strokeWidth={isHighlighted ? 1.5 : 0.8}
                    opacity={isHighlighted ? 0.8 : 0.25}
                    strokeDasharray="6 4"
                  >
                    {isInView && (
                      <animate
                        attributeName="stroke-dashoffset"
                        from="20"
                        to="0"
                        dur="2s"
                        repeatCount="indefinite"
                      />
                    )}
                  </path>
                </g>
              );
            })}

            {/* City nodes */}
            {projectedCities.map((city, i) => {
              const isHovered = hoveredCity === i;
              return (
                <g
                  key={`city-${i}`}
                  onMouseEnter={() => setHoveredCity(i)}
                  onMouseLeave={() => setHoveredCity(null)}
                  className="cursor-pointer"
                >
                  {/* Expanding ring pulse */}
                  <circle
                    cx={city.x}
                    cy={city.y}
                    r="8"
                    fill="none"
                    stroke="#C0182A"
                    strokeWidth="0.5"
                    opacity="0"
                  >
                    <animate
                      attributeName="r"
                      values="4;14;4"
                      dur="3s"
                      repeatCount="indefinite"
                      begin={`${i * 0.3}s`}
                    />
                    <animate
                      attributeName="opacity"
                      values="0.6;0;0.6"
                      dur="3s"
                      repeatCount="indefinite"
                      begin={`${i * 0.3}s`}
                    />
                  </circle>

                  {/* Main dot */}
                  <circle
                    cx={city.x}
                    cy={city.y}
                    r={isHovered ? 6 : 3.5}
                    fill={isHovered ? "#F59E0B" : "#C0182A"}
                    style={{ transition: "all 0.3s ease" }}
                  />
                  <circle
                    cx={city.x}
                    cy={city.y}
                    r={isHovered ? 10 : 6}
                    fill={isHovered ? "#F59E0B" : "#C0182A"}
                    opacity="0.15"
                    style={{ transition: "all 0.3s ease" }}
                  />

                  {/* City label on hover */}
                  {isHovered && (
                    <g>
                      <rect
                        x={city.x - 70}
                        y={city.y - 50}
                        width="140"
                        height="38"
                        rx="6"
                        fill="rgba(10,10,15,0.9)"
                        stroke="rgba(255,255,255,0.15)"
                        strokeWidth="0.5"
                      />
                      <text
                        x={city.x}
                        y={city.y - 34}
                        textAnchor="middle"
                        fill="#F59E0B"
                        fontSize="9"
                        fontFamily="Orbitron, sans-serif"
                        fontWeight="600"
                      >
                        {city.agency}
                      </text>
                      <text
                        x={city.x}
                        y={city.y - 20}
                        textAnchor="middle"
                        fill="#94A3B8"
                        fontSize="8"
                        fontFamily="Inter, sans-serif"
                      >
                        {city.name} — {city.cases} cases
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Operational stats */}
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { value: "47", label: "Countries" },
              { value: "14", label: "Active Relays" },
              { value: "24/7", label: "Monitoring" },
              { value: "< 200ms", label: "Sync Latency" },
            ].map((stat, i) => (
              <div
                key={i}
                className="text-center p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]"
              >
                <div className="font-orbitron text-2xl font-bold text-amber">
                  {stat.value}
                </div>
                <div className="text-xs text-dim mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
