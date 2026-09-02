import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLivingRealm } from '../context/LivingRealmContext';
import { 
  Video, Play, Pause, RotateCcw, Download, Sparkles, Layers, 
  Film, Sliders, Volume2, VolumeX, Shield, Eye, Copy, Check, 
  ArrowRight, ExternalLink, Cpu, Flame, Award, RefreshCw, 
  Wand2, Scissors, Music, Share2, Monitor, Smartphone, Square,
  Clock, AlertCircle, FileCode, CheckCircle2, ChevronRight,
  Repeat, ShieldCheck, Zap, Terminal, Hash, Network, ArrowUpRight,
  PlaySquare, Radio, Sparkle
} from 'lucide-react';

interface VideoShot {
  shotIndex: number;
  timecode: string;
  durationSeconds: number;
  title: string;
  cameraMovement: string;
  lightingAndVFX: string;
  visualPrompt: string;
  firstFrameRef?: string;
  multiImageRef?: string;
  narrationScript: string;
  overlayText: string;
  overlayCta: string;
  previewGradient: string;
}

interface VideoProductionStoryboard {
  id: string;
  title: string;
  templateId: string;
  platform: 'tiktok' | 'reels' | 'shorts' | 'youtube' | 'twitter';
  aspectRatio: '9:16' | '16:9' | '1:1' | '4:5';
  width: number;
  height: number;
  totalDurationSeconds: number;
  narratorAgentId: string;
  narratorName: string;
  lutProfile: 'cyberpunk_emerald' | 'vault_gold' | 'neon_matrix' | 'natural_cinematic';
  referralCode: string;
  shots: VideoShot[];
  fullNarrationText: string;
  captionCopy: string;
  hashtags: string[];
  pinnedComment: string;
  createdAt: string;
}

interface VideoTemplate {
  id: string;
  name: string;
  description: string;
  aspectRatio: string;
  targetPlatform: string;
  recommendedDuration: number;
  recommendedLut: string;
  icon: string;
  tag: string;
}

