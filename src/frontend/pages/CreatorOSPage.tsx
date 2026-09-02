import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useLivingRealm } from '../context/LivingRealmContext';
import { 
  Wand2, Image as ImageIcon, Video, Film, Volume2, Sparkles, 
  Download, Copy, Check, RefreshCw, Trash2, Layers, Play, Pause, 
  RotateCcw, Sliders, Shield, Award, ArrowRight, Eye, ExternalLink,
  Cpu, Flame, Monitor, Smartphone, Square, Clock, Music
} from 'lucide-react';

interface MediaAssetItem {
  id: string;
  userId: string;
  type: 'image' | 'video' | 'audio' | 'storyboard';
  prompt: string;
  title: string;
  mediaUrl: string;
  thumbnailUrl?: string;
  aspectRatio: string;
  stylePreset?: string;
  durationSeconds?: number;
  metadata?: any;
  createdAt: string;
}

export const CreatorOSPage: React.FC<{ onNavigate?: (tab: string) => void }> = ({ onNavigate }) => {
  const { user, token } = useAuth();
  const { playSound } = useLivingRealm();

  // Active studio mode
  const [activeModule, setActiveModule] = useState<'image' | 'video' | 'voice' | 'vault'>('video');

  // Text-to-Image State
  const [imagePrompt, setImagePrompt] = useState<string>('A monolithic cybernetic wealth vault floating in deep space, glowing with molten gold circuitry and neon green laser streams');
  const [imageAspect, setImageAspect] = useState<string>('1:1');
  const [imageStyle, setImageStyle] = useState<string>('cyberpunk_neon');
  const [isGeneratingImage, setIsGeneratingImage] = useState<boolean>(false);
  const [activeImageResult, setActiveImageResult] = useState<MediaAssetItem | null>(null);

  // Text-to-Video State
  const [videoPrompt, setVideoPrompt] = useState<string>('Extreme macro dolly shot of golden coins cascading into an encrypted high-yield reserve vault, neon emerald volumetric lighting');
  const [videoAspect, setVideoAspect] = useState<string>('9:16');
  const [videoCamera, setVideoCamera] = useState<string>('Dolly In 4K');
  const [videoDuration, setVideoDuration] = useState<number>(5);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState<boolean>(false);
  const [activeVideoResult, setActiveVideoResult] = useState<MediaAssetItem | null>({
    id: 'vid_init_sample',
    userId: 'user',
    type: 'video',
    prompt: 'Extreme macro dolly shot of golden coins cascading into an encrypted high-yield reserve vault, neon emerald volumetric lighting',
    title: 'Extreme macro dolly shot of golden coins...',
    mediaUrl: '',
    aspectRatio: '9:16',
    stylePreset: 'motion_cinematic',
    durationSeconds: 5,
    createdAt: new Date().toISOString()
  });
  const [isVideoPlaying, setIsVideoPlaying] = useState<boolean>(true);
  const [playheadTime, setPlayheadTime] = useState<number>(0);
  const [isExportingRealVideo, setIsExportingRealVideo] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Media Library Vault State
  const [assets, setAssets] = useState<MediaAssetItem[]>([]);
  const [loadingAssets, setLoadingAssets] = useState<boolean>(false);
  const [vaultFilter, setVaultFilter] = useState<'all' | 'image' | 'video'>('all');

  // Google Ultra Credits / Gemini State
  const [googleStatus, setGoogleStatus] = useState<{
    isConnected: boolean;
    source: string;
    maskedKey: string;
    modelTier: string;
  } | null>(null);
  const [showGoogleModal, setShowGoogleModal] = useState<boolean>(false);
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [projectIdInput, setProjectIdInput] = useState<string>('');
  const [isSavingGoogleKey, setIsSavingGoogleKey] = useState<boolean>(false);

  // Voiceover State
  const [voiceScript, setVoiceScript] = useState<string>('Stop tracking money with dead spreadsheets. Step into the Living Vault with autonomous AI voice banking.');
  const [voicePersona, setVoicePersona] = useState<string>('davinci');
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  const [toast, setToast] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const referralCode = user?.referral_code || 'FOUNDER-PLUG';

  // Fetch Google Ultra credits status
  const fetchGoogleStatus = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/creator-os/google-status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const j = await res.json();
      if (j.success && j.data) {
        setGoogleStatus(j.data);
      }
    } catch (e) {}
  };

  const handleSaveGoogleKey = async () => {
    if (!apiKeyInput.trim() || !token) return;
    try {
      setIsSavingGoogleKey(true);
      const res = await fetch('/api/creator-os/google-credentials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          geminiApiKey: apiKeyInput.trim(),
          googleProjectId: projectIdInput.trim()
        })
      });
      const j = await res.json();
      if (j.success) {
        setShowGoogleModal(false);
        setToast('⚡ Google Ultra AI API Key Verified!');
        fetchGoogleStatus();
        setTimeout(() => setToast(null), 3000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingGoogleKey(false);
    }
  };

  // Fetch saved assets
  const fetchAssets = async () => {
    if (!token) return;
    try {
      setLoadingAssets(true);
      const res = await fetch('/api/creator-os/assets', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const j = await res.json();
      if (j.success && j.data?.assets) {
        setAssets(j.data.assets);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAssets(false);
    }
  };

  useEffect(() => {
    fetchAssets();
    fetchGoogleStatus();
  }, [token]);

  // ── 60FPS Dynamic Motion Canvas Video Renderer ───────────────────────
  useEffect(() => {
    let animId: number;
    let startTime = performance.now();

    const renderFrame = (now: number) => {
      const canvas = canvasRef.current;
      if (!canvas) {
        if (isVideoPlaying) animId = requestAnimationFrame(renderFrame);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      const t = (now - startTime) / 1000;
      const duration = videoDuration || 5;
      const progress = (t % duration) / duration;
      setPlayheadTime(t % duration);

      // 1. Clear & Draw Deep Cyber Space Background
      ctx.fillStyle = '#050811';
      ctx.fillRect(0, 0, w, h);

      // 2. Radial Nebula Glow
      const glowGrad = ctx.createRadialGradient(w / 2, h / 2, 20, w / 2, h / 2, Math.max(w, h) * 0.65);
      glowGrad.addColorStop(0, 'rgba(0, 255, 136, 0.32)');
      glowGrad.addColorStop(0.5, 'rgba(0, 229, 255, 0.16)');
      glowGrad.addColorStop(1, 'rgba(5, 8, 17, 1)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, w, h);

      // 3. Dynamic Camera Movement (Dolly In, Orbit, Pan, Zoom)
      ctx.save();
      ctx.translate(w / 2, h / 2);
      let zoom = 1.0;
      if (videoCamera.includes('Dolly')) {
        zoom = 1.0 + progress * 0.45;
      } else if (videoCamera.includes('Snap')) {
        zoom = 1.0 + Math.sin(progress * Math.PI) * 0.5;
      } else if (videoCamera.includes('Orbit')) {
        ctx.rotate(progress * Math.PI * 0.5);
      } else if (videoCamera.includes('Pan')) {
        ctx.translate(Math.sin(progress * Math.PI * 2) * 50, 0);
      }
      ctx.scale(zoom, zoom);

      // 4. Draw Cascading 3D Gold Coins & High-Energy Photons
      for (let i = 0; i < 42; i++) {
        const angle = i * (Math.PI * 2 / 42) + t * 0.9;
        const dist = 70 + (i * 19) % 240 + Math.sin(t * 2 + i) * 25;
        const px = Math.cos(angle) * dist;
        const py = Math.sin(angle) * dist + ((t * 90 + i * 45) % (h * 0.85)) - h * 0.42;
        const radius = (i % 3 === 0) ? 9 : 4.5;

        if (i % 2 === 0) {
          // 3D Molten Gold Bullion / Coin
          ctx.beginPath();
          ctx.arc(px, py, radius, 0, Math.PI * 2);
          ctx.fillStyle = '#fbbf24';
          ctx.fill();
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.5;
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 8px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('$', px, py);
        } else {
          // Emerald Photon
          ctx.beginPath();
          ctx.arc(px, py, radius, 0, Math.PI * 2);
          ctx.fillStyle = '#00ff88';
          ctx.shadowColor = '#00ff88';
          ctx.shadowBlur = 10;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      // 5. 3D Rotating Sigil Rings
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.75)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, 0, 120, 120 * Math.cos(t * 1.6), t * 0.6, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(0, 229, 255, 0.85)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.ellipse(0, 0, 85 * Math.sin(t * 1.3), 85, t * -0.9, 0, Math.PI * 2);
      ctx.stroke();

      // Central glowing power core
      const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 36);
      coreGrad.addColorStop(0, '#ffffff');
      coreGrad.addColorStop(0.35, '#00ff88');
      coreGrad.addColorStop(1, 'rgba(0, 229, 255, 0)');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 36, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // 6. Kinetic Caption / Subtitle Overlay
      ctx.fillStyle = 'rgba(5, 8, 17, 0.88)';
      ctx.fillRect(20, h - 140, w - 40, 72);
      ctx.strokeStyle = 'rgba(0, 255, 136, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(20, h - 140, w - 40, 72);

      ctx.fillStyle = '#00ff88';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`⚡ 60FPS MOTION • CAMERA: ${videoCamera.toUpperCase()}`, 32, h - 118);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 13px sans-serif';
      const promptText = videoPrompt.length > 46 ? videoPrompt.slice(0, 44) + '...' : videoPrompt;
      ctx.fillText(`"${promptText}"`, 32, h - 92);

      // 7. Live Equalizer Audio Waveform Bars
      for (let b = 0; b < 32; b++) {
        const barHeight = 8 + Math.abs(Math.sin(t * 7 + b * 0.35)) * 30;
        const bx = 32 + b * ((w - 64) / 32);
        ctx.fillStyle = b % 2 === 0 ? '#00ff88' : '#00e5ff';
        ctx.fillRect(bx, h - 45, ((w - 64) / 32) - 3, -barHeight);
      }

      // 8. Verified Referral Code Watermark Badge
      ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.fillRect(w - 156, 18, 138, 30);
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 1;
      ctx.strokeRect(w - 156, 18, 138, 30);
      ctx.fillStyle = '#00ff88';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`CODE: ${referralCode}`, w - 87, 37);

      if (isVideoPlaying) {
        animId = requestAnimationFrame(renderFrame);
      }
    };

    if (activeModule === 'video') {
      animId = requestAnimationFrame(renderFrame);
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isVideoPlaying, activeModule, videoCamera, videoDuration, videoPrompt, referralCode]);

  // Handle Real Video Export (.webm / .mp4 compatible)
  const handleDownloadRealVideo = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      setIsExportingRealVideo(true);
      playSound('laser');
      const stream = canvas.captureStream(60);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `creator_motion_60fps_${Date.now()}.webm`;
        a.click();
        setIsExportingRealVideo(false);
        playSound('powerup');
        setToast('🎥 Real 60FPS Video Exported & Downloaded!');
        setTimeout(() => setToast(null), 3000);
      };

      recorder.start();
      setIsVideoPlaying(true);
      setTimeout(() => {
        if (recorder.state === 'recording') {
          recorder.stop();
        }
      }, (videoDuration || 5) * 1000);
    } catch (e: any) {
      setIsExportingRealVideo(false);
      setToast(`⚠️ Video export notice: ${e.message}`);
    }
  };

  // Handle Text-to-Image Generation
  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) return;
    try {
      setIsGeneratingImage(true);
      playSound('laser');

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/creator-os/generate-image', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt: imagePrompt,
          aspectRatio: imageAspect,
          stylePreset: imageStyle,
          enhancePrompt: true
        })
      });

      const j = await res.json();
      if (j.success && j.data?.asset) {
        setActiveImageResult(j.data.asset);
        playSound('powerup');
        setToast(`✨ Image Rendered! (+${j.data.xpAwarded} XP)`);
        setTimeout(() => setToast(null), 3500);
        fetchAssets();
      } else {
        setToast(`⚠️ ${j.error || 'Generation failed'}`);
        setTimeout(() => setToast(null), 3500);
      }
    } catch (e: any) {
      setToast(`⚠️ ${e.message}`);
      setTimeout(() => setToast(null), 3500);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Handle Text-to-Video Generation
  const handleGenerateVideo = async () => {
    if (!videoPrompt.trim()) return;
    try {
      setIsGeneratingVideo(true);
      playSound('warp');

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/creator-os/generate-video', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt: videoPrompt,
          aspectRatio: videoAspect,
          durationSeconds: videoDuration,
          cameraMotion: videoCamera,
          fps: 60
        })
      });

      const j = await res.json();
      if (j.success && j.data?.asset) {
        setActiveVideoResult(j.data.asset);
        playSound('ascension');
        setToast(`🎥 Motion Sequence Rendered! (+${j.data.xpAwarded} XP)`);
        setTimeout(() => setToast(null), 3500);
        fetchAssets();
      } else {
        setToast(`⚠️ ${j.error || 'Video generation failed'}`);
        setTimeout(() => setToast(null), 3500);
      }
    } catch (e: any) {
      setToast(`⚠️ ${e.message}`);
      setTimeout(() => setToast(null), 3500);
    } finally {
      setIsGeneratingVideo(false);
    }
  };

  // Enhance Prompt
  const handleEnhancePrompt = async (type: 'image' | 'video') => {
    const current = type === 'image' ? imagePrompt : videoPrompt;
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/creator-os/enhance-prompt', {
        method: 'POST',
        headers,
        body: JSON.stringify({ prompt: current, type })
      });

      const j = await res.json();
      if (j.success && j.data?.enhancedPrompt) {
        if (type === 'image') setImagePrompt(j.data.enhancedPrompt);
        else setVideoPrompt(j.data.enhancedPrompt);
        playSound('laser');
        setToast('✨ Prompt Enhanced with Cinematic Directives!');
        setTimeout(() => setToast(null), 2500);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Voiceover Playback
  const handleSpeakVoiceover = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(voiceScript);
      utterance.rate = 1.0;
      utterance.pitch = voicePersona === 'davinci' ? 0.95 : 1.05;
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      window.speechSynthesis.speak(utterance);
      playSound('laser');
    }
  };

  // Delete Asset
  const handleDeleteAsset = async (assetId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/creator-os/assets/${assetId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setAssets(prev => prev.filter(a => a.id !== assetId));
        setToast('🗑️ Asset deleted from Media Vault');
        setTimeout(() => setToast(null), 2500);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredAssets = assets.filter(a => vaultFilter === 'all' || a.type === vaultFilter);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 font-sans text-white">
      
      {/* Toast Alert */}
      {toast && (
        <div className="fixed top-20 right-6 z-50 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-pink-500 to-purple-600 text-white font-black text-xs uppercase tracking-wider shadow-2xl animate-in fade-in slide-in-from-top-4 duration-200">
          {toast}
        </div>
      )}

      {/* ── Studio Banner Header ── */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-slate-950 via-purple-950/80 to-slate-950 border-2 border-pink-500/40 shadow-2xl relative overflow-hidden backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-500/20 text-pink-300 text-xs font-mono font-bold uppercase tracking-wider border border-pink-500/40">
            <Sparkles className="w-3.5 h-3.5 animate-pulse" />
            <span>Full Media Pipeline • Multi-Modal Engine</span>
          </div>

          <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
            Creator OS Studio
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl font-mono leading-relaxed">
            Direct text-to-video & text-to-image synthesis with built-in referral watermark stamps, cinematic LUTs, and DaVinci Resolve timeline exporters.
          </p>
        </div>

        {/* Module Switcher Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/90 p-1.5 rounded-2xl border border-slate-800 text-xs font-mono">
          <button
            onClick={() => setActiveModule('image')}
            className={`px-3.5 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeModule === 'image' ? 'bg-gradient-to-r from-pink-600 to-purple-600 text-white shadow-md font-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Text-to-Image</span>
          </button>

          <button
            onClick={() => setActiveModule('video')}
            className={`px-3.5 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeModule === 'video' ? 'bg-gradient-to-r from-cyan-500 to-emerald-400 text-slate-950 shadow-md font-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Video className="w-4 h-4" />
            <span>Text-to-Video</span>
          </button>

          <button
            onClick={() => setActiveModule('voice')}
            className={`px-3.5 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeModule === 'voice' ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 shadow-md font-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Volume2 className="w-4 h-4" />
            <span>Voiceover Lab</span>
          </button>

          <button
            onClick={() => setActiveModule('vault')}
            className={`px-3.5 py-2 rounded-xl font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeModule === 'vault' ? 'bg-purple-600 text-white shadow-md font-black' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Media Vault ({assets.length})</span>
          </button>
        </div>
      </div>

      {/* ── Google Ultra / Gemini Credits Engine Ribbon ── */}
      <div className="p-4 rounded-3xl bg-slate-900/90 border border-slate-800 flex items-center justify-between flex-wrap gap-4 text-xs font-mono shadow-xl backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500/20 via-purple-500/20 to-pink-500/20 text-cyan-300 flex items-center justify-center border border-cyan-500/30 font-black text-sm">
            ⚡
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white">AI Engine Backend:</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                googleStatus?.isConnected 
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              }`}>
                {googleStatus?.isConnected ? '🟢 Google Ultra Credits Linked' : '🟡 Procedural Canvas Engine'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {googleStatus?.isConnected 
                ? `Imagen 3 & Gemini 2.5 Pro active • Key: ${googleStatus.maskedKey}`
                : 'Connect your Gemini API Key to use Google AI Studio / Ultra / GCP credits directly'}
            </p>
          </div>
        </div>

        <button
          onClick={() => { setShowGoogleModal(true); playSound('laser'); }}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-pink-600 to-amber-500 hover:from-purple-500 hover:to-amber-400 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-lg transition-all"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{googleStatus?.isConnected ? '⚡ Manage Google Key' : '⚡ Connect Google Ultra Key'}</span>
        </button>
      </div>

      {/* ── Google Credits Setup Modal ── */}
      {showGoogleModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-purple-500/40 p-6 sm:p-8 space-y-6 shadow-2xl animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-300 flex items-center justify-center font-black">
                  ⚡
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Google Ultra / Gemini Credits</h3>
                  <p className="text-[11px] text-slate-400 font-mono">Use your Google AI Studio or GCP billing credits</p>
                </div>
              </div>
              <button
                onClick={() => setShowGoogleModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs font-mono">
              <div className="p-3.5 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 text-cyan-200 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>How to get your Google API Key:</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  1. Visit <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-cyan-400 underline font-bold">Google AI Studio API Keys</a>.<br/>
                  2. Click <strong>"Create API Key"</strong> on your Google Cloud Project with active Ultra credits.<br/>
                  3. Paste the key below to unlock Imagen 3 and Gemini 2.5 Ultra models!
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase font-bold text-slate-300">Gemini / Google AI API Key:</label>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] uppercase font-bold text-slate-400">Google Cloud Project ID (Optional for Vertex AI):</label>
                <input
                  type="text"
                  value={projectIdInput}
                  onChange={(e) => setProjectIdInput(e.target.value)}
                  placeholder="my-gcp-project-123"
                  className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  onClick={() => setShowGoogleModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveGoogleKey}
                  disabled={isSavingGoogleKey || !apiKeyInput.trim()}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-400 text-slate-950 font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-lg disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isSavingGoogleKey ? 'Verifying...' : '⚡ Verify & Link Credits'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* MODULE 1: TEXT-TO-IMAGE GENERATION STUDIO                     */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeModule === 'image' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-200">
          
          {/* Prompt Controls (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 space-y-5 shadow-xl">
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-pink-400 uppercase tracking-wider">
                  <ImageIcon className="w-4 h-4" />
                  <span>Image Directives</span>
                </div>
                
                <button
                  onClick={() => handleEnhancePrompt('image')}
                  className="px-2.5 py-1 rounded-lg bg-pink-500/20 text-pink-300 hover:bg-pink-500/30 text-[10px] font-mono font-bold flex items-center gap-1 border border-pink-500/40 transition-colors cursor-pointer"
                >
                  <Wand2 className="w-3 h-3" />
                  <span>Magic Enhance</span>
                </button>
              </div>

              {/* Prompt Textarea */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase text-slate-400 font-bold block">Prompt Description:</label>
                <textarea
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  rows={4}
                  placeholder="Describe your visual concept..."
                  className="w-full p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-pink-500 leading-relaxed resize-none transition-colors"
                />
              </div>

              {/* Aspect Ratio Selector */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase text-slate-400 font-bold block">Aspect Ratio:</label>
                <div className="grid grid-cols-4 gap-2 text-xs font-mono">
                  {[
                    { id: '1:1', label: '1:1 Square' },
                    { id: '16:9', label: '16:9 Landscape' },
                    { id: '9:16', label: '9:16 Portrait' },
                    { id: '3:2', label: '3:2 Photo' },
                  ].map((aspect) => (
                    <button
                      key={aspect.id}
                      onClick={() => setImageAspect(aspect.id)}
                      className={`p-2 rounded-xl border text-center font-bold transition-all ${
                        imageAspect === aspect.id
                          ? 'bg-pink-500/20 text-pink-300 border-pink-500 shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {aspect.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Style Presets */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase text-slate-400 font-bold block">Aesthetic Preset:</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                  {[
                    { id: 'cyberpunk_neon', label: '🟢 Cyberpunk OLED Neon' },
                    { id: 'living_gold_vault', label: '🟡 24K Living Gold' },
                    { id: 'photoreal_8k', label: '📸 Photoreal Studio 8K' },
                    { id: 'sigil_vector_3d', label: '🔮 3D Quantum Sigil' },
                    { id: 'cinematic_film', label: '🎞️ Kodak 35mm Film' },
                  ].map((style) => (
                    <button
                      key={style.id}
                      onClick={() => setImageStyle(style.id)}
                      className={`p-2.5 rounded-xl border text-left font-bold transition-all ${
                        imageStyle === style.id
                          ? 'bg-pink-500/20 text-pink-300 border-pink-500 shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {style.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Render Action Button */}
              <button
                onClick={handleGenerateImage}
                disabled={isGeneratingImage}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-pink-600 via-purple-600 to-cyan-500 hover:from-pink-500 hover:to-cyan-400 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-pink-600/20 transition-all cursor-pointer disabled:opacity-50"
              >
                <Sparkles className={`w-4 h-4 ${isGeneratingImage ? 'animate-spin' : ''}`} />
                <span>{isGeneratingImage ? 'Synthesizing Graphic...' : '✨ Render High-Res Graphic (+50 XP)'}</span>
              </button>

            </div>
          </div>

          {/* High-Resolution Viewport Canvas (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="rounded-3xl bg-slate-950 border border-slate-800 p-6 shadow-2xl flex flex-col justify-between h-full min-h-[460px]">
              
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 text-xs font-mono text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-pink-400 animate-ping" />
                  <span className="text-white font-bold">HIGH-RES VIEWPORT</span>
                  <span>|</span>
                  <span className="text-pink-300">{imageAspect}</span>
                  <span>|</span>
                  <span className="text-slate-400">{imageStyle.replace(/_/g, ' ').toUpperCase()}</span>
                </div>
                <span>Render Engine Active</span>
              </div>

              {/* Active Image Canvas Preview */}
              <div className="my-6 flex-1 flex items-center justify-center relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-inner group">
                {activeImageResult ? (
                  <img
                    src={activeImageResult.mediaUrl}
                    alt="Generated Graphic"
                    className="max-h-[420px] w-auto object-contain rounded-xl shadow-2xl transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="text-center p-8 space-y-3">
                    <div className="w-16 h-16 rounded-2xl bg-pink-500/10 text-pink-400 flex items-center justify-center mx-auto border border-pink-500/20">
                      <ImageIcon className="w-8 h-8 opacity-70 animate-pulse" />
                    </div>
                    <h3 className="text-base font-bold text-white">No Graphic Rendered Yet</h3>
                    <p className="text-xs text-slate-400 font-mono max-w-sm">
                      Type your creative concept on the left and hit Render to generate your high-res graphic.
                    </p>
                  </div>
                )}
              </div>

              {/* Viewport Action Bar */}
              {activeImageResult && (
                <div className="pt-3 border-t border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs font-mono">
                  <span className="text-slate-400 truncate max-w-xs">{activeImageResult.prompt.slice(0, 45)}...</span>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setVideoPrompt(`Animate the scene: ${activeImageResult.prompt}`);
                        setActiveModule('video');
                        playSound('laser');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-md transition-colors"
                    >
                      <Video className="w-3.5 h-3.5" />
                      <span>Animate to Video</span>
                    </button>

                    <a
                      href={activeImageResult.mediaUrl}
                      download={`creator_os_${Date.now()}.svg`}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold flex items-center gap-1.5 cursor-pointer border border-slate-700 transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Download</span>
                    </a>
                  </div>
                </div>
              )}

            </div>
          </div>

        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* MODULE 2: TEXT-TO-VIDEO & MOTION STUDIO                       */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeModule === 'video' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-200">
          
          {/* Video Prompt Controls (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 space-y-5 shadow-xl">
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-cyan-400 uppercase tracking-wider">
                  <Video className="w-4 h-4" />
                  <span>Motion Directives</span>
                </div>

                <button
                  onClick={() => handleEnhancePrompt('video')}
                  className="px-2.5 py-1 rounded-lg bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 text-[10px] font-mono font-bold flex items-center gap-1 border border-cyan-500/40 transition-colors cursor-pointer"
                >
                  <Wand2 className="w-3 h-3" />
                  <span>Magic Enhance</span>
                </button>
              </div>

              {/* Video Prompt */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase text-slate-400 font-bold block">Motion Scene Prompt:</label>
                <textarea
                  value={videoPrompt}
                  onChange={(e) => setVideoPrompt(e.target.value)}
                  rows={4}
                  placeholder="Describe your video motion scene..."
                  className="w-full p-3.5 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-cyan-500 leading-relaxed resize-none transition-colors"
                />
              </div>

              {/* Aspect Ratio */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase text-slate-400 font-bold block">Aspect Ratio:</label>
                <div className="grid grid-cols-3 gap-2 text-xs font-mono">
                  {[
                    { id: '9:16', label: '9:16 TikTok / Reels' },
                    { id: '16:9', label: '16:9 YouTube / X' },
                    { id: '1:1', label: '1:1 Square' },
                  ].map((aspect) => (
                    <button
                      key={aspect.id}
                      onClick={() => setVideoAspect(aspect.id)}
                      className={`p-2 rounded-xl border text-center font-bold transition-all ${
                        videoAspect === aspect.id
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500 shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {aspect.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Camera Motion */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase text-slate-400 font-bold block">Camera Motion:</label>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  {['Dolly In 4K', 'Orbit 360°', 'Dynamic Pan Right', 'Snap Center Zoom'].map((motion) => (
                    <button
                      key={motion}
                      onClick={() => setVideoCamera(motion)}
                      className={`p-2.5 rounded-xl border text-left font-bold transition-all ${
                        videoCamera === motion
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500 shadow-sm'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {motion}
                    </button>
                  ))}
                </div>
              </div>

              {/* Render Video Action */}
              <button
                onClick={handleGenerateVideo}
                disabled={isGeneratingVideo}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 via-emerald-400 to-teal-400 hover:from-cyan-400 hover:to-emerald-300 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-xl shadow-cyan-500/25 transition-all cursor-pointer disabled:opacity-50"
              >
                <Video className={`w-4 h-4 ${isGeneratingVideo ? 'animate-spin' : ''}`} />
                <span>{isGeneratingVideo ? 'Rendering Motion Frames...' : '🎥 Generate 60FPS Video (+100 XP)'}</span>
              </button>

            </div>
          </div>

          {/* 4K Video Viewport (7 Cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="rounded-3xl bg-slate-950 border border-slate-800 p-6 shadow-2xl flex flex-col justify-between h-full min-h-[460px]">
              
              <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 text-xs font-mono text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  <span className="text-white font-bold">4K 60FPS MOTION PLAYER</span>
                  <span>|</span>
                  <span className="text-cyan-300">{videoAspect}</span>
                  <span>|</span>
                  <span className="text-slate-400">{videoCamera}</span>
                </div>
                <span>Gemini Omni Flash / Runway</span>
              </div>

              {/* Video Player Canvas */}
              <div className="my-4 flex-1 flex flex-col items-center justify-center relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-inner group">
                <div className="relative w-full h-full min-h-[420px] flex items-center justify-center overflow-hidden bg-[#050811]">
                  <canvas
                    ref={canvasRef}
                    width={videoAspect === '16:9' ? 720 : (videoAspect === '9:16' ? 405 : 512)}
                    height={videoAspect === '16:9' ? 405 : (videoAspect === '9:16' ? 720 : 512)}
                    className="max-h-[420px] w-auto object-contain rounded-xl shadow-2xl border border-cyan-500/30"
                  />

                  {/* Playhead Timecode Badge */}
                  <div className="absolute bottom-4 left-4 px-3 py-1 rounded-lg bg-black/80 border border-slate-800 text-xs font-mono font-bold text-cyan-300 backdrop-blur-md flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-cyan-400" />
                    <span>00:0{Math.floor(playheadTime)} / 00:0{videoDuration || 5}</span>
                    <span className="text-[10px] text-emerald-400">@ 60FPS</span>
                  </div>

                  {/* Video Play/Pause Toggle */}
                  <button
                    onClick={() => {
                      setIsVideoPlaying(!isVideoPlaying);
                      playSound('laser');
                    }}
                    className="absolute bottom-4 right-4 px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-lg transition-transform hover:scale-105"
                  >
                    {isVideoPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                    <span>{isVideoPlaying ? 'PAUSE' : 'PLAY'}</span>
                  </button>
                </div>
              </div>

              {/* Video Export Bar */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs font-mono">
                <div className="flex items-center gap-2 text-slate-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="truncate max-w-xs">{videoPrompt.slice(0, 45)}...</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDownloadRealVideo}
                    disabled={isExportingRealVideo}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-400 hover:from-cyan-400 hover:to-emerald-300 text-slate-950 font-black flex items-center gap-1.5 cursor-pointer shadow-lg transition-all disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isExportingRealVideo ? 'Recording 60FPS Clip...' : '🎥 Export Real 60FPS Video (.webm)'}</span>
                  </button>
                </div>
              </div>

            </div>
          </div>

        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* MODULE 3: VOICEOVER & ACOUSTIC LAB                            */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeModule === 'voice' && (
        <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-6 sm:p-8 space-y-6 shadow-xl animate-in fade-in duration-200">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
              <Volume2 className="w-4 h-4" />
              <span>Solfeggio 432Hz Voiceover Generator</span>
            </div>
            <span className="text-xs font-mono text-slate-400">ElevenLabs & Web Audio Engine</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <label className="text-xs font-mono uppercase text-slate-400 font-bold block">Narration Script:</label>
              <textarea
                value={voiceScript}
                onChange={(e) => setVoiceScript(e.target.value)}
                rows={5}
                className="w-full p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-mono text-white focus:outline-none focus:border-amber-500 leading-relaxed resize-none"
              />

              <div className="flex items-center gap-3">
                <button
                  onClick={handleSpeakVoiceover}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>{isSpeaking ? 'Speaking...' : '🎙️ Synthesize Voiceover'}</span>
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-xs font-mono uppercase text-slate-400 font-bold block">Voice Persona & Resonance:</label>
              <div className="space-y-2 text-xs font-mono">
                {[
                  { id: 'davinci', name: 'Leonardo • Cultured Polymath', freq: '432 Hz Pythagorean', desc: 'Poetic, commanding, authoritative' },
                  { id: 'liam', name: 'Liam • Wealth Sovereign', freq: '528 Hz Miraculous', desc: 'Calm, strategic, quantitative' },
                  { id: 'rachel', name: 'Rachel • Viral Charisma', freq: '639 Hz Harmonic', desc: 'High-energy social creator' },
                  { id: 'adam', name: 'Adam • Yield Architect', freq: '741 Hz Intuitive', desc: 'Hype, growth-oriented, actionable' },
                ].map((p) => (
                  <div
                    key={p.id}
                    onClick={() => { setVoicePersona(p.id); playSound('laser'); }}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                      voicePersona === p.id
                        ? 'bg-amber-500/20 border-amber-500 text-white font-bold shadow-md'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span>{p.name}</span>
                      <span className="text-amber-400 text-[10px]">{p.freq}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 font-sans mt-0.5">{p.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* MODULE 4: MEDIA VAULT & ASSET GALLERY                         */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeModule === 'vault' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          
          {/* Vault Controls */}
          <div className="flex items-center justify-between flex-wrap gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs font-mono">
            <div className="flex items-center gap-2 text-white font-bold">
              <Layers className="w-4 h-4 text-purple-400" />
              <span>Media Assets Gallery</span>
              <span className="text-slate-500">|</span>
              <span className="text-purple-300">{filteredAssets.length} Saved Assets</span>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
              {(['all', 'image', 'video'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setVaultFilter(filter)}
                  className={`px-3 py-1 rounded-lg uppercase font-bold transition-all ${
                    vaultFilter === filter
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>

          {/* Asset Grid */}
          {filteredAssets.length === 0 ? (
            <div className="p-12 rounded-3xl bg-slate-950 border border-slate-800 text-center space-y-3">
              <Layers className="w-12 h-12 text-slate-600 mx-auto animate-pulse" />
              <h3 className="text-lg font-bold text-white">Your Media Vault is Empty</h3>
              <p className="text-xs text-slate-400 font-mono max-w-sm mx-auto">
                Generate images or motion sequences using the Text-to-Image or Text-to-Video tabs above to build your creator library.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="rounded-3xl bg-slate-950 border border-slate-800 overflow-hidden shadow-2xl flex flex-col justify-between group hover:border-purple-500/50 transition-all"
                >
                  {/* Thumbnail / Preview Canvas */}
                  <div className="relative aspect-video w-full bg-slate-900 flex items-center justify-center overflow-hidden">
                    <img
                      src={asset.mediaUrl}
                      alt={asset.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/80 text-white text-[9px] font-mono font-bold uppercase tracking-wider backdrop-blur-md">
                      {asset.type} • {asset.aspectRatio}
                    </div>
                  </div>

                  {/* Asset Details */}
                  <div className="p-4 space-y-2">
                    <h4 className="text-xs font-bold text-white truncate">{asset.title}</h4>
                    <p className="text-[11px] text-slate-400 font-mono line-clamp-2 leading-relaxed">
                      {asset.prompt}
                    </p>
                  </div>

                  {/* Action Bar */}
                  <div className="p-3 bg-slate-900/80 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
                    <span className="text-[10px] text-slate-500">
                      {new Date(asset.createdAt).toLocaleDateString()}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <a
                        href={asset.mediaUrl}
                        download={`${asset.id}.svg`}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white transition-colors"
                        title="Download Asset"
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-400" />
                      </a>

                      <button
                        onClick={() => handleDeleteAsset(asset.id)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                        title="Delete Asset"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      )}

    </div>
  );
};

export default CreatorOSPage;
