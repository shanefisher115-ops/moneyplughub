import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Zap, Play, Activity, Cpu, Shield, RefreshCw, Terminal, 
  Layers, CheckCircle, Flame, Sparkles, AlertTriangle, Disc, 
  BarChart3, Compass, Database, Key, Settings, FileCode, Check,
  Copy, Share2, ExternalLink, ArrowRight, MessageSquare, Video,
  TrendingUp, Award, Send, Twitter, Mail, Film, Link as LinkIcon,
  Tag, Clock, History, Sparkle
} from 'lucide-react';

interface GeneratedArtifact {
  pulseId: 'cyan' | 'magenta' | 'gold' | 'infrared' | 'white';
  title: string;
  category: string;
  summary: string;
  content: string;
  platformRecommendations?: string[];
  copyableText: string;
  timestamp: string;
  xpAwarded?: number;
}

interface CopywriterResult {
  niche: string;
  productName: string;
  tone: string;
  embeddedAffiliateLink: string;
  trackingToken: string;
  twitterThread: {
    title: string;
    tweets: string[];
    fullText: string;
  };
  tiktokScript: {
    title: string;
    hook: string;
    visualCues: string[];
    spokenVoiceover: string;
    cta: string;
    hashtags: string[];
    fullScript: string;
  };
  emailSwipe: {
    title: string;
    subjectLines: string[];
    previewText: string;
    body: string;
    ctaLink: string;
    ps: string;
    fullEmail: string;
  };
}

