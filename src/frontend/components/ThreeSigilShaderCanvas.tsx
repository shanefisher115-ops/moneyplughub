import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import soundDesign, { SoundscapeType } from '../utils/soundDesignEngine';

export interface ThreeSigilShaderCanvasProps {
  svgDataUri?: string;
  glowColor?: string;
  rotationSpeed?: 'off' | 'slow' | 'normal' | 'warp';
  glowMode?: 'subtle' | 'normal' | 'supernova';
  hueShift?: number;
  triggerBurst?: boolean;
  chromaticAberration?: boolean;
  audioReactive?: boolean;
  activeSoundscape?: SoundscapeType;
  onCanvasClick?: () => void;
}

// ── Custom WebGL Shaders for Reactive Sigil Energy Field ──
const SIGIL_VERTEX_SHADER = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;
  uniform float uTime;
  uniform float uAudioBass;
  uniform float uHover;
  uniform vec2 uMouse;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);

    vec3 pos = position;

    // Web Audio bass pulse vertex displacement
    float distToCenter = length(pos.xy);
    float wave = sin(distToCenter * 8.0 - uTime * 4.0) * uAudioBass * 0.15;
    pos.z += wave;

    // Mouse hover proximity vector push
    float mouseDist = length(pos.xy - uMouse * 2.0);
    float hoverForce = smoothstep(1.5, 0.0, mouseDist) * uHover * 0.25;
    pos.z += hoverForce;

    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const SIGIL_FRAGMENT_SHADER = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  uniform sampler2D uTexture;
  uniform float uTime;
  uniform vec3 uGlowColor;
  uniform float uAudioBass;
  uniform float uAudioMid;
  uniform float uAudioTreble;
  uniform float uHover;
  uniform vec2 uMouse;
  uniform float uGlowIntensity;
  uniform float uHueShift;
  uniform float uChromatic;

  // Hue Rotation Helper
  vec3 hueRotate(vec3 col, float angle) {
    const vec3 k = vec3(0.57735, 0.57735, 0.57735);
    float cosAngle = cos(angle);
    return col * cosAngle + cross(k, col) * sin(angle) + k * dot(k, col) * (1.0 - cosAngle);
  }

  void main() {
    vec2 uv = vUv;

    // Chromatic Aberration Dispersion based on Audio Treble & Mouse Hover
    float shift = (0.003 + uAudioTreble * 0.012 + uHover * 0.008) * uChromatic;
    vec2 distVec = uv - vec2(0.5);

    vec4 texColorR = texture2D(uTexture, uv + distVec * shift);
    vec4 texColorG = texture2D(uTexture, uv);
    vec4 texColorB = texture2D(uTexture, uv - distVec * shift);

    vec4 texColor = vec4(texColorR.r, texColorG.g, texColorB.b, texColorG.a);

    // Procedural Energy Field Shimmer & Radial Pulsar
    float centerDist = length(uv - vec2(0.5));
    float pulse = sin(centerDist * 20.0 - uTime * 3.0 + uAudioBass * 6.0) * 0.5 + 0.5;
    float auraRing = smoothstep(0.48, 0.42, centerDist) * smoothstep(0.2, 0.4, centerDist);

    vec3 auraColor = uGlowColor * (pulse * 0.6 + uAudioMid * 0.8 + 0.4) * uGlowIntensity;
    auraColor = hueRotate(auraColor, uHueShift);

    // Dynamic Mouse Hover Spotlight Highlight
    float mouseGlow = smoothstep(0.4, 0.0, length(uv - (uMouse * 0.5 + 0.5))) * uHover;
    auraColor += vec3(1.0, 0.8, 0.4) * mouseGlow * 0.8;

    // Blend Sigil Texture with Shader Energy Aura
    vec3 finalColor = mix(auraColor * auraRing * 0.8, texColor.rgb + auraColor * 0.3, texColor.a);
    float finalAlpha = max(texColor.a, auraRing * 0.4 * uGlowIntensity);

    gl_FragColor = vec4(finalColor, finalAlpha);
  }