export const VideoProductionPage: React.FC<{ onNavigate?: (tab: string) => void }> = ({ onNavigate }) => {
  const { user, token } = useAuth();
  const { playSound } = useLivingRealm();

  // Active Chamber Tab
  const [activeTab, setActiveTab] = useState<'omni_flash' | 'loop_engineer' | 'timeline' | 'batch_davinci'>('omni_flash');

  // Storyboard and Template State
  const [templates, setTemplates] = useState<VideoTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('viral_hook_916');
  const [selectedAspect, setSelectedAspect] = useState<'9:16' | '16:9' | '1:1' | '4:5'>('9:16');
  const [selectedLut, setSelectedLut] = useState<'cyberpunk_emerald' | 'vault_gold' | 'neon_matrix' | 'natural_cinematic'>('cyberpunk_emerald');
  const [selectedNarrator, setSelectedNarrator] = useState<string>('davinci_agent');
  const [customTopic, setCustomTopic] = useState<string>('passive-cashflow');

  const [storyboard, setStoryboard] = useState<VideoProductionStoryboard | null>(null);
  const [loadingStoryboard, setLoadingStoryboard] = useState<boolean>(false);
  const [activeShotIndex, setActiveShotIndex] = useState<number>(0);
  
  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playheadSeconds, setPlayheadSeconds] = useState<number>(0);
  const [audioMuted, setAudioMuted] = useState<boolean>(false);
  const [copiedCaption, setCopiedCaption] = useState<boolean>(false);
  const [copiedComment, setCopiedComment] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);
  const [dispatchStatus, setDispatchStatus] = useState<string | null>(null);
  const [exportingXml, setExportingXml] = useState<boolean>(false);

  // ── Gemini Omni Flash Generation State ─────────────────────────────
  const [omniMode, setOmniMode] = useState<'text_to_video' | 'first_frame' | 'image_referenced' | 'interpolation' | 'video_edit'>('text_to_video');
  const [omniPrompt, setOmniPrompt] = useState<string>('Continuous, unbroken shot of an ultra-luxury cybernetic vault door opening in a dark neon studio, golden particles cascading into high-yield yield meters. Sound design: Subsonic bass pulse, crisp electrical hum.');
  const [omniDuration, setOmniDuration] = useState<number>(5);
  const [omniStripAudio, setOmniStripAudio] = useState<boolean>(true);
  const [omniAudioPrompt, setOmniAudioPrompt] = useState<string>('High-energy cinematic electro synthwave with rhythmic mechanical clicks and 432Hz ambient resonance');
  const [omniFirstFrame, setOmniFirstFrame] = useState<string>('/moneyplughub_emblem.png');
  const [omniKeyframeEnd, setOmniKeyframeEnd] = useState<string>('/moneyplughub_emblem.png');
  const [omniPrevInteractionId, setOmniPrevInteractionId] = useState<string>('');
  const [isGeneratingOmni, setIsGeneratingOmni] = useState<boolean>(false);
  const [omniResult, setOmniResult] = useState<any>(null);

  // ── LoopEngineer Autonomous Loop State ──────────────────────────────
  const [loopDepth, setLoopDepth] = useState<number>(3);
  const [maxDepth, setMaxDepth] = useState<number>(5);
  const [loopTopic, setLoopTopic] = useState<string>('Automated Faceless Media Yield Loop');
  const [isExecutingLoop, setIsExecutingLoop] = useState<boolean>(false);
  const [loopExecutionTrace, setLoopExecutionTrace] = useState<string[]>([]);
  const [activeIdempotencyHash, setActiveIdempotencyHash] = useState<string | null>(null);
  const [antigravScore, setAntigravScore] = useState<number>(92.4);

  // ── Batch Matrix State ──────────────────────────────────────────────
  const [batchConcurrency, setBatchConcurrency] = useState<number>(3);
  const [batchConfigJson, setBatchConfigJson] = useState<string>('');
  const [isGeneratingBatch, setIsGeneratingBatch] = useState<boolean>(false);

  const playbackTimerRef = useRef<any>(null);

  // Fetch templates
  useEffect(() => {
    fetch('/api/video/templates')
      .then(res => res.json())
      .then(j => {
        if (j.success && j.data) setTemplates(j.data);
      })
      .catch(console.error);

    generateStoryboard('viral_hook_916');
  }, []);

  const generateStoryboard = async (templateIdToUse?: string) => {
    try {
      setLoadingStoryboard(true);
      setIsPlaying(false);
      setPlayheadSeconds(0);
      setActiveShotIndex(0);

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/video/storyboard', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          templateId: templateIdToUse || selectedTemplateId,
          topic: customTopic,
          aspectRatio: selectedAspect,
          narratorAgentId: selectedNarrator,
          lutProfile: selectedLut,
        })
      });

      const j = await res.json();
      if (j.success && j.data) {
        setStoryboard(j.data);
        playSound('warp');
        setToast('✨ Production Blueprint Generated!');
        setTimeout(() => setToast(null), 3000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingStoryboard(false);
    }
  };

  // Trigger Gemini Omni Flash Video Generation
  const handleGenerateOmniVideo = async () => {
    try {
      setIsGeneratingOmni(true);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let endpoint = '/api/video/omni-flash/generate';
      let payload: any = {
        prompt: omniPrompt,
        aspectRatio: selectedAspect,
        durationSeconds: omniDuration,
        mode: omniMode,
        stripAudio: omniStripAudio,
        audioPrompt: omniAudioPrompt,
        firstFrameImage: omniFirstFrame,
        previousInteractionId: omniPrevInteractionId
      };

      if (omniMode === 'interpolation') {
        endpoint = '/api/video/omni-flash/interpolate';
        payload = {
          prompt: omniPrompt,
          startImage: omniFirstFrame,
          endImage: omniKeyframeEnd,
          durationSeconds: omniDuration,
          aspectRatio: selectedAspect
        };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });

      const j = await res.json();
      if (j.success && j.data) {
        setOmniResult(j.data);
        playSound('ascension');
        setToast('⚡ Gemini Omni Flash Generation Dispatched!');
        setTimeout(() => setToast(null), 3500);
      } else {
        setToast(`⚠️ ${j.error || 'Generation failed'}`);
        setTimeout(() => setToast(null), 3500);
      }
    } catch (e: any) {
      console.error(e);
      setToast(`⚠️ ${e.message}`);
      setTimeout(() => setToast(null), 3500);
    } finally {
      setIsGeneratingOmni(false);
    }
  };

  // Trigger LoopEngineer Autonomous Execution
  const handleExecuteLoop = async () => {
    try {
      setIsExecutingLoop(true);
      setLoopExecutionTrace(['[LoopEngineer] Initiating cryptographic sovereignty check...']);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/video/loop/execute', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          topic: loopTopic,
          templateId: selectedTemplateId,
          loopDepth,
          maxDepth,
          idempotencyToken: `token_${Date.now()}`
        })
      });

      const j = await res.json();
      if (j.success && j.data) {
        setActiveIdempotencyHash(j.data.idempotencyHash);
        setAntigravScore(j.data.antigravScore || 92.4);
        setLoopExecutionTrace(j.data.logJson || []);
        playSound('laser');
        setToast(j.isIdempotentReplay ? '🛡️ Idempotency Shield Active (Replay Protected)' : '🚀 Autonomous Loop Executed & Staged!');
        setTimeout(() => setToast(null), 4000);
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsExecutingLoop(false);
    }
  };

  // Generate Batch JSON Payload
  const handleGenerateBatchConfig = async () => {
    try {
      setIsGeneratingBatch(true);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const sampleBatch = [
        { prompt: `${customTopic} • High Velocity Hook`, aspectRatio: '9:16', duration: 5, stripAudio: true },
        { prompt: `${customTopic} • 24K Living Vault Compounding Stream`, aspectRatio: '9:16', duration: 7, stripAudio: false },
        { prompt: `${customTopic} • 3D Holographic Sigil Call to Action`, aspectRatio: '9:16', duration: 4, stripAudio: true }
      ];

      const res = await fetch('/api/video/omni-flash/batch', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jobs: sampleBatch,
          concurrency: batchConcurrency
        })
      });

      const j = await res.json();
      if (j.success && j.data) {
        setBatchConfigJson(JSON.stringify(j.data.configJson, null, 2));
        playSound('powerup');
        setToast('📦 Batch Execution Config Generated!');
        setTimeout(() => setToast(null), 3000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingBatch(false);
    }
  };

  // Playback loop
  useEffect(() => {
    if (isPlaying && storyboard) {
      playbackTimerRef.current = setInterval(() => {
        setPlayheadSeconds(prev => {
          const next = prev + 0.1;
          if (next >= storyboard.totalDurationSeconds) {
            setIsPlaying(false);
            return 0;
          }
          let accumulated = 0;
          for (let i = 0; i < storyboard.shots.length; i++) {
            accumulated += storyboard.shots[i].durationSeconds;
            if (next <= accumulated) {
              setActiveShotIndex(i);
              break;
            }
          }
          return next;
        });
      }, 100);
    } else {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    }
    return () => {
      if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    };
  }, [isPlaying, storyboard]);

  const togglePlay = () => {
    if (!storyboard) return;
    if (isPlaying) {
      setIsPlaying(false);
    } else {
      if (playheadSeconds >= storyboard.totalDurationSeconds - 0.2) {
        setPlayheadSeconds(0);
        setActiveShotIndex(0);
      }
      setIsPlaying(true);
      playSound('laser');
    }
  };

  const handleExportFCPXML = async () => {
    if (!storyboard) return;
    try {
      setExportingXml(true);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/video/export-fcpxml', {
        method: 'POST',
        headers,
        body: JSON.stringify({ storyboard })
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${storyboard.title.replace(/\s+/g, '_')}.fcpxml`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        playSound('powerup');
        setToast('📥 DaVinci Resolve FCPXML Downloaded!');
        setTimeout(() => setToast(null), 3500);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setExportingXml(false);
    }
  };

  const handleDaVinciDispatch = async () => {
    if (!storyboard) return;
    try {
      setDispatchStatus('Connecting to DaVinci Resolve Studio API...');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/video/davinci-dispatch', {
        method: 'POST',
        headers,
        body: JSON.stringify({ storyboard })
      });

      const j = await res.json();
      if (j.success) {
        setDispatchStatus('✓ Timeline Dispatched to DaVinci Studio!');
        playSound('ascension');
        setTimeout(() => setDispatchStatus(null), 4000);
      } else {
        setDispatchStatus(`⚠️ ${j.error || 'Failed to dispatch'}`);
        setTimeout(() => setDispatchStatus(null), 4000);
      }
    } catch (e: any) {
      setDispatchStatus(`⚠️ ${e.message || 'Dispatch error'}`);
      setTimeout(() => setDispatchStatus(null), 4000);
    }
  };

  const currentShot = storyboard?.shots[activeShotIndex] || storyboard?.shots[0];

  const getLutFilterStyle = () => {
    switch (selectedLut) {
      case 'cyberpunk_emerald':
        return 'hue-rotate-15 contrast-125 saturate-150 brightness-105';
      case 'vault_gold':
        return 'sepia-[0.35] hue-rotate-[-20deg] contrast-115 brightness-110 saturate-140';
      case 'neon_matrix':
        return 'hue-rotate-180 contrast-130 saturate-125';
      case 'natural_cinematic':
        return 'contrast-105 saturate-95 brightness-102';
      default:
        return '';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 font-sans text-white">
      
      {/* ── Toast Notification ── */}
      {toast && (
        <div className="fixed top-20 right-6 z-50 px-4 py-2.5 rounded-2xl bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-2xl animate-in fade-in slide-in-from-top-4 duration-200">
          {toast}
        </div>
      )}

      {/* ── Sovereign Hero Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-purple-950/80 border border-purple-500/40 shadow-2xl backdrop-blur-xl relative overflow-hidden">
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-pink-500 via-purple-600 to-cyan-400 p-0.5 shadow-2xl shadow-purple-500/30 flex items-center justify-center shrink-0">
            <div className="w-full h-full rounded-[14px] bg-slate-950 flex items-center justify-center">
              <Film className="w-8 h-8 text-pink-400 animate-pulse" />
            </div>
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-cyan-500/20 text-pink-300 text-[10px] font-mono font-bold uppercase tracking-wider mb-1.5 border border-pink-500/30 shadow-inner">
              <Zap className="w-3 h-3 text-pink-400" />
              LoopEngineer™ & Gemini Omni Flash Engine
            </div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white tracking-tight">
              Autonomous Video Studio & Faceless Loops
            </h1>
            <p className="text-xs text-slate-400 font-mono mt-1">
              Gemini Omni Flash 2.0 • 2-Frame Keyframe Interpolation • DaVinci Resolve FCPXML • Idempotent Dispatch
            </p>
          </div>
        </div>

        {/* Action Header Stats */}
        <div className="flex items-center gap-3 relative z-10 flex-wrap">
          <div className="px-4 py-2 rounded-2xl bg-slate-950/80 border border-emerald-500/40 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <div className="text-left">
              <div className="text-[9px] text-slate-400 uppercase font-mono">ANTIGRAV() Score</div>
              <div className="text-xs font-black text-emerald-300">{antigravScore}/100 [SOVEREIGN]</div>
            </div>
          </div>

          <button
            onClick={() => generateStoryboard()}
            disabled={loadingStoryboard}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loadingStoryboard ? 'animate-spin' : ''}`} />
            <span>Regenerate Blueprint</span>
          </button>
        </div>
      </div>

      {/* ── Chamber Navigation Tabs ── */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto text-xs font-mono">
        <button
          onClick={() => setActiveTab('omni_flash')}
          className={`px-4 py-2.5 rounded-2xl font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'omni_flash'
              ? 'bg-pink-500/20 text-pink-300 border border-pink-500/50 shadow-lg shadow-pink-500/20'
              : 'text-slate-400 hover:text-white bg-slate-900/60 border border-slate-800'
          }`}
        >
          <Sparkles className="w-4 h-4 text-pink-400" />
          <span>Gemini Omni Flash Creative Suite</span>
        </button>

        <button
          onClick={() => setActiveTab('loop_engineer')}
          className={`px-4 py-2.5 rounded-2xl font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'loop_engineer'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-lg shadow-emerald-500/20'
              : 'text-slate-400 hover:text-white bg-slate-900/60 border border-slate-800'
          }`}
        >
          <Repeat className="w-4 h-4 text-emerald-400" />
          <span>LoopEngineer™ Autonomous Publisher</span>
        </button>

        <button
          onClick={() => setActiveTab('timeline')}
          className={`px-4 py-2.5 rounded-2xl font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'timeline'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 shadow-lg shadow-cyan-500/20'
              : 'text-slate-400 hover:text-white bg-slate-900/60 border border-slate-800'
          }`}
        >
          <Layers className="w-4 h-4 text-cyan-400" />
          <span>Multi-Track Timeline & Viewport</span>
        </button>

        <button
          onClick={() => setActiveTab('batch_davinci')}
          className={`px-4 py-2.5 rounded-2xl font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'batch_davinci'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50 shadow-lg shadow-amber-500/20'
              : 'text-slate-400 hover:text-white bg-slate-900/60 border border-slate-800'
          }`}
        >
          <Film className="w-4 h-4 text-amber-400" />
          <span>DaVinci Bridge & Batch Matrix</span>
        </button>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ── TAB 1: GEMINI OMNI FLASH CREATIVE SUITE ────────────────── */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'omni_flash' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
          
          {/* Left 2 Cols: Prompt Builder, Mode Config & Preview */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Mode Select Card */}
            <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-white uppercase tracking-wider flex items-center gap-2">
                  <Wand2 className="w-4 h-4 text-pink-400" />
                  <span>Omni Flash Generation Mode</span>
                </span>
                <span className="px-2.5 py-0.5 rounded-full bg-pink-500/20 text-pink-300 font-mono text-[10px] font-bold">
                  gemini-omni-flash-preview
                </span>
              </div>

              {/* Mode Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono">
                {[
                  { id: 'text_to_video', label: '✍️ Text to Video', desc: 'Single prompt scene' },
                  { id: 'first_frame', label: '🖼️ First Frame', desc: '<FIRST_FRAME> lock' },
                  { id: 'image_referenced', label: '🎨 Ref Guided', desc: '<IMAGE_REF_0> style' },
                  { id: 'interpolation', label: '🔄 2-Keyframes', desc: 'Morph between 2 imgs' },
                  { id: 'video_edit', label: '✂️ Video Edit', desc: 'Turn-by-turn rewrite' }
                ].map(m => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setOmniMode(m.id as any);
                      playSound('laser');
                    }}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      omniMode === m.id
                        ? 'bg-pink-950/40 border-pink-500 text-pink-300 ring-2 ring-pink-500/20 shadow-lg shadow-pink-500/10 font-bold'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="font-bold text-white text-[11px] truncate">{m.label}</div>
                    <div className="text-[9px] text-slate-400 mt-1">{m.desc}</div>
                  </button>
                ))}
              </div>

              {/* Prompt Textarea */}
              <div className="space-y-2 pt-2">
                <label className="text-xs text-slate-300 font-mono font-bold uppercase flex items-center justify-between">
                  <span>Natural Prompt Directive</span>
                  <span className="text-slate-500 text-[10px]">Supports timecodes like [0-3s], [3-6s]</span>
                </label>
                <textarea
                  rows={4}
                  value={omniPrompt}
                  onChange={e => setOmniPrompt(e.target.value)}
                  className="w-full p-4 rounded-2xl bg-slate-900 border border-slate-800 text-slate-200 text-sm font-sans focus:outline-none focus:border-pink-500/60 transition-colors shadow-inner"
                  placeholder="Describe your scene, camera motion, and visual details..."
                />
              </div>

              {/* Specific Mode Fields */}
              {omniMode === 'first_frame' && (
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2 text-xs font-mono">
                  <span className="text-pink-300 font-bold block">📸 First Frame Asset URL:</span>
                  <input
                    type="text"
                    value={omniFirstFrame}
                    onChange={e => setOmniFirstFrame(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300"
                    placeholder="/assets/frame1.png"
                  />
                  <p className="text-[10px] text-slate-500">Binds as &lt;FIRST_FRAME&gt; in the generation prompt.</p>
                </div>
              )}

              {omniMode === 'interpolation' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs font-mono">
                  <div>
                    <span className="text-pink-300 font-bold block mb-1">Keyframe 1 (Start):</span>
                    <input
                      type="text"
                      value={omniFirstFrame}
                      onChange={e => setOmniFirstFrame(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300"
                      placeholder="/start.png"
                    />
                  </div>
                  <div>
                    <span className="text-cyan-300 font-bold block mb-1">Keyframe 2 (End):</span>
                    <input
                      type="text"
                      value={omniKeyframeEnd}
                      onChange={e => setOmniKeyframeEnd(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300"
                      placeholder="/end.png"
                    />
                  </div>
                </div>
              )}

              {omniMode === 'video_edit' && (
                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2 text-xs font-mono">
                  <span className="text-purple-300 font-bold block">🔄 Prior Interaction ID:</span>
                  <input
                    type="text"
                    value={omniPrevInteractionId}
                    onChange={e => setOmniPrevInteractionId(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300"
                    placeholder="interaction_omni_123456..."
                  />
                  <p className="text-[10px] text-slate-500">Performs turn-by-turn video rewriting without re-uploading source files.</p>
                </div>
              )}

              {/* Audio Stream Control */}
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold text-white">
                    <Music className="w-4 h-4 text-emerald-400" />
                    <span>Audio Synthesis & Sound Design</span>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-mono cursor-pointer">
                    <input
                      type="checkbox"
                      checked={omniStripAudio}
                      onChange={e => setOmniStripAudio(e.target.checked)}
                      className="rounded bg-slate-800 text-emerald-500 focus:ring-0"
                    />
                    <span className="text-slate-300">Regenerate Audio From Scratch (--strip-audio)</span>
                  </label>
                </div>

                {omniStripAudio && (
                  <input
                    type="text"
                    value={omniAudioPrompt}
                    onChange={e => setOmniAudioPrompt(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-emerald-300"
                    placeholder="Describe background audio, sound effects, music tempo..."
                  />
                )}
              </div>

              {/* Duration & Dispatch Controls */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-slate-800">
                <div className="flex items-center gap-4 text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-400">Duration:</span>
                    <select
                      value={omniDuration}
                      onChange={e => setOmniDuration(Number(e.target.value))}
                      className="bg-slate-900 border border-slate-800 text-white rounded-lg px-2 py-1"
                    >
                      {[3, 4, 5, 6, 7, 8, 9, 10].map(s => (
                        <option key={s} value={s}>{s} seconds</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Aspect:</span>
                    <select
                      value={selectedAspect}
                      onChange={e => setSelectedAspect(e.target.value as any)}
                      className="bg-slate-900 border border-slate-800 text-white rounded-lg px-2 py-1"
                    >
                      {['9:16', '16:9', '1:1', '4:5'].map(a => (
                        <option key={a} value={a}>{a}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleGenerateOmniVideo}
                  disabled={isGeneratingOmni}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-pink-600 via-purple-600 to-cyan-500 hover:from-pink-500 hover:to-cyan-400 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-pink-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className={`w-4 h-4 ${isGeneratingOmni ? 'animate-spin' : ''}`} />
                  <span>{isGeneratingOmni ? 'Synthesizing Video...' : 'Dispatch Omni Flash Job'}</span>
                </button>
              </div>

            </div>

            {/* Omni Flash Output Card */}
            {omniResult && (
              <div className="p-6 rounded-3xl bg-slate-950 border border-pink-500/40 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2 text-xs font-mono text-pink-300 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Omni Flash Interaction Active ({omniResult.jobId})</span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">{omniResult.createdAt}</span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-900 text-xs font-mono space-y-2">
                  <div className="text-slate-400">Resolved Full Prompt:</div>
                  <div className="text-slate-200 font-sans leading-relaxed">{omniResult.prompt}</div>
                  <div className="text-[10px] text-emerald-400 pt-1">
                    Model: {omniResult.model} • Mode: {omniResult.mode} • Duration: {omniResult.durationSeconds}s • Audio Strip: {omniResult.stripAudio ? 'Yes (Regenerated)' : 'No'}
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Right 1 Col: Quick Omni Snippets & Prompt Catalog */}
          <div className="space-y-6">
            <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-3 shadow-xl text-xs font-mono">
              <div className="flex items-center gap-2 text-white font-bold uppercase tracking-wider">
                <Sparkle className="w-4 h-4 text-pink-400" />
                <span>Omni Flash Prompt Formulas</span>
              </div>
              <p className="text-slate-400 text-[11px]">Click any formula to load into the creative studio:</p>

              <div className="space-y-2">
                {[
                  {
                    title: '💎 24K Living Vault Morph',
                    prompt: 'Continuous, unbroken shot of a massive 24K gold bullion door opening slowly in an ultra-dark space, revealing glowing neon emerald liquid reserves. Sound design: Deep cinematic sub-bass rumble, crisp clockwork ratchet clicks.',
                    mode: 'text_to_video'
                  },
                  {
                    title: '⚡ Spreadsheets Shatter Effect',
                    prompt: '<FIRST_FRAME> Extreme close-up of a broken Excel spreadsheet shattering like tempered glass, exploding into a high-voltage neon financial dashboard. Sound design: Glass shattering, electric matrix whoosh.',
                    mode: 'first_frame'
                  },
                  {
                    title: '🔮 Quantum Sigil Resonance',
                    prompt: '[# Sources <FIRST_FRAME>@Image1] [# References <IMAGE_REF_0>@Image2] Seamless transition where a 3D holographic sigil spins rapidly and emits an expanding ultraviolet shockwave. Sound design: High resonance crystal chime.',
                    mode: 'interpolation'
                  }
                ].map((f, i) => (
                  <div
                    key={i}
                    onClick={() => {
                      setOmniPrompt(f.prompt);
                      setOmniMode(f.mode as any);
                      playSound('laser');
                    }}
                    className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-pink-500/50 hover:bg-pink-950/20 transition-all cursor-pointer"
                  >
                    <div className="font-bold text-white text-xs mb-1">{f.title}</div>
                    <div className="text-[10px] text-slate-400 line-clamp-2">{f.prompt}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ── TAB 2: LOOPENGINEER™ AUTONOMOUS PUBLISHER ──────────────── */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'loop_engineer' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
          
          {/* Left 2 Cols: Loop State Machine, Depth Controls & Telemetry */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Visual State Machine Banner */}
            <div className="p-6 rounded-3xl bg-slate-950 border border-emerald-500/40 space-y-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider">
                  <Network className="w-4 h-4" />
                  <span>Autonomous Media Loop State Machine</span>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold border border-emerald-500/30">
                  Idempotency Guarantee: ACTIVE
                </span>
              </div>

              {/* State Machine Step Pipeline */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { step: '01', title: 'Trigger & Topic', desc: 'High-Altitude Angle', color: 'border-cyan-500/50 bg-cyan-950/20 text-cyan-300' },
                  { step: '02', title: 'Omni Flash Render', desc: 'Continuous 10s Clip', color: 'border-pink-500/50 bg-pink-950/20 text-pink-300' },
                  { step: '03', title: 'DaVinci Assembly', desc: 'Multi-Track XML Build', color: 'border-amber-500/50 bg-amber-950/20 text-amber-300' },
                  { step: '04', title: 'Sovereign Gate', desc: 'SHA-256 Anti-Spam Check', color: 'border-emerald-500/50 bg-emerald-950/20 text-emerald-300' }
                ].map((s, i) => (
                  <div key={i} className={`p-3.5 rounded-2xl border ${s.color} space-y-1 font-mono`}>
                    <div className="text-[10px] opacity-70 font-bold">STAGE {s.step}</div>
                    <div className="text-xs font-bold text-white truncate">{s.title}</div>
                    <div className="text-[9px] opacity-80">{s.desc}</div>
                  </div>
                ))}
              </div>

              {/* Loop Depth Controller */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-bold">Loop Depth Control Limit:</span>
                  <span className="text-emerald-400 font-black">{loopDepth} / {maxDepth} Cycles</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={maxDepth}
                  value={loopDepth}
                  onChange={e => setLoopDepth(Number(e.target.value))}
                  className="w-full accent-emerald-400 cursor-pointer"
                />
                <div className="flex items-center justify-between text-[10px] text-slate-500">
                  <span>1 (Single Controlled Burst)</span>
                  <span>{maxDepth} (Max Depth Safety Threshold)</span>
                </div>
              </div>

              {/* Loop Configuration Inputs */}
              <div className="space-y-3 font-mono text-xs">
                <label className="text-slate-300 font-bold block">Autonomous Campaign Target:</label>
                <input
                  type="text"
                  value={loopTopic}
                  onChange={e => setLoopTopic(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 text-xs"
                  placeholder="Campaign Topic..."
                />
              </div>

              <button
                onClick={handleExecuteLoop}
                disabled={isExecutingLoop}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 via-cyan-500 to-emerald-600 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
              >
                <Repeat className={`w-4 h-4 ${isExecutingLoop ? 'animate-spin' : ''}`} />
                <span>{isExecutingLoop ? 'Validating & Staging Loop...' : 'Execute Loop with Idempotency Guard'}</span>
              </button>
            </div>

            {/* Live Terminal Log Stream */}
            <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 space-y-3 shadow-2xl font-mono text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2 text-slate-300 font-bold">
                  <Terminal className="w-4 h-4 text-emerald-400" />
                  <span>Loop Execution Trace & Telemetry</span>
                </div>
                {activeIdempotencyHash && (
                  <span className="text-[10px] text-slate-500">
                    HASH: {activeIdempotencyHash.slice(0, 16)}...
                  </span>
                )}
              </div>

              <div className="p-4 rounded-2xl bg-black/80 border border-slate-900 space-y-1.5 max-h-48 overflow-y-auto text-emerald-400 text-[11px]">
                {loopExecutionTrace.length === 0 ? (
                  <div className="text-slate-600 italic">No active execution traces. Click 'Execute Loop' to dispatch.</div>
                ) : (
                  loopExecutionTrace.map((log, i) => (
                    <div key={i} className="leading-relaxed">
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>

          {/* Right 1 Col: Sovereignty Integrity Checks */}
          <div className="space-y-6">
            <div className="p-5 rounded-3xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-xl text-xs font-mono">
              <div className="flex items-center gap-2 text-white font-bold uppercase tracking-wider">
                <Shield className="w-4 h-4 text-emerald-400" />
                <span>Anti-Collapse Guardrails</span>
              </div>

              <div className="space-y-3 text-[11px] text-slate-300">
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Zero Spam Tolerance (Strict 1-hour hash buckets)</span>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Human Sovereign Veto Enabled (Tier 0 Override)</span>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>ANTIGRAV() Score Gate &gt;= 70 Required</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ── TAB 3: MULTI-TRACK TIMELINE & VIEWPORT ─────────────────── */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'timeline' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
          
          {/* Left 2 Cols: 4K Viewport & Sequencer */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Cinema Player Viewport */}
            <div className="rounded-3xl bg-slate-950 border border-slate-800 p-4 sm:p-6 shadow-2xl relative overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-emerald-400 font-bold">4K 60FPS VIEWPORT</span>
                  <span className="text-slate-500">|</span>
                  <span className="text-slate-300">{storyboard?.aspectRatio || '9:16'}</span>
                  <span className="text-slate-500">|</span>
                  <span className="text-purple-300 font-bold uppercase">{selectedLut.replace('_', ' ')}</span>
                </div>
                <div className="text-slate-400">
                  {playheadSeconds.toFixed(1)}s / {storyboard?.totalDurationSeconds || 15}s
                </div>
              </div>

              {/* Simulated Cinema Screen */}
              <div className="relative my-4 aspect-[16/9] sm:aspect-[16/10] w-full rounded-2xl bg-black overflow-hidden border border-slate-800 flex items-center justify-center group shadow-inner">
                <div className={`absolute inset-0 bg-gradient-to-tr ${currentShot?.previewGradient || 'from-emerald-950 via-slate-900 to-black'} transition-all duration-700 ${getLutFilterStyle()}`} />
                <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:20px_20px] opacity-20 pointer-events-none" />

                <div className="relative z-10 p-6 text-center max-w-md space-y-3 animate-in fade-in zoom-in-95 duration-300">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 border border-white/20 text-white text-[10px] font-mono uppercase tracking-widest backdrop-blur-md">
                    <span>SHOT {currentShot?.shotIndex || 1} • {currentShot?.timecode || '[0-3s]'}</span>
                  </div>
                  
                  <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight drop-shadow-md">
                    {currentShot?.overlayText || 'CREATOR MONEY OS'}
                  </h3>
                  
                  <div className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-black text-xs uppercase tracking-wider inline-block shadow-lg shadow-emerald-500/30">
                    {currentShot?.overlayCta || 'Start Free Today'}
                  </div>

                  <div className="mt-4 p-2.5 rounded-xl bg-black/70 border border-slate-700 text-xs text-slate-200 font-mono italic max-w-sm mx-auto backdrop-blur-md">
                    "{currentShot?.narrationScript}"
                  </div>
                </div>

                <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/60 border border-slate-800 text-[10px] font-mono text-emerald-300 font-bold backdrop-blur-md">
                  <Shield className="w-3 h-3 text-emerald-400" />
                  <span>MoneyPlugHub</span>
                </div>
              </div>

              {/* Player Scrub & Controls Bar */}
              <div className="space-y-3 pt-2">
                <div className="relative w-full h-2 bg-slate-900 rounded-full overflow-hidden cursor-pointer">
                  <div 
                    className="h-full bg-gradient-to-r from-cyan-400 via-emerald-400 to-purple-500 rounded-full transition-all duration-100"
                    style={{ width: `${((playheadSeconds) / Math.max(1, storyboard?.totalDurationSeconds || 15)) * 100}%` }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={togglePlay}
                      className="p-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black transition-all shadow-md cursor-pointer"
                    >
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
                    </button>
                    <button
                      onClick={() => { setPlayheadSeconds(0); setActiveShotIndex(0); setIsPlaying(false); }}
                      className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setAudioMuted(!audioMuted)}
                      className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
                    >
                      {audioMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                  </div>

                  <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs font-mono">
                    {(['9:16', '16:9', '1:1', '4:5'] as const).map((aspect) => (
                      <button
                        key={aspect}
                        onClick={() => {
                          setSelectedAspect(aspect);
                          generateStoryboard();
                        }}
                        className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                          selectedAspect === aspect
                            ? 'bg-plug-accent/20 text-plug-accent border border-plug-accent/40 shadow-sm'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {aspect}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Multi-Track Timeline & Clip Sequencer */}
            <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-2 text-white font-bold">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <span>Multi-Track Storyboard Sequencer</span>
                </div>
                <span className="text-slate-400">{storyboard?.shots.length || 4} Sequential Shots</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {storyboard?.shots.map((shot, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      setActiveShotIndex(idx);
                      setPlayheadSeconds(
                        storyboard.shots.slice(0, idx).reduce((acc, s) => acc + s.durationSeconds, 0)
                      );
                    }}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                      activeShotIndex === idx
                        ? 'bg-purple-950/60 border-purple-500 ring-2 ring-purple-500/30 shadow-lg shadow-purple-500/20'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-1.5">
                      <span className="font-bold text-white">SHOT {shot.shotIndex}</span>
                      <span>{shot.timecode}</span>
                    </div>
                    <div className="text-xs font-bold text-slate-200 truncate">{shot.title}</div>
                    <div className="text-[10px] text-emerald-400 font-mono mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{shot.durationSeconds}s duration</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Right 1 Col: LUT Color Suite & Social Captions */}
          <div className="space-y-6">
            
            {/* LUT Color Grading Selector */}
            <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-5 space-y-3 shadow-xl">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-white uppercase tracking-wider">
                <Sliders className="w-4 h-4 text-emerald-400" />
                <span>LUT Color Grading Suite</span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                {[
                  { id: 'cyberpunk_emerald', label: '🟢 Cyber Emerald', desc: 'OLED Black + Neon' },
                  { id: 'vault_gold', label: '🟡 24K Living Gold', desc: 'Warm Amber Luxury' },
                  { id: 'neon_matrix', label: '🟣 Cyber Matrix', desc: 'Cyan & Violet Split' },
                  { id: 'natural_cinematic', label: '🎞️ Kodak Film', desc: 'Clean 2383 Emulation' },
                ].map((lut) => (
                  <button
                    key={lut.id}
                    onClick={() => setSelectedLut(lut.id as any)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      selectedLut === lut.id
                        ? 'bg-emerald-500/20 border-emerald-500 text-white font-bold'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="font-bold">{lut.label}</div>
                    <div className="text-[9px] text-slate-500 mt-0.5">{lut.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Social Caption & Comment Generator */}
            {storyboard && (
              <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-5 space-y-3 shadow-xl text-xs font-mono">
                <div className="flex items-center justify-between text-white font-bold uppercase">
                  <span>Social Captions & Hooks</span>
                  <span className="text-emerald-400">Ready</span>
                </div>

                <div>
                  <span className="text-slate-400 text-[10px] block mb-1">Post Caption:</span>
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 text-xs font-sans relative">
                    {storyboard.captionCopy}
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(storyboard.captionCopy);
                        setCopiedCaption(true);
                        playSound('laser');
                        setTimeout(() => setCopiedCaption(false), 2000);
                      }}
                      className="absolute top-2 right-2 p-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300"
                    >
                      {copiedCaption ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* ── TAB 4: DAVINCI STUDIO BRIDGE & BATCH MATRIX ─────────────── */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeTab === 'batch_davinci' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-200">
          
          {/* DaVinci Studio Direct Bridge */}
          <div className="rounded-3xl bg-slate-950 border border-pink-500/40 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-pink-300 uppercase tracking-wider">
              <Film className="w-4 h-4 text-pink-400" />
              <span>DaVinci Resolve Studio Direct Bridge</span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              Exports full multi-track timelines directly into DaVinci Resolve Studio using official FCPXML 1.10 schemas and Python DaVinci API bridges.
            </p>

            <div className="space-y-3 pt-2">
              <button
                onClick={handleExportFCPXML}
                disabled={!storyboard || exportingXml}
                className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/40 font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                <Download className="w-4 h-4 text-amber-400" />
                <span>Export DaVinci .fcpxml Timeline</span>
              </button>

              <button
                onClick={handleDaVinciDispatch}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-pink-600/20 transition-all cursor-pointer"
              >
                <Film className="w-4 h-4" />
                <span>Build Local Timeline in DaVinci</span>
              </button>

              {dispatchStatus && (
                <div className="p-3 rounded-xl bg-slate-900 border border-pink-500/40 text-[11px] font-mono text-pink-300 text-center animate-in fade-in duration-200">
                  {dispatchStatus}
                </div>
              )}
            </div>
          </div>

          {/* Parallel Batch Execution Matrix */}
          <div className="rounded-3xl bg-slate-950 border border-slate-800 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-white uppercase tracking-wider">
                <FileCode className="w-4 h-4 text-cyan-400" />
                <span>Parallel Batch Execution Matrix</span>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-slate-400">Concurrency:</span>
                <select
                  value={batchConcurrency}
                  onChange={e => setBatchConcurrency(Number(e.target.value))}
                  className="bg-slate-900 border border-slate-800 text-white rounded px-2 py-0.5 text-xs"
                >
                  {[1, 2, 3, 4, 5, 6].map(c => (
                    <option key={c} value={c}>{c}x Parallel</option>
                  ))}
                </select>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              Compiles a complete <code className="text-cyan-400 font-mono">jobs.json</code> configuration payload to run automated batch video generation with the official CLI scripts.
            </p>

            <button
              onClick={handleGenerateBatchConfig}
              disabled={isGeneratingBatch}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-cyan-600/20 transition-all cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Compile jobs.json Matrix</span>
            </button>

            {batchConfigJson && (
              <pre className="p-4 rounded-2xl bg-black/80 border border-slate-900 text-cyan-300 text-[11px] font-mono overflow-x-auto max-h-40">
                {batchConfigJson}
              </pre>
            )}
          </div>

        </div>
      )}

    </div>
  );
};

export default VideoProductionPage;
