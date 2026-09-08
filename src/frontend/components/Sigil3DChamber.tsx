import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Compass, RotateCw, Sparkles, Orbit, ShieldCheck } from 'lucide-react';
import { forgeAudio } from '../utils/forgeAudio';

interface Sigil3DChamberProps {
  svgDataUri: string;
  glowColor?: string;
  isIgniting?: boolean;
  orientationAngle?: number;
  onSnapUpright?: () => void;
}

export const Sigil3DChamber: React.FC<Sigil3DChamberProps> = ({
  svgDataUri,
  glowColor = '#00ff88',
  isIgniting = false,
  orientationAngle = 0,
  onSnapUpright,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const medallionRef = useRef<THREE.Group | null>(null);
  const ringsGroupRef = useRef<THREE.Group | null>(null);
  const textureRef = useRef<THREE.CanvasTexture | null>(null);
  const animFrameRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);
  const previousMousePositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const rotationVelocityRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [textureFlipped, setTextureFlipped] = useState<boolean>(false);
  const [isHovered, setIsHovered] = useState<boolean>(false);

  // ── Update Texture when svgDataUri changes ──────────────────────────────
  useEffect(() => {
    if (!svgDataUri) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1024;
      canvas.height = 1024;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw dark high-contrast backdrop
      ctx.fillStyle = '#020408';
      ctx.fillRect(0, 0, 1024, 1024);

      // Draw SVG right-side up onto canvas
      ctx.drawImage(img, 0, 0, 1024, 1024);

      if (textureRef.current) {
        textureRef.current.image = canvas;
        textureRef.current.needsUpdate = true;
      }
    };
    img.src = svgDataUri;
  }, [svgDataUri]);

  // ── 3D Scene Initialization ──────────────────────────────────────────
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 400;

    // 1. Scene & Fog
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x030712, 0.04);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 8.5);
    cameraRef.current = camera;

    // 3. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;
    rendererRef.current = renderer;

    container.replaceChildren(renderer.domElement);

    // 4. Lighting Suite
    const ambientLight = new THREE.AmbientLight(0x0f172a, 2.0);
    scene.add(ambientLight);

    const mainLight = new THREE.PointLight(new THREE.Color(glowColor), 3.5, 20);
    mainLight.position.set(0, 2, 6);
    scene.add(mainLight);

    const rimLight = new THREE.PointLight(0x38bdf8, 2.0, 15);
    rimLight.position.set(-5, 4, -4);
    scene.add(rimLight);

    const bottomGlow = new THREE.PointLight(new THREE.Color(glowColor), 1.5, 12);
    bottomGlow.position.set(0, -4, 2);
    scene.add(bottomGlow);

    // 5. Build Floating 3D Sigil Medallion
    const medallionGroup = new THREE.Group();
    medallionRef.current = medallionGroup;
    scene.add(medallionGroup);

    // Initial offscreen canvas for initial texture
    const initialCanvas = document.createElement('canvas');
    initialCanvas.width = 1024;
    initialCanvas.height = 1024;
    const initialCtx = initialCanvas.getContext('2d');
    if (initialCtx) {
      initialCtx.fillStyle = '#020408';
      initialCtx.fillRect(0, 0, 1024, 1024);
    }

    const canvasTexture = new THREE.CanvasTexture(initialCanvas);
    canvasTexture.colorSpace = THREE.SRGBColorSpace;
    canvasTexture.flipY = !textureFlipped; // Standard Three.js canvas orientation (Right-side up)
    textureRef.current = canvasTexture;

    // Load current SVG onto texture
    if (svgDataUri) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        initialCtx?.drawImage(img, 0, 0, 1024, 1024);
        canvasTexture.needsUpdate = true;
      };
      img.src = svgDataUri;
    }

    // Front Sigil Face (Circular disk facing camera)
    const diskGeo = new THREE.CircleGeometry(2.35, 64);
    const diskMat = new THREE.MeshStandardMaterial({
      map: canvasTexture,
      roughness: 0.25,
      metalness: 0.6,
      side: THREE.FrontSide,
    });
    const diskMesh = new THREE.Mesh(diskGeo, diskMat);
    diskMesh.position.z = 0.08;
    medallionGroup.add(diskMesh);

    // Metallic Beveled Rim / Coin Outer Edge
    const rimGeo = new THREE.CylinderGeometry(2.4, 2.4, 0.15, 64, 1, false);
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      emissive: new THREE.Color(glowColor),
      emissiveIntensity: 0.25,
      roughness: 0.15,
      metalness: 0.9,
    });
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    rimMesh.rotation.x = Math.PI / 2;
    medallionGroup.add(rimMesh);

    // Outer Aureate Crown Ring on Medallion
    const bezelGeo = new THREE.TorusGeometry(2.42, 0.045, 16, 64);
    const bezelMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(glowColor),
      emissive: new THREE.Color(glowColor),
      emissiveIntensity: 0.6,
      roughness: 0.2,
      metalness: 0.85,
    });
    const bezelMesh = new THREE.Mesh(bezelGeo, bezelMat);
    bezelMesh.position.z = 0.085;
    medallionGroup.add(bezelMesh);

    // 6. 3D Concentric Orbiting Sacred Geometry Rings
    const ringsGroup = new THREE.Group();
    ringsGroupRef.current = ringsGroup;
    scene.add(ringsGroup);

    // Ring 1: Cyan Orbit (45° Tilt)
    const orbitGeo1 = new THREE.TorusGeometry(2.8, 0.025, 16, 64);
    const orbitMat1 = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.5,
      roughness: 0.3,
      metalness: 0.8,
    });
    const orbitRing1 = new THREE.Mesh(orbitGeo1, orbitMat1);
    orbitRing1.rotation.x = Math.PI / 4;
    ringsGroup.add(orbitRing1);

    // Ring 2: Amethyst Orbit (-35° Tilt)
    const orbitGeo2 = new THREE.TorusGeometry(3.1, 0.02, 16, 64);
    const orbitMat2 = new THREE.MeshStandardMaterial({
      color: 0xc084fc,
      emissive: 0x9333ea,
      emissiveIntensity: 0.5,
      roughness: 0.3,
      metalness: 0.8,
    });
    const orbitRing2 = new THREE.Mesh(orbitGeo2, orbitMat2);
    orbitRing2.rotation.y = Math.PI / 3;
    orbitRing2.rotation.z = Math.PI / 6;
    ringsGroup.add(orbitRing2);

    // Ring 3: Glow Color Equatorial Halo
    const orbitGeo3 = new THREE.TorusGeometry(3.4, 0.015, 16, 64);
    const orbitMat3 = new THREE.MeshStandardMaterial({
      color: new THREE.Color(glowColor),
      emissive: new THREE.Color(glowColor),
      emissiveIntensity: 0.7,
      roughness: 0.2,
      metalness: 0.9,
    });
    const orbitRing3 = new THREE.Mesh(orbitGeo3, orbitMat3);
    orbitRing3.rotation.x = Math.PI / 2.5;
    ringsGroup.add(orbitRing3);

    // 7. 3D Floating Constellation Stardust Particles
    const particleCount = 350;
    const particleGeo = new THREE.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      const radius = 2.5 + Math.random() * 3.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      particlePos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      particlePos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      particlePos[i * 3 + 2] = radius * Math.cos(phi);
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));

    const particleMat = new THREE.PointsMaterial({
      color: new THREE.Color(glowColor),
      size: 0.04,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });
    const particleSystem = new THREE.Points(particleGeo, particleMat);
    scene.add(particleSystem);

    // ── Mouse Drag Orbit Controls ─────────────────────────────────────
    const onMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !medallionRef.current) return;
      const deltaX = e.clientX - previousMousePositionRef.current.x;
      const deltaY = e.clientY - previousMousePositionRef.current.y;

      rotationVelocityRef.current = {
        x: deltaY * 0.005,
        y: deltaX * 0.005,
      };

      medallionRef.current.rotation.y += deltaX * 0.008;
      medallionRef.current.rotation.x += deltaY * 0.008;

      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
    };

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    // ── Animation Render Loop ─────────────────────────────────────────
    let clock = new THREE.Clock();

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Apply initial orientation angle (degrees to radians)
      const targetRadZ = (orientationAngle * Math.PI) / 180;
      if (medallionRef.current && !isDraggingRef.current) {
        // Smoothly return Z rotation to strictly upright target
        medallionRef.current.rotation.z += (targetRadZ - medallionRef.current.rotation.z) * 0.08;

        // Gentle levitation breathing
        medallionRef.current.position.y = Math.sin(elapsedTime * 1.5) * 0.12;

        if (autoRotate) {
          // Slow yaw rotation while strictly preserving upright axis
          medallionRef.current.rotation.y += 0.006;
          // Slight pitch tilt
          medallionRef.current.rotation.x = Math.sin(elapsedTime * 0.8) * 0.1;
        } else {
          // Smooth deceleration if dragging released
          medallionRef.current.rotation.y += rotationVelocityRef.current.y;
          medallionRef.current.rotation.x += rotationVelocityRef.current.x;
          rotationVelocityRef.current.x *= 0.92;
          rotationVelocityRef.current.y *= 0.92;
        }
      }

      // Rotate surrounding sacred geometry rings independently
      if (ringsGroupRef.current) {
        ringsGroupRef.current.rotation.y = elapsedTime * 0.25;
        ringsGroupRef.current.rotation.x = Math.sin(elapsedTime * 0.2) * 0.2;
      }

      // Rotate stardust constellation
      particleSystem.rotation.y = -elapsedTime * 0.08;

      // Pulse main light if igniting
      if (isIgniting) {
        mainLight.intensity = 6.0 + Math.sin(elapsedTime * 18) * 3.0;
      } else {
        mainLight.intensity = 3.2 + Math.sin(elapsedTime * 2) * 0.6;
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!container || !camera || !renderer) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, [glowColor, textureFlipped]);

  // ── Snap to 100% Upright Handler ──────────────────────────────────────
  const handleResetUpright = () => {
    if (medallionRef.current) {
      medallionRef.current.rotation.set(0, 0, 0);
      medallionRef.current.position.set(0, 0, 0);
      rotationVelocityRef.current = { x: 0, y: 0 };
    }
    setAutoRotate(false);
    forgeAudio.playOrientSnap();
    onSnapUpright?.();
  };

  const handleToggleTextureFlip = () => {
    if (textureRef.current) {
      textureRef.current.flipY = !textureRef.current.flipY;
      textureRef.current.needsUpdate = true;
      setTextureFlipped(!textureFlipped);
      forgeAudio.playTick(1200);
    }
  };

  return (
    <div 
      className="relative w-full aspect-square max-w-[420px] rounded-3xl overflow-hidden border border-slate-800 shadow-2xl bg-gradient-to-b from-slate-950 via-[#030712] to-slate-950 group select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Three.js Canvas Mount */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top HUD Telemetry Bar */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none z-10">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-950/80 border border-emerald-500/40 text-[10px] font-mono text-emerald-300 backdrop-blur-md">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>3D SPATIAL CHAMBER</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/80 border border-slate-800 text-[10px] font-mono text-cyan-300 backdrop-blur-md">
          <ShieldCheck className="w-3 h-3 text-cyan-400" />
          <span>UPRIGHT LOCKED ✓</span>
        </div>
      </div>

      {/* Viewport Floating Action Controls */}
      <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 z-10">
        {/* Left: Snap Upright & Flip Test */}
        <div className="flex items-center gap-1.5 bg-slate-950/85 p-1 rounded-xl border border-slate-800 backdrop-blur-md">
          <button
            onClick={handleResetUpright}
            className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-mono font-bold flex items-center gap-1 transition-all cursor-pointer shadow"
            title="Snap 3D Sigil firmly right-side up (0° lock)"
          >
            <Compass className="w-3.5 h-3.5 text-emerald-400" />
            <span>Snap Upright</span>
          </button>

          <button
            onClick={handleToggleTextureFlip}
            className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white text-[10px] font-mono transition-all cursor-pointer"
            title="Invert texture Y axis (180° test flip)"
          >
            <RotateCw className="w-3 h-3" />
            <span>Flip Y</span>
          </button>
        </div>

        {/* Right: Auto-Orbit Toggle */}
        <div className="flex items-center gap-1 bg-slate-950/85 p-1 rounded-xl border border-slate-800 backdrop-blur-md">
          <button
            onClick={() => {
              setAutoRotate(!autoRotate);
              forgeAudio.playTick(900);
            }}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold flex items-center gap-1 transition-all cursor-pointer ${
              autoRotate 
                ? 'bg-purple-600 text-white shadow' 
                : 'text-slate-400 hover:text-white bg-slate-900'
            }`}
            title="Toggle continuous orbital rotation"
          >
            <Orbit className="w-3.5 h-3.5" />
            <span>{autoRotate ? 'Orbit: ON' : 'Orbit: OFF'}</span>
          </button>
        </div>
      </div>

      {/* Interactive Helper Tooltip on Hover */}
      {isHovered && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-slate-900/90 border border-slate-700/60 text-[10px] font-mono text-slate-300 pointer-events-none backdrop-blur-md animate-fadeIn">
          🖱️ Click & Drag to Orbit 3D Medallion
        </div>
      )}
    </div>
  );
};
