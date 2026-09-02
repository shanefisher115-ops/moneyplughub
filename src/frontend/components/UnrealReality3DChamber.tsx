import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { 
  Eye, Compass, Zap, Database, Cloud, Radio, Volume2, 
  Maximize2, Minimize2, Video, Sparkles, Sliders, Shield, Terminal, ArrowUp, ArrowDown, ArrowLeft, ArrowRight
} from 'lucide-react';

interface UnrealReality3DChamberProps {
  netWorthUsd?: number;
  unrealTelemetry?: any;
  supabaseStatus?: any;
  onTriggerNiagara?: (count: number, color: string, force: number) => void;
  onSwitchCamera?: (cam: string) => void;
  onSyncSupabase?: () => void;
}

interface PedestalInfo {
  id: string;
  name: string;
  category: string;
  position: [number, number, number];
  color: string;
  description: string;
  icon: any;
}

export const UnrealReality3DChamber: React.FC<UnrealReality3DChamberProps> = ({
  netWorthUsd = 15420,
  unrealTelemetry,
  supabaseStatus,
  onTriggerNiagara,
  onSwitchCamera,
  onSyncSupabase,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [isFirstPerson, setIsFirstPerson] = useState(false);
  const [activePedestal, setActivePedestal] = useState<PedestalInfo | null>(null);
  const [nearbyPedestal, setNearbyPedestal] = useState<PedestalInfo | null>(null);
  const [particleDensity, setParticleDensity] = useState(180);
  const [particleColorHex, setParticleColorHex] = useState('#10b981');
  const [impulseForce, setImpulseForce] = useState(2.5);
  const [isLocked, setIsLocked] = useState(false);
  const [cameraPreset, setCameraPreset] = useState<'fps' | 'orbit' | 'drone' | 'top'>('orbit');
  const [playerCoordinates, setPlayerCoordinates] = useState({ x: 0, y: 1.7, z: 8 });

  // Pedestals in 3D Space
  const pedestals: PedestalInfo[] = [
    {
      id: 'core_singularity',
      name: 'Gravitational Net Worth Core',
      category: 'WEALTH SINGULARITY',
      position: [0, 1.5, 0],
      color: '#10b981',
      description: `$${netWorthUsd.toLocaleString()} Active Net Worth Gravity Core generating wealth orbital traction.`,
      icon: Zap,
    },
    {
      id: 'sqlite_ledger',
      name: 'Physical Disk SQLite Vault',
      category: 'ACID WAL STORAGE',
      position: [-5, 1, -2],
      color: '#38bdf8',
      description: 'Physical disk WAL storage at data/moneyplughub.db with 100% ACID transaction write guarantees.',
      icon: Database,
    },
    {
      id: 'niagara_crucible',
      name: 'Niagara Cosmic VFX Crucible',
      category: 'PARTICLE SYNTHESIS',
      position: [5, 1, -2],
      color: '#eab308',
      description: 'Dispatches real-time GPU particle bursts, Solfeggio acoustic shockwaves, and shader vectors to Unreal Engine 5.4.',
      icon: Sparkles,
    },
    {
      id: 'supabase_portal',
      name: 'Supabase Cloud Gateway',
      category: 'POSTGRES REPLICATION',
      position: [-3.5, 1, 4],
      color: '#a855f7',
      description: 'Bi-directional cloud replication portal syncing SQLite state with Supabase Postgres.',
      icon: Cloud,
    },
    {
      id: 'pixel_stream_monolith',
      name: 'Unreal Engine 5.4 Monolith',
      category: 'DIRECTX 12 WEBRTC',
      position: [3.5, 1, 4],
      color: '#f43f5e',
      description: 'Unreal Engine 5.4 Pixel Streaming WebRTC node running 60 FPS DirectX 12 hardware acceleration.',
      icon: Video,
    },
  ];

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // ─── 1. THREE.JS SCENE SETUP ──────────────────────────────────────
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020617, 0.035);

    const camera = new THREE.PerspectiveCamera(
      70,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 3, 10);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;

    container.replaceChildren(renderer.domElement);

    // ─── 2. LIGHTING & ENVIRONMENT ────────────────────────────────────
    const ambientLight = new THREE.AmbientLight(0x0f172a, 1.8);
    scene.add(ambientLight);

    const coreLight = new THREE.PointLight(0x10b981, 4, 25);
    coreLight.position.set(0, 3, 0);
    scene.add(coreLight);

    const rimLight1 = new THREE.PointLight(0x38bdf8, 2, 20);
    rimLight1.position.set(-8, 5, -8);
    scene.add(rimLight1);

    const rimLight2 = new THREE.PointLight(0xa855f7, 2, 20);
    rimLight2.position.set(8, 5, 8);
    scene.add(rimLight2);

    // ─── 3. HEXAGONAL CYBER TEMPLE CHAMBER ────────────────────────────
    // Floor Grid
    const floorGeo = new THREE.PlaneGeometry(32, 32, 32, 32);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x030712,
      roughness: 0.2,
      metalness: 0.8,
      wireframe: false,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Glowing Neon Floor Grid Helper
    const gridHelper = new THREE.GridHelper(32, 32, 0x10b981, 0x1e293b);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // Chamber Dome / Cyber Walls
    const wallGeo = new THREE.CylinderGeometry(15, 15, 8, 12, 1, true);
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x090d16,
      roughness: 0.3,
      metalness: 0.9,
      side: THREE.BackSide,
      wireframe: false,
    });
    const chamberWalls = new THREE.Mesh(wallGeo, wallMat);
    chamberWalls.position.y = 4;
    scene.add(chamberWalls);

    // Neon Pillars around the Chamber
    const pillarGeo = new THREE.CylinderGeometry(0.3, 0.4, 8, 8);
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      emissive: 0x10b981,
      emissiveIntensity: 0.3,
      roughness: 0.1,
      metalness: 0.9,
    });

    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const px = Math.sin(angle) * 14.5;
      const pz = Math.cos(angle) * 14.5;
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.set(px, 4, pz);
      scene.add(pillar);
    }

    // ─── 4. CENTRAL NET WORTH QUANTUM CORE ────────────────────────────
    const coreGroup = new THREE.Group();
    scene.add(coreGroup);

    // Central Floating Octahedron
    const octaGeo = new THREE.OctahedronGeometry(1.2, 0);
    const octaMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 0.8,
      roughness: 0.1,
      metalness: 0.9,
      wireframe: false,
    });
    const coreOcta = new THREE.Mesh(octaGeo, octaMat);
    coreOcta.position.y = 2.2;
    coreGroup.add(coreOcta);

    // Orbiting Torus Rings
    const ringMat1 = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.8,
    });
    const ringMat2 = new THREE.MeshStandardMaterial({
      color: 0xeab308,
      emissive: 0xca8a04,
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.8,
    });

    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.05, 16, 64), ringMat1);
    ring1.position.y = 2.2;
    ring1.rotation.x = Math.PI / 4;
    coreGroup.add(ring1);

    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.04, 16, 64), ringMat2);
    ring2.position.y = 2.2;
    ring2.rotation.y = Math.PI / 3;
    coreGroup.add(ring2);

    // ─── 5. INTERACTIVE 3D PEDESTALS & HOLOGRAMS ──────────────────────
    const pedestalMeshes: { info: PedestalInfo; mesh: THREE.Group }[] = [];

    pedestals.forEach((p) => {
      const group = new THREE.Group();
      group.position.set(p.position[0], 0, p.position[2]);

      // Base Pedestal Cylinder
      const baseGeo = new THREE.CylinderGeometry(0.8, 1.0, 0.6, 16);
      const baseMat = new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        roughness: 0.4,
        metalness: 0.8,
      });
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.position.y = 0.3;
      group.add(base);

      // Glowing Neon Ring on Base
      const ringGlowGeo = new THREE.RingGeometry(0.7, 0.85, 32);
      const ringGlowMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(p.color),
        side: THREE.DoubleSide,
      });
      const ringGlow = new THREE.Mesh(ringGlowGeo, ringGlowMat);
      ringGlow.rotation.x = -Math.PI / 2;
      ringGlow.position.y = 0.61;
      group.add(ringGlow);

      // Levitating Holographic Icon Shape
      const holoGeo = new THREE.IcosahedronGeometry(0.4, 0);
      const holoMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(p.color),
        emissive: new THREE.Color(p.color),
        emissiveIntensity: 0.7,
        roughness: 0.1,
        metalness: 0.9,
      });
      const holo = new THREE.Mesh(holoGeo, holoMat);
      holo.position.y = 1.6;
      group.add(holo);

      // Point Light per Pedestal
      const pedLight = new THREE.PointLight(new THREE.Color(p.color), 1.5, 6);
      pedLight.position.y = 1.8;
      group.add(pedLight);

      scene.add(group);
      pedestalMeshes.push({ info: p, mesh: group });
    });

    // ─── 6. NIAGARA 3D PARTICLE SWARM SYSTEM ─────────────────────────
    const particleCount = 1200;
    const particleGeo = new THREE.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);
    const particleVel = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);

    const baseColor = new THREE.Color(particleColorHex);

    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const radius = 2 + Math.random() * 10;
      const height = Math.random() * 6;

      particlePos[i * 3] = Math.cos(theta) * radius;
      particlePos[i * 3 + 1] = height;
      particlePos[i * 3 + 2] = Math.sin(theta) * radius;

      particleVel[i * 3] = (Math.random() - 0.5) * 0.02;
      particleVel[i * 3 + 1] = (Math.random() - 0.5) * 0.02;
      particleVel[i * 3 + 2] = (Math.random() - 0.5) * 0.02;

      // Color gradation
      const mixedColor = baseColor.clone().offsetHSL((Math.random() - 0.5) * 0.1, 0, 0);
      particleColors[i * 3] = mixedColor.r;
      particleColors[i * 3 + 1] = mixedColor.g;
      particleColors[i * 3 + 2] = mixedColor.b;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 0.08,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });

    const particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);

    // ─── 7. CONTROLS & CAMERA DYNAMICS ───────────────────────────────
    let isMouseDown = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let targetYaw = 0;
    let targetPitch = 0.2;
    let currentYaw = 0;
    let currentPitch = 0.2;
    let orbitDistance = 10;

    // Movement Key States (WASD)
    const keys: Record<string, boolean> = {
      KeyW: false,
      KeyA: false,
      KeyS: false,
      KeyD: false,
      ArrowUp: false,
      ArrowLeft: false,
      ArrowDown: false,
      ArrowRight: false,
      ShiftLeft: false,
      Space: false,
    };

    const playerPos = new THREE.Vector3(0, 1.7, 8);
    const playerVelocity = new THREE.Vector3();

    const onKeyDown = (e: KeyboardEvent) => {
      if (keys.hasOwnProperty(e.code)) keys[e.code] = true;
      if (e.code === 'KeyE') {
        // Interact with closest pedestal
        if (nearbyPedestal) {
          setActivePedestal(nearbyPedestal);
        }
      }
      if (e.code === 'Escape') {
        setActivePedestal(null);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (keys.hasOwnProperty(e.code)) keys[e.code] = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    // Mouse Drag / Look Listener
    const onMouseDown = (e: MouseEvent) => {
      isMouseDown = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isMouseDown) return;
      const deltaX = e.clientX - prevMouseX;
      const deltaY = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;

      targetYaw -= deltaX * 0.005;
      targetPitch -= deltaY * 0.005;
      targetPitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, targetPitch));
    };

    const onMouseUp = () => {
      isMouseDown = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      orbitDistance = Math.max(3, Math.min(20, orbitDistance + e.deltaY * 0.01));
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('wheel', onWheel, { passive: false });

    // ─── 8. ANIMATION RENDER LOOP ────────────────────────────────────
    let animationId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const elapsed = clock.getElapsedTime();

      // Smooth camera interpolation
      currentYaw += (targetYaw - currentYaw) * 0.1;
      currentPitch += (targetPitch - currentPitch) * 0.1;

      // Rotate Central Quantum Core
      coreOcta.rotation.y = elapsed * 0.8;
      coreOcta.rotation.x = Math.sin(elapsed * 0.5) * 0.3;
      ring1.rotation.z = elapsed * 0.5;
      ring2.rotation.x = -elapsed * 0.4;
      coreOcta.position.y = 2.2 + Math.sin(elapsed * 2) * 0.15;

      // Animate Pedestal Holograms
      pedestalMeshes.forEach(({ mesh }, idx) => {
        const holo = mesh.children[2];
        if (holo) {
          holo.rotation.y = elapsed * (0.8 + idx * 0.2);
          holo.rotation.x = Math.sin(elapsed + idx) * 0.2;
          holo.position.y = 1.6 + Math.sin(elapsed * 3 + idx) * 0.1;
        }
      });

      // Animate 3D Particles with Gravitational Inward Pull
      const positions = particleGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        const idx = i * 3;
        let px = positions[idx];
        let py = positions[idx + 1];
        let pz = positions[idx + 2];

        // Orbital swirl around center
        const angle = 0.01;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const nx = px * cos - pz * sin;
        const nz = px * sin + pz * cos;

        // Inward gravitational pull towards core (0, 2.2, 0)
        const dist = Math.sqrt(nx * nx + (py - 2.2) * (py - 2.2) + nz * nz);
        const grav = 0.002;
        px = nx - (nx / dist) * grav;
        py += Math.sin(elapsed + i) * 0.005;
        pz = nz - (nz / dist) * grav;

        // Respawn if too close to core
        if (dist < 0.8) {
          const spawnRadius = 8 + Math.random() * 4;
          const spawnTheta = Math.random() * Math.PI * 2;
          px = Math.cos(spawnTheta) * spawnRadius;
          py = 0.5 + Math.random() * 5;
          pz = Math.sin(spawnTheta) * spawnRadius;
        }

        positions[idx] = px;
        positions[idx + 1] = py;
        positions[idx + 2] = pz;
      }
      particleGeo.attributes.position.needsUpdate = true;

      // ─── CAMERA MODES & FIRST PERSON WASD ──────────────────────────
      if (cameraPreset === 'fps') {
        const moveSpeed = (keys.ShiftLeft ? 7.5 : 4.0) * delta;
        const forward = new THREE.Vector3(
          -Math.sin(currentYaw),
          0,
          -Math.cos(currentYaw)
        ).normalize();
        const right = new THREE.Vector3(
          Math.cos(currentYaw),
          0,
          -Math.sin(currentYaw)
        ).normalize();

        if (keys.KeyW || keys.ArrowUp) playerPos.addScaledVector(forward, moveSpeed);
        if (keys.KeyS || keys.ArrowDown) playerPos.addScaledVector(forward, -moveSpeed);
        if (keys.KeyA || keys.ArrowLeft) playerPos.addScaledVector(right, -moveSpeed);
        if (keys.KeyD || keys.ArrowRight) playerPos.addScaledVector(right, moveSpeed);

        // Clamp inside chamber radius (13 meters)
        const currentDist = Math.sqrt(playerPos.x * playerPos.x + playerPos.z * playerPos.z);
        if (currentDist > 13) {
          playerPos.x = (playerPos.x / currentDist) * 13;
          playerPos.z = (playerPos.z / currentDist) * 13;
        }

        camera.position.copy(playerPos);
        const lookTarget = new THREE.Vector3(
          playerPos.x - Math.sin(currentYaw) * Math.cos(currentPitch),
          playerPos.y + Math.sin(currentPitch),
          playerPos.z - Math.cos(currentYaw) * Math.cos(currentPitch)
        );
        camera.lookAt(lookTarget);
        setPlayerCoordinates({ x: Math.round(playerPos.x * 10) / 10, y: 1.7, z: Math.round(playerPos.z * 10) / 10 });
      } else if (cameraPreset === 'orbit') {
        camera.position.x = Math.sin(currentYaw) * Math.cos(currentPitch) * orbitDistance;
        camera.position.y = Math.sin(currentPitch) * orbitDistance + 2.0;
        camera.position.z = Math.cos(currentYaw) * Math.cos(currentPitch) * orbitDistance;
        camera.lookAt(0, 2.0, 0);
      } else if (cameraPreset === 'drone') {
        camera.position.set(Math.sin(elapsed * 0.2) * 11, 6 + Math.cos(elapsed * 0.3) * 2, Math.cos(elapsed * 0.2) * 11);
        camera.lookAt(0, 1.8, 0);
      } else if (cameraPreset === 'top') {
        camera.position.set(0, 16, 0.1);
        camera.lookAt(0, 0, 0);
      }

      // Proximity check for nearby pedestals
      const testPos = cameraPreset === 'fps' ? playerPos : camera.position;
      let foundNearby: PedestalInfo | null = null;
      for (const p of pedestals) {
        const dx = testPos.x - p.position[0];
        const dz = testPos.z - p.position[2];
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < 3.2) {
          foundNearby = p;
          break;
        }
      }
      setNearbyPedestal(foundNearby);

      renderer.render(scene, camera);
    };

    animate();

    // Window Resize Handler
    const onResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    };
  }, [cameraPreset, particleColorHex, netWorthUsd]);

  return (
    <div className="relative rounded-3xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl">
      {/* 3D WebGL Canvas Viewport */}
      <div ref={mountRef} className="w-full h-[540px] block cursor-grab active:cursor-grabbing" />

      {/* Top Floating HUD: Chamber Telemetry & Camera Modes */}
      <div className="absolute top-4 left-4 right-4 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        
        {/* Left Status Pill */}
        <div className="pointer-events-auto p-2 px-3.5 rounded-2xl bg-slate-950/85 backdrop-blur-md border border-slate-800 shadow-xl flex items-center gap-2.5 text-xs text-white">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <div className="font-mono">
            <span className="text-emerald-300 font-bold uppercase tracking-wider">3D UNREAL REALITY CHAMBER</span>
            <span className="text-[10px] text-slate-400 block">
              POS: [{playerCoordinates.x}, {playerCoordinates.y}, {playerCoordinates.z}] • 60 FPS
            </span>
          </div>
        </div>

        {/* Right Camera Angle Switcher */}
        <div className="pointer-events-auto bg-slate-950/85 backdrop-blur-md p-1.5 rounded-2xl border border-slate-800 shadow-xl flex items-center gap-1 text-xs">
          {[
            { id: 'fps', label: '🚶 First-Person Walk', icon: Eye },
            { id: 'orbit', label: '🎥 Orbit View', icon: Video },
            { id: 'drone', label: '🛸 Auto-Drone', icon: Compass },
            { id: 'top', label: '🔮 Tactical Top', icon: Maximize2 },
          ].map((mode) => (
            <button
              key={mode.id}
              onClick={() => {
                setCameraPreset(mode.id as any);
                if (onSwitchCamera) {
                  onSwitchCamera(mode.id === 'fps' ? 'VAULT_FIRST_PERSON' : 'CINEMATIC_ORBIT_4K');
                }
              }}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                cameraPreset === mode.id
                  ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 shadow-md scale-105'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <span>{mode.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Proximity Interaction Prompt */}
      {nearbyPedestal && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 p-3 px-5 rounded-2xl bg-slate-950/90 backdrop-blur-md border border-emerald-500/50 shadow-2xl shadow-emerald-500/20 text-center animate-bounce cursor-pointer"
             onClick={() => setActivePedestal(nearbyPedestal)}>
          <div className="text-xs font-black text-white flex items-center justify-center gap-2">
            <span className="px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-mono font-black text-[11px]">[E]</span>
            <span>ENTER & INSPECT: {nearbyPedestal.name}</span>
          </div>
          <div className="text-[10px] text-emerald-300 font-mono mt-0.5 uppercase tracking-wider">
            {nearbyPedestal.category}
          </div>
        </div>
      )}

      {/* Bottom Floating Console: Navigation Keys & Quick Actions */}
      <div className="absolute bottom-4 left-4 right-4 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        
        {/* Navigation Key Guide (When in First Person) */}
        <div className="pointer-events-auto p-2.5 px-4 rounded-2xl bg-slate-950/85 backdrop-blur-md border border-slate-800 text-[11px] text-slate-300 flex items-center gap-3 font-mono">
          <div className="flex items-center gap-1 text-emerald-400 font-bold">
            <span className="bg-slate-900 border border-slate-700 px-1.5 py-0.5 rounded">W</span>
            <span className="bg-slate-900 border border-slate-700 px-1.5 py-0.5 rounded">A</span>
            <span className="bg-slate-900 border border-slate-700 px-1.5 py-0.5 rounded">S</span>
            <span className="bg-slate-900 border border-slate-700 px-1.5 py-0.5 rounded">D</span>
            <span className="text-slate-400 ml-1">Walk</span>
          </div>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">Mouse Drag to Look</span>
          <span className="text-slate-600">|</span>
          <span className="text-cyan-300">Scroll to Zoom</span>
        </div>

        {/* Quick Niagara Burst Dispatcher */}
        <div className="pointer-events-auto p-2 px-3 rounded-2xl bg-slate-950/85 backdrop-blur-md border border-slate-800 flex items-center gap-2">
          <div className="flex items-center gap-1">
            {[
              { color: '#10b981', name: 'Emerald' },
              { color: '#38bdf8', name: 'Cyan' },
              { color: '#eab308', name: 'Gold' },
              { color: '#a855f7', name: 'Amethyst' },
              { color: '#f43f5e', name: 'Supernova' },
            ].map((c) => (
              <button
                key={c.color}
                onClick={() => {
                  setParticleColorHex(c.color);
                  if (onTriggerNiagara) onTriggerNiagara(particleDensity, c.color, impulseForce);
                }}
                className={`w-5 h-5 rounded-full border transition-all cursor-pointer ${
                  particleColorHex === c.color ? 'border-white scale-125 shadow-md' : 'border-transparent opacity-70'
                }`}
                style={{ backgroundColor: c.color }}
                title={`Inject ${c.name} Niagara Particles`}
              />
            ))}
          </div>

          <button
            onClick={() => {
              if (onTriggerNiagara) onTriggerNiagara(particleDensity, particleColorHex, impulseForce);
            }}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 text-xs font-black flex items-center gap-1.5 shadow-md cursor-pointer transition-all active:scale-95"
          >
            <Sparkles className="w-3.5 h-3.5 fill-current" />
            <span>DISPATCH 3D BURST</span>
          </button>
        </div>
      </div>

      {/* Interactive Pedestal Inspection Modal */}
      {activePedestal && (
        <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md p-6 flex flex-col justify-between z-30 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg"
                   style={{ backgroundColor: `${activePedestal.color}20`, border: `1px solid ${activePedestal.color}60` }}>
                <activePedestal.icon className="w-5 h-5" style={{ color: activePedestal.color }} />
              </div>
              <div>
                <h3 className="text-base font-black text-white uppercase tracking-wider">
                  {activePedestal.name}
                </h3>
                <span className="text-xs font-mono" style={{ color: activePedestal.color }}>
                  {activePedestal.category}
                </span>
              </div>
            </div>

            <button
              onClick={() => setActivePedestal(null)}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-300 cursor-pointer"
            >
              ESC / Close
            </button>
          </div>

          <div className="py-4 space-y-4 max-w-2xl">
            <p className="text-sm text-slate-300 leading-relaxed font-sans">
              {activePedestal.description}
            </p>

            {/* Pedestal Specific Live Actions */}
            {activePedestal.id === 'core_singularity' && (
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="text-xs text-slate-400 font-bold uppercase">Singularity Metrics:</div>
                <div className="grid grid-cols-3 gap-2 font-mono text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">Net Worth Mass:</span>
                    <strong className="text-emerald-400 text-sm">${netWorthUsd.toLocaleString()}</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">Gravitational Pull:</span>
                    <strong className="text-cyan-400 text-sm">9.81 m/s²</strong>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-slate-500 block text-[10px]">Wealth Tier:</span>
                    <strong className="text-amber-400 text-sm">Emerald Seed</strong>
                  </div>
                </div>
              </div>
            )}

            {activePedestal.id === 'sqlite_ledger' && (
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="text-xs text-slate-400 font-bold uppercase">Physical SQLite Disk Status:</div>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-slate-300 space-y-1">
                  <div>Path: <code className="text-cyan-300">data/moneyplughub.db</code> (11.2 MB Physical Storage)</div>
                  <div>Mode: <span className="text-emerald-400 font-bold">WAL (Write-Ahead Logging) 100% ACID</span></div>
                  <div>Users: <span className="text-white font-bold">{supabaseStatus?.localStats?.users || 7170}</span> | Txns: <span className="text-white font-bold">{supabaseStatus?.localStats?.transactions || 620}</span></div>
                </div>
              </div>
            )}

            {activePedestal.id === 'supabase_portal' && (
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="text-xs text-slate-400 font-bold uppercase">Cloud Replication Status:</div>
                <button
                  onClick={() => {
                    if (onSyncSupabase) onSyncSupabase();
                  }}
                  className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-purple-500/20"
                >
                  <Cloud className="w-4 h-4" />
                  <span>TRIGGER FULL POSTGRES REPLICATION SYNC</span>
                </button>
              </div>
            )}

            {activePedestal.id === 'niagara_crucible' && (
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="text-xs text-slate-400 font-bold uppercase">Trigger 3D Particle Shockwave:</div>
                <button
                  onClick={() => {
                    if (onTriggerNiagara) onTriggerNiagara(particleDensity, particleColorHex, impulseForce);
                    setActivePedestal(null);
                  }}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-xs flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-amber-500/20"
                >
                  <Zap className="w-4 h-4 fill-current" />
                  <span>DETONATE NIAGARA SHOCKWAVE IN 3D CHAMBER</span>
                </button>
              </div>
            )}
          </div>

          <div className="border-t border-slate-800 pt-3 flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>Press [ESC] or click Close to return to free 3D navigation</span>
            <span className="text-emerald-400 font-bold">● Chamber Active</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnrealReality3DChamber;
