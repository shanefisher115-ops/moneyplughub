import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import soundDesign from '../utils/soundDesignEngine';

export interface SigilForgeThreeCanvasProps {
  auraColor?: string;
  selectedAura?: string;
  selectedGlyph?: string;
  selectedRing?: string;
  selectedCrest?: string;
  selectedAtmosphere?: string;
  monogram?: string;
  motto?: string;
  rotationSpeed?: 'off' | 'slow' | 'normal' | 'warp';
  glowMode?: 'subtle' | 'normal' | 'supernova';
  hueShift?: number;
  triggerBurst?: boolean;
  chromaticAberration?: boolean;
  particleDensity?: number;
  orbitSpeedFactor?: number;
  onCanvasClick?: () => void;
}

// Custom WebGL Shader for Reactive Energy Field
const SigilEnergyShader = {
  uniforms: {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color('#38bdf8') },
    uAudioBass: { value: 0 },
    uAudioMid: { value: 0 },
    uAudioTreble: { value: 0 },
    uGlowIntensity: { value: 1.0 },
    uMouse: { value: new THREE.Vector2(0, 0) },
  },
  vertexShader: `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;
    uniform float uTime;
    uniform float uAudioBass;
    uniform float uAudioMid;

    void main() {
      vUv = uv;
      vNormal = normalize(normalMatrix * normal);
      vPosition = position;

      vec3 pos = position;
      // Audio displacement
      float wave = sin(pos.x * 3.0 + uTime * 4.0) * cos(pos.y * 3.0 + uTime * 4.0);
      pos += normal * (wave * (0.05 + uAudioBass * 0.25) + uAudioMid * 0.15);

      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;
    uniform float uTime;
    uniform vec3 uColor;
    uniform float uAudioBass;
    uniform float uAudioMid;
    uniform float uAudioTreble;
    uniform float uGlowIntensity;
    uniform vec2 uMouse;

    void main() {
      vec3 viewDir = normalize(-vPosition);
      float fresnel = pow(1.0 - max(0.0, dot(vNormal, viewDir)), 2.5);

      // Dynamic plasma pattern
      float plasma = sin(vUv.x * 12.0 + uTime * 3.0) * cos(vUv.y * 12.0 + uTime * 3.0);
      plasma = smoothstep(-0.2, 0.8, plasma);

      // Distance from mouse cursor uniform
      float distToMouse = length(vUv - (uMouse * 0.5 + 0.5));
      float mouseRipple = smoothstep(0.3, 0.0, distToMouse) * 0.4;

      vec3 baseColor = uColor + vec3(uAudioTreble * 0.3, uAudioMid * 0.2, uAudioBass * 0.4);
      vec3 finalGlow = baseColor * (fresnel * 1.8 + plasma * 0.6 + mouseRipple) * uGlowIntensity;

      gl_FragColor = vec4(finalGlow, clamp(fresnel * 0.85 + plasma * 0.4, 0.2, 0.95));
    }
  `,
};

