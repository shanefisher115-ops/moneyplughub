import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Bot, Send, Sparkles, Trash2, RefreshCw, DollarSign, 
  TrendingUp, CreditCard, PieChart, Target, Shield, Zap, 
  ArrowRight, User, Wallet, Landmark, CheckCircle, ChevronRight,
  Mic, MicOff, Volume2, VolumeX, Radio, PhoneCall, PhoneOff,
  Clock, ShieldCheck, Sparkle, AlertCircle, ChevronDown, MessageSquare,
  Cpu, Users, Layers, Activity
} from 'lucide-react';
import { VoiceOSHUD } from '../components/voice-os/VoiceOSHUD';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at?: string;
  metadata?: any;
  receipt?: any;
  swarmAgent?: {
    id: string;
    name: string;
    title: string;
    themeColor: string;
  };
}

export interface SwarmAgentPreset {
  id: string;
  name: string;
  title: string;
  badge: string;
  color: string;
  glow: string;
  icon: any;
  voiceDesc: string;
}

export const SWARM_VOICE_AGENTS: SwarmAgentPreset[] = [
  { id: 'auto', name: 'Auto-Pilot Swarm', title: 'Dynamic 5-Agent Mesh', badge: 'Mesh 5-Agent', color: '#10b981', glow: 'rgba(16, 185, 129, 0.4)', icon: Bot, voiceDesc: 'Auto-Routes to Best Agent' },
  { id: 'balance_agent', name: 'BalanceAgent (Liam)', title: 'Vault Sovereign', badge: 'Vault Core', color: '#10b981', glow: 'rgba(16, 185, 129, 0.4)', icon: Wallet, voiceDesc: 'Liam (Authoritative Calm)' },
  { id: 'earnings_agent', name: 'EarningsAgent (Adam)', title: 'Monetization Strategist', badge: 'Yield Engine', color: '#f59e0b', glow: 'rgba(245, 158, 11, 0.4)', icon: TrendingUp, voiceDesc: 'Adam (Hype & Yield)' },
  { id: 'referral_agent', name: 'ReferralAgent (Rachel)', title: 'Growth & Referrals Guide', badge: 'Growth Loop', color: '#a855f7', glow: 'rgba(168, 85, 247, 0.4)', icon: Zap, voiceDesc: 'Rachel (Viral Charisma)' },
  { id: 'insight_agent', name: 'InsightAgent (Antoni)', title: 'Analytical Sage', badge: 'Insight Core', color: '#06b6d4', glow: 'rgba(6, 182, 212, 0.4)', icon: PieChart, voiceDesc: 'Antoni (Smooth Analytical)' },
  { id: 'automation_agent', name: 'AutomationAgent (Josh)', title: 'Command Co-Pilot', badge: 'Orchestrator', color: '#3b82f6', glow: 'rgba(59, 130, 246, 0.4)', icon: Cpu, voiceDesc: 'Josh (Snappy Operational)' },
  { id: 'davinci_agent', name: 'DaVinci Polymath (Leonardo)', title: 'Cinematic & Creative Polymath', badge: 'DaVinci Core', color: '#ec4899', glow: 'rgba(236, 72, 153, 0.4)', icon: Sparkles, voiceDesc: 'Leonardo (Cultured Polymath)' },
];

type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking';

