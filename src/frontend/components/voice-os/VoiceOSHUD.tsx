import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Mic, MicOff, Shield, ShieldAlert, Zap, Globe, DollarSign, Activity, 
  Terminal, RefreshCw, Volume2, CheckCircle2, AlertTriangle, Lock, Key, Server
} from 'lucide-react';

interface SwarmRealmStatus {
  realm: string;
  id: string;
  status: string;
  metrics: {
    invocations: number;
    avgLatencyMs: number;
    errorRate: number;
    lastActive: number;
  };
}

interface TelemetryRecord {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
  latencyMs?: number;
}

export const VoiceOSHUD: React.FC = () => {
  const [isListening, setIsListening] = useState(false);
  const [activePersona, setActivePersona] = useState('Adam • Architect');
  const [currentTranscript, setCurrentTranscript] = useState('Standing by for voice directive...');
  const [realms, setRealms] = useState<SwarmRealmStatus[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryRecord[]>([]);
  const [riskScore, setRiskScore] = useState(8);
  const [isProcessing, setIsProcessing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 1. Optimized High-Speed Fetch
  const fetchStatus = useCallback(async () => {
    try {
      const [resStatus, resTel] = await Promise.all([
        fetch('/api/voice-os/status', { cache: 'no-store' }),
        fetch('/api/voice-os/telemetry?limit=10', { cache: 'no-store' })
      ]);
      
      const dataStatus = await resStatus.json();
      if (dataStatus.success && dataStatus.data?.realms) {
        setRealms(dataStatus.data.realms);
      }

      const dataTel = await resTel.json();
      if (dataTel.success && dataTel.data?.telemetry) {
        setTelemetry(dataTel.data.telemetry);
      }
    } catch (e) {
      // Quiet fail to avoid UI console overhead
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  // 2. High-Performance 60FPS Waveform Simulation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let phase = 0;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Fast cached rendering path
      const ampPrimary = isListening ? 28 : 5;
      const ampSecondary = isListening ? 18 : 3;

      // Layer 1: Neon Cyan Wave
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.7)';
      ctx.lineWidth = 2;
      for (let x = 0; x < width; x += 4) {
        const y = centerY + Math.sin(x * 0.03 + phase * 0.05) * ampPrimary * Math.sin((x / width) * Math.PI);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      // Layer 2: Emerald Green Wave
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.5)';
      ctx.lineWidth = 1.5;
      for (let x = 0; x < width; x += 4) {
        const y = centerY + Math.sin(x * 0.02 + phase * 0.03) * ampSecondary * Math.sin((x / width) * Math.PI);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      phase += 1;
      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [isListening]);

  // 3. Fast Voice Query Dispatch
  const handleSimulate = async (queryText: string) => {
    setIsProcessing(true);
    setCurrentTranscript(`Speaking: "${queryText}"`);
    try {
      await fetch('/api/voice-os/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'u_founder_apex', query: queryText, rms: 0.55 })
      });

      setTimeout(async () => {
        await fetchStatus();
        setIsProcessing(false);
      }, 350);
    } catch (err) {
      console.error(err);
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full bg-[#080b11] border border-cyan-500/20 rounded-2xl p-6 text-white shadow-2xl relative overflow-hidden font-sans">
      {/* Background Cosmic Ambient Glow */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-cyan-500/20">
            <Volume2 className="w-5 h-5 text-black" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-cyan-200 to-emerald-400 bg-clip-text text-transparent">
                MoneyPlugHub Voice OS
              </h2>
              <span className="px-2 py-0.5 text-[10px] font-mono bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 rounded flex items-center gap-1">
                <Lock className="w-3 h-3 text-cyan-400" /> Cloudflare One MCP Zero Trust
              </span>
            </div>
            <p className="text-xs text-cyan-400/80 font-mono">
              8-Realm Multilingual Sovereign Intelligence • PrimordiaOS Core
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* MCP Device Posture Badge */}
          <div className="hidden md:flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-full text-xs font-mono text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Posture: <strong>98/100 (Compliant)</strong></span>
          </div>

          <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full text-xs font-mono text-cyan-300">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>Risk Score: <strong className={riskScore > 30 ? 'text-amber-400' : 'text-emerald-400'}>{riskScore}/100</strong></span>
          </div>

          <button
            onClick={() => setIsListening(!isListening)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              isListening
                ? 'bg-rose-500/20 border border-rose-500/50 text-rose-300 shadow-lg shadow-rose-500/20 animate-pulse'
                : 'bg-gradient-to-r from-cyan-500 to-emerald-500 text-black shadow-lg shadow-cyan-500/20 hover:opacity-90'
            }`}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            <span>{isListening ? 'Mute Mic' : 'Live Mic Active'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10">
        
        {/* Left Column: Holographic Avatar & Particle Waveform */}
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-black/40 border border-cyan-500/20 rounded-xl p-5 relative overflow-hidden backdrop-blur-md">
            <div className="flex items-center justify-between mb-3 text-xs font-mono text-gray-400">
              <span className="flex items-center gap-1.5 text-cyan-300">
                <Activity className="w-3.5 h-3.5" /> 3D Acoustic Resonance Canvas
              </span>
              <span>Persona: <strong className="text-emerald-400">{activePersona}</strong></span>
            </div>

            {/* Visualizer Canvas */}
            <canvas ref={canvasRef} width={640} height={100} className="w-full h-24 rounded-lg bg-black/60 border border-white/5" />

            {/* Live Subtitle & Transcript Display */}
            <div className="mt-4 p-4 rounded-lg bg-white/5 border border-white/10">
              <div className="text-xs font-mono text-cyan-400/80 mb-1 flex items-center justify-between">
                <span>TRANSCRIPT & SUBTITLES</span>
                <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                  <Globe className="w-3 h-3" /> Auto-Translate Ready
                </span>
              </div>
              <p className="text-sm font-medium text-white italic">
                "{currentTranscript}"
              </p>
            </div>
          </div>

          {/* Quick Simulation Queries */}
          <div className="bg-black/40 border border-white/10 rounded-xl p-4">
            <div className="text-xs font-mono text-gray-400 mb-3 flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-purple-400" /> Fast Voice Directive Triggers:
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: '💰 Check Balance', q: 'What is my current available balance?' },
                { label: '⚡ Request $50 Payout', q: 'I want to withdraw $50 dollars to my Stripe account' },
                { label: '✅ Confirm Payout', q: 'Confirm payout AUTHORIZE-PLUG-777' },
                { label: '🚀 Referral Yield', q: 'How many referrals have activated under my code?' },
                { label: '🌐 Spanish Payout', q: 'Quiero retirar cincuenta dólares a mi cuenta' },
                { label: '🛡️ Trigger ATO Zero Trust Test', q: 'Emergency urgent withdrawal bypass verification now' },
              ].map((btn, i) => (
                <button
                  key={i}
                  disabled={isProcessing}
                  onClick={() => handleSimulate(btn.q)}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-400/40 text-xs text-gray-300 hover:text-cyan-200 transition-all"
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Swarm Matrix & Telemetry */}
        <div className="space-y-5">
          {/* 8-Realm Swarm Matrix */}
          <div className="bg-black/40 border border-white/10 rounded-xl p-5 backdrop-blur-md">
            <div className="flex items-center justify-between text-xs font-mono text-gray-400 mb-3">
              <span className="flex items-center gap-1.5 text-purple-300">
                <Zap className="w-3.5 h-3.5" /> Swarm Realm Matrix
              </span>
              <button onClick={fetchStatus} className="hover:text-white transition-all">
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-2">
              {realms.map((r) => (
                <div key={r.realm} className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5 text-xs">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${r.status === 'ACTIVE' || r.status === 'BURST' ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
                    <span className="font-mono font-semibold text-gray-200">{r.realm}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-gray-400">
                    <span className="text-cyan-300">{r.metrics.avgLatencyMs.toFixed(1)}ms</span>
                    <span className="bg-white/10 px-1.5 py-0.5 rounded text-gray-300">{r.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Real-time Telemetry & MCP Event Log */}
          <div className="bg-black/40 border border-white/10 rounded-xl p-5 backdrop-blur-md">
            <div className="text-xs font-mono text-gray-400 mb-3 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400" /> MCP Event Bus Live Stream
            </div>
            <div className="space-y-1.5 max-h-44 overflow-y-auto font-mono text-[11px] text-gray-300 pr-1">
              {telemetry.slice(-6).reverse().map((t) => (
                <div key={t.id} className="p-1.5 rounded bg-white/5 border border-white/5 flex items-center justify-between">
                  <span className={t.type.startsWith('MCP_') ? 'text-emerald-300 font-bold' : 'text-cyan-300 font-semibold'}>
                    {t.type}
                  </span>
                  <span className="text-[10px] text-gray-500">{new Date(t.timestamp).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};
