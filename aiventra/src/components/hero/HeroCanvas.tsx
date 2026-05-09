"use client";

import React, { useRef, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import * as THREE from "three";

// ===== WIREFRAME GLOBE =====
function Globe() {
  const meshRef = useRef<THREE.Mesh>(null);
  const dotsRef = useRef<THREE.Group>(null);

  // Intelligence node dots on surface
  const dots = useMemo(() => {
    const positions: [number, number, number][] = [];
    for (let i = 0; i < 100; i++) {
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = 2 * Math.PI * Math.random();
      const r = 2.5;
      positions.push([
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta),
        r * Math.cos(phi),
      ]);
    }
    return positions;
  }, []);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.002;
      meshRef.current.rotation.x += 0.0005;
    }
    if (dotsRef.current) {
      dotsRef.current.rotation.y += 0.002;
      dotsRef.current.rotation.x += 0.0005;
    }
  });

  return (
    <group>
      {/* Main wireframe sphere */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[2.5, 32, 32]} />
        <meshStandardMaterial
          color="#C0182A"
          emissive="#C0182A"
          emissiveIntensity={0.3}
          wireframe
          transparent
          opacity={0.25}
        />
      </mesh>

      {/* Holographic grid overlay */}
      <mesh rotation={[0, 0, 0]}>
        <sphereGeometry args={[2.52, 16, 16]} />
        <meshStandardMaterial
          color="#C0182A"
          emissive="#C0182A"
          emissiveIntensity={0.1}
          wireframe
          transparent
          opacity={0.08}
        />
      </mesh>

      {/* Intelligence node dots */}
      <group ref={dotsRef}>
        {dots.map((pos, i) => (
          <mesh key={i} position={pos}>
            <icosahedronGeometry args={[0.04, 0]} />
            <meshStandardMaterial
              color={i % 10 === 0 ? "#F59E0B" : "#C0182A"}
              emissive={i % 10 === 0 ? "#F59E0B" : "#C0182A"}
              emissiveIntensity={0.8}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}

// ===== PARTICLE FIELD =====
function ParticleField() {
  const particlesRef = useRef<THREE.Points>(null);
  const count = 4000;

  const [positions, colors, sizes] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const siz = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 30;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 30;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 30;

      const rand = Math.random();
      if (rand > 0.97) {
        // Amber 3%
        col[i * 3] = 0.96; col[i * 3 + 1] = 0.62; col[i * 3 + 2] = 0.04;
      } else if (rand > 0.9) {
        // Crimson 7%
        col[i * 3] = 0.75; col[i * 3 + 1] = 0.09; col[i * 3 + 2] = 0.16;
      } else {
        // White 90%
        col[i * 3] = 0.9; col[i * 3 + 1] = 0.9; col[i * 3 + 2] = 0.95;
      }

      siz[i] = Math.random() * 2 + 0.5;
    }

    return [pos, col, siz];
  }, []);

  useFrame(({ clock }) => {
    if (!particlesRef.current) return;
    const time = clock.getElapsedTime();
    const posArray = particlesRef.current.geometry.attributes.position.array as Float32Array;

    for (let i = 0; i < count; i++) {
      // Drift upward with turbulence
      posArray[i * 3 + 1] += 0.003;
      posArray[i * 3] += Math.sin(time + i * 0.01) * 0.001;
      posArray[i * 3 + 2] += Math.cos(time + i * 0.01) * 0.001;

      // Reset particles that drift too high
      if (posArray[i * 3 + 1] > 15) {
        posArray[i * 3 + 1] = -15;
      }
    }
    particlesRef.current.geometry.attributes.position.needsUpdate = true;

    // Pulse sizes
    const sizeAttr = particlesRef.current.geometry.attributes.size;
    const sizeArray = sizeAttr.array as Float32Array;
    for (let i = 0; i < count; i++) {
      sizeArray[i] = (Math.sin(time * 2 + i) * 0.5 + 1) * 1.5;
    }
    sizeAttr.needsUpdate = true;
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
        />
        <bufferAttribute
          attach="attributes-size"
          args={[sizes, 1]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.04}
        vertexColors
        transparent
        opacity={0.6}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

// ===== CYBER GRID FLOOR =====
function CyberGrid() {
  const gridRef = useRef<THREE.Mesh>(null);

  const gridMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uColor1: { value: new THREE.Color("#C0182A") },
        uColor2: { value: new THREE.Color("#F59E0B") },
      },
      vertexShader: `
        varying vec2 vUv;
        varying float vFog;
        void main() {
          vUv = uv;
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vFog = smoothstep(5.0, 30.0, -mvPos.z);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uColor1;
        uniform vec3 uColor2;
        varying vec2 vUv;
        varying float vFog;

        void main() {
          vec2 grid = abs(fract(vUv * 30.0 - vec2(0.0, uTime * 0.05)) - 0.5);
          float line = min(grid.x, grid.y);
          float gridLine = 1.0 - smoothstep(0.0, 0.03, line);

          vec3 color = mix(uColor1, uColor2, sin(vUv.x * 10.0 + uTime) * 0.5 + 0.5);
          float alpha = gridLine * 0.15 * (1.0 - vFog);

          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
  }, []);

  useFrame(({ clock }) => {
    gridMaterial.uniforms.uTime.value = clock.getElapsedTime();
  });

  return (
    <mesh ref={gridRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -3, 0]} material={gridMaterial}>
      <planeGeometry args={[60, 60, 60, 60]} />
    </mesh>
  );
}

// ===== SCANNING RING =====
function ScanningRing() {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (ringRef.current) {
      ringRef.current.rotation.y += 0.003;
      ringRef.current.rotation.z += 0.001;
    }
  });

  return (
    <mesh ref={ringRef}>
      <torusGeometry args={[3.2, 0.01, 8, 128]} />
      <meshStandardMaterial
        color="#F59E0B"
        emissive="#F59E0B"
        emissiveIntensity={2}
        transparent
        opacity={0.8}
      />
    </mesh>
  );
}

// ===== CAMERA RIG WITH PARALLAX =====
function CameraRig() {
  const { camera } = useThree();
  const mouse = useRef({ x: 0, y: 0 });

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouse.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useFrame(() => {
    camera.position.x += (mouse.current.x * 0.5 - camera.position.x + 0) * 0.05;
    camera.position.y += (-mouse.current.y * 0.3 - camera.position.y + 1.5) * 0.05;
  });

  return null;
}

// ===== MAIN HERO CANVAS =====
function HeroScene() {
  return (
    <>
      <ambientLight intensity={0.15} />
      <pointLight position={[10, 10, 10]} intensity={0.5} color="#C0182A" />
      <pointLight position={[-10, -10, 5]} intensity={0.3} color="#F59E0B" />

      <Globe />
      <ParticleField />
      <CyberGrid />
      <ScanningRing />
      <CameraRig />

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.3}
        dampingFactor={0.05}
        maxPolarAngle={Math.PI / 1.8}
        minPolarAngle={Math.PI / 3}
      />

      <EffectComposer>
        <Bloom
          intensity={1.8}
          luminanceThreshold={0.4}
          luminanceSmoothing={0.9}
        />
        <Vignette darkness={0.7} offset={0.3} />
      </EffectComposer>
    </>
  );
}

// ===== LOADING SCREEN =====
function Loader() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-base z-50">
      <div className="font-orbitron text-sm text-crimson tracking-widest mb-4 animate-pulse">
        INITIALIZING SYSTEM
      </div>
      <div className="w-48 h-[2px] bg-white/10 rounded-full overflow-hidden">
        <div className="loading-bar" />
      </div>
    </div>
  );
}

export default function HeroCanvas() {
  return (
    <div className="hero-canvas-container">
      <React.Suspense fallback={<Loader />}>
        <Canvas
          camera={{ position: [0, 1.5, 7], fov: 60 }}
          dpr={[1, 1.5]}
          gl={{ antialias: true, alpha: true }}
          style={{ background: "#050508" }}
        >
          <HeroScene />
        </Canvas>
      </React.Suspense>
    </div>
  );
}