export const GenerateDashboardPage: React.FC = () => {
  const { user, token } = useAuth();
  const [telemetry, setTelemetry] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copywriting, setCopywriting] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [animating, setAnimating] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [activeArtifact, setActiveArtifact] = useState<GeneratedArtifact | null>(null);

  // Tab mode in Generate Page
  const [activeTab, setActiveTab] = useState<'copywriter' | 'pulses' | 'history'>('copywriter');

  // Copywriter Inputs
  const [niche, setNiche] = useState<string>('Personal Finance & Wealth');
  const [productName, setProductName] = useState<string>('Creator Money OS');
  const [tone, setTone] = useState<string>('high_energy');
  const [contentType, setContentType] = useState<string>('all');
  const [affiliateUrl, setAffiliateUrl] = useState<string>('');
  const [trackingToken, setTrackingToken] = useState<string>('utm_source=twitter&subid=creators_01');
  const [targetAudience, setTargetAudience] = useState<string>('Creators, freelancers, and digital hustlers looking to scale passive income');

  // Copywriter Results
  const [copywriterOutput, setCopywriterOutput] = useState<CopywriterResult | null>(null);
  const [activeOutputTab, setActiveOutputTab] = useState<'thread' | 'tiktok' | 'email'>('thread');
  const [historyItems, setHistoryItems] = useState<any[]>([]);

  // Niche Presets
  const popularNiches = [
    'Personal Finance & Wealth',
    'AI Tools & SaaS',
    'Crypto & Web3',
    'Side Hustles & Ecommerce',
    'Fitness & Wellness',
    'Creator Economy',
  ];

  // Multi-pulse animation frames
  const frames = [
    ['🟣', '🔵', '🟡', '🔴', '⚪', '⚫', '⚫', '⚫'],
    ['⚫', '🟣', '🔵', '🟡', '🔴', '⚪', '⚫', '⚫'],
    ['⚫', '⚫', '🟣', '🔵', '🟡', '🔴', '⚪', '⚫'],
    ['⚫', '⚫', '⚫', '🟣', '🔵', '🟡', '🔴', '⚪'],
    ['⚪', '⚫', '⚫', '⚫', '🟣', '🔵', '🟡', '🔴'],
    ['🔴', '⚪', '⚫', '⚫', '⚫', '🟣', '🔵', '🟡'],
    ['🟡', '🔴', '⚪', '⚫', '⚫', '⚫', '🟣', '🔵'],
    ['🔵', '🟡', '🔴', '⚪', '⚫', '⚫', '⚫', '🟣'],
  ];

  useEffect(() => {
    let interval: any;
    if (animating) {
      interval = setInterval(() => {
        setCurrentFrame((prev) => (prev + 1) % frames.length);
      }, 600);
    }
    return () => clearInterval(interval);
  }, [animating]);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/generate/status');
      if (res.ok) {
        const j = await res.json();
        if (j.success) setTelemetry(j.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchCopywriterHistory();
    // Default generate AI Copywriter on first mount
    handleGenerateCopywriter();
  }, []);

  const fetchCopywriterHistory = async () => {
    try {
      const res = await fetch('/api/generate/copywriter/history', {
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      });
      if (res.ok) {
        const j = await res.json();
        if (j.success) setHistoryItems(j.data || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerateCopywriter = async () => {
    try {
      setCopywriting(true);
      const res = await fetch('/api/generate/copywriter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          niche,
          productName,
          tone,
          contentType,
          affiliateUrl: affiliateUrl.trim() || undefined,
          trackingToken: trackingToken.trim() || undefined,
          targetAudience,
        })
      });

      if (res.ok) {
        const j = await res.json();
        if (j.success) {
          setCopywriterOutput(j.data.copyResult);
          setToast(j.message || '✨ High-converting copy generated successfully!');
          fetchCopywriterHistory();
          setTimeout(() => setToast(null), 4000);
        }
      }
    } catch (e) {
      console.error(e);
      setToast('❌ Failed to generate copy. Please try again.');
      setTimeout(() => setToast(null), 4000);
    } finally {
      setCopywriting(false);
    }
  };

  const triggerAction = async (actionType: string) => {
    try {
      setGenerating(true);
      const res = await fetch('/api/generate/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ actionType }),
      });
      if (res.ok) {
        const j = await res.json();
        setToast(j.message);
        if (j.data?.telemetry) setTelemetry(j.data.telemetry);
        if (j.data?.artifact) setActiveArtifact(j.data.artifact);
        setTimeout(() => setToast(null), 4000);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopyItem = (id: string, text: string, msg: string = 'Copied to clipboard!') => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    setToast(`📋 ${msg}`);
    setTimeout(() => {
      setCopiedIndex(null);
      setToast(null);
    }, 3000);
  };

  const referralCode = user?.referral_code || 'PLUG-VIP';
  const defaultTrackUrl = `/api/referrals/track/${referralCode}?${trackingToken}`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 font-mono text-slate-200">
      {toast && (
        <div className="p-4 rounded-2xl bg-plug-accent/20 border border-plug-accent text-plug-accent text-xs font-bold shadow-2xl flex items-center gap-2 sticky top-20 z-50 backdrop-blur-xl animate-fade-in">
          <Zap className="w-4 h-4 shrink-0 fill-current animate-bounce" />
          <span>{toast}</span>
        </div>
      )}

      {/* ASCII BANNER HEADER */}
      <div className="p-6 rounded-3xl bg-black border border-slate-800 shadow-2xl space-y-2 overflow-x-auto text-xs leading-relaxed text-plug-accent">
        <pre className="font-mono text-[11px] sm:text-xs">
{`██████████████████████████████████████████████████████████████████
█   IN-APP AI COPYWRITER — GEMINI FLASH SOVEREIGN ENGINE       █
█   Formats: X/Twitter Threads • TikTok Scripts • Email Swipes   █
█   Connected Account: ${referralCode.padEnd(16)} | Tracking Active █
█   Embedded Affiliate Links & Tracking Tokens Auto-Injected    █
██████████████████████████████████████████████████████████████████`}
        </pre>
      </div>

      {/* TOP TAB CONTROLLER */}
      <div className="flex items-center gap-3 border-b border-slate-800 pb-4 overflow-x-auto">
        <button
          onClick={() => setActiveTab('copywriter')}
          className={`px-5 py-3 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'copywriter'
              ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 shadow-lg shadow-emerald-500/20'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>✨ Gemini Flash AI Copywriter</span>
        </button>

        <button
          onClick={() => setActiveTab('pulses')}
          className={`px-5 py-3 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'pulses'
              ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 shadow-lg shadow-emerald-500/20'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>⚡ 5-Pulse Dispatch Studio</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`px-5 py-3 rounded-2xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
            activeTab === 'history'
              ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 shadow-lg shadow-emerald-500/20'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
          }`}
        >
          <History className="w-4 h-4" />
          <span>📜 Copy History ({historyItems.length})</span>
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          MODE 1: GEMINI FLASH AI COPYWRITER STUDIO
         ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'copywriter' && (
        <div className="space-y-8">
          {/* INPUT FORM PANEL */}
          <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 shadow-2xl space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800 pb-4">
              <div className="space-y-1">
                <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-plug-accent" />
                  ✨ TAILOR YOUR CREATOR COPY
                </h2>
                <p className="text-xs text-slate-400">
                  Powered by Gemini Flash. Instantly embeds tracking tokens and referral links for max conversion.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-plug-accent/20 border border-plug-accent text-plug-accent text-[11px] font-bold">
                Earn +50 XP per Generation
              </span>
            </div>

            {/* Quick Niche Selector Presets */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-plug-accent" /> Select Creator Niche:
              </label>
              <div className="flex flex-wrap gap-2">
                {popularNiches.map((p) => (
                  <button
                    key={p}
                    onClick={() => setNiche(p)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      niche === p
                        ? 'bg-plug-accent text-slate-950 font-black shadow-md'
                        : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                placeholder="Or type custom niche..."
                className="w-full mt-2 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-plug-accent"
              />
            </div>

            {/* Product & Tone Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Offer / Product Name:</label>
                <input
                  type="text"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  placeholder="e.g. Creator Money OS"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-plug-accent"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Tone of Voice:</label>
                <select
                  value={tone}
                  onChange={(e) => setTone(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-plug-accent"
                >
                  <option value="high_energy">⚡ High Energy & Direct</option>
                  <option value="storytelling">📖 Personal Storytelling</option>
                  <option value="analytical">📊 Data-Driven & Analytical</option>
                  <option value="pattern_interrupt">🚨 Pattern Interrupt & Curiosity</option>
                  <option value="fomo">🔥 High FOMO & Urgency</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Tracking Token / SubID:</label>
                <input
                  type="text"
                  value={trackingToken}
                  onChange={(e) => setTrackingToken(e.target.value)}
                  placeholder="utm_source=twitter&subid=creators_01"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-plug-accent"
                />
              </div>
            </div>

            {/* Target Audience & Custom Link */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Target Audience Description:</label>
                <input
                  type="text"
                  value={targetAudience}
                  onChange={(e) => setTargetAudience(e.target.value)}
                  placeholder="e.g. Solo creators looking to automate revenue"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-plug-accent"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-300">Custom Affiliate URL (Optional):</label>
                <input
                  type="text"
                  value={affiliateUrl}
                  onChange={(e) => setAffiliateUrl(e.target.value)}
                  placeholder={`Default: /api/referrals/track/${referralCode}`}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-plug-accent"
                />
              </div>
            </div>

            {/* Embedded Tracking Link Live Badge */}
            <div className="p-3.5 rounded-2xl bg-black border border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs">
              <div className="flex items-center gap-2 text-slate-400">
                <LinkIcon className="w-4 h-4 text-plug-accent" />
                <span>Live Embedded Link:</span>
                <code className="text-plug-accent font-bold">
                  {affiliateUrl ? `${affiliateUrl}?${trackingToken}` : `${window.location.origin}/api/referrals/track/${referralCode}?${trackingToken}`}
                </code>
              </div>
              <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
                ✓ Tracking Active
              </span>
            </div>

            {/* GENERATE CTA BUTTON */}
            <button
              disabled={copywriting}
              onClick={handleGenerateCopywriter}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-500 via-cyan-500 to-indigo-500 hover:from-emerald-400 hover:to-indigo-400 text-slate-950 font-black text-sm uppercase tracking-wider transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50"
            >
              {copywriting ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Synthesizing Copy with Gemini Flash...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>⚡ Generate High-Converting Copy Kit (+50 XP)</span>
                </>
              )}
            </button>
          </div>

          {/* OUTPUT WORKSPACE */}
          {copywriterOutput && (
            <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 shadow-2xl space-y-6">
              {/* Output Sub-Header & Format Selector */}
              <div className="flex items-center justify-between flex-wrap gap-4 border-b border-slate-800 pb-4">
                <div className="space-y-1">
                  <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-plug-accent" />
                    GENERATED CREATOR COPYWRITING KIT
                  </h3>
                  <p className="text-xs text-slate-400">
                    Niche: <strong className="text-white">{copywriterOutput.niche}</strong> | Offer: <strong className="text-white">{copywriterOutput.productName}</strong>
                  </p>
                </div>

                {/* Sub-Format Tabs */}
                <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-2xl border border-slate-800">
                  <button
                    onClick={() => setActiveOutputTab('thread')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      activeOutputTab === 'thread' ? 'bg-sky-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Twitter className="w-3.5 h-3.5" /> X/Twitter Thread
                  </button>

                  <button
                    onClick={() => setActiveOutputTab('tiktok')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      activeOutputTab === 'tiktok' ? 'bg-pink-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Film className="w-3.5 h-3.5" /> TikTok Script
                  </button>

                  <button
                    onClick={() => setActiveOutputTab('email')}
                    className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      activeOutputTab === 'email' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5" /> Email Swipe
                  </button>
                </div>
              </div>

              {/* 1. X / TWITTER THREAD TAB */}
              {activeOutputTab === 'thread' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-sky-400 flex items-center gap-2">
                      <Twitter className="w-4 h-4" /> {copywriterOutput.twitterThread.title}
                    </h4>
                    <button
                      onClick={() => handleCopyItem('full_thread', copywriterOutput.twitterThread.fullText, 'Copied full Twitter thread!')}
                      className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition-all flex items-center gap-2 shadow-lg shadow-sky-500/20 cursor-pointer"
                    >
                      {copiedIndex === 'full_thread' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>Copy Entire Thread</span>
                    </button>
                  </div>

                  {/* Tweet List */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {copywriterOutput.twitterThread.tweets.map((tweet, idx) => (
                      <div key={idx} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 relative group hover:border-sky-500/40 transition-all">
                        <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-slate-800 pb-2">
                          <span className="font-bold text-sky-400">Tweet {idx + 1}/{copywriterOutput.twitterThread.tweets.length}</span>
                          <span className="text-[10px] text-slate-500">{tweet.length} / 280 chars</span>
                        </div>
                        <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">{tweet}</p>
                        <button
                          onClick={() => handleCopyItem(`tweet_${idx}`, tweet, `Copied Tweet #${idx + 1}!`)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-sky-500 hover:text-slate-950 text-slate-300 font-bold text-[10px] transition-all flex items-center gap-1"
                        >
                          {copiedIndex === `tweet_${idx}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          <span>Copy Tweet</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 2. TIKTOK VIDEO SCRIPT TAB */}
              {activeOutputTab === 'tiktok' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-pink-400 flex items-center gap-2">
                      <Film className="w-4 h-4" /> {copywriterOutput.tiktokScript.title}
                    </h4>
                    <button
                      onClick={() => handleCopyItem('tiktok_script', copywriterOutput.tiktokScript.fullScript, 'Copied full TikTok script!')}
                      className="px-4 py-2 rounded-xl bg-pink-500 hover:bg-pink-400 text-slate-950 font-bold text-xs transition-all flex items-center gap-2 shadow-lg shadow-pink-500/20 cursor-pointer"
                    >
                      {copiedIndex === 'tiktok_script' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>Copy Full TikTok Script</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Visual Cues & Spoken Script */}
                    <div className="lg:col-span-2 space-y-4 p-5 rounded-2xl bg-slate-900 border border-slate-800 text-xs leading-relaxed">
                      {/* Hook Box */}
                      <div className="p-3.5 rounded-xl bg-pink-950/40 border border-pink-800/80 space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-pink-400 block">⚡ PATTERN INTERRUPT HOOK (0-3s):</span>
                        <p className="text-sm font-extrabold text-white">{copywriterOutput.tiktokScript.hook}</p>
                      </div>

                      {/* Visual & Voiceover Details */}
                      <div className="whitespace-pre-wrap text-slate-200 leading-relaxed space-y-3">
                        <strong className="text-slate-400 uppercase text-[10px] block border-b border-slate-800 pb-1">🎬 VISUAL & AUDIO SCRIPT:</strong>
                        <div className="text-xs">{copywriterOutput.tiktokScript.fullScript}</div>
                      </div>
                    </div>

                    {/* Hashtags & CTA Sidebar */}
                    <div className="space-y-4">
                      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">🏷️ VIRAL HASHTAGS</span>
                        <div className="flex flex-wrap gap-1.5">
                          {copywriterOutput.tiktokScript.hashtags.map((tag, i) => (
                            <span key={i} className="px-2.5 py-1 rounded-lg bg-pink-950/80 border border-pink-800 text-pink-300 text-[11px] font-bold">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">🔗 BIO LINK CTA</span>
                        <p className="text-xs text-slate-300">{copywriterOutput.tiktokScript.cta}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 3. EMAIL SWIPE TAB */}
              {activeOutputTab === 'email' && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                      <Mail className="w-4 h-4" /> {copywriterOutput.emailSwipe.title}
                    </h4>
                    <button
                      onClick={() => handleCopyItem('email_swipe', copywriterOutput.emailSwipe.fullEmail, 'Copied email swipe!')}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-all flex items-center gap-2 shadow-lg shadow-amber-500/20 cursor-pointer"
                    >
                      {copiedIndex === 'email_swipe' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      <span>Copy Email Swipe</span>
                    </button>
                  </div>

                  {/* Subject Lines Options */}
                  <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                    <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">📧 HIGH CTR SUBJECT LINE OPTIONS:</span>
                    <div className="space-y-2">
                      {copywriterOutput.emailSwipe.subjectLines.map((subj, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                          <span className="text-slate-200 font-bold">{subj}</span>
                          <button
                            onClick={() => handleCopyItem(`subj_${i}`, subj, 'Copied subject line!')}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-[10px] font-bold transition-all shrink-0 ml-2"
                          >
                            Copy
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Preheader & Body */}
                  <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 text-xs leading-relaxed">
                    <div className="text-[11px] text-slate-400 border-b border-slate-800 pb-2">
                      <strong>PREHEADER:</strong> {copywriterOutput.emailSwipe.previewText}
                    </div>
                    <div className="whitespace-pre-wrap text-slate-200 font-mono text-[12px] leading-relaxed">
                      {copywriterOutput.emailSwipe.body}
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-amber-500/40 text-amber-300 font-bold text-xs">
                      P.S. {copywriterOutput.emailSwipe.ps}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODE 2: 5-PULSE CREATOR AI DISPATCH
         ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'pulses' && (
        <div className="space-y-8">
          <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Zap className="w-5 h-5 text-plug-accent" />
                ⚡ 5-PULSE CREATOR AI DISPATCH
              </h2>
              <span className="text-[11px] text-slate-400">
                Click any engine to generate real viral campaigns & earn <span className="text-plug-accent font-bold">+25 XP</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* 1. Cyan */}
              <button
                disabled={generating}
                onClick={() => triggerAction('cyan')}
                className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden group cursor-pointer ${
                  activeArtifact?.pulseId === 'cyan'
                    ? 'bg-sky-500/20 border-sky-400 shadow-lg shadow-sky-500/10'
                    : 'bg-slate-900/80 border-slate-800 hover:border-sky-500/50 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">🔵</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-sky-400 px-2 py-0.5 rounded-full bg-sky-950/80 border border-sky-800">
                    Shorts / Reels
                  </span>
                </div>
                <div className="font-bold text-white text-sm group-hover:text-sky-300 transition-colors">
                  Cyan Pulse
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Viral TikTok hooks, video b-roll cues & hashtags
                </div>
              </button>

              {/* 2. Magenta */}
              <button
                disabled={generating}
                onClick={() => triggerAction('magenta')}
                className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden group cursor-pointer ${
                  activeArtifact?.pulseId === 'magenta'
                    ? 'bg-pink-500/20 border-pink-400 shadow-lg shadow-pink-500/10'
                    : 'bg-slate-900/80 border-slate-800 hover:border-pink-500/50 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">🟣</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-pink-400 px-2 py-0.5 rounded-full bg-pink-950/80 border border-pink-800">
                    DM & Bios
                  </span>
                </div>
                <div className="font-bold text-white text-sm group-hover:text-pink-300 transition-colors">
                  Magenta Pulse
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Outreach DMs, converting bios & newsletter blurbs
                </div>
              </button>

              {/* 3. Gold */}
              <button
                disabled={generating}
                onClick={() => triggerAction('gold')}
                className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden group cursor-pointer ${
                  activeArtifact?.pulseId === 'gold'
                    ? 'bg-amber-500/20 border-amber-400 shadow-lg shadow-amber-500/10'
                    : 'bg-slate-900/80 border-slate-800 hover:border-amber-500/50 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">🟡</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400 px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-800">
                    Strategy
                  </span>
                </div>
                <div className="font-bold text-white text-sm group-hover:text-amber-300 transition-colors">
                  Gold Pulse
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Daily roadmap to hit next tier + revenue projection
                </div>
              </button>

              {/* 4. Infrared */}
              <button
                disabled={generating}
                onClick={() => triggerAction('infrared')}
                className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden group cursor-pointer ${
                  activeArtifact?.pulseId === 'infrared'
                    ? 'bg-rose-500/20 border-rose-400 shadow-lg shadow-rose-500/10'
                    : 'bg-slate-900/80 border-slate-800 hover:border-rose-500/50 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">🔴</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-rose-400 px-2 py-0.5 rounded-full bg-rose-950/80 border border-rose-800">
                    Telemetry
                  </span>
                </div>
                <div className="font-bold text-white text-sm group-hover:text-rose-300 transition-colors">
                  Infrared Pulse
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Live click audits, conversion velocity & fraud scan
                </div>
              </button>

              {/* 5. White */}
              <button
                disabled={generating}
                onClick={() => triggerAction('white')}
                className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden group cursor-pointer ${
                  activeArtifact?.pulseId === 'white'
                    ? 'bg-slate-800 border-white shadow-lg shadow-white/10'
                    : 'bg-slate-900/80 border-slate-800 hover:border-white/50 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl">⚪</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-200 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700">
                    Master Kit
                  </span>
                </div>
                <div className="font-bold text-white text-sm group-hover:text-slate-100 transition-colors">
                  White Pulse
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  360° weekly campaign: scripts, schedule & assets
                </div>
              </button>
            </div>
          </div>

          {activeArtifact && (
            <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 shadow-2xl space-y-6">
              <div className="flex items-start justify-between flex-wrap gap-4 border-b border-slate-800 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-extrabold text-white">
                      {activeArtifact.title}
                    </h3>
                    {activeArtifact.xpAwarded && (
                      <span className="px-2.5 py-0.5 rounded-full bg-plug-accent/20 border border-plug-accent text-plug-accent text-[11px] font-bold flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> +{activeArtifact.xpAwarded} XP
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">{activeArtifact.summary}</p>
                </div>

                <button
                  onClick={() => handleCopyItem('pulse_artifact', activeArtifact.copyableText, 'Copied pulse campaign!')}
                  className="px-4 py-2 rounded-xl bg-plug-accent text-slate-950 hover:bg-emerald-400 font-bold text-xs transition-all flex items-center gap-2 shadow-lg shadow-plug-accent/20 cursor-pointer"
                >
                  {copiedIndex === 'pulse_artifact' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>Copy Pulse Output</span>
                </button>
              </div>

              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 text-xs leading-relaxed whitespace-pre-wrap font-mono text-slate-200">
                {activeArtifact.content}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          MODE 3: HISTORY DRAWER
         ═══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'history' && (
        <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <h2 className="text-base font-extrabold text-white flex items-center gap-2">
              <History className="w-5 h-5 text-plug-accent" />
              📜 SAVED COPYWRITER GENERATIONS HISTORY
            </h2>
            <button
              onClick={fetchCopywriterHistory}
              className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh History
            </button>
          </div>

          {historyItems.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs font-mono space-y-2">
              <Clock className="w-8 h-8 text-slate-600 mx-auto" />
              <p>No copywriter generations saved yet. Use the Gemini Flash studio above!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {historyItems.map((item, idx) => (
                <div key={idx} className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3 hover:border-slate-700 transition-all">
                  <div className="flex items-center justify-between flex-wrap gap-2 text-xs border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2 font-bold text-white">
                      <Sparkles className="w-4 h-4 text-plug-accent" />
                      <span>{item.niche} • {item.product_name}</span>
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] text-slate-400 font-normal">
                        Tone: {item.tone}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-500">
                      {new Date(item.created_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="text-xs text-slate-300 flex items-center gap-2">
                    <span className="text-slate-500">Link:</span>
                    <code className="text-plug-accent font-bold text-[11px] truncate max-w-md">
                      {item.affiliate_url}
                    </code>
                  </div>

                  {item.result && (
                    <div className="flex items-center gap-2 pt-2">
                      <button
                        onClick={() => {
                          setCopywriterOutput(item.result);
                          setActiveTab('copywriter');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-plug-accent hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all cursor-pointer"
                      >
                        ⚡ Load into Output Workspace
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 🧬 MULTI‑PULSE STATUS & TELEMETRY */}
      <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-plug-accent" />
            ⚡ 5-PULSE CREATOR AI DISPATCH
          </h2>
          <span className="text-[11px] text-slate-400">
            Click any engine to generate real viral campaigns & earn <span className="text-plug-accent font-bold">+25 XP</span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* 1. Cyan */}
          <button
            disabled={generating}
            onClick={() => triggerAction('cyan')}
            className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden group ${
              activeArtifact?.pulseId === 'cyan'
                ? 'bg-sky-500/20 border-sky-400 shadow-lg shadow-sky-500/10'
                : 'bg-slate-900/80 border-slate-800 hover:border-sky-500/50 hover:bg-slate-900'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">🔵</span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-sky-400 px-2 py-0.5 rounded-full bg-sky-950/80 border border-sky-800">
                Shorts / Reels
              </span>
            </div>
            <div className="font-bold text-white text-sm group-hover:text-sky-300 transition-colors">
              Cyan Pulse
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Viral TikTok hooks, video b-roll cues & hashtags
            </div>
          </button>

          {/* 2. Magenta */}
          <button
            disabled={generating}
            onClick={() => triggerAction('magenta')}
            className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden group ${
              activeArtifact?.pulseId === 'magenta'
                ? 'bg-pink-500/20 border-pink-400 shadow-lg shadow-pink-500/10'
                : 'bg-slate-900/80 border-slate-800 hover:border-pink-500/50 hover:bg-slate-900'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">🟣</span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-pink-400 px-2 py-0.5 rounded-full bg-pink-950/80 border border-pink-800">
                DM & Bios
              </span>
            </div>
            <div className="font-bold text-white text-sm group-hover:text-pink-300 transition-colors">
              Magenta Pulse
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Outreach DMs, converting bios & newsletter blurbs
            </div>
          </button>

          {/* 3. Gold */}
          <button
            disabled={generating}
            onClick={() => triggerAction('gold')}
            className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden group ${
              activeArtifact?.pulseId === 'gold'
                ? 'bg-amber-500/20 border-amber-400 shadow-lg shadow-amber-500/10'
                : 'bg-slate-900/80 border-slate-800 hover:border-amber-500/50 hover:bg-slate-900'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">🟡</span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400 px-2 py-0.5 rounded-full bg-amber-950/80 border border-amber-800">
                Strategy
              </span>
            </div>
            <div className="font-bold text-white text-sm group-hover:text-amber-300 transition-colors">
              Gold Pulse
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Daily roadmap to hit next tier + revenue projection
            </div>
          </button>

          {/* 4. Infrared */}
          <button
            disabled={generating}
            onClick={() => triggerAction('infrared')}
            className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden group ${
              activeArtifact?.pulseId === 'infrared'
                ? 'bg-rose-500/20 border-rose-400 shadow-lg shadow-rose-500/10'
                : 'bg-slate-900/80 border-slate-800 hover:border-rose-500/50 hover:bg-slate-900'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">🔴</span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-rose-400 px-2 py-0.5 rounded-full bg-rose-950/80 border border-rose-800">
                Telemetry
              </span>
            </div>
            <div className="font-bold text-white text-sm group-hover:text-rose-300 transition-colors">
              Infrared Pulse
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Live click audits, conversion velocity & fraud scan
            </div>
          </button>

          {/* 5. White */}
          <button
            disabled={generating}
            onClick={() => triggerAction('white')}
            className={`p-4 rounded-2xl border text-left transition-all relative overflow-hidden group ${
              activeArtifact?.pulseId === 'white'
                ? 'bg-slate-800 border-white shadow-lg shadow-white/10'
                : 'bg-slate-900/80 border-slate-800 hover:border-white/50 hover:bg-slate-900'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">⚪</span>
              <span className="text-[9px] font-bold uppercase tracking-wider text-slate-200 px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700">
                Master Kit
              </span>
            </div>
            <div className="font-bold text-white text-sm group-hover:text-slate-100 transition-colors">
              White Pulse
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              360° weekly campaign: scripts, schedule & assets
            </div>
          </button>
        </div>
      </div>

      {/* 🎯 ACTIVE GENERATED OUTPUT WORKSPACE */}
      {activeArtifact && (
        <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 shadow-2xl space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between flex-wrap gap-4 border-b border-slate-800 pb-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-extrabold text-white">
                  {activeArtifact.title}
                </h3>
                {activeArtifact.xpAwarded && (
                  <span className="px-2.5 py-0.5 rounded-full bg-plug-accent/20 border border-plug-accent text-plug-accent text-[11px] font-bold flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> +{activeArtifact.xpAwarded} XP
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">{activeArtifact.summary}</p>
            </div>

            {/* Copy CTA button */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleCopyText(activeArtifact.copyableText)}
                className="px-4 py-2 rounded-xl bg-plug-accent text-slate-950 hover:bg-emerald-400 font-bold text-xs transition-all flex items-center gap-2 shadow-lg shadow-plug-accent/20"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied with Link!' : '1-Click Copy Campaign'}</span>
              </button>
            </div>
          </div>

          {/* Main Output Box */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Formatted Content */}
            <div className="lg:col-span-2 p-5 rounded-2xl bg-slate-900 border border-slate-800 text-xs leading-relaxed space-y-4">
              <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase font-bold tracking-wider border-b border-slate-800/80 pb-2">
                <span>Output Workspace</span>
                <span>Category: {activeArtifact.category}</span>
              </div>
              <div className="whitespace-pre-wrap font-mono text-slate-200 text-[12px] leading-relaxed">
                {activeArtifact.content}
              </div>
            </div>

            {/* Visual Asset & Quick-Share Panel */}
            <div className="space-y-4">
              {/* Sigil Card */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                  🪬 Your Procedural Referral Sigil
                </span>
                <div className="flex items-center justify-center p-2 rounded-xl bg-black border border-slate-800">
                  <img
                    src={`/api/sigil/${referralCode}?size=160`}
                    alt="Referral Sigil"
                    className="w-28 h-28 object-contain rounded-lg shadow-inner"
                  />
                </div>
                <div className="text-[10px] text-slate-400 text-center">
                  Deterministic SVG emblem tied to <strong className="text-white">{referralCode}</strong>
                </div>
              </div>

              {/* Share Card Embed Preview */}
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                  🖼️ Viral Achievement Card
                </span>
                <a
                  href={`/api/growth/share-card/${referralCode}`}
                  target="_blank"
                  rel="noreferrer"
                  className="block group relative rounded-xl overflow-hidden border border-slate-800 hover:border-plug-accent transition-all"
                >
                  <img
                    src={`/api/growth/share-card/${referralCode}`}
                    alt="Share Card"
                    className="w-full h-auto object-cover group-hover:scale-105 transition-transform"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1">
                    <span>Open Full Visual</span>
                    <ExternalLink className="w-3 h-3" />
                  </div>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 🧬 MULTI‑PULSE STATUS & TELEMETRY */}
      <div className="p-6 rounded-3xl bg-slate-950 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Disc className="w-5 h-5 text-plug-accent" />
            🧬 LIVE ENGINE TELEMETRY & MULTI-PULSE SYNC
          </h2>
          <button
            onClick={() => setAnimating(!animating)}
            className="px-3 py-1 bg-slate-900 border border-slate-800 text-xs text-slate-400 hover:text-white rounded-lg"
          >
            {animating ? 'Pause Animation' : 'Resume Animation'}
          </button>
        </div>

        {/* Pulse Bar Animation */}
        <div className="p-4 rounded-2xl bg-black border border-slate-800 font-mono text-center text-xl tracking-widest overflow-x-auto select-none">
          {frames[currentFrame].join(' ')}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
            <span className="text-slate-500 uppercase font-bold text-[10px]">Engine Status</span>
            <div className="text-emerald-400 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              ONLINE (5/5 ACTIVE)
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
            <span className="text-slate-500 uppercase font-bold text-[10px]">Pulse Sync</span>
            <div className="text-purple-400 font-bold">100% Locked</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
            <span className="text-slate-500 uppercase font-bold text-[10px]">Generations Today</span>
            <div className="text-sky-400 font-bold">{telemetry?.metrics?.totalGenerationsToday || 328} Completed</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
            <span className="text-slate-500 uppercase font-bold text-[10px]">Your Referral Code</span>
            <div className="text-plug-accent font-bold">{referralCode}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default GenerateDashboardPage;