`;

export const ThreeSigilShaderCanvas: React.FC<ThreeSigilShaderCanvasProps> = ({
  svgDataUri,
  glowColor = '#00ff88',
  rotationSpeed = 'normal',
  glowMode = 'normal',
  hueShift = 0,
  triggerBurst = false,
  chromaticAberration = false,
  audioReactive = true,
  activeSoundscape = 'sigil_shimmer',
  onCanvasClick,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const mousePosRef = useRef<{ x: number; y: number; hover: number }>({ x: 0, y: 0, hover: 0 });
  const [audioLevel, setAudioLevel] = useState<{ bass: number; mid: number; treble: number }>({ bass: 0, mid: 0, treble: 0 });

  // References for Three.js state
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const particleSystemRef = useRef<THREE.Points | null>(null);
  const shockwavesRef = useRef<{ mesh: THREE.Mesh; maxRadius: number; alpha: number; color: THREE.Color }[]>([]);

  // Convert HEX color to THREE.Color
  const threeGlowColor = useRef(new THREE.Color(glowColor));

  useEffect(() => {
    threeGlowColor.current.set(glowColor);
  }, [glowColor]);

  // Trigger soundscape when activeSoundscape changes
  useEffect(() => {
    if (activeSoundscape && activeSoundscape !== 'none') {
      soundDesign.setSoundscape(activeSoundscape);
    }
  }, [activeSoundscape]);

  // Trigger 3D Shockwave Burst
  useEffect(() => {
    if (triggerBurst && sceneRef.current) {
      soundDesign.playEffect('supernova');
      const scene = sceneRef.current;
      const ringGeo = new THREE.RingGeometry(0.1, 0.2, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: threeGlowColor.current,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 1.0,
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.position.z = 0.1;
      scene.add(ringMesh);

      shockwavesRef.current.push({
        mesh: ringMesh,
        maxRadius: 4.5,
        alpha: 1.0,
        color: threeGlowColor.current.clone(),
      });
    }
  }, [triggerBurst]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 400;
    const height = container.clientHeight || 400;

    // ── 1. THREE.JS SCENE SETUP ──
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 5.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;

    container.replaceChildren(renderer.domElement);

    // ── 2. SIGIL TEXTURE & SHADER MATERIAL ──
    const textureLoader = new THREE.TextureLoader();
    let sigilTexture: THREE.Texture | null = null;

    if (svgDataUri) {
      sigilTexture = textureLoader.load(svgDataUri);
    }

    const glowIntensityValue = glowMode === 'subtle' ? 0.6 : glowMode === 'supernova' ? 2.2 : 1.2;

    const shaderMaterial = new THREE.ShaderMaterial({
      vertexShader: SIGIL_VERTEX_SHADER,
      fragmentShader: SIGIL_FRAGMENT_SHADER,
      uniforms: {
        uTexture: { value: sigilTexture },
        uTime: { value: 0 },
        uGlowColor: { value: threeGlowColor.current },
        uAudioBass: { value: 0 },
        uAudioMid: { value: 0 },
        uAudioTreble: { value: 0 },
        uMouse: { value: new THREE.Vector2(0, 0) },
        uHover: { value: 0 },
        uGlowIntensity: { value: glowIntensityValue },
        uHueShift: { value: (hueShift * Math.PI) / 180 },
        uChromatic: { value: chromaticAberration ? 1.0 : 0.0 },
      },
      transparent: true,
      side: THREE.DoubleSide,
    });
    materialRef.current = shaderMaterial;

    const planeGeo = new THREE.PlaneGeometry(3.2, 3.2, 32, 32);
    const sigilMesh = new THREE.Mesh(planeGeo, shaderMaterial);
    meshRef.current = sigilMesh;
    scene.add(sigilMesh);

    // ── 3. 3D ORBITING PARTICLE SWARM ──
    const particleCount = 240;
    const particleGeo = new THREE.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);
    const particleSpeeds = new Float32Array(particleCount);
    const particleDistances = new Float32Array(particleCount);
    const particleAngles = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      const dist = 1.6 + Math.random() * 1.8;
      const angle = Math.random() * Math.PI * 2;
      particleDistances[i] = dist;
      particleAngles[i] = angle;
      particleSpeeds[i] = (Math.random() > 0.5 ? 1 : -1) * (0.003 + Math.random() * 0.008);

      particlePos[i * 3] = Math.cos(angle) * dist;
      particlePos[i * 3 + 1] = Math.sin(angle) * dist;
      particlePos[i * 3 + 2] = (Math.random() - 0.5) * 0.8;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 0.045,
      color: threeGlowColor.current,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });

    const particleSystem = new THREE.Points(particleGeo, particleMat);
    particleSystemRef.current = particleSystem;
    scene.add(particleSystem);

    // ── 4. MOUSE HOVER PHYSICS & RAYCASTING ──
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      mousePosRef.current.x = nx;
      mousePosRef.current.y = ny;
      mousePosRef.current.hover = 1.0;
    };

    const handleMouseLeave = () => {
      mousePosRef.current.hover = 0.0;
    };

    const handleClick = () => {
      soundDesign.playEffect('sigil_glow');
      if (onCanvasClick) onCanvasClick();
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);
    container.addEventListener('click', handleClick);

    // ── 5. MAIN RENDER LOOP ──
    let animId: number;
    const clock = new THREE.Clock();

    const render = () => {
      animId = requestAnimationFrame(render);
      const elapsedTime = clock.getElapsedTime();

      // Retrieve real-time Web Audio frequency metrics
      const metrics = audioReactive
        ? soundDesign.getAudioMetrics()
        : { bass: 0.1, mid: 0.1, treble: 0.1, average: 0.1 };

      setAudioLevel(metrics);

      // Smooth mouse hover lerp
      const mouse = mousePosRef.current;
      const hoverTarget = mouse.hover;
      const curHover = shaderMaterial.uniforms.uHover.value;
      shaderMaterial.uniforms.uHover.value += (hoverTarget - curHover) * 0.08;

      const curMouse = shaderMaterial.uniforms.uMouse.value as THREE.Vector2;
      curMouse.x += (mouse.x - curMouse.x) * 0.1;
      curMouse.y += (mouse.y - curMouse.y) * 0.1;

      // Update Shader Uniforms
      shaderMaterial.uniforms.uTime.value = elapsedTime;
      shaderMaterial.uniforms.uAudioBass.value = metrics.bass;
      shaderMaterial.uniforms.uAudioMid.value = metrics.mid;
      shaderMaterial.uniforms.uAudioTreble.value = metrics.treble;
      shaderMaterial.uniforms.uGlowColor.value = threeGlowColor.current;
      shaderMaterial.uniforms.uGlowIntensity.value =
        glowMode === 'subtle' ? 0.6 : glowMode === 'supernova' ? 2.2 : 1.2;
      shaderMaterial.uniforms.uHueShift.value = (hueShift * Math.PI) / 180;
      shaderMaterial.uniforms.uChromatic.value = chromaticAberration ? 1.0 : 0.0;

      // Mesh Gyroscopic 3D Rotation Physics
      if (sigilMesh) {
        let speedMult = 0.01;
        if (rotationSpeed === 'off') speedMult = 0.0;
        else if (rotationSpeed === 'slow') speedMult = 0.003;
        else if (rotationSpeed === 'normal') speedMult = 0.012;
        else if (rotationSpeed === 'warp') speedMult = 0.045;

        sigilMesh.rotation.z += speedMult + metrics.bass * 0.01;

        // Interactive mouse tilt inertia
        const tiltX = mouse.y * 0.35;
        const tiltY = mouse.x * 0.35;
        sigilMesh.rotation.x += (tiltX - sigilMesh.rotation.x) * 0.08;
        sigilMesh.rotation.y += (tiltY - sigilMesh.rotation.y) * 0.08;
      }

      // Update 3D Particles Swarm
      const positions = particleGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        particleAngles[i] += particleSpeeds[i] * (1.0 + metrics.bass * 2.5);
        const dist = particleDistances[i] + Math.sin(elapsedTime * 2.0 + i) * 0.08 * (1.0 + metrics.mid);

        const px = Math.cos(particleAngles[i]) * dist;
        const py = Math.sin(particleAngles[i]) * dist;
        let pz = positions[i * 3 + 2];

        // Mouse repulsion physics
        const mdx = px - mouse.x * 2.0;
        const mdy = py - mouse.y * 2.0;
        const mdist = Math.sqrt(mdx * mdx + mdy * mdy) || 1.0;
        if (mdist < 1.2) {
          pz += (1.2 - mdist) * 0.02 * curHover;
        } else {
          pz *= 0.95;
        }

        positions[i * 3] = px;
        positions[i * 3 + 1] = py;
        positions[i * 3 + 2] = pz;
      }
      particleGeo.attributes.position.needsUpdate = true;
      particleMat.color = threeGlowColor.current;

      // Animate 3D Shockwaves
      for (let i = shockwavesRef.current.length - 1; i >= 0; i--) {
        const sw = shockwavesRef.current[i];
        sw.mesh.scale.addScalar(0.08);
        sw.alpha -= 0.03;
        (sw.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, sw.alpha);

        if (sw.alpha <= 0 || sw.mesh.scale.x > sw.maxRadius) {
          scene.remove(sw.mesh);
          sw.mesh.geometry.dispose();
          (sw.mesh.material as THREE.Material).dispose();
          shockwavesRef.current.splice(i, 1);
        }
      }

      renderer.render(scene, camera);
    };

    render();

    // Resize Listener
    const handleResize = () => {
      if (!container) return;
      const nw = container.clientWidth;
      const nh = container.clientHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
      container.removeEventListener('click', handleClick);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, [svgDataUri, rotationSpeed, glowMode, hueShift, chromaticAberration, audioReactive]);

  // Update texture dynamically when svgDataUri changes
  useEffect(() => {
    if (svgDataUri && materialRef.current) {
      new THREE.TextureLoader().load(svgDataUri, (tex) => {
        if (materialRef.current) {
          materialRef.current.uniforms.uTexture.value = tex;
          materialRef.current.needsUpdate = true;
        }
      });
    }
  }, [svgDataUri]);

  return (
    <div className="relative w-full h-full min-h-[360px] flex items-center justify-center overflow-hidden cursor-pointer select-none">
      {/* Three.js Canvas Container */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      {/* Real-time Web Audio Spectrum Overlay Badge */}
      <div className="absolute top-3 left-3 px-3 py-1.5 rounded-xl bg-slate-950/80 backdrop-blur-md border border-slate-800/80 text-[10px] font-mono text-slate-300 flex items-center gap-2 pointer-events-none z-10 shadow-lg">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="font-bold text-emerald-400">THREE.JS SHADER REALM</span>
        <div className="flex items-center gap-1 border-l border-slate-800 pl-2">
          <span className="text-slate-500">BASS:</span>
          <span className="text-cyan-400 font-bold">{(audioLevel.bass * 100).toFixed(0)}%</span>
          <span className="text-slate-500 ml-1">MID:</span>
          <span className="text-purple-400 font-bold">{(audioLevel.mid * 100).toFixed(0)}%</span>
        </div>
      </div>
    </div>
  );
};

export default ThreeSigilShaderCanvas;
