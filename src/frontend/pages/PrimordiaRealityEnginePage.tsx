import React, { useState, useEffect, useRef } from 'react';
import { 
  Zap, Flame, Shield, Activity, Compass, Brain, Sparkles, Orbit, 
  Layers, Sliders, ChevronRight, Play, Volume2, VolumeX, Square, Users, RefreshCw, 
  ArrowUpRight, AlertTriangle, Disc, Radio, Eye, Wand2, Palette, CheckCircle2, Mic,
  Database, Cpu, Cloud, Terminal, Video, Monitor, ExternalLink, Download, Box
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useGenerativeDesign, CosmicPillBackgroundKey } from '../context/GenerativeDesignContext';
import { MoneyOSHologramAvatar } from '../components/MoneyOSHologramAvatar';
import { CreatorNeuralField } from '../components/CreatorNeuralField';
import { CreatorXPReactor } from '../components/CreatorXPReactor';
import { UnrealReality3DChamber } from '../components/UnrealReality3DChamber';

interface PrimordiaRealityEnginePageProps {
  onNavigate?: (tab: string) => void;
  initialSubChamber?: 'parallel' | 'reality' | 'quantum-sigil' | 'time-dilation' | 'swarm-brain' | 'black-hole';
}

type SubChamberType = 'parallel' | 'reality' | 'quantum-sigil' | 'time-dilation' | 'swarm-brain' | 'black-hole';

