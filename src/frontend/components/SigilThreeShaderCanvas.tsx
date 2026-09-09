import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import soundDesign from '../utils/soundDesignEngine';

export interface SigilThreeShaderCanvasProps {
  glowColor?: string;
  rotationSpeed?: 'off' | 'slow' | 'normal' | 'warp';
  glowMode?: 'subtle' | 'normal' | 'supernova';
  hueShift?: number;
  triggerBurst?: boolean;
  activeAtmosphere?: string;
  activeSolfeggioHz?: number | null;
  interactive?: boolean;
  sigilSvgDataUri?: string;
  motto?: string;
}

export const SigilThreeShaderCanvas: React.FC<SigilThreeShaderCanvasProps> = ({
  glowColor = '#00ff88',
  rotationSpeed = 'normal',
  glowMode = 'normal',
  hueShift = 0,
  triggerBurst = false,
  activeAtmosphere = 'bg_void_matrix',
  activeSolfeggioHz = null,
  interactive = true,
  sigilSvgDataUri = '',
  motto = 'SOVEREIGN CREATOR',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const audioMetricsRef = useRef<{ low: number; mid: number; high: number; avg: number }>({
    low: 0,
    mid: 0,
    high: 0,
    avg: 0,
  });

  const mousePosRef = useRef<{ x: number; y: number; targetX: number; targetY: number }>({
    x: 0,
    y: 0,
    targetX: 0,
    targetY: 0,
  });

  const shockwavesRef = useRef<Array<{ radius: number; maxRadius: number; alpha: number; color: string }>>([]);
  const [audioLevel, setAudioLevel] = useState<number>(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ─── 1. THREE.JS SCENE SETUP ──────────────────────────────────────────
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 0, 5.5);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    container.replaceChildren(renderer.domElement);

    // ─── 2. CUSTOM SHADER MATERIAL FOR GLOWING NEBULA / AURA ────────────────
    const vertexShader = `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;
      uniform float uTime;
      uniform float uAudioLow;
      uniform float uAudioMid;

      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;

        vec3 pos = position;
        float pulse = sin(uTime * 3.0 + pos.x * 2.0) * (0.05 + uAudioLow * 0.2);
        pos += normal * pulse;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
      }
    `;

    const fragmentShader = `
      varying vec2 vUv;
      varying vec3 vNormal;
      varying vec3 vPosition;
      uniform float uTime;
      uniform vec3 uColor;
      uniform float uHueShift;
      uniform float uAudioLow;
      uniform float uAudioMid;
      uniform float uAudioHigh;
      uniform float uGlowIntensity;
      uniform vec2 uMouse;

      vec3 rgb2hsl(vec3 c) {
        vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
        vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
        vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
        float d = q.x - min(q.w, q.y);
        float e = 1.0e-10;
        return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
      }

      vec3 hsl2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
      }

      void main() {
        vec2 centerUv = vUv - 0.5;
        float dist = length(centerUv);

        float audioEffect = (uAudioLow * 0.6 + uAudioMid * 0.4);
        float rim = 1.0 - clamp(dot(vec3(0.0, 0.0, 1.0), vNormal), 0.0, 1.0);
        float glow = pow(rim, 2.0 + (1.0 - audioEffect) * 1.5) * uGlowIntensity;

        vec3 hsl = rgb2hsl(uColor);
        hsl.x = fract(hsl.x + uHueShift / 360.0);
        vec3 baseRGB = hsl2rgb(hsl);

        // Add cybernetic pulse lines
        float linePulse = sin(dist * 40.0 - uTime * 4.0 + uAudioHigh * 10.0) * 0.5 + 0.5;
        vec3 finalColor = baseRGB * (glow + linePulse * 0.3 * audioEffect + 0.2);

        // Alpha fade at edge
        float alpha = smoothstep(0.5, 0.2, dist) * (glow + 0.3);
        gl_FragColor = vec4(finalColor, alpha);
      }
    `;

    const baseColorTHREE = new THREE.Color(glowColor);
    const shaderUniforms = {
      uTime: { value: 0 },
      uColor: { value: baseColorTHREE },
      uHueShift: { value: hueShift },
      uAudioLow: { value: 0 },
      uAudioMid: { value: 0 },
      uAudioHigh: { value: 0 },
      uGlowIntensity: { value: glowMode === 'supernova' ? 2.5 : glowMode === 'subtle' ? 0.7 : 1.4 },
      uMouse: { value: new THREE.Vector2(0, 0) },
    };

    const shaderMat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: shaderUniforms,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    // ─── 3. AUDIO-REACTIVE ORBITAL SHADER RINGS & CORE ─────────────────────
    const sigilGroup = new THREE.Group();
    scene.add(sigilGroup);

    // Inner Glowing Aura Shield Sphere
    const sphereGeo = new THREE.IcosahedronGeometry(1.6, 4);
    const auraMesh = new THREE.Mesh(sphereGeo, shaderMat);
    auraMesh.position.z = -0.2;
    sigilGroup.add(auraMesh);

    // Outer Concentric Concentric Concentric Rings
    const ringMat1 = new THREE.MeshBasicMaterial({
      color: baseColorTHREE,
      wireframe: true,
      transparent: true,
      opacity: 0.45,
    });

    const ringMat2 = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });

    const torusRing1 = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.02, 16, 64), ringMat1);
    torusRing1.rotation.x = Math.PI / 3;
    sigilGroup.add(torusRing1);

    const torusRing2 = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.015, 12, 64), ringMat2);
    torusRing2.rotation.y = Math.PI / 4;
    sigilGroup.add(torusRing2);

    // ─── 4. SVG TEXTURE PLANE FOR REAL-TIME EMBLEM RENDER ─────────────────
    let svgMesh: THREE.Mesh | null = null;
    const textureLoader = new THREE.TextureLoader();

    const updateSvgTexture = (uri: string) => {
      if (!uri) return;
      textureLoader.load(uri, (texture) => {
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;

        if (svgMesh) {
          (svgMesh.material as THREE.MeshBasicMaterial).map = texture;
          (svgMesh.material as THREE.MeshBasicMaterial).needsUpdate = true;
        } else {
          const planeGeo = new THREE.PlaneGeometry(3.6, 3.6);
          const planeMat = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
          });
          svgMesh = new THREE.Mesh(planeGeo, planeMat);
          svgMesh.position.z = 0.05;
          sigilGroup.add(svgMesh);
        }
      });
    };

    if (sigilSvgDataUri) {
      updateSvgTexture(sigilSvgDataUri);
    }

    // ─── 5. NIAGARA PARTICLE SWARM & HOVER PHYSICS ────────────────────────
    const particleCount = 200;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleVelocities = new Float32Array(particleCount * 3);
    const particleBaseAngles = new Float32Array(particleCount);
    const particleDistances = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 1.8 + Math.random() * 1.6;

      particlePositions[i * 3] = Math.cos(angle) * dist;
      particlePositions[i * 3 + 1] = Math.sin(angle) * dist;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 0.8;

      particleVelocities[i * 3] = (Math.random() - 0.5) * 0.01;
      particleVelocities[i * 3 + 1] = (Math.random() - 0.5) * 0.01;
      particleVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.01;

      particleBaseAngles[i] = angle;
      particleDistances[i] = dist;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    const particleMat = new THREE.PointsMaterial({
      color: baseColorTHREE,
      size: 0.045,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });

    const particleSwarm = new THREE.Points(particleGeo, particleMat);
    sigilGroup.add(particleSwarm);

    // ─── 6. MOUSE HOVER PHYSICS & RAYCASTING INTERACTION ──────────────────
    const handleMouseMove = (e: MouseEvent) => {
      if (!interactive || !container) return;
      const rect = container.getBoundingClientRect();
      const rawX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const rawY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

      mousePosRef.current.targetX = rawX * 0.6;
      mousePosRef.current.targetY = rawY * 0.6;
      shaderUniforms.uMouse.value.set(rawX, rawY);
    };

    const handleMouseLeave = () => {
      mousePosRef.current.targetX = 0;
      mousePosRef.current.targetY = 0;
    };

    const handleClick = () => {
      if (!interactive) return;
      soundDesign.playEffect('sigil_glow');

      shockwavesRef.current.push({
        radius: 0.1,
        maxRadius: 3.5,
        alpha: 1.0,
        color: glowColor,
      });
    };

    if (interactive) {
      container.addEventListener('mousemove', handleMouseMove);
      container.addEventListener('mouseleave', handleMouseLeave);
      container.addEventListener('click', handleClick);
    }

    // ─── 7. ANIMATION & WEB AUDIO SYNCHRONIZATION LOOP ────────────────────
    let animId: number;
    const clock = new THREE.Clock();

    const render = () => {
      animId = requestAnimationFrame(render);
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      // Get Web Audio frequency metrics from soundDesignEngine
      const audioData = soundDesign.getFrequencyData();
      audioMetricsRef.current = audioData;

      // Update shader uniforms
      shaderUniforms.uTime.value = time;
      shaderUniforms.uAudioLow.value = audioData.low;
      shaderUniforms.uAudioMid.value = audioData.mid;
      shaderUniforms.uAudioHigh.value = audioData.high;

      setAudioLevel(Math.round(audioData.avg * 100));

      // Rotation Speed Factor
      let speedFactor = 0.5;
      if (rotationSpeed === 'off') speedFactor = 0;
      else if (rotationSpeed === 'slow') speedFactor = 0.25;
      else if (rotationSpeed === 'normal') speedFactor = 0.7;
      else if (rotationSpeed === 'warp') speedFactor = 2.2;

      // React to Audio Bass/Treble by accelerating spin
      const dynamicSpeed = speedFactor + audioData.low * 1.5;

      sigilGroup.rotation.z = time * 0.15 * dynamicSpeed;
      torusRing1.rotation.x = Math.PI / 3 + Math.sin(time * 0.8) * 0.2 + audioData.mid * 0.5;
      torusRing1.rotation.z = time * 0.4 * dynamicSpeed;

      torusRing2.rotation.y = Math.PI / 4 + Math.cos(time * 0.6) * 0.25 + audioData.high * 0.6;
      torusRing2.rotation.z = -time * 0.3 * dynamicSpeed;

      // Audio reactive scale pulse
      const scalePulse = 1.0 + audioData.low * 0.18 + Math.sin(time * 2.5) * 0.02;
      auraMesh.scale.set(scalePulse, scalePulse, scalePulse);

      // Smooth mouse tilt parallax
      mousePosRef.current.x += (mousePosRef.current.targetX - mousePosRef.current.x) * 0.08;
      mousePosRef.current.y += (mousePosRef.current.targetY - mousePosRef.current.y) * 0.08;

      sigilGroup.rotation.y = mousePosRef.current.x * 0.8;
      sigilGroup.rotation.x = -mousePosRef.current.y * 0.8;

      // Particle Swarm Physics
      const positions = particleGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        const idx = i * 3;
        particleBaseAngles[i] += (0.003 + audioData.high * 0.01) * (i % 2 === 0 ? 1 : -1);

        const curDist = particleDistances[i] + Math.sin(time * 2.0 + i) * (0.1 + audioData.mid * 0.3);
        positions[idx] = Math.cos(particleBaseAngles[i]) * curDist;
        positions[idx + 1] = Math.sin(particleBaseAngles[i]) * curDist;
        positions[idx + 2] += Math.sin(time + i) * 0.002;
      }
      particleGeo.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
    };

    animId = requestAnimationFrame(render);

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      if (interactive && container) {
        container.removeEventListener('mousemove', handleMouseMove);
        container.removeEventListener('mouseleave', handleMouseLeave);
        container.removeEventListener('click', handleClick);
      }
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, [glowColor, rotationSpeed, glowMode, hueShift, interactive, activeAtmosphere]);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      {/* Three.js Canvas Mount */}
      <div ref={containerRef} className="w-full h-full block cursor-pointer" />

      {/* Real-time Audio Frequency Reactivity Overlay HUD */}
      <div className="absolute top-3 right-3 px-2.5 py-1 rounded-xl bg-slate-950/80 border border-slate-800 text-[10px] font-mono text-slate-300 flex items-center gap-2 pointer-events-none z-20 backdrop-blur-md">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span>WEB AUDIO 528HZ: <strong className="text-emerald-300">{audioLevel}%</strong></span>
      </div>
    </div>
  );
};

export default SigilThreeShaderCanvas;