export const MoneyOSPage: React.FC = () => {
  const { user, token } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingHistory, setFetchingHistory] = useState(true);
  const [walletContext, setWalletContext] = useState<any>(null);
  const [toast, setToast] = useState<string | null>(null);

  // ─── Real-Time Phone Call & Voice Engine ───────────────────────────
  const [conversationMode, setConversationMode] = useState(false);
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(true);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [lastUserSpoken, setLastUserSpoken] = useState('');
  const [lastAssistantSpoken, setLastAssistantSpoken] = useState('');
  const [callDurationSec, setCallDurationSec] = useState(0);
  const [selectedSwarmAgent, setSelectedSwarmAgent] = useState<string>('auto');
  const [activeSwarmAgent, setActiveSwarmAgent] = useState<SwarmAgentPreset>(SWARM_VOICE_AGENTS[0]);
  const [showChatInCall, setShowChatInCall] = useState(false);
  const [boardroomMode, setBoardroomMode] = useState(false);
  const [activeSpeakingAgentId, setActiveSpeakingAgentId] = useState<string | null>(null);
  const [osmiumMemoryMetrics, setOsmiumMemoryMetrics] = useState<any>(null);

  const recognitionRef = useRef<any>(null);
  const conversationModeRef = useRef(false);
  const voiceOutputRef = useRef(true);
  const isMicMutedRef = useRef(false);
  const voiceStateRef = useRef<VoiceState>('idle');
  const isProcessingRef = useRef(false);
  const callTimerRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<any>(null);
  const currentSpeechGenerationRef = useRef<number>(0);
  const speechSilenceTimeoutRef = useRef<any>(null);
  const lastSpokenTextRef = useRef('');

  useEffect(() => { conversationModeRef.current = conversationMode; }, [conversationMode]);
  useEffect(() => { voiceOutputRef.current = voiceOutputEnabled; }, [voiceOutputEnabled]);
  useEffect(() => { isMicMutedRef.current = isMicMuted; }, [isMicMuted]);
  useEffect(() => { voiceStateRef.current = voiceState; }, [voiceState]);

  // Call timer effect
  useEffect(() => {
    if (conversationMode) {
      setCallDurationSec(0);
      callTimerRef.current = setInterval(() => {
        setCallDurationSec(prev => prev + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      setCallDurationSec(0);
    }
    return () => {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
    };
  }, [conversationMode]);

  const formatCallTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Prime Web Audio Context on user click
  const primeAudioContext = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioCtx();
        }
        if (audioContextRef.current.state === 'suspended') {
          audioContextRef.current.resume();
        }
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.resume();
      }
    } catch {}
  };

  const interruptSpeech = useCallback(() => {
    currentSpeechGenerationRef.current += 1;
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.src = '';
      } catch {}
      audioRef.current = null;
    }
    if ('speechSynthesis' in window) {
      try { window.speechSynthesis.cancel(); } catch {}
    }
  }, []);

  // ─── SPATIAL HARMONIC CUE ──────────────────────────────────────────
  const playHarmonicTone = useCallback((freq: number, pan: number) => {
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
  }, []);

  const startListeningRef = useRef<() => void>(() => {});
  const stopListeningRef = useRef<() => void>(() => {});

  const speakWithBrowser = useCallback((text: string, onDone?: () => void, agentId?: string) => {
    if (!('speechSynthesis' in window)) {
      setVoiceState(conversationModeRef.current ? 'listening' : 'idle');
      onDone?.();
      return;
    }
    try {
      interruptSpeech();
      const thisGen = currentSpeechGenerationRef.current;

      const clean = text
        .replace(/###|\*\*|\*|#|`|---|⚡|💳|📊|🎯|💸|🤖|🏛️|👋|🧹|📈|🎙️|💰|🔥|✨|🚀|💪|🤙|🙏|😄|😂|😅|🌤️|📞|📴|🔊|🎶|🔇/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/\n+/g, '. ')
        .replace(/\.\s*\./g, '.')
        .trim();

      if (!clean) {
        onDone?.();
        setVoiceState(conversationModeRef.current ? 'listening' : 'idle');
        return;
      }

      const utterance = new SpeechSynthesisUtterance(clean.substring(0, 1500));
      const allVoices = window.speechSynthesis.getVoices();
      const enVoices = allVoices.filter(v => v.lang.startsWith('en'));
      const voicePool = enVoices.length > 0 ? enVoices : allVoices;

      // ─── RADICAL ACOUSTIC & VOCAL PROFILING PER AGENT ─────────────
      const targetAgent = agentId || selectedSwarmAgent;
      if (targetAgent === 'balance_agent') {
        // Liam • Strategist (Deep Baritone, Slow, Steady)
        playHarmonicTone(174, -0.75);
        utterance.pitch = 0.55;
        utterance.rate = 0.85;
        const v = voicePool.find(v => (v.name.includes('George') || v.name.includes('David') || v.name.includes('Daniel') || v.name.includes('Oliver') || v.name.includes('Male')) && !v.name.includes('Zira') && !v.name.includes('Susan')) || voicePool[0];
        if (v) utterance.voice = v;
      } else if (targetAgent === 'referral_agent') {
        // Rachel • Explainer (Bright Soprano, Warm, Expressive)
        playHarmonicTone(528, -0.35);
        utterance.pitch = 1.45;
        utterance.rate = 1.04;
        const v = voicePool.find(v => (v.name.includes('Zira') || v.name.includes('Samantha') || v.name.includes('Victoria') || v.name.includes('Susan') || v.name.includes('Hazel') || v.name.includes('Female')) && !v.name.includes('David')) || voicePool[1] || voicePool[0];
        if (v) utterance.voice = v;
      } else if (targetAgent === 'insight_agent') {
        // Adam • Architect (Crisp, Structured, Analytical Midrange)
        playHarmonicTone(396, 0.0);
        utterance.pitch = 0.94;
        utterance.rate = 0.96;
        const v = voicePool.find(v => (v.name.includes('Mark') || v.name.includes('Aaron') || v.name.includes('Sean') || v.name.includes('Google') || v.lang.includes('GB') || v.lang.includes('IE') || v.lang.includes('CA'))) || voicePool[2] || voicePool[0];
        if (v) utterance.voice = v;
      } else if (targetAgent === 'earnings_agent') {
        // Antoni • Optimizer (Sharp Tenor, Ultra-Fast, Rapid-Fire Leverage)
        playHarmonicTone(639, 0.45);
        utterance.pitch = 1.30;
        utterance.rate = 1.28;
        const v = voicePool.find(v => (v.name.includes('Ravi') || v.name.includes('James') || v.name.includes('Fred') || v.name.includes('Alex') || v.name.includes('Tom') || v.lang.includes('IN') || v.lang.includes('AU'))) || voicePool[3] || voicePool[0];
        if (v) utterance.voice = v;
      } else if (targetAgent === 'automation_agent') {
        // Josh • Motivator (Husky Booming Baritone, High Energy Momentum)
        playHarmonicTone(741, 0.80);
        utterance.pitch = 0.72;
        utterance.rate = 1.18;
        const v = voicePool.find(v => (v.name.includes('Bruce') || v.name.includes('Ryan') || v.name.includes('Richard') || v.name.includes('Guy') || v.name.includes('David') || v.name.includes('Microsoft'))) || voicePool[4] || voicePool[0];
        if (v) utterance.voice = v;
      } else if (targetAgent === 'davinci_agent') {
        // Leonardo • DaVinci Polymath (432Hz Harmonized, Cultured Renaissance Tone)
        playHarmonicTone(432, 0.50);
        utterance.pitch = 1.08;
        utterance.rate = 0.94;
        const v = voicePool.find(v => (v.name.includes('Arthur') || v.name.includes('Daniel') || v.name.includes('Oliver') || v.name.includes('Male'))) || voicePool[0];
        if (v) utterance.voice = v;
      } else {
        utterance.pitch = 1.0;
        utterance.rate = 1.05;
        const v = voicePool.find(v => v.name.includes('Natural') || v.name.includes('Google') || v.name.includes('Daniel') || v.name.includes('Ava')) || voicePool[0];
        if (v) utterance.voice = v;
      }

      utterance.onstart = () => {
        if (thisGen !== currentSpeechGenerationRef.current) {
          window.speechSynthesis.cancel();
          return;
        }
        setVoiceState('speaking');
      };
      utterance.onend = () => {
        if (thisGen !== currentSpeechGenerationRef.current) return;
        if (conversationModeRef.current && !isMicMutedRef.current) {
          setVoiceState('listening');
          setTimeout(() => {
            if (conversationModeRef.current) startListeningRef.current();
          }, 200);
        } else {
          setVoiceState('idle');
        }
        onDone?.();
      };
      utterance.onerror = () => {
        if (thisGen !== currentSpeechGenerationRef.current) return;
        if (conversationModeRef.current && !isMicMutedRef.current) {
          setVoiceState('listening');
          setTimeout(() => {
            if (conversationModeRef.current) startListeningRef.current();
          }, 200);
        } else {
          setVoiceState('idle');
        }
        onDone?.();
      };
      window.speechSynthesis.speak(utterance);
    } catch {
      setVoiceState(conversationModeRef.current ? 'listening' : 'idle');
      onDone?.();
    }
  }, [interruptSpeech, selectedSwarmAgent, playHarmonicTone]);

  const speakResponse = useCallback((text: string, onDone?: () => void, agentIdOverride?: string) => {
    if (!voiceOutputRef.current) {
      onDone?.();
      return;
    }

    // 1. Terminate previous speech & pause mic listening so speaker doesn't trigger mic
    interruptSpeech();
    const thisGen = currentSpeechGenerationRef.current;

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
    }

    setVoiceState('speaking');
    setLastAssistantSpoken(text);

    const targetAgent = agentIdOverride || (selectedSwarmAgent !== 'auto' ? selectedSwarmAgent : undefined);

    fetch('/api/tts/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        text,
        swarmAgentId: targetAgent,
      }),
    })
      .then(async (res) => {
        if (thisGen !== currentSpeechGenerationRef.current) return;
        if (!res.ok) throw new Error('ElevenLabs unavailable');

        const swarmAgentId = res.headers.get('X-MoneyOS-Swarm-Agent-Id') || targetAgent;
        if (swarmAgentId) {
          const match = SWARM_VOICE_AGENTS.find(a => a.id === swarmAgentId);
          if (match) setActiveSwarmAgent(match);
        }

        const blob = await res.blob();
        if (thisGen !== currentSpeechGenerationRef.current) return;

        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;

        audio.onended = () => {
          if (thisGen !== currentSpeechGenerationRef.current) return;
          URL.revokeObjectURL(url);
          audioRef.current = null;
          if (conversationModeRef.current && !isMicMutedRef.current) {
            setVoiceState('listening');
            setTimeout(() => {
              if (conversationModeRef.current) startListeningRef.current();
            }, 200);
          } else {
            setVoiceState('idle');
          }
          onDone?.();
        };

        audio.onerror = () => {
          if (thisGen !== currentSpeechGenerationRef.current) return;
          URL.revokeObjectURL(url);
          audioRef.current = null;
          speakWithBrowser(text, onDone, targetAgent);
        };

        audio.play().catch(() => {
          if (thisGen !== currentSpeechGenerationRef.current) return;
          audioRef.current = null;
          speakWithBrowser(text, onDone, targetAgent);
        });
      })
      .catch(() => {
        if (thisGen !== currentSpeechGenerationRef.current) return;
        speakWithBrowser(text, onDone, targetAgent);
      });
  }, [selectedSwarmAgent, interruptSpeech, speakWithBrowser]);

  // ─── Multi-AI Boardroom Sequential Voice Player ────────────────────
  const speakBoardroomSequence = useCallback((turns: any[], index = 0, onAllDone?: () => void) => {
    if (index >= turns.length) {
      setActiveSpeakingAgentId(null);
      onAllDone?.();
      return;
    }

    const turn = turns[index];
    const match = SWARM_VOICE_AGENTS.find(a => a.id === turn.agentId);
    if (match) setActiveSwarmAgent(match);
    setActiveSpeakingAgentId(turn.agentId);
    setLastAssistantSpoken(`[${turn.agentName} • ${turn.agentTitle}]: ${turn.text}`);

    speakResponse(turn.text, () => {
      setTimeout(() => {
        speakBoardroomSequence(turns, index + 1, onAllDone);
      }, 450);
    }, turn.agentId);
  }, [speakResponse]);

  // ─── Speech Recognition (User Voice Ingest) ────────────────────────
  const startListening = useCallback(() => {
    if (isMicMutedRef.current) {
      setVoiceState('idle');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setToast('⚠️ Speech recognition not supported in this browser. Please use Chrome, Edge, or Safari.');
      setTimeout(() => setToast(null), 4000);
      return;
    }

    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = 'en-US';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setVoiceState('listening');
        setInterimTranscript('');
        lastSpokenTextRef.current = '';
      };

      recognition.onresult = (event: any) => {
        // If AI is currently speaking, do not capture speaker echo
        if (voiceStateRef.current === 'speaking') return;

        let interim = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript;
          } else {
            interim += result[0].transcript;
          }
        }

        const combined = (finalTranscript || interim).trim();
        if (combined) {
          lastSpokenTextRef.current = combined;
          setInterimTranscript(combined);
          setInputMessage(combined);

          if (speechSilenceTimeoutRef.current) clearTimeout(speechSilenceTimeoutRef.current);
          speechSilenceTimeoutRef.current = setTimeout(() => {
            const textToSend = lastSpokenTextRef.current.trim();
            if (textToSend && !isProcessingRef.current) {
              lastSpokenTextRef.current = '';
              setInterimTranscript('');
              setInputMessage('');
              sendVoiceMessage(textToSend);
            }
          }, 850);
        }

        if (finalTranscript.trim()) {
          if (speechSilenceTimeoutRef.current) clearTimeout(speechSilenceTimeoutRef.current);
          const textToSend = finalTranscript.trim();
          lastSpokenTextRef.current = '';
          setInterimTranscript('');
          setInputMessage('');
          if (!isProcessingRef.current) {
            sendVoiceMessage(textToSend);
          }
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'no-speech' || event.error === 'aborted') return;
        if (event.error === 'not-allowed') {
          setToast('⚠️ Microphone access blocked. Please allow mic permissions in your browser.');
          setTimeout(() => setToast(null), 4000);
        }
        if (!conversationModeRef.current) setVoiceState('idle');
      };

      recognition.onend = () => {
        const pending = lastSpokenTextRef.current.trim();
        if (pending && !isProcessingRef.current && voiceStateRef.current !== 'speaking') {
          lastSpokenTextRef.current = '';
          setInterimTranscript('');
          setInputMessage('');
          sendVoiceMessage(pending);
          return;
        }

        if (conversationModeRef.current && voiceStateRef.current !== 'processing' && voiceStateRef.current !== 'speaking' && !isMicMutedRef.current) {
          setTimeout(() => {
            if (conversationModeRef.current && voiceStateRef.current !== 'speaking') {
              try { startListening(); } catch {}
            }
          }, 200);
        } else if (!conversationModeRef.current) {
          setVoiceState('idle');
        }
      };

      recognition.start();
    } catch (e) {
      console.error('Failed to start recognition:', e);
      setVoiceState('idle');
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.abort(); } catch {}
      recognitionRef.current = null;
    }
    setInterimTranscript('');
  }, []);

  useEffect(() => {
    startListeningRef.current = startListening;
    stopListeningRef.current = stopListening;
  }, [startListening, stopListening]);

  // ─── Send Voice Message ────────────────────────────────────────────
  const sendVoiceMessage = useCallback(async (text: string) => {
    if (!text.trim() || isProcessingRef.current) return;
    isProcessingRef.current = true;
    setVoiceState('processing');
    setLastUserSpoken(text.trim());

    const userMsg: ChatMessage = {
      id: `temp_${Date.now()}`,
      role: 'user',
      content: text.trim(),
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      // ─── MULTI-AI SWARM BOARDROOM MODE ────────────────────────────
      if (boardroomMode) {
        const res = await fetch('/api/moneyos/boardroom', {
          method: 'POST',
          headers,
          body: JSON.stringify({ prompt: text.trim() }),
        });

        if (res.ok) {
          const j = await res.json();
          if (j.success && j.data?.turns?.length > 0) {
            const turns = j.data.turns;
            for (const t of turns) {
              setMessages(prev => [...prev, {
                id: `b_${Date.now()}_${t.agentId}`,
                role: 'assistant',
                content: `**[${t.agentName} • ${t.agentTitle}]**: ${t.text}`,
                created_at: new Date().toISOString(),
                swarmAgent: { id: t.agentId, name: t.agentName, title: t.agentTitle, themeColor: t.themeColor }
              }]);
            }

            speakBoardroomSequence(turns, 0, () => {
              isProcessingRef.current = false;
              if (conversationModeRef.current && !isMicMutedRef.current) {
                startListening();
              }
            });
            return;
          }
        }
      }

      // ─── STANDARD CO-PILOT MODE ───────────────────────────────────
      const res = await fetch('/api/moneyos/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
          message: text.trim(),
          swarmAgentId: selectedSwarmAgent !== 'auto' ? selectedSwarmAgent : undefined,
        }),
      });

      if (res.ok) {
        const j = await res.json();
        if (j.success) {
          setMessages(prev => [...prev, j.data]);

          if (j.data.receipt) {
            setToast(`⚡ Executed: ${j.data.receipt.type} ($${j.data.receipt.amount})`);
            setTimeout(() => setToast(null), 3500);
            fetchContextAndHistory();
          }

          if (j.data.content) {
            speakResponse(j.data.content, () => {
              isProcessingRef.current = false;
              if (conversationModeRef.current && !isMicMutedRef.current) {
                startListening();
              }
            });
          } else {
            isProcessingRef.current = false;
            if (conversationModeRef.current && !isMicMutedRef.current) startListening();
          }
        } else {
          isProcessingRef.current = false;
          if (conversationModeRef.current && !isMicMutedRef.current) startListening();
        }
      } else {
        setToast('⚠️ MoneyOS failed to respond.');
        setTimeout(() => setToast(null), 3000);
        isProcessingRef.current = false;
        if (conversationModeRef.current && !isMicMutedRef.current) startListening();
      }
    } catch (e) {
      console.error(e);
      setToast('⚠️ Network connection error.');
      setTimeout(() => setToast(null), 3000);
      isProcessingRef.current = false;
      if (conversationModeRef.current && !isMicMutedRef.current) startListening();
    } finally {
      setLoading(false);
    }
  }, [token, boardroomMode, selectedSwarmAgent, speakResponse, speakBoardroomSequence, startListening]);

  // ─── Toggle Phone Call Mode ────────────────────────────────────────
  const toggleConversationMode = useCallback(() => {
    primeAudioContext();

    if (conversationMode) {
      setConversationMode(false);
      conversationModeRef.current = false;
      interruptSpeech();
      stopListening();
      setVoiceState('idle');
      isProcessingRef.current = false;
      setToast('📴 Voice call ended.');
      setTimeout(() => setToast(null), 2500);
    } else {
      setConversationMode(true);
      conversationModeRef.current = true;
      setIsMicMuted(false);
      setToast('📞 Call Connected — Speak freely. Talk with MoneyOS.');
      setTimeout(() => setToast(null), 3000);
      startListening();
    }
  }, [conversationMode, interruptSpeech, stopListening, startListening]);

  const toggleMuteMic = () => {
    if (isMicMuted) {
      setIsMicMuted(false);
      isMicMutedRef.current = false;
      setToast('🎙️ Microphone unmuted.');
      setTimeout(() => setToast(null), 2000);
      if (voiceStateRef.current !== 'speaking') {
        startListening();
      }
    } else {
      setIsMicMuted(true);
      isMicMutedRef.current = true;
      stopListening();
      setVoiceState('idle');
      setToast('🔇 Microphone muted.');
      setTimeout(() => setToast(null), 2000);
    }
  };

  useEffect(() => {
    return () => { interruptSpeech(); stopListening(); };
  }, [interruptSpeech, stopListening]);

  // ─── Data Fetching ─────────────────────────────────────────────────
  const fetchContextAndHistory = async () => {
    try {
      setFetchingHistory(true);
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const [ctxRes, histRes] = await Promise.all([
        fetch('/api/moneyos/context', { headers }),
        fetch('/api/moneyos/history', { headers }),
      ]);

      if (ctxRes.ok) {
        const j = await ctxRes.json();
        if (j.success) setWalletContext(j.data);
      }

      if (histRes.ok) {
        const j = await histRes.json();
        if (j.success && j.data.length > 0) {
          setMessages(j.data);
        } else {
          setMessages([
            {
              id: 'msg_welcome',
              role: 'assistant',
              content: `### 🤖 MoneyOS Live Voice Orchestrator\n\nClick **📞 Call MoneyOS** above to begin a live, two-way conversational phone call. Speak naturally, interrupt anytime, or ask to move funds across accounts in real-time.\n\n*Try asking:*\n* "What is my liquid cash balance?"\n* "Send $100 from savings to checking"\n* "How do I optimize my monthly cashflow?"`,
              created_at: new Date().toISOString(),
            }
          ]);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setFetchingHistory(false);
    }
  };

  useEffect(() => { fetchContextAndHistory(); }, [token]);
  useEffect(() => { scrollToBottom(); }, [messages, loading]);

  const handleSendMessage = async (e?: React.FormEvent, customPrompt?: string) => {
    if (e) e.preventDefault();
    const text = customPrompt || inputMessage;
    if (!text.trim() || loading) return;

    primeAudioContext();

    const userMsg: ChatMessage = {
      id: `temp_${Date.now()}`,
      role: 'user',
      content: text.trim(),
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setLoading(true);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/moneyos/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
          message: text.trim(),
          swarmAgentId: selectedSwarmAgent !== 'auto' ? selectedSwarmAgent : undefined,
        }),
      });

      if (res.ok) {
        const j = await res.json();
        if (j.success) {
          setMessages(prev => [...prev, j.data]);
          if (j.data.content && voiceOutputEnabled) speakResponse(j.data.content);
          if (j.data.receipt) {
            setToast(`⚡ Command Executed: ${j.data.receipt.type}`);
            setTimeout(() => setToast(null), 3500);
            fetchContextAndHistory();
          }
        }
      } else {
        setToast('⚠️ Failed to receive MoneyOS response.');
        setTimeout(() => setToast(null), 3000);
      }
    } catch (e) {
      console.error(e);
      setToast('⚠️ Network connection error.');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    interruptSpeech();
    try {
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      await fetch('/api/moneyos/history', { method: 'DELETE', headers });
      setMessages([
        {
          id: 'msg_reset',
          role: 'assistant',
          content: '### 🧹 MoneyOS Memory Reset\n\nHow can I help you route or optimize your money?',
          created_at: new Date().toISOString(),
        }
      ]);
      setToast('✨ Chat history cleared.');
      setTimeout(() => setToast(null), 2500);
    } catch {}
  };

  const QUICK_PROMPTS = [
    { label: '🎬 Generate TikTok Video Script', prompt: 'Create a viral 9:16 TikTok video production script and DaVinci Resolve storyboard for my referral code' },
    { label: '💸 Send $100 Savings → Checking', prompt: 'Send $100 from savings to checking' },
    { label: '💳 Pay $150 on Credit Card', prompt: 'Pay $150 on my credit card' },
    { label: '📈 How do I invest $500?', prompt: 'How do I invest $500?' },
    { label: '📊 Set Food Budget to $500', prompt: 'Set food budget to 500' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-8 pb-36 sm:pb-16 space-y-5 sm:space-y-6 animate-fadeIn min-h-[calc(100dvh-100px)]">
      {/* Toast Alert */}
      {toast && (
        <div className="p-3 sm:p-3.5 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-mono font-bold flex items-center gap-2 animate-fadeIn shadow-lg shadow-emerald-500/10">
          <Zap className="w-4 h-4 fill-current shrink-0 text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}

      {/* Hero Header */}
      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-slate-900/90 border ${
        conversationMode ? 'border-emerald-500/60 shadow-emerald-500/20' : 'border-plug-border/80'
      } shadow-2xl backdrop-blur-xl relative overflow-hidden transition-all`}>
        
        {/* Glow backdrop during active call */}
        {conversationMode && (
          <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-purple-500/10 pointer-events-none animate-pulse" />
        )}

        <div className="flex items-center gap-3.5 sm:gap-4 relative z-10">
          <div className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center font-black shadow-lg shrink-0 transition-all ${
            conversationMode
              ? 'bg-gradient-to-tr from-emerald-400 to-cyan-400 text-slate-950 animate-pulse shadow-emerald-500/40 ring-4 ring-emerald-500/30'
              : 'bg-gradient-to-tr from-emerald-500 to-plug-accent text-plug-dark shadow-plug-accent/25'
          }`}>
            {conversationMode ? <PhoneCall className="w-6 h-6 sm:w-7 sm:h-7 animate-bounce" /> : <Bot className="w-6 h-6 sm:w-7 sm:h-7" />}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">MoneyOS Voice Engine</h1>
              {conversationMode ? (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 animate-pulse shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  LIVE CALL • {formatCallTime(callDurationSec)}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-800 text-slate-400 border border-slate-700">
                  Ready to Call
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">
              {conversationMode
                ? `Connected to ${activeSwarmAgent.name} • Natural two-way voice call`
                : 'Autonomous Financial Intelligence • Real-Time Voice Conversations'
              }
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 relative z-10 flex-wrap">
          {/* Main Call Action Button */}
          <button
            onClick={toggleConversationMode}
            className={`px-4 sm:px-5 py-2.5 rounded-2xl text-xs sm:text-sm font-black border transition-all flex items-center gap-2 cursor-pointer shadow-lg ${
              conversationMode
                ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400 ring-4 ring-rose-500/20 shadow-rose-600/30 animate-pulse'
                : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-400 shadow-emerald-500/30 hover:scale-105'
            }`}
          >
            {conversationMode ? <PhoneOff className="w-4 h-4" /> : <PhoneCall className="w-4 h-4" />}
            <span>{conversationMode ? 'End Call' : 'Call MoneyOS'}</span>
          </button>

          {/* Voice Speaker Mute Toggle */}
          <button
            onClick={() => {
              if (voiceOutputEnabled) interruptSpeech();
              setVoiceOutputEnabled(!voiceOutputEnabled);
            }}
            className={`px-3 py-2 rounded-xl text-xs font-mono font-bold border transition-colors flex items-center gap-1.5 ${
              voiceOutputEnabled
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
            }`}
            title="Toggle Voice Output Audio"
          >
            {voiceOutputEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{voiceOutputEnabled ? 'Voice ON' : 'Muted'}</span>
          </button>

          {/* Refresh & Clear */}
          <button onClick={fetchContextAndHistory}
            className="p-2.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 transition-colors"
            title="Refresh Context"
          >
            <RefreshCw className={`w-4 h-4 ${fetchingHistory ? 'animate-spin' : ''}`} />
          </button>

          <button onClick={handleClearHistory}
            className="p-2.5 rounded-xl bg-slate-950 hover:bg-rose-950/30 text-slate-400 hover:text-rose-400 border border-slate-800 transition-colors"
            title="Clear Chat History"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 👑 MoneyPlugHub 7-Realm Voice OS Cinematic HUD */}
      <VoiceOSHUD />

      {/* Financial Context Cards */}
      {walletContext && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          {[
            { label: 'Net Worth', value: `$${walletContext.finances.netWorthUsd}`, color: 'text-white' },
            { label: 'Liquid Cash', value: `$${walletContext.finances.totalCashUsd}`, color: 'text-emerald-400' },
            { label: 'Total Liabilities', value: `$${walletContext.finances.totalDebtUsd}`, color: 'text-rose-400' },
            { label: 'Savings Rate', value: `${walletContext.finances.savingsRatePct}%`, color: 'text-plug-accent' },
          ].map((card, idx) => (
            <div key={idx} className="p-3 sm:p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800">
              <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">{card.label}</span>
              <div className={`text-base font-black font-mono mt-0.5 ${card.color}`}>{card.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 📞 DEDICATED PHONE CALL HUD ROOM (ACTIVE WHEN CALLING)          */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {conversationMode && (
        <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-slate-900/98 via-slate-950/98 to-slate-900/98 border-2 border-emerald-500/50 shadow-2xl shadow-emerald-500/10 backdrop-blur-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          
          {/* Ambient Cosmic Grid */}
          <div className="absolute inset-0 bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:24px_24px] opacity-15 pointer-events-none" />

          {/* Top Bar: Call Status, Mode Toggle & Agent Selector */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 relative z-10 pb-5 border-b border-slate-800/80">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-xs font-mono font-bold text-emerald-300">
                LINE ACTIVE • {formatCallTime(callDurationSec)}
              </span>
              <span className="text-slate-600">•</span>
              <span className="px-2 py-0.5 rounded-md bg-purple-950/80 border border-purple-500/40 text-[10px] font-mono text-purple-300 font-bold flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-purple-400" />
                ♾️ INFINITE TOKENS (OSMIUM GRAPH ACTIVE)
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Boardroom Mode Toggle */}
              <button
                onClick={() => {
                  setBoardroomMode(!boardroomMode);
                  setToast(boardroomMode ? '🤖 Switched to Solo Co-Pilot Mode' : '🏛️ Swarm Boardroom Mode Activated — 5 AIs will debate your prompt!');
                  setTimeout(() => setToast(null), 3000);
                }}
                className={`px-3 py-1.5 rounded-xl font-mono text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                  boardroomMode
                    ? 'bg-purple-600 hover:bg-purple-500 text-white border-purple-400 shadow-md shadow-purple-600/30'
                    : 'bg-slate-950 hover:bg-slate-900 text-slate-300 border-slate-800'
                }`}
                title="Toggle 5-Agent Round-Table Deliberation"
              >
                <Users className="w-3.5 h-3.5" />
                <span>{boardroomMode ? '🏛️ Boardroom Swarm ON' : '🤖 Solo Co-Pilot'}</span>
              </button>

              {/* Swarm Voice Selector Pill */}
              {!boardroomMode && (
                <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-2xl border border-slate-800">
                  <span className="text-[10px] font-mono text-slate-400 uppercase px-2 font-bold">Voice:</span>
                  <select
                    value={selectedSwarmAgent}
                    onChange={(e) => {
                      setSelectedSwarmAgent(e.target.value);
                      const found = SWARM_VOICE_AGENTS.find(a => a.id === e.target.value);
                      if (found) setActiveSwarmAgent(found);
                    }}
                    className="bg-slate-900 text-emerald-300 font-mono text-xs font-bold rounded-xl px-2.5 py-1 border border-slate-700 focus:outline-none cursor-pointer"
                  >
                    {SWARM_VOICE_AGENTS.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* Centerpiece: Holographic Pulsing Avatar & Multi-Agent Boardroom Grid */}
          <div className="py-6 sm:py-10 flex flex-col items-center justify-center text-center relative z-10 space-y-5">
            
            {/* ═══ BOARDROOM 5-AGENT ROUND-TABLE HUD ═══ */}
            {boardroomMode ? (
              <div className="w-full max-w-xl py-2">
                <div className="text-xs font-mono text-purple-300 font-bold uppercase tracking-wider mb-4 flex items-center justify-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                  <span>Autonomous AI Swarm Round-Table Chamber</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-2">
                  {SWARM_VOICE_AGENTS.filter(a => a.id !== 'auto').map((agent) => {
                    const isSpeakingThis = activeSpeakingAgentId === agent.id;
                    return (
                      <div
                        key={agent.id}
                        className={`p-3 rounded-2xl border transition-all duration-300 flex flex-col items-center justify-center text-center ${
                          isSpeakingThis
                            ? 'bg-slate-900 border-2 scale-105 shadow-xl'
                            : 'bg-slate-950/80 border-slate-800/80 opacity-70 hover:opacity-100'
                        }`}
                        style={{
                          borderColor: isSpeakingThis ? agent.color : undefined,
                          boxShadow: isSpeakingThis ? `0 0 20px ${agent.glow}` : undefined,
                        }}
                      >
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs mb-1.5 shadow-md transition-all ${
                            isSpeakingThis ? 'scale-110 animate-bounce text-slate-950' : 'bg-slate-900 text-slate-400'
                          }`}
                          style={{
                            backgroundColor: isSpeakingThis ? agent.color : undefined,
                          }}
                        >
                          <agent.icon className="w-5 h-5" />
                        </div>
                        <div className="text-[11px] font-black font-mono text-white truncate max-w-full">
                          {agent.name.split(' ')[0]}
                        </div>
                        <div className="text-[9px] font-mono text-slate-400 truncate max-w-full">
                          {agent.title}
                        </div>
                        {isSpeakingThis && (
                          <span className="mt-1 px-1.5 py-0.2 rounded text-[8px] font-mono font-bold bg-white/20 text-white animate-pulse">
                            SPEAKING
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* ═══ SOLO AVATAR HOLOGRAPHIC MODE ═══ */
              <div className="relative flex items-center justify-center">
                {/* Outer Ring */}
                <div className={`absolute w-36 h-36 sm:w-44 sm:h-44 rounded-full border-2 transition-all duration-500 ${
                  voiceState === 'speaking'
                    ? 'border-cyan-400/40 animate-ping scale-110'
                    : voiceState === 'listening'
                    ? 'border-emerald-400/40 animate-pulse'
                    : voiceState === 'processing'
                    ? 'border-amber-400/40 animate-spin'
                    : 'border-slate-800'
                }`} />

                {/* Middle Ring */}
                <div className={`absolute w-28 h-28 sm:w-36 sm:h-36 rounded-full border transition-all duration-300 ${
                  voiceState === 'speaking'
                    ? 'border-cyan-300/60 scale-105'
                    : voiceState === 'listening'
                    ? 'border-emerald-300/60 scale-105'
                    : 'border-slate-700/60'
                }`} />

                {/* Core Avatar Sphere */}
                <div className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center font-black shadow-2xl transition-all duration-300 ${
                  voiceState === 'speaking'
                    ? 'bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-cyan-500/50 scale-105'
                    : voiceState === 'listening'
                    ? 'bg-gradient-to-tr from-emerald-500 to-teal-500 text-slate-950 shadow-emerald-500/50 scale-105'
                    : voiceState === 'processing'
                    ? 'bg-gradient-to-tr from-amber-500 to-yellow-500 text-slate-950 shadow-amber-500/50'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  {voiceState === 'speaking' ? (
                    <Volume2 className="w-10 h-10 sm:w-12 sm:h-12 animate-pulse" />
                  ) : voiceState === 'listening' ? (
                    <Mic className="w-10 h-10 sm:w-12 sm:h-12 animate-bounce" />
                  ) : voiceState === 'processing' ? (
                    <Zap className="w-10 h-10 sm:w-12 sm:h-12 animate-pulse" />
                  ) : (
                    <PhoneCall className="w-10 h-10 sm:w-12 sm:h-12" />
                  )}
                </div>
              </div>
            )}

            {/* Live State Text & Dynamic Waveform */}
            <div className="space-y-2 max-w-lg">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-950 border border-slate-800">
                <span className={`w-2 h-2 rounded-full ${
                  voiceState === 'speaking' ? 'bg-cyan-400 animate-ping' :
                  voiceState === 'listening' ? 'bg-emerald-400 animate-ping' :
                  voiceState === 'processing' ? 'bg-amber-400 animate-ping' : 'bg-slate-500'
                }`} />
                <span className="text-xs font-mono font-bold text-slate-200">
                  {voiceState === 'speaking'
                    ? boardroomMode
                      ? `🔊 ${activeSwarmAgent.name} Speaking (Boardroom Deliberation)`
                      : '🔊 MoneyOS is Speaking (Interrupt anytime)'
                    : voiceState === 'listening'
                    ? '🎙️ Listening to You... (Speak naturally)'
                    : voiceState === 'processing'
                    ? '⚡ Swarm Deliberating & Synthesizing...'
                    : 'Connected'}
                </span>
              </div>

              {/* Animated Waveform Equalizer */}
              <div className="flex items-center justify-center gap-1 h-8 pt-1">
                {[4, 12, 22, 16, 28, 14, 24, 18, 30, 15, 20, 10].map((h, i) => (
                  <span
                    key={i}
                    className={`w-1 rounded-full transition-all duration-150 ${
                      voiceState === 'speaking' ? 'bg-cyan-400' :
                      voiceState === 'listening' ? 'bg-emerald-400' : 'bg-slate-700'
                    }`}
                    style={{
                      height: voiceState === 'speaking' || voiceState === 'listening'
                        ? `${Math.max(6, (h * (Math.sin(Date.now() / 200 + i) + 1.2)))}px`
                        : '6px',
                    }}
                  />
                ))}
              </div>

              {/* Real-Time Live Transcript Bubble */}
              {interimTranscript && (
                <div className="p-3 rounded-2xl bg-emerald-950/80 border border-emerald-500/40 text-emerald-200 text-xs font-mono italic animate-in fade-in duration-100">
                  "{interimTranscript}"
                </div>
              )}
            </div>

            {/* Recent Exchange Context Box */}
            {(lastUserSpoken || lastAssistantSpoken) && (
              <div className="w-full max-w-2xl text-left bg-slate-950/90 rounded-2xl p-4 border border-slate-800/80 space-y-2 text-xs font-mono">
                {lastUserSpoken && (
                  <div className="flex items-start gap-2 text-slate-300">
                    <span className="text-purple-400 font-bold shrink-0">You:</span>
                    <span className="italic">"{lastUserSpoken}"</span>
                  </div>
                )}
                {lastAssistantSpoken && (
                  <div className="flex items-start gap-2 text-emerald-300 pt-1 border-t border-slate-900">
                    <span className="text-plug-accent font-bold shrink-0">{activeSwarmAgent.name}:</span>
                    <span className="line-clamp-3">{lastAssistantSpoken}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Bottom Call Controls Toolbar */}
          <div className="flex items-center justify-center gap-3 sm:gap-4 relative z-10 pt-4 border-t border-slate-800/80 flex-wrap">
            
            {/* Mute Mic Button */}
            <button
              onClick={toggleMuteMic}
              className={`p-3.5 sm:px-4 sm:py-3 rounded-2xl text-xs font-mono font-bold border transition-all flex items-center gap-2 cursor-pointer shadow-md ${
                isMicMuted
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 ring-2 ring-amber-500/30'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
              title={isMicMuted ? 'Unmute Microphone' : 'Mute Microphone'}
            >
              {isMicMuted ? <MicOff className="w-4 h-4 text-amber-400" /> : <Mic className="w-4 h-4 text-emerald-400" />}
              <span className="hidden sm:inline">{isMicMuted ? 'Unmute Mic' : 'Mute Mic'}</span>
            </button>

            {/* Instant Interrupt / Barge-In Button */}
            {voiceState === 'speaking' && (
              <button
                onClick={() => {
                  interruptSpeech();
                  setVoiceState('listening');
                  startListening();
                }}
                className="px-4 py-3 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-cyan-500/20 animate-pulse"
                title="Interrupt MoneyOS speech and talk immediately"
              >
                <Zap className="w-4 h-4" />
                <span>Interrupt & Speak</span>
              </button>
            )}

            {/* End Call Button */}
            <button
              onClick={toggleConversationMode}
              className="px-6 py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs sm:text-sm font-black transition-all flex items-center gap-2.5 cursor-pointer shadow-lg shadow-rose-600/40 hover:scale-105 ring-4 ring-rose-500/20"
              title="Hang Up Phone Call"
            >
              <PhoneOff className="w-5 h-5" />
              <span>Hang Up</span>
            </button>

            {/* Toggle Full Chat Feed */}
            <button
              onClick={() => setShowChatInCall(!showChatInCall)}
              className="p-3.5 sm:px-4 sm:py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-mono text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
              title="Toggle Full Chat Log"
            >
              <MessageSquare className="w-4 h-4 text-slate-400" />
              <span className="hidden sm:inline">{showChatInCall ? 'Hide Log' : 'View Full Log'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* 💬 STANDARD CHAT INTERFACE & MESSAGE STREAM                     */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {(!conversationMode || showChatInCall) && (
        <div className={`rounded-2xl sm:rounded-3xl bg-slate-900/90 border ${
          conversationMode ? 'border-emerald-500/40' : 'border-plug-border/80'
        } shadow-2xl backdrop-blur-xl flex flex-col h-[calc(100dvh-280px)] min-h-[440px] max-h-[640px] overflow-hidden transition-colors relative`}>

          {/* Message Feed */}
          <div className="flex-1 p-3.5 sm:p-6 overflow-y-auto space-y-3 sm:space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
            {messages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <div key={m.id} className={`flex items-start gap-2 sm:gap-3.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl shrink-0 flex items-center justify-center font-bold text-xs shadow-md ${
                    isUser ? 'bg-purple-600 text-white' : 'bg-gradient-to-tr from-emerald-500 to-plug-accent text-plug-dark font-black'
                  }`}>
                    {isUser ? <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                  </div>

                  <div className={`max-w-[90%] sm:max-w-[85%] rounded-2xl sm:rounded-3xl p-3 sm:p-4 text-xs leading-relaxed space-y-1.5 sm:space-y-2 ${
                    isUser
                      ? 'bg-purple-600 text-white font-medium rounded-tr-none shadow-md shadow-purple-900/20'
                      : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-tl-none font-mono'
                  }`}>
                    <div className="whitespace-pre-wrap break-words">{m.content}</div>

                    {m.receipt && (
                      <div className="mt-2 p-2.5 sm:p-3 rounded-2xl bg-emerald-950/80 border border-emerald-500/50 text-xs font-mono text-emerald-300 space-y-1">
                        <div className="font-bold flex items-center gap-1.5 text-emerald-400">
                          <CheckCircle className="w-4 h-4" />
                          <span>LIVE RECEIPT: {m.receipt.type}</span>
                        </div>
                        <div className="text-[11px] text-slate-300">
                          Amount: <strong className="text-white">${m.receipt.amount}</strong>
                        </div>
                      </div>
                    )}

                    <div className={`text-[9px] sm:text-[10px] pt-1 font-mono ${isUser ? 'text-purple-200 text-right' : 'text-slate-500'}`}>
                      {m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                    </div>
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex items-start gap-2.5 sm:gap-3.5">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-plug-accent text-plug-dark flex items-center justify-center font-black text-xs shrink-0 animate-pulse">
                  <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <div className="p-3 sm:p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs font-mono text-slate-400 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-plug-accent animate-ping" />
                  <span>MoneyOS is analyzing your live financial context...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          <div className="p-2 sm:p-3 bg-slate-950/90 border-t border-slate-800 flex items-center gap-2 overflow-x-auto scrollbar-none">
            <span className="text-[9px] sm:text-[10px] font-mono text-slate-500 uppercase font-bold shrink-0 ml-1">Quick:</span>
            {QUICK_PROMPTS.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(undefined, q.prompt)}
                className="px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-[11px] sm:text-xs font-mono whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span>{q.label}</span>
                <ChevronRight className="w-3 h-3 text-slate-500" />
              </button>
            ))}
          </div>

          {/* Text Input Bar */}
          <form
            onSubmit={(e) => handleSendMessage(e)}
            className="p-2.5 sm:p-4 bg-slate-900 border-t border-plug-border/80 flex items-center gap-2 sm:gap-3 sticky bottom-0 z-20 pb-[max(0.65rem,env(safe-area-inset-bottom))]"
          >
            {/* Quick Call Start Button inside Input */}
            <button
              type="button"
              onClick={toggleConversationMode}
              className={`p-2 sm:p-3 rounded-xl sm:rounded-2xl transition-all flex items-center justify-center shrink-0 cursor-pointer shadow-md ${
                conversationMode
                  ? 'bg-rose-600 hover:bg-rose-500 text-white ring-4 ring-rose-500/30 animate-pulse'
                  : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold'
              }`}
              title={conversationMode ? 'End Phone Call' : 'Start Phone Call with MoneyOS'}
            >
              {conversationMode ? <PhoneOff className="w-4 h-4" /> : <PhoneCall className="w-4 h-4" />}
            </button>

            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask MoneyOS or tap phone..."
              className="flex-1 px-3 sm:px-4 py-2 sm:py-3 bg-slate-950 border border-slate-800 rounded-xl sm:rounded-2xl text-white font-mono text-xs focus:outline-none focus:border-plug-accent transition-colors"
            />

            <button
              type="submit"
              disabled={!inputMessage.trim() || loading}
              className="p-2 sm:p-3 bg-plug-accent hover:bg-plug-accentHover disabled:opacity-50 text-plug-dark font-black rounded-xl sm:rounded-2xl transition-all shadow-md shadow-plug-accent/20 flex items-center justify-center shrink-0 cursor-pointer"
              title="Send Message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default MoneyOSPage;