export const SigilForgeThreeCanvas: React.FC<SigilForgeThreeCanvasProps> = ({
  auraColor = '#00ff88',
  selectedAura = 'aura_cyber_emerald',
  selectedGlyph = 'glyph_quantum_hex',
  selectedRing = 'ring_circuit_traces',
  selectedCrest = 'crest_cyber_spikes',
  selectedAtmosphere = 'bg_void_matrix',
  monogram = '',
  motto = '',
  rotationSpeed = 'normal',
  glowMode = 'normal',
  hueShift = 0,
  triggerBurst = false,
  chromaticAberration = false,
  particleDensity = 30,
  orbitSpeedFactor = 1.0,
  onCanvasClick,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const shockwaveRef = useRef<{ radius: number; maxRadius: number; active: boolean }>({
    radius: 0,
    maxRadius: 12,
    active: false,
  });

  // Handle Shockwave Bursts
  useEffect(() => {
    if (triggerBurst) {
      shockwaveRef.current = {
        radius: 0.2,
        maxRadius: 10,
        active: true,
      };
    }
  }, [triggerBurst]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // ─── 1. THREE.JS SCENE INITIALIZATION ──────────────────────────────────
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 0, 7.5);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.3;

    container.replaceChildren(renderer.domElement);

    // ─── 2. LIGHTING SETUP ────────────────────────────────────────────────
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const baseThreeColor = new THREE.Color(auraColor);
    const mainLight = new THREE.PointLight(baseThreeColor, 3, 20);
    mainLight.position.set(0, 0, 4);
    scene.add(mainLight);

    const rimLight = new THREE.PointLight(0xffffff, 1.5, 15);
    rimLight.position.set(0, 5, -3);
    scene.add(rimLight);

    // ─── 3. SHADER MATERIAL & CORE GEOMETRY SYNTHESIS ───────────────────
    const shaderMat = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.clone(SigilEnergyShader.uniforms),
      vertexShader: SigilEnergyShader.vertexShader,
      fragmentShader: SigilEnergyShader.fragmentShader,
      transparent: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    shaderMat.uniforms.uColor.value = baseThreeColor;

    const coreGroup = new THREE.Group();
    scene.add(coreGroup);

    // Dynamic Central Glyph Mesh Selection
    let glyphGeo: THREE.BufferGeometry;
    if (selectedGlyph.includes('metatron') || selectedGlyph.includes('octagram') || selectedGlyph.includes('merkaba')) {
      glyphGeo = new THREE.OctahedronGeometry(1.3, 1);
    } else if (selectedGlyph.includes('tesseract') || selectedGlyph.includes('hex')) {
      glyphGeo = new THREE.IcosahedronGeometry(1.2, 0);
    } else if (selectedGlyph.includes('crown') || selectedGlyph.includes('apex')) {
      glyphGeo = new THREE.ConeGeometry(1.2, 2, 6);
    } else if (selectedGlyph.includes('dragon') || selectedGlyph.includes('phoenix')) {
      glyphGeo = new THREE.DodecahedronGeometry(1.2, 0);
    } else {
      glyphGeo = new THREE.TorusKnotGeometry(0.85, 0.28, 64, 16);
    }

    const glyphMesh = new THREE.Mesh(glyphGeo, shaderMat);
    coreGroup.add(glyphMesh);

    // Wireframe Overlay for Cyber Aesthetic
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    });
    const wireMesh = new THREE.Mesh(glyphGeo, wireMat);
    coreGroup.add(wireMesh);

    // ─── 4. ORBITAL RINGS & CREST ARCS ──────────────────────────────────
    const innerRingGeo = new THREE.TorusGeometry(2.1, 0.04, 16, 80);
    const ringMat1 = new THREE.MeshStandardMaterial({
      color: baseThreeColor,
      emissive: baseThreeColor,
      emissiveIntensity: 0.8,
      metalness: 0.9,
      roughness: 0.1,
    });
    const innerRing = new THREE.Mesh(innerRingGeo, ringMat1);
    coreGroup.add(innerRing);

    const outerRingGeo = new THREE.TorusGeometry(2.8, 0.03, 16, 96);
    const ringMat2 = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: baseThreeColor,
      emissiveIntensity: 0.5,
      metalness: 0.8,
      roughness: 0.2,
    });
    const outerRing = new THREE.Mesh(outerRingGeo, ringMat2);
    outerRing.rotation.x = Math.PI / 4;
    coreGroup.add(outerRing);

    // Crest Tri-Spike / Halo Geometry
    const crestGroup = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const spikeGeo = new THREE.ConeGeometry(0.2, 0.8, 4);
      const spikeMesh = new THREE.Mesh(spikeGeo, ringMat1);
      const angle = (i * Math.PI * 2) / 3;
      spikeMesh.position.set(Math.cos(angle) * 3.1, Math.sin(angle) * 3.1, 0);
      spikeMesh.rotation.z = angle - Math.PI / 2;
      crestGroup.add(spikeMesh);
    }
    coreGroup.add(crestGroup);

    // ─── 5. SHOCKWAVE RING ────────────────────────────────────────────────
    const shockwaveGeo = new THREE.RingGeometry(0.1, 0.2, 64);
    const shockwaveMat = new THREE.MeshBasicMaterial({
      color: baseThreeColor,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0,
    });
    const shockwaveMesh = new THREE.Mesh(shockwaveGeo, shockwaveMat);
    scene.add(shockwaveMesh);

    // ─── 6. PARTICLES FIELD WITH MOUSE MESH PHYSICS ─────────────────────
    const pCount = Math.max(20, Math.min(200, particleDensity * 3));
    const pGeo = new THREE.BufferGeometry();
    const pPositions = new Float32Array(pCount * 3);
    const pVelocities = new Float32Array(pCount * 3);
    const pBasePos = new Float32Array(pCount * 3);

    for (let i = 0; i < pCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 1.2 + Math.random() * 3.5;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      const z = (Math.random() - 0.5) * 2.5;

      pPositions[i * 3] = x;
      pPositions[i * 3 + 1] = y;
      pPositions[i * 3 + 2] = z;

      pBasePos[i * 3] = x;
      pBasePos[i * 3 + 1] = y;
      pBasePos[i * 3 + 2] = z;

      pVelocities[i * 3] = (Math.random() - 0.5) * 0.02;
      pVelocities[i * 3 + 1] = (Math.random() - 0.5) * 0.02;
      pVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.02;
    }

    pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
    const pMat = new THREE.PointsMaterial({
      size: 0.12,
      color: baseThreeColor,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });
    const particleSystem = new THREE.Points(pGeo, pMat);
    scene.add(particleSystem);

    // ─── 7. MOUSE PHYSICS & INTERACTION ──────────────────────────────────
    const mouse = new THREE.Vector2(0, 0);
    const targetRotation = new THREE.Vector2(0, 0);
    const raycaster = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    const mouse3D = new THREE.Vector3();

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      mouse.set(x, y);
      targetRotation.set(y * 0.6, x * 0.6);

      // Raycast to Z=0 plane for 3D physics interaction
      raycaster.setFromCamera(mouse, camera);
      raycaster.ray.intersectPlane(plane, mouse3D);

      shaderMat.uniforms.uMouse.value.set(x, y);
    };

    const handleMouseLeave = () => {
      targetRotation.set(0, 0);
      mouse.set(0, 0);
    };

    const handleClick = (e: MouseEvent) => {
      shockwaveRef.current = {
        radius: 0.2,
        maxRadius: 8.0,
        active: true,
      };
      if (onCanvasClick) onCanvasClick();
    };

    container.addEventListener('mousemove', handleMouseMove);
    container.addEventListener('mouseleave', handleMouseLeave);
    container.addEventListener('click', handleClick);

    // ─── 8. MAIN THREE.JS ANIMATION RENDER LOOP ─────────────────────────
    let animId: number;
    const clock = new THREE.Clock();

    const render = () => {
      animId = requestAnimationFrame(render);
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      // Retrieve Web Audio frequency data metrics from soundDesignEngine
      const metrics = soundDesign.getAudioMetrics();

      // Update Shader Uniforms
      shaderMat.uniforms.uTime.value = time;
      shaderMat.uniforms.uAudioBass.value = metrics.bass;
      shaderMat.uniforms.uAudioMid.value = metrics.mid;
      shaderMat.uniforms.uAudioTreble.value = metrics.treble;

      const glowMultiplier = glowMode === 'supernova' ? 2.2 : glowMode === 'subtle' ? 0.6 : 1.2;
      shaderMat.uniforms.uGlowIntensity.value = (1.0 + metrics.overall * 1.5) * glowMultiplier;

      // Update Colors based on Hue Shift and Aura
      const updatedColor = baseThreeColor.clone();
      if (hueShift !== 0) {
        updatedColor.offsetHSL(hueShift / 360, 0, 0);
      }
      shaderMat.uniforms.uColor.value = updatedColor;
      mainLight.color = updatedColor;
      ringMat1.color = updatedColor;
      ringMat1.emissive = updatedColor;
      pMat.color = updatedColor;

      // Spin Speeds Reacting to Audio & Speed Settings
      let speedMult = rotationSpeed === 'warp' ? 4.0 : rotationSpeed === 'slow' ? 0.3 : rotationSpeed === 'off' ? 0 : 1.0;
      speedMult *= orbitSpeedFactor;

      const spinVelocity = (0.3 + metrics.bass * 1.2) * speedMult;
      glyphMesh.rotation.y += spinVelocity * delta;
      glyphMesh.rotation.x += spinVelocity * 0.5 * delta;
      wireMesh.rotation.copy(glyphMesh.rotation);

      innerRing.rotation.z += (0.4 + metrics.mid * 1.5) * speedMult * delta;
      outerRing.rotation.y += (0.5 + metrics.treble * 1.8) * speedMult * delta;
      crestGroup.rotation.z -= (0.2 + metrics.bass * 0.8) * speedMult * delta;

      // Audio-Driven Mesh Pulsing
      const scaleBase = 1.0 + metrics.bass * 0.35 + Math.sin(time * 2) * 0.05;
      glyphMesh.scale.setScalar(scaleBase);
      wireMesh.scale.setScalar(scaleBase * 1.01);

      // Smooth Mouse Tilt Interpolation
      coreGroup.rotation.x += (targetRotation.x - coreGroup.rotation.x) * 0.08;
      coreGroup.rotation.y += (targetRotation.y - coreGroup.rotation.y) * 0.08;

      // Animate 3D Particles with Mouse Repulsion / Attraction Physics
      const posArr = pGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < pCount; i++) {
        const idx = i * 3;
        let px = posArr[idx];
        let py = posArr[idx + 1];
        let pz = posArr[idx + 2];

        // Orbit around origin
        const orbAngle = 0.005 * speedMult * (1 + metrics.treble);
        const cosA = Math.cos(orbAngle);
        const sinA = Math.sin(orbAngle);
        const nx = px * cosA - py * sinA;
        const ny = px * sinA + py * cosA;

        px = nx;
        py = ny;

        // Mouse distance force
        const dx = px - mouse3D.x;
        const dy = py - mouse3D.y;
        const dist = Math.sqrt(dx * dx + dy * dy + pz * pz) || 1;

        if (dist < 2.5) {
          const force = (2.5 - dist) / 2.5;
          pVelocities[idx] += (dx / dist) * force * 0.05;
          pVelocities[idx + 1] += (dy / dist) * force * 0.05;
        }

        // Return force to base positions
        pVelocities[idx] += (pBasePos[idx] - px) * 0.01;
        pVelocities[idx + 1] += (pBasePos[idx + 1] - py) * 0.01;
        pVelocities[idx + 2] += (pBasePos[idx + 2] - pz) * 0.01;

        // Apply velocity dampening
        pVelocities[idx] *= 0.92;
        pVelocities[idx + 1] *= 0.92;
        pVelocities[idx + 2] *= 0.92;

        posArr[idx] = px + pVelocities[idx];
        posArr[idx + 1] = py + pVelocities[idx + 1];
        posArr[idx + 2] = pz + pVelocities[idx + 2];
      }
      pGeo.attributes.position.needsUpdate = true;

      // Animate Shockwave Mesh
      const sw = shockwaveRef.current;
      if (sw.active) {
        sw.radius += delta * 12.0;
        shockwaveMesh.scale.set(sw.radius, sw.radius, 1);
        shockwaveMat.opacity = Math.max(0, 1.0 - sw.radius / sw.maxRadius);

        if (sw.radius >= sw.maxRadius) {
          sw.active = false;
          shockwaveMat.opacity = 0;
        }
      }

      renderer.render(scene, camera);
    };

    render();

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
      container.removeEventListener('mousemove', handleMouseMove);
      container.removeEventListener('mouseleave', handleMouseLeave);
      container.removeEventListener('click', handleClick);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
    };
  }, [
    auraColor,
    selectedGlyph,
    selectedRing,
    selectedCrest,
    rotationSpeed,
    glowMode,
    hueShift,
    particleDensity,
    orbitSpeedFactor,
    onCanvasClick,
  ]);

  return (
    <div
      ref={mountRef}
      className="relative w-full h-full cursor-crosshair overflow-hidden rounded-3xl"
    />
  );
};

export default SigilForgeThreeCanvas;