export const PrimordiaRealityEnginePage: React.FC<PrimordiaRealityEnginePageProps> = ({
  onNavigate,
  initialSubChamber = 'parallel',
}) => {
  const { user, token } = useAuth();
  const { pillBackgroundKey, pillBackgroundCss, setPillBackground } = useGenerativeDesign();
  const [activeChamber, setActiveChamber] = useState<SubChamberType>(initialSubChamber);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Nuclear Master State
  const [nuclearData, setNuclearData] = useState<any>(null);
  const [finances, setFinances] = useState<any>({
    netWorthUsd: 15420,
    totalCashUsd: 11650,
    totalDebtUsd: 1850,
    savingsRatePct: 42,
  });

  // ─── Chamber 1: Reality Engine Canvas Ref ──────────────────────────
  const realityCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // ─── Chamber 2: Quantum Sigil State ────────────────────────────────
  const [quantumSigils, setQuantumSigils] = useState<any[]>([]);
  const [selectedQuantumSigil, setSelectedQuantumSigil] = useState<any>(null);
  const [sigilChargeAmount, setSigilChargeAmount] = useState<number>(500);

  // ─── Chamber 3: Time Dilation State ────────────────────────────────
  const [dilationYears, setDilationYears] = useState<number>(10);
  const [monthlyInvest, setMonthlyInvest] = useState<number>(250);
  const [referralReinvest, setReferralReinvest] = useState<number>(250);
  const [dilationResults, setDilationResults] = useState<any>(null);

  // ─── Chamber 4: Swarm Brain State ──────────────────────────────────
  const [swarmWeights, setSwarmWeights] = useState({
    preservation: 35, // Liam
    growth: 35,       // Rachel
    yield: 30,        // Adam
  });
  const [boardroomPrompt, setBoardroomPrompt] = useState('How do we maximize our 12-month net worth velocity?');
  const [boardroomTurns, setBoardroomTurns] = useState<any[]>([]);
  const [activeDeliberatingAgent, setActiveDeliberatingAgent] = useState<string | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const isAudioMutedRef = useRef(false);
  isAudioMutedRef.current = isAudioMuted;
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const currentSpeechGenerationRef = useRef(0);

  // ─── Chamber 5: Black Hole State ───────────────────────────────────
  const [blackHoleEntropy, setBlackHoleEntropy] = useState<any>({
    entropyScore: 18.4,
    eventHorizonRadius: 74,
    accretionDiskLuminosity: 78,
    singularityStatus: 'STABILIZED_EQUILIBRIUM',
  });

  // ─── UNREAL ENGINE 5.4+ & SUPABASE CLOUD SYNC STATE ──────────────
  const [unrealViewMode, setUnrealViewMode] = useState<'3d_chamber' | 'webgl' | 'pixel_stream'>('3d_chamber');
  const [unrealTelemetry, setUnrealTelemetry] = useState<any>({
    connected: true,
    fps: 60.0,
    frameTimeMs: 16.6,
    activeCamera: 'CINEMATIC_ORBIT_4K',
    niagaraParticleCount: 150,
    solfeggioFreqHz: 528.0,
    physicsImpulseLevel: 1.0,
    renderMode: 'DirectX 12 / Vulkan Hardware Accelerated',
    engineVersion: 'Unreal Engine 5.4.4',
  });
  const [niagaraColor, setNiagaraColor] = useState('#10b981');
  const [niagaraParticleSlider, setNiagaraParticleSlider] = useState(150);
  const [niagaraImpulseSlider, setNiagaraImpulseSlider] = useState(2.5);
  const [supabaseStatus, setSupabaseStatus] = useState<any>(null);
  const [isSyncingSupabase, setIsSyncingSupabase] = useState(false);

  const fetchUnrealStatus = async () => {
    try {
      const res = await fetch('/api/unreal/status');
      if (res.ok) {
        const j = await res.json();
        if (j.success && j.data) setUnrealTelemetry(j.data);
      }
    } catch {}
  };

  const fetchSupabaseStatus = async () => {
    try {
      const res = await fetch('/api/supabase/status');
      if (res.ok) {
        const j = await res.json();
        if (j.success && j.data) setSupabaseStatus(j.data);
      }
    } catch {}
  };

  const handleTriggerNiagara = async () => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/unreal/niagara', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          particleCount: niagaraParticleSlider,
          colorHex: niagaraColor,
          impulseForce: niagaraImpulseSlider,
        }),
      });
      if (res.ok) {
        const j = await res.json();
        setToast(j.message || '⚡ Niagara Particle Burst Dispatched!');
        setTimeout(() => setToast(null), 3000);
        fetchUnrealStatus();
      }
    } catch {}
  };

  const handleSwitchCamera = async (mode: string) => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/unreal/camera', {
        method: 'POST',
        headers,
        body: JSON.stringify({ cameraMode: mode }),
      });
      if (res.ok) {
        const j = await res.json();
        setToast(j.message || `🎥 Camera switched to ${mode}`);
        setTimeout(() => setToast(null), 3000);
        fetchUnrealStatus();
      }
    } catch {}
  };

  const handleSyncSupabase = async () => {
    if (isSyncingSupabase) return;
    setIsSyncingSupabase(true);
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/supabase/sync', { method: 'POST', headers });
      if (res.ok) {
        const j = await res.json();
        setToast('☁️ Supabase Cloud Replication Complete!');
        setTimeout(() => setToast(null), 3500);
        fetchSupabaseStatus();
      }
    } catch {
      setToast('⚠️ Cloud Sync Error');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setIsSyncingSupabase(false);
    }
  };

  const fetchNuclearState = async () => {
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/primordia/nuclear/state', { headers });
      if (res.ok) {
        const j = await res.json();
        if (j.success && j.data) {
          setNuclearData(j.data);
          if (j.data.finances) setFinances(j.data.finances);
          if (j.data.quantumSigils) {
            setQuantumSigils(j.data.quantumSigils);
            if (!selectedQuantumSigil && j.data.quantumSigils.length > 0) {
              setSelectedQuantumSigil(j.data.quantumSigils[0]);
            }
          }
          if (j.data.blackHoleEntropy) setBlackHoleEntropy(j.data.blackHoleEntropy);
        }
      }
    } catch {}
  };

  useEffect(() => {
    fetchNuclearState();
    fetchUnrealStatus();
    fetchSupabaseStatus();
  }, [token]);

  // Run Time Dilation Simulation
  const runDilationSimulation = async () => {
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/primordia/nuclear/time-dilation/simulate', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          years: dilationYears,
          monthlyInvestment: monthlyInvest,
          referralReinvestMonthly: referralReinvest,
        }),
      });
      if (res.ok) {
        const j = await res.json();
        if (j.success && j.data) {
          setDilationResults(j.data);
        }
      }
    } catch {}
  };

  useEffect(() => {
    if (activeChamber === 'time-dilation') {
      runDilationSimulation();
    }
  }, [activeChamber, dilationYears, monthlyInvest, referralReinvest]);

  // ─── 1. REALITY ENGINE CANVAS SIMULATION ───────────────────────────
  useEffect(() => {
    if (activeChamber !== 'reality' && activeChamber !== 'parallel') return;
    const canvas = realityCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let t = 0;

    const width = (canvas.width = canvas.parentElement?.clientWidth || 900);
    const height = (canvas.height = 540);

    const particles: Array<{ x: number; y: number; vx: number; vy: number; color: string; size: number }> = [];
    for (let i = 0; i < 220; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 1.5,
        vy: (Math.random() - 0.5) * 1.5,
        color: i % 4 === 0 ? '#10b981' : i % 4 === 1 ? '#06b6d4' : i % 4 === 2 ? '#a855f7' : '#f59e0b',
        size: Math.random() * 2 + 1,
      });
    }

    const render = () => {
      t += 0.02;
      ctx.fillStyle = 'rgba(2, 6, 23, 0.25)';
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;

      // 1. Central Gravitational Well (Net Worth Core)
      const coreRadius = Math.min(80, Math.max(25, (finances.netWorthUsd / 1000) * 2.5));
      const coreGrad = ctx.createRadialGradient(cx, cy, 5, cx, cy, coreRadius * 2);
      coreGrad.addColorStop(0, '#ffffff');
      coreGrad.addColorStop(0.3, '#10b981');
      coreGrad.addColorStop(0.7, '#06b6d4');
      coreGrad.addColorStop(1, 'transparent');

      ctx.beginPath();
      ctx.arc(cx, cy, coreRadius * (1 + Math.sin(t * 3) * 0.08), 0, Math.PI * 2);
      ctx.fillStyle = coreGrad;
      ctx.fill();

      // 2. Budget Shield Toroidal Magnetic Field Lines
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(t * 0.3);
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(0, 0, coreRadius * 2.2, coreRadius * 1.2 + (i * 20), (i * Math.PI) / 3, 0, Math.PI * 2);
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 1.2;
        ctx.globalAlpha = 0.4;
        ctx.stroke();
      }
      ctx.restore();

      // 3. Dark Matter Debt Swirl (if debt exists)
      if (finances.totalDebtUsd > 0) {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(-t * 0.8);
        ctx.beginPath();
        ctx.arc(coreRadius * 1.8, 0, Math.min(45, finances.totalDebtUsd / 50), 0, Math.PI * 2);
        const debtGrad = ctx.createRadialGradient(coreRadius * 1.8, 0, 2, coreRadius * 1.8, 0, 45);
        debtGrad.addColorStop(0, '#a855f7');
        debtGrad.addColorStop(0.8, '#3b0764');
        debtGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = debtGrad;
        ctx.fill();
        ctx.restore();
      }

      // 4. Relativistic Particle Jets & Constellation Nodes
      for (const p of particles) {
        // Gravitational attraction toward center
        const dx = cx - p.x;
        const dy = cy - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 30) {
          p.vx += (dx / dist) * 0.08;
          p.vy += (dy / dist) * 0.08;
        }

        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();

        // Connect nearby particles as Constellations
        for (const p2 of particles) {
          const d2 = Math.hypot(p.x - p2.x, p.y - p2.y);
          if (d2 < 45) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = p.color;
            ctx.globalAlpha = (1 - d2 / 45) * 0.25;
            ctx.lineWidth = 0.6;
            ctx.stroke();
          }
        }
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [activeChamber, finances]);

  // ─── 2. QUANTUM SIGIL CHARGE HANDLER ──────────────────────────────
  const handleChargeSigil = async () => {
    if (!selectedQuantumSigil || loading) return;
    setLoading(true);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/primordia/nuclear/quantum-sigil/charge', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sigilId: selectedQuantumSigil.id,
          xpAmount: sigilChargeAmount,
        }),
      });

      if (res.ok) {
        const j = await res.json();
        if (j.success) {
          setToast(j.data?.message || '✨ Quantum Sigil infused with XP!');
          setTimeout(() => setToast(null), 3500);
          fetchNuclearState();
        } else {
          setToast(`⚠️ ${j.error}`);
          setTimeout(() => setToast(null), 3000);
        }
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  // ─── AUDIO ENGINE & SWARM VOICE SYNTHESIS ──────────────────────────
  const interruptAudio = () => {
    currentSpeechGenerationRef.current++;
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      } catch {}
    }
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    setIsPlayingAudio(false);
    setActiveDeliberatingAgent(null);
  };

  const primeAudioContext = () => {
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.resume();
      } catch {}
    }
  };

  // ─── SPATIAL HARMONIC ACOUSTIC CUE ──────────────────────────────
  const playAgentHarmonicCue = (freq: number, pan: number) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const panner = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);

      if (panner) {
        panner.pan.setValueAtTime(pan, ctx.currentTime);
        osc.connect(gain);
        gain.connect(panner);
        panner.connect(ctx.destination);
      } else {
        osc.connect(gain);
        gain.connect(ctx.destination);
      }

      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {}
  };

  const speakTurnWithBrowser = (turn: any, onDone?: () => void) => {
    if (!('speechSynthesis' in window) || isAudioMutedRef.current) {
      onDone?.();
      return;
    }

    try {
      const thisGen = currentSpeechGenerationRef.current;
      const clean = (turn.text || '')
        .replace(/###|\*\*|\*|#|`|---|⚡|💳|📊|🎯|💸|🤖|🏛️|👋|🧹|📈|🎙️|💰|🔥|✨|🚀|💪|🤙|🙏|😄|😂|😅|🌤️|📞|📴|🔊|🎶|🔇/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/\n+/g, '. ')
        .trim();

      if (!clean) {
        onDone?.();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(clean);
      const allVoices = window.speechSynthesis.getVoices();
      const enVoices = allVoices.filter(v => v.lang.startsWith('en'));
      const voicePool = enVoices.length > 0 ? enVoices : allVoices;

      // ─── RADICAL ACOUSTIC & VOCAL PROFILING PER AGENT ─────────────
      if (turn.agentId === 'balance_agent') {
        // Liam • Strategist (Deep Baritone, Slow, Steady, Grounded)
        playAgentHarmonicCue(174, -0.75);
        utterance.pitch = 0.55;
        utterance.rate = 0.85;
        const v = voicePool.find(v => (v.name.includes('George') || v.name.includes('David') || v.name.includes('Daniel') || v.name.includes('Oliver') || v.name.includes('Male')) && !v.name.includes('Zira') && !v.name.includes('Susan')) || voicePool[0];
        if (v) utterance.voice = v;
      } else if (turn.agentId === 'referral_agent') {
        // Rachel • Explainer (Bright Soprano, Warm, Expressive)
        playAgentHarmonicCue(528, -0.35);
        utterance.pitch = 1.45;
        utterance.rate = 1.04;
        const v = voicePool.find(v => (v.name.includes('Zira') || v.name.includes('Samantha') || v.name.includes('Victoria') || v.name.includes('Susan') || v.name.includes('Hazel') || v.name.includes('Female')) && !v.name.includes('David')) || voicePool[1] || voicePool[0];
        if (v) utterance.voice = v;
      } else if (turn.agentId === 'insight_agent') {
        // Adam • Architect (Crisp, Structured, Analytical Midrange)
        playAgentHarmonicCue(396, 0.0);
        utterance.pitch = 0.94;
        utterance.rate = 0.96;
        const v = voicePool.find(v => (v.name.includes('Mark') || v.name.includes('Aaron') || v.name.includes('Sean') || v.name.includes('Google') || v.lang.includes('GB') || v.lang.includes('IE') || v.lang.includes('CA'))) || voicePool[2] || voicePool[0];
        if (v) utterance.voice = v;
      } else if (turn.agentId === 'earnings_agent') {
        // Antoni • Optimizer (Sharp Tenor, Ultra-Fast, Rapid-Fire Leverage)
        playAgentHarmonicCue(639, 0.45);
        utterance.pitch = 1.30;
        utterance.rate = 1.28;
        const v = voicePool.find(v => (v.name.includes('Ravi') || v.name.includes('James') || v.name.includes('Fred') || v.name.includes('Alex') || v.name.includes('Tom') || v.lang.includes('IN') || v.lang.includes('AU'))) || voicePool[3] || voicePool[0];
        if (v) utterance.voice = v;
      } else {
        // Josh • Motivator (Husky Booming Baritone, High Energy Momentum)
        playAgentHarmonicCue(741, 0.80);
        utterance.pitch = 0.72;
        utterance.rate = 1.18;
        const v = voicePool.find(v => (v.name.includes('Bruce') || v.name.includes('Ryan') || v.name.includes('Richard') || v.name.includes('Guy') || v.name.includes('David') || v.name.includes('Microsoft'))) || voicePool[4] || voicePool[0];
        if (v) utterance.voice = v;
      }

      utterance.onstart = () => {
        if (thisGen !== currentSpeechGenerationRef.current) {
          window.speechSynthesis.cancel();
          return;
        }
        setIsPlayingAudio(true);
        setActiveDeliberatingAgent(turn.agentId);
      };

      utterance.onend = () => {
        if (thisGen !== currentSpeechGenerationRef.current) return;
        onDone?.();
      };

      utterance.onerror = () => {
        if (thisGen !== currentSpeechGenerationRef.current) return;
        onDone?.();
      };

      window.speechSynthesis.speak(utterance);
    } catch {
      onDone?.();
    }
  };

  const speakTurn = async (turn: any, onDone?: () => void) => {
    if (isAudioMutedRef.current) {
      setActiveDeliberatingAgent(turn.agentId);
      setTimeout(() => onDone?.(), 1800);
      return;
    }

    interruptAudio();
    const thisGen = currentSpeechGenerationRef.current;
    setActiveDeliberatingAgent(turn.agentId);
    setIsPlayingAudio(true);

    try {
      const res = await fetch('/api/tts/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: turn.text,
          swarmAgentId: turn.agentId,
        }),
      });

      if (res.ok) {
        const blob = await res.blob();
        if (thisGen !== currentSpeechGenerationRef.current) return;
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        currentAudioRef.current = audio;

        audio.onended = () => {
          if (thisGen !== currentSpeechGenerationRef.current) return;
          URL.revokeObjectURL(url);
          currentAudioRef.current = null;
          onDone?.();
        };

        audio.onerror = () => {
          if (thisGen !== currentSpeechGenerationRef.current) return;
          URL.revokeObjectURL(url);
          currentAudioRef.current = null;
          speakTurnWithBrowser(turn, onDone);
        };

        await audio.play().catch(() => {
          if (thisGen !== currentSpeechGenerationRef.current) return;
          speakTurnWithBrowser(turn, onDone);
        });
      } else {
        speakTurnWithBrowser(turn, onDone);
      }
    } catch {
      speakTurnWithBrowser(turn, onDone);
    }
  };

  const playBoardroomSequence = (turns: any[], index = 0) => {
    if (index >= turns.length) {
      setActiveDeliberatingAgent(null);
      setIsPlayingAudio(false);
      return;
    }

    const currentTurn = turns[index];
    speakTurn(currentTurn, () => {
      setTimeout(() => {
        playBoardroomSequence(turns, index + 1);
      }, 350);
    });
  };

  // ─── 4. SWARM BRAIN DELIBERATION DISPATCH ─────────────────────────
  const handleConveneSwarmBrain = async () => {
    if (!boardroomPrompt.trim() || loading) return;
    primeAudioContext();
    interruptAudio();
    setLoading(true);
    setBoardroomTurns([]);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/moneyos/boardroom', {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt: boardroomPrompt.trim() }),
      });

      if (res.ok) {
        const j = await res.json();
        if (j.success && j.data?.turns && j.data.turns.length > 0) {
          setBoardroomTurns(j.data.turns);
          playBoardroomSequence(j.data.turns, 0);
        }
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  // ─── 5. BLACK HOLE STABILIZE HANDLER ──────────────────────────────
  const handleStabilizeBlackHole = async () => {
    if (loading) return;
    setLoading(true);

    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/primordia/nuclear/black-hole/stabilize', {
        method: 'POST',
        headers,
      });

      if (res.ok) {
        const j = await res.json();
        if (j.success) {
          setToast('🕳️ Spacetime singularity stabilized! +750 XP awarded.');
          setTimeout(() => setToast(null), 3500);
          fetchNuclearState();
          if ((window as any).refreshGlobalBalance) (window as any).refreshGlobalBalance();
        }
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-6 animate-fadeIn font-mono">
      {/* Toast Alert */}
      {toast && (
        <div className="p-3 sm:p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold flex items-center gap-2 animate-fadeIn shadow-lg shadow-emerald-500/10">
          <Zap className="w-4 h-4 fill-current shrink-0 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}

      {/* Persistent Mind-Reading Creator Neural Field */}
      <CreatorNeuralField onNavigate={onNavigate} />

      {/* Floating XP Fusion Core Reactor (Persistent HUD) */}
      <CreatorXPReactor onNavigate={onNavigate} />

      {/* Master Chamber Header & Realm Navigation Tabs */}
      <div className="p-5 sm:p-6 rounded-3xl bg-slate-950/90 border border-slate-800 shadow-2xl backdrop-blur-2xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 via-cyan-500 to-purple-600 p-0.5 shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-emerald-400">
                <Orbit className="w-6 h-6 animate-spin-slow" />
              </div>
            </div>
            <div>
              <div className="text-lg sm:text-xl font-black text-white tracking-wider flex items-center gap-2">
                <span>PRIMORDIAOS REALITY ENGINE</span>
                <span className="px-2 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/40 text-[10px] text-purple-300 font-bold">
                  ☢️ NUCLEAR TIER
                </span>
              </div>
              <div className="text-xs text-slate-400">
                Cosmic Spacetime Simulation • Quantum Fractals • Temporal Dilation
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
              Net Worth Gravity: <strong className="text-emerald-400">${finances.netWorthUsd.toLocaleString()}</strong>
            </div>
          </div>
        </div>

        {/* 6 Nuclear Sub-Chambers Tab Bar (Including All 3 in Parallel) */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-2 border-t border-slate-800/80">
          <button
            onClick={() => setActiveChamber('parallel')}
            className={`py-2 px-3 rounded-xl font-black text-xs border transition-all flex items-center justify-center gap-1.5 cursor-pointer col-span-2 sm:col-span-1 ${
              activeChamber === 'parallel'
                ? 'bg-gradient-to-r from-purple-500/30 via-cyan-500/30 to-emerald-500/30 text-white border-cyan-400 shadow-xl shadow-cyan-500/20 scale-[1.03]'
                : 'bg-slate-900/90 text-slate-300 border-slate-700 hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>⚡ ALL 3 PARALLEL</span>
          </button>

          <button
            onClick={() => setActiveChamber('reality')}
            className={`py-2 px-3 rounded-xl font-bold text-xs border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeChamber === 'reality'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 shadow-lg shadow-emerald-500/20'
                : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            <Orbit className="w-3.5 h-3.5" />
            <span>1. Reality Engine</span>
          </button>

          <button
            onClick={() => setActiveChamber('quantum-sigil')}
            className={`py-2 px-3 rounded-xl font-bold text-xs border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeChamber === 'quantum-sigil'
                ? 'bg-purple-500/20 text-purple-300 border-purple-500/60 shadow-lg shadow-purple-500/20'
                : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>2. Quantum Sigil</span>
          </button>

          <button
            onClick={() => setActiveChamber('time-dilation')}
            className={`py-2 px-3 rounded-xl font-bold text-xs border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeChamber === 'time-dilation'
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60 shadow-lg shadow-cyan-500/20'
                : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>3. Time Dilation</span>
          </button>

          <button
            onClick={() => setActiveChamber('swarm-brain')}
            className={`py-2 px-3 rounded-xl font-bold text-xs border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeChamber === 'swarm-brain'
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 shadow-lg shadow-amber-500/20'
                : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            <span>4. Swarm Brain</span>
          </button>

          <button
            onClick={() => setActiveChamber('black-hole')}
            className={`py-2 px-3 rounded-xl font-bold text-xs border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeChamber === 'black-hole'
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/60 shadow-lg shadow-rose-500/20'
                : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            <Disc className="w-3.5 h-3.5" />
            <span>5. Black Hole</span>
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ⚡ MASTER CHAMBER: ALL 3 IN PARALLEL (TRI-COCKPIT MATRIX)       */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeChamber === 'parallel' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          
          {/* Top Row: Engine 1 (Reality Engine) + Engine 2 (Magical Abilities & Cosmic Pill) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* 🌌 Engine 1: Live Reality Engine 60 FPS Physics Simulation (7 Cols) */}
            <div className="lg:col-span-7 p-5 rounded-3xl bg-slate-950/95 border border-slate-800 shadow-2xl relative overflow-hidden flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-xs font-black text-emerald-300 uppercase tracking-wider">
                    [1] REALITY ENGINE (60 FPS GRAVITATIONAL WELL)
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800 font-mono">
                  ${finances.netWorthUsd.toLocaleString()} Mass
                </span>
              </div>

              <div className="relative rounded-2xl overflow-hidden border border-slate-800/80 bg-slate-950">
                <canvas ref={realityCanvasRef} className="w-full h-[280px] block" />
                
                <div className="absolute bottom-2 left-2 right-2 p-2 rounded-xl bg-slate-950/80 backdrop-blur-md border border-slate-800/80 text-[10px] grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-slate-300">
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    <span>Net Worth Core</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    <span>Budget Shield</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    <span>Debt Dark Matter</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span>Referral Jets</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 🪄 Engine 2: Magical Mouseclick Abilities & Cosmic Pill Crucible (5 Cols) */}
            <div className="lg:col-span-5 p-5 rounded-3xl bg-slate-950/95 border border-slate-800 shadow-2xl space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Wand2 className="w-4 h-4 text-purple-400" />
                    <span className="text-xs font-black text-white uppercase tracking-wider">
                      [2] MAGICAL ABILITIES & PILL CRUCIBLE
                    </span>
                  </div>
                  <span className="text-[10px] text-purple-300 bg-purple-950/50 border border-purple-500/30 px-2 py-0.5 rounded-md font-bold">
                    Interactive Fast-Cast
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Tap any ability glyph below to trigger real-time 60 FPS particle bursts at your cursor:
                </p>

                {/* 9 Fast-Cast Magical Abilities Grid */}
                <div className="grid grid-cols-3 gap-1.5 mt-3">
                  {[
                    { key: 'lightning', name: '⚡ Lightning', color: '#38bdf8' },
                    { key: 'frost', name: '❄️ Frost', color: '#06b6d4' },
                    { key: 'inferno', name: '🔥 Inferno', color: '#f97316' },
                    { key: 'elemental', name: '🌿 Gaia', color: '#10b981' },
                    { key: 'fractal', name: '🔮 Fractal', color: '#a855f7' },
                    { key: 'vortex', name: '🌀 Vortex', color: '#6366f1' },
                    { key: 'antigravity', name: '🪐 Antigravity', color: '#eab308' },
                    { key: 'plasmatic', name: '⚛️ Plasmatic', color: '#ec4899' },
                    { key: 'chaos', name: '🌌 Chaos', color: '#f43f5e' },
                  ].map(ab => (
                    <button
                      key={ab.key}
                      onClick={(e) => {
                        e.stopPropagation();
                        if ((window as any).triggerMagicalClick) {
                          (window as any).triggerMagicalClick(e.clientX, e.clientY, ab.key);
                        }
                        if ((window as any).setEquippedClickAbility) {
                          (window as any).setEquippedClickAbility(ab.key);
                        }
                        setToast(`⚡ Fast-Cast Equipped: ${ab.name}`);
                        setTimeout(() => setToast(null), 2500);
                      }}
                      className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-600 text-[10px] font-bold text-slate-200 hover:text-white transition-all text-center flex items-center justify-center cursor-pointer shadow-md hover:scale-105 active:scale-95"
                      style={{ borderLeftColor: ab.color, borderLeftWidth: 3 }}
                    >
                      <span>{ab.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Cosmic Pill Container Theme Selector */}
              <div className="pt-3 border-t border-slate-800/80">
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold mb-2">
                  <span className="flex items-center gap-1">
                    <Palette className="w-3 h-3 text-cyan-400" />
                    <span>Active Cosmic Pill Theme:</span>
                  </span>
                  <span className="text-cyan-300 font-mono uppercase">{pillBackgroundKey.replace('_', ' ')}</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5 text-[9px] font-bold">
                  {[
                    { key: 'nebula_void', label: '🌌 Nebula' },
                    { key: 'solar_gold', label: '🌟 Solar Gold' },
                    { key: 'cyber_matrix', label: '🔮 Matrix' },
                    { key: 'emerald_vault', label: '🟢 Emerald' },
                    { key: 'singularity', label: '⚛️ Void' },
                    { key: 'spacetime_warp', label: '🚀 Warp' },
                  ].map(p => (
                    <button
                      key={p.key}
                      onClick={() => setPillBackground(p.key as CosmicPillBackgroundKey)}
                      className={`p-1.5 rounded-lg border text-center transition-all cursor-pointer ${
                        pillBackgroundKey === p.key
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60 shadow-sm'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Row: Engine 3 (MoneyOS Swarm Council Voice & Google Live 3.5 Duplex Stream) */}
          <div className="p-6 rounded-3xl bg-slate-950/95 border border-slate-800 shadow-2xl space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <Brain className="w-5 h-5 text-amber-400" />
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">
                    [3] MONEYOS SWARM COUNCIL VOICE & GOOGLE LIVE 3.5 DUPLEX STREAM
                  </h3>
                  <div className="text-[10px] text-slate-400 font-mono">
                    5 Autonomous Reasoning Nodes (Liam, Rachel, Adam, Antoni, Josh) Synthesizing Live
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {isPlayingAudio && (
                  <button
                    onClick={interruptAudio}
                    className="px-2.5 py-1 rounded-xl bg-rose-500/20 border border-rose-500/40 text-[10px] text-rose-300 font-bold flex items-center gap-1 hover:bg-rose-500/30 transition-all cursor-pointer"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    <span>Stop Audio</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    const next = !isAudioMuted;
                    setIsAudioMuted(next);
                    if (next) interruptAudio();
                    else primeAudioContext();
                  }}
                  className={`px-2.5 py-1 rounded-xl border text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    isAudioMuted
                      ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                      : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  }`}
                  title={isAudioMuted ? 'Unmute Audio' : 'Mute Audio'}
                >
                  {isAudioMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  <span>{isAudioMuted ? 'Audio: MUTED' : 'Audio: LIVE'}</span>
                </button>
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-[10px] text-emerald-300 font-bold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>24kHz Duplex Ready</span>
                </span>
              </div>
            </div>

            {/* 5 Holographic AI Agent Personas in Parallel */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                { id: 'balance_agent', name: 'Liam', title: 'Strategist', color: '#10b981' },
                { id: 'referral_agent', name: 'Rachel', title: 'Explainer', color: '#a855f7' },
                { id: 'insight_agent', name: 'Adam', title: 'Architect', color: '#06b6d4' },
                { id: 'earnings_agent', name: 'Antoni', title: 'Optimizer', color: '#f59e0b' },
                { id: 'automation_agent', name: 'Josh', title: 'Motivator', color: '#3b82f6' },
              ].map((agent) => (
                <div
                  key={agent.id}
                  className={`p-3 rounded-2xl border transition-all duration-300 ${
                    activeDeliberatingAgent === agent.id
                      ? 'bg-slate-900 border-2 scale-105 shadow-xl shadow-amber-500/10'
                      : 'bg-slate-950/80 border-slate-800'
                  }`}
                  style={{
                    borderColor: activeDeliberatingAgent === agent.id ? agent.color : undefined,
                  }}
                >
                  <MoneyOSHologramAvatar
                    personaId={agent.id}
                    personaName={`${agent.name} (${agent.title})`}
                    isSpeaking={activeDeliberatingAgent === agent.id}
                    themeColor={agent.color}
                    size="sm"
                  />
                </div>
              ))}
            </div>

            {/* Deliberation Council Trigger & Prompt Input */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
              <div className="text-xs font-bold text-slate-300 flex items-center justify-between">
                <span>Dispatch Parallel Question to 5-Agent Council:</span>
                <span className="text-[10px] text-slate-500 font-normal">Synthesizes into Unified Holographic Voice</span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={boardroomPrompt}
                  onChange={(e) => setBoardroomPrompt(e.target.value)}
                  placeholder="e.g. How do we maximize passive referral yield while hedging liability?"
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                />
                <button
                  onClick={handleConveneSwarmBrain}
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/25 flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>{loading ? 'DELIBERATING...' : 'DISPATCH TO ALL 5'}</span>
                </button>
              </div>
            </div>

            {/* Live Deliberation Transcript */}
            {boardroomTurns.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-400 uppercase flex items-center justify-between">
                  <span>Live Council Speech Stream:</span>
                  {activeDeliberatingAgent && (
                    <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1 animate-pulse">
                      <Volume2 className="w-3 h-3" />
                      <span>Speaking now...</span>
                    </span>
                  )}
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {boardroomTurns.map((t, idx) => (
                    <div
                      key={idx}
                      className={`p-3.5 rounded-xl border text-xs space-y-1.5 transition-all ${
                        activeDeliberatingAgent === t.agentId
                          ? 'bg-slate-900 border-2 shadow-lg shadow-amber-500/10'
                          : 'bg-slate-900/90 border-slate-800'
                      }`}
                      style={{ borderLeftColor: t.themeColor, borderLeftWidth: 4 }}
                    >
                      <div className="font-bold text-white flex items-center justify-between">
                        <span style={{ color: t.themeColor }}>{t.agentName} • {t.agentTitle}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              primeAudioContext();
                              speakTurn(t);
                            }}
                            className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 font-bold flex items-center gap-1 transition-all cursor-pointer"
                            title="Play this agent's response"
                          >
                            <Volume2 className="w-3 h-3 text-amber-400" />
                            <span>Listen</span>
                          </button>
                          <span className="text-[10px] text-slate-500 uppercase">{t.spatialPan} pan</span>
                        </div>
                      </div>
                      <div className="text-slate-300 leading-relaxed font-mono">{t.text}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ☢️ SUB-CHAMBER 1: UNREAL ENGINE 5.4+ & REALITY ENGINE MATRIX     */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeChamber === 'reality' && (
        <div className="space-y-6">
          {/* Top Status & Controls Header */}
          <div className="p-6 rounded-3xl bg-slate-950/95 border border-slate-800 shadow-2xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <Cpu className="w-5 h-5 text-slate-950" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-black text-white uppercase tracking-wider">
                      UNREAL ENGINE 5.4+ REALITY ENGINE & NIAGARA MATRIX
                    </h2>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/40 animate-pulse">
                      3D SPATIAL WALK-IN CHAMBER
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono flex items-center gap-3 mt-0.5">
                    <span>Active Camera: <strong className="text-cyan-300">{unrealTelemetry.activeCamera}</strong></span>
                    <span>•</span>
                    <span>FPS: <strong className="text-emerald-400">{unrealTelemetry.fps}</strong></span>
                    <span>•</span>
                    <span>Frame: <strong className="text-amber-300">{unrealTelemetry.frameTimeMs}ms</strong></span>
                    <span>•</span>
                    <span>Harmonic: <strong className="text-purple-300">{unrealTelemetry.solfeggioFreqHz}Hz</strong></span>
                  </div>
                </div>
              </div>

              {/* Viewport Mode & Supabase Sync Toggles */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="bg-slate-900 p-1 rounded-xl border border-slate-800 flex items-center gap-1">
                  <button
                    onClick={() => setUnrealViewMode('3d_chamber')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      unrealViewMode === '3d_chamber'
                        ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 shadow-md scale-105'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Box className="w-3.5 h-3.5" />
                    <span>🌐 3D Walk-In Chamber</span>
                  </button>
                  <button
                    onClick={() => setUnrealViewMode('pixel_stream')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      unrealViewMode === 'pixel_stream'
                        ? 'bg-cyan-500 text-slate-950 shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>Unreal Pixel Stream</span>
                  </button>
                  <button
                    onClick={() => setUnrealViewMode('webgl')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      unrealViewMode === 'webgl'
                        ? 'bg-emerald-500 text-slate-950 shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Activity className="w-3.5 h-3.5" />
                    <span>2D Canvas</span>
                  </button>
                </div>

                <button
                  onClick={handleSyncSupabase}
                  disabled={isSyncingSupabase}
                  className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                  title="Trigger bi-directional sync to Supabase Cloud"
                >
                  <Cloud className={`w-3.5 h-3.5 text-cyan-400 ${isSyncingSupabase ? 'animate-spin' : ''}`} />
                  <span>{isSyncingSupabase ? 'Syncing...' : 'Sync Supabase'}</span>
                </button>
              </div>
            </div>

            {/* Supabase Status Banner */}
            {supabaseStatus && (
              <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-400" />
                  <span>
                    Database: <strong className="text-white">Physical Disk SQLite WAL</strong> + <strong className="text-cyan-300">Supabase Dual-Write</strong> ({supabaseStatus.localStats?.transactions || 0} Txns, {supabaseStatus.localStats?.users || 0} Users)
                  </span>
                </div>
                <div className="flex items-center gap-3 font-mono text-[11px]">
                  <span className="text-slate-400">Status: <strong className="text-emerald-300">{supabaseStatus.status}</strong></span>
                  <span className="text-slate-400">Latency: <strong className="text-cyan-300">{supabaseStatus.latencyMs}ms</strong></span>
                </div>
              </div>
            )}
          </div>

          {/* Main Viewport Container */}
          <div>
            {unrealViewMode === '3d_chamber' ? (
              <UnrealReality3DChamber
                netWorthUsd={finances.netWorthUsd}
                unrealTelemetry={unrealTelemetry}
                supabaseStatus={supabaseStatus}
                onTriggerNiagara={(count, color, force) => {
                  setNiagaraParticleSlider(count);
                  setNiagaraColor(color);
                  setNiagaraImpulseSlider(force);
                  handleTriggerNiagara();
                }}
                onSwitchCamera={handleSwitchCamera}
                onSyncSupabase={handleSyncSupabase}
              />
            ) : unrealViewMode === 'webgl' ? (
              <div className="p-6 rounded-3xl bg-slate-950/95 border border-slate-800 shadow-2xl relative overflow-hidden space-y-4">
                <div className="relative rounded-2xl overflow-hidden border border-slate-800/80 bg-slate-950">
                  <canvas ref={realityCanvasRef} className="w-full h-[420px] block" />
                  
                  {/* Physics Legend Overlay */}
                  <div className="absolute bottom-3 left-3 right-3 p-3 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-800 text-[11px] grid grid-cols-2 sm:grid-cols-4 gap-2 text-slate-300">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Net Worth Grav-Core (${finances.netWorthUsd.toLocaleString()})</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-cyan-400" />
                      <span>Magnetic Budget Shield</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-purple-400" />
                      <span>Debt Dark Matter Orbit</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      <span>Referral Particle Jets</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-3xl bg-slate-950/95 border border-slate-800 shadow-2xl relative overflow-hidden space-y-4">
                <div className="relative rounded-2xl overflow-hidden border border-slate-800/80 bg-slate-950 min-h-[420px] flex flex-col items-center justify-center p-6 text-center">
                  <iframe
                    src="http://localhost:8888"
                    className="w-full h-[420px] rounded-xl border border-slate-800 bg-black"
                    title="Unreal Engine Pixel Streaming Viewport"
                    onError={() => console.log('Pixel stream offline')}
                  />
                  <div className="mt-3 p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 max-w-xl">
                    <div className="font-bold text-white flex items-center justify-center gap-2 mb-1">
                      <Monitor className="w-4 h-4 text-cyan-400" />
                      <span>Unreal Engine 5.4 Pixel Streaming Receiver (Port 8888)</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      If stream is idle, launch the local node by running: <code className="bg-slate-950 px-2 py-0.5 rounded text-cyan-300 font-mono">powershell ./launch_primordia_unreal.ps1</code>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Interactive Unreal Niagara & Camera Console */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Niagara Cosmic Particle Controller (7 Cols) */}
            <div className="lg:col-span-7 p-6 rounded-3xl bg-slate-950/95 border border-slate-800 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-black text-white uppercase tracking-wider">
                    NIAGARA PARTICLE VFX & ACOUSTIC EMITTER
                  </h3>
                </div>
                <span className="text-[10px] text-emerald-300 bg-emerald-950/50 border border-emerald-500/30 px-2 py-0.5 rounded-md font-bold">
                  Real-Time IPC Trigger
                </span>
              </div>

              {/* Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-slate-400">
                    <span>Particle Density:</span>
                    <strong className="text-white font-mono">{niagaraParticleSlider} particles</strong>
                  </div>
                  <input
                    type="range"
                    min="25"
                    max="250"
                    step="5"
                    value={niagaraParticleSlider}
                    onChange={(e) => setNiagaraParticleSlider(Number(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-slate-400">
                    <span>Impulse Force:</span>
                    <strong className="text-white font-mono">{niagaraImpulseSlider}x</strong>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="5.0"
                    step="0.5"
                    value={niagaraImpulseSlider}
                    onChange={(e) => setNiagaraImpulseSlider(Number(e.target.value))}
                    className="w-full accent-cyan-500 cursor-pointer"
                  />
                </div>
              </div>

              {/* Niagara Color Presets */}
              <div className="space-y-2 pt-2">
                <label className="text-[11px] font-bold text-slate-400 block">Niagara Shader Palette:</label>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { color: '#10b981', name: 'Emerald' },
                    { color: '#38bdf8', name: 'Cyan' },
                    { color: '#a855f7', name: 'Amethyst' },
                    { color: '#eab308', name: '24K Gold' },
                    { color: '#f43f5e', name: 'Supernova' },
                  ].map((p) => (
                    <button
                      key={p.color}
                      onClick={() => setNiagaraColor(p.color)}
                      className={`p-2 rounded-xl border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                        niagaraColor === p.color
                          ? 'border-white bg-slate-800 shadow-md scale-105'
                          : 'border-slate-800 bg-slate-900 hover:border-slate-700'
                      }`}
                    >
                      <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="text-[9px] font-bold text-slate-300">{p.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Trigger Button */}
              <button
                onClick={handleTriggerNiagara}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all cursor-pointer mt-2"
              >
                <Zap className="w-4 h-4 fill-current" />
                <span>DISPATCH NIAGARA BURST TO UNREAL ENGINE</span>
              </button>
            </div>

            {/* Camera & Solfeggio Matrix (5 Cols) */}
            <div className="lg:col-span-5 p-6 rounded-3xl bg-slate-950/95 border border-slate-800 shadow-2xl space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                  <div className="flex items-center gap-2">
                    <Video className="w-4 h-4 text-cyan-400" />
                    <h3 className="text-xs font-black text-white uppercase tracking-wider">
                      CINEMATIC CAMERAS & SOLFEGGIO
                    </h3>
                  </div>
                </div>

                {/* 4 Camera Modes */}
                <div className="space-y-2 mb-4">
                  <label className="text-[11px] font-bold text-slate-400 block">Switch Unreal Camera:</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'CINEMATIC_ORBIT_4K', label: '🎥 Orbit 4K' },
                      { id: 'VAULT_FIRST_PERSON', label: '👁️ Vault FP' },
                      { id: 'DRONE_MACRO', label: '🛸 Drone Macro' },
                      { id: 'MATRIX_GRID', label: '🔮 Matrix Grid' },
                    ].map((cam) => (
                      <button
                        key={cam.id}
                        onClick={() => handleSwitchCamera(cam.id)}
                        className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center ${
                          unrealTelemetry.activeCamera === cam.id
                            ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60 shadow-md'
                            : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:text-white'
                        }`}
                      >
                        {cam.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Solfeggio Harmonic Presets */}
                <div className="space-y-2">
                  <label className="text-[11px] font-bold text-slate-400 block">Solfeggio Harmonic Pulses:</label>
                  <div className="grid grid-cols-4 gap-1.5 text-[10px] font-bold font-mono">
                    {[
                      { freq: 174, label: '174Hz' },
                      { freq: 432, label: '432Hz' },
                      { freq: 528, label: '528Hz' },
                      { freq: 639, label: '639Hz' },
                    ].map((h) => (
                      <button
                        key={h.freq}
                        onClick={() => {
                          playAgentHarmonicCue(h.freq, 0);
                          setToast(`🎶 Solfeggio ${h.label} Acoustic Frequency Dispatched!`);
                          setTimeout(() => setToast(null), 2500);
                        }}
                        className="p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-purple-500/50 text-purple-300 hover:text-white transition-all cursor-pointer text-center"
                      >
                        {h.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Launcher Info */}
              <div className="p-3 rounded-2xl bg-slate-900/80 border border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-amber-400" />
                  <span>Launcher: <strong>launch_primordia_unreal.ps1</strong></span>
                </div>
                <span className="text-[10px] text-emerald-400 font-mono">UE 5.4 Ready</span>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ☢️ SUB-CHAMBER 2: SIGIL FORGE QUANTUM CHAMBER                   */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeChamber === 'quantum-sigil' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Sigils List */}
          <div className="p-5 rounded-3xl bg-slate-950/90 border border-slate-800 space-y-3">
            <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span>Quantum Fractal Sigils</span>
            </h3>
            <div className="space-y-2">
              {quantumSigils.map((sigil) => (
                <div
                  key={sigil.id}
                  onClick={() => setSelectedQuantumSigil(sigil)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                    selectedQuantumSigil?.id === sigil.id
                      ? 'bg-purple-950/40 border-purple-500/60 shadow-lg shadow-purple-500/20'
                      : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{sigil.sigil_name}</span>
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-purple-500/20 text-purple-300">
                      LVL {sigil.charge_level}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Multiplier: <strong className="text-emerald-400">{sigil.yield_multiplier}x</strong> • Depth {sigil.fractal_depth}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Active Sigil Fractal Preview & Infusion Forge */}
          <div className="md:col-span-2 p-6 rounded-3xl bg-slate-950/90 border border-slate-800 space-y-5">
            {selectedQuantumSigil ? (
              <>
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <h3 className="text-base font-black text-white">{selectedQuantumSigil.sigil_name}</h3>
                    <div className="text-xs text-slate-400">{selectedQuantumSigil.fractal_type} • Harmonic {selectedQuantumSigil.harmonic_frequency} Hz</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-emerald-400">{selectedQuantumSigil.yield_multiplier}x Yield Multiplier</div>
                    <div className="text-[10px] text-slate-400">{selectedQuantumSigil.xp_charged} Total XP Infused</div>
                  </div>
                </div>

                {/* Animated Fractal Geometric Canvas */}
                <div className="h-56 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-center relative overflow-hidden">
                  <div className="relative flex items-center justify-center">
                    <div className="w-36 h-36 rounded-full border-2 border-dashed border-purple-500/50 animate-spin-slow" />
                    <div className="absolute w-28 h-28 rounded-full border border-cyan-400/60 animate-spin" />
                    <div className="absolute w-20 h-20 rounded-full border-2 border-emerald-400/70 animate-pulse" />
                    <div className="absolute text-center">
                      <Sparkles className="w-8 h-8 text-purple-300 animate-bounce" />
                    </div>
                  </div>
                </div>

                {/* XP Infusion Controls */}
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-300">Infuse XP into Fractal Aura:</span>
                    <span className="text-purple-300 font-bold">{sigilChargeAmount} XP</span>
                  </div>
                  <input
                    type="range"
                    min="100"
                    max="2000"
                    step="100"
                    value={sigilChargeAmount}
                    onChange={(e) => setSigilChargeAmount(parseInt(e.target.value, 10))}
                    className="w-full accent-purple-400 cursor-pointer"
                  />
                  <button
                    onClick={handleChargeSigil}
                    disabled={loading}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs shadow-lg shadow-purple-500/25 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{loading ? 'INFUSING FRACTAL...' : `🔮 INFUSE ${sigilChargeAmount} XP (+0.05x BOOST)`}</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-12 text-slate-500">Select a Quantum Sigil to begin fractal infusion.</div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ☢️ SUB-CHAMBER 3: TIME DILATION ENGINE                          */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeChamber === 'time-dilation' && (
        <div className="p-6 rounded-3xl bg-slate-950/90 border border-slate-800 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-black text-white tracking-wider flex items-center gap-2">
                <Compass className="w-5 h-5 text-cyan-400" />
                <span>TIME DILATION MULTI-TIMELINE SIMULATOR</span>
              </h3>
              <div className="text-xs text-slate-400">Scrub across 1 to 40 years of parallel compound realities</div>
            </div>
            <div className="px-3 py-1 rounded-xl bg-cyan-950/60 border border-cyan-500/40 text-xs font-bold text-cyan-300">
              Horizon: {dilationYears} Years
            </div>
          </div>

          {/* Timeline Scrubber */}
          <div className="space-y-2 p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
            <div className="flex items-center justify-between text-xs font-bold text-slate-300">
              <span>Temporal Horizon:</span>
              <span className="text-cyan-300">{dilationYears} Years into Future</span>
            </div>
            <input
              type="range"
              min="1"
              max="35"
              value={dilationYears}
              onChange={(e) => setDilationYears(parseInt(e.target.value, 10))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>1 Year</span>
              <span>5 Yrs</span>
              <span>10 Yrs</span>
              <span>20 Yrs</span>
              <span>35 Yrs</span>
            </div>
          </div>

          {/* 4 Parallel Realities Grid */}
          {dilationResults && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {dilationResults.timelines.map((tl: any) => (
                  <div
                    key={tl.key}
                    className={`p-4 rounded-2xl border transition-all ${
                      tl.key === 'omega'
                        ? 'bg-emerald-950/40 border-emerald-500/60 shadow-xl shadow-emerald-500/20 scale-[1.02]'
                        : 'bg-slate-900/70 border-slate-800'
                    }`}
                  >
                    <div className="text-[10px] font-bold text-slate-400 uppercase">{tl.label}</div>
                    <div className="text-xl font-black text-white mt-1" style={{ color: tl.color }}>
                      ${tl.netWorthUsd.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">
                      CAGR Yield: <strong className="text-slate-200">{tl.yieldRate}</strong>
                    </div>
                    {tl.monthlyPassiveYieldUsd && (
                      <div className="mt-2 pt-2 border-t border-slate-800 text-[10px] text-emerald-300 font-bold">
                        ${tl.monthlyPassiveYieldUsd.toLocaleString()}/mo Safe Passive Yield
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* AI Divergence Commentary */}
              <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/40 text-xs text-cyan-200 leading-relaxed flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-white block mb-1">MoneyOS Temporal Intelligence:</strong>
                  {dilationResults.aiCommentary}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ☢️ SUB-CHAMBER 4: THE MULTI-AGENT SWARM BRAIN                   */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeChamber === 'swarm-brain' && (
        <div className="p-6 rounded-3xl bg-slate-950/90 border border-slate-800 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-black text-white tracking-wider flex items-center gap-2">
                <Brain className="w-5 h-5 text-amber-400" />
                <span>MULTI-AGENT SWARM BRAIN COUNCIL</span>
              </h3>
              <div className="text-xs text-slate-400">5 Autonomous AI Personas deliberating financial strategy</div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {isPlayingAudio && (
                <button
                  onClick={interruptAudio}
                  className="px-2.5 py-1 rounded-xl bg-rose-500/20 border border-rose-500/40 text-[10px] text-rose-300 font-bold flex items-center gap-1 hover:bg-rose-500/30 transition-all cursor-pointer"
                >
                  <Square className="w-3 h-3 fill-current" />
                  <span>Stop Audio</span>
                </button>
              )}
              <button
                onClick={() => {
                  const next = !isAudioMuted;
                  setIsAudioMuted(next);
                  if (next) interruptAudio();
                  else primeAudioContext();
                }}
                className={`px-2.5 py-1 rounded-xl border text-[10px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                  isAudioMuted
                    ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                    : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                }`}
                title={isAudioMuted ? 'Unmute Audio' : 'Mute Audio'}
              >
                {isAudioMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                <span>{isAudioMuted ? 'Audio: MUTED' : 'Audio: LIVE'}</span>
              </button>
              <span className="px-3 py-1 rounded-xl bg-amber-950/60 border border-amber-500/40 text-xs font-bold text-amber-300">
                5 Nodes Synced
              </span>
            </div>
          </div>

          {/* Visualized Holographic Agent Council */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { id: 'balance_agent', name: 'Liam', title: 'Strategist', color: '#10b981' },
              { id: 'referral_agent', name: 'Rachel', title: 'Explainer', color: '#a855f7' },
              { id: 'insight_agent', name: 'Adam', title: 'Architect', color: '#06b6d4' },
              { id: 'earnings_agent', name: 'Antoni', title: 'Optimizer', color: '#f59e0b' },
              { id: 'automation_agent', name: 'Josh', title: 'Motivator', color: '#3b82f6' },
            ].map((agent) => (
              <div
                key={agent.id}
                className={`p-3 rounded-2xl border transition-all duration-300 ${
                  activeDeliberatingAgent === agent.id
                    ? 'bg-slate-900 border-2 scale-105 shadow-xl'
                    : 'bg-slate-950/80 border-slate-800'
                }`}
                style={{
                  borderColor: activeDeliberatingAgent === agent.id ? agent.color : undefined,
                }}
              >
                <MoneyOSHologramAvatar
                  personaId={agent.id}
                  personaName={`${agent.name} (${agent.title})`}
                  isSpeaking={activeDeliberatingAgent === agent.id}
                  themeColor={agent.color}
                  size="sm"
                />
              </div>
            ))}
          </div>

          {/* Strategic Dilemma Prompt Box */}
          <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
            <div className="text-xs font-bold text-slate-300">Enter Financial Dilemma for Swarm Debate:</div>
            <div className="flex gap-2">
              <input
                type="text"
                value={boardroomPrompt}
                onChange={(e) => setBoardroomPrompt(e.target.value)}
                placeholder="e.g. Should I pay off credit card or reinvest in crypto?"
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
              />
              <button
                onClick={handleConveneSwarmBrain}
                disabled={loading}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/25 flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{loading ? 'DELIBERATING...' : 'CONVENE COUNCIL'}</span>
              </button>
            </div>
          </div>

          {/* Deliberation Transcript */}
          {boardroomTurns.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-400 uppercase flex items-center justify-between">
                <span>Live Deliberation Transcript:</span>
                {activeDeliberatingAgent && (
                  <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1 animate-pulse">
                    <Volume2 className="w-3 h-3" />
                    <span>Speaking now...</span>
                  </span>
                )}
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {boardroomTurns.map((t, idx) => (
                  <div
                    key={idx}
                    className={`p-3.5 rounded-xl border text-xs space-y-1.5 transition-all ${
                      activeDeliberatingAgent === t.agentId
                        ? 'bg-slate-900 border-2 shadow-lg shadow-amber-500/10'
                        : 'bg-slate-900/90 border-slate-800'
                    }`}
                    style={{ borderLeftColor: t.themeColor, borderLeftWidth: 4 }}
                  >
                    <div className="font-bold text-white flex items-center justify-between">
                      <span style={{ color: t.themeColor }}>{t.agentName} • {t.agentTitle}</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            primeAudioContext();
                            speakTurn(t);
                          }}
                          className="px-2 py-0.5 rounded-md bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 font-bold flex items-center gap-1 transition-all cursor-pointer"
                          title="Play this agent's response"
                        >
                          <Volume2 className="w-3 h-3 text-amber-400" />
                          <span>Listen</span>
                        </button>
                        <span className="text-[10px] text-slate-500 uppercase">{t.spatialPan} pan</span>
                      </div>
                    </div>
                    <div className="text-slate-300 leading-relaxed font-mono">{t.text}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* ☢️ SUB-CHAMBER 5: THE BLACK HOLE CHAMBER (FINANCIAL ENTROPY)   */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeChamber === 'black-hole' && (
        <div className="p-6 rounded-3xl bg-slate-950/90 border border-slate-800 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-black text-white tracking-wider flex items-center gap-2">
                <Disc className="w-5 h-5 text-rose-400" />
                <span>PRIMORDIAOS BLACK HOLE ENTROPY CHAMBER</span>
              </h3>
              <div className="text-xs text-slate-400">Gravitational Spacetime Curvature vs Financial Freedom</div>
            </div>
            <span className="px-3 py-1 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs font-bold text-rose-300">
              Entropy: {blackHoleEntropy.entropyScore}%
            </span>
          </div>

          {/* Black Hole Graphic Centerpiece */}
          <div className="h-64 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center relative overflow-hidden">
            <div className="relative flex items-center justify-center">
              {/* Relativistic Accretion Disk */}
              <div className="w-48 h-48 rounded-full bg-gradient-to-tr from-rose-600 via-amber-500 to-transparent blur-md animate-spin-slow opacity-70" />
              
              {/* Event Horizon Void */}
              <div className="absolute w-28 h-28 rounded-full bg-black border-2 border-rose-500/80 shadow-2xl shadow-rose-600/50 flex items-center justify-center">
                <span className="text-[10px] font-black text-rose-400 tracking-wider">EVENT HORIZON</span>
              </div>
            </div>
          </div>

          {/* Entropy Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="text-[10px] text-slate-400">EVENT HORIZON RADIUS</div>
              <div className="text-base font-black text-rose-400 mt-1">{blackHoleEntropy.eventHorizonRadius} km</div>
              <div className="text-[9px] text-slate-500 mt-0.5">Driven by total liabilities (${finances.totalDebtUsd})</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="text-[10px] text-slate-400">ACCRETION DISK LUMINOSITY</div>
              <div className="text-base font-black text-emerald-400 mt-1">{blackHoleEntropy.accretionDiskLuminosity}%</div>
              <div className="text-[9px] text-slate-500 mt-0.5">Driven by liquid reserve velocity</div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
              <div className="text-[10px] text-slate-400">SINGULARITY STABILITY</div>
              <div className="text-base font-black text-cyan-400 mt-1">{blackHoleEntropy.singularityStatus}</div>
              <div className="text-[9px] text-slate-500 mt-0.5">Astrophysical Jets Active</div>
            </div>
          </div>

          {/* Horizon Stabilization Action */}
          <button
            onClick={handleStabilizeBlackHole}
            disabled={loading}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-rose-600 via-purple-600 to-indigo-600 hover:from-rose-500 hover:to-indigo-500 text-white font-black text-xs shadow-xl shadow-rose-600/30 flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Disc className="w-4 h-4" />
            <span>{loading ? 'STABILIZING SPACETIME...' : '🕳️ STABILIZE EVENT HORIZON (+750 XP)'}</span>
          </button>
        </div>
      )}
    </div>
  );
};
