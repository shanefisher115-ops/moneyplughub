import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bot, Mic, MicOff, Volume2, VolumeX, Send, Sparkles, TrendingUp,
  DollarSign, Zap, Check, ArrowRight, ShieldCheck, RefreshCw, Layers, Calculator, CreditCard, X
} from 'lucide-react';
import { SalesCheckoutModal } from './SalesCheckoutModal';

interface SalesMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  triggerCheckout?: boolean;
  planId?: string;
  calculation?: any;
}

export interface SalesCopilotVoiceProps {
  isOpen?: boolean;
  onClose?: () => void;
  initialReferralCount?: number;
  initialTierId?: string;
}

export const SalesCopilotVoice: React.FC<SalesCopilotVoiceProps> = ({
  isOpen = true,
  onClose,
  initialReferralCount = 15,
  initialTierId = 'creator',
}) => {
  // Chat & AI State
  const [messages, setMessages] = useState<SalesMessage[]>([
    {
      id: 'msg_init',
      role: 'assistant',
      content: `### 🤖 Gemini Flash AI Sales Copilot Active\n\nI am your live voice & sales assistant. Ask me anything about our **Subscription Tiers**, calculate your projected **Affiliate Earnings**, or tell me to **open checkout**!`,
      timestamp: new Date().toISOString(),
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Voice State
  const [isListening, setIsListening] = useState(false);
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(true);
  const [speechState, setSpeechState] = useState<'idle' | 'listening' | 'speaking'>('idle');
  const [interimTranscript, setInterimTranscript] = useState('');

  // Calculator State
  const [referralCount, setReferralCount] = useState<number>(initialReferralCount);
  const [selectedTierId, setSelectedTierId] = useState<string>(initialTierId);
  const [monthlySpendUsd, setMonthlySpendUsd] = useState<number>(29);
  const [calculationResult, setCalculationResult] = useState<any>(null);

  // Modal State
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [checkoutPlanId, setCheckoutPlanId] = useState<string>('creator');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Calculate Affiliate Earnings API Call
  const runCalculation = useCallback(async (count: number, tierId: string, spend: number) => {
    try {
      const res = await fetch('/api/sales-copilot/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referralCount: count,
          tierId,
          avgSubscriptionSpendUsd: spend,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setCalculationResult(data.data);
        }
      }
    } catch (e) {
      console.error('Calculation error:', e);
    }
  }, []);

  useEffect(() => {
    runCalculation(referralCount, selectedTierId, monthlySpendUsd);
  }, [referralCount, selectedTierId, monthlySpendUsd, runCalculation]);

  // Text-To-Speech Synthesis
  const speakText = useCallback((text: string) => {
    if (!voiceOutputEnabled || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel();
      const clean = text
        .replace(/#{1,6}\s+/g, '')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/`([^`]+)`/g, '$1')
        .replace(/[^\w\s.,!?'"$\-%]/g, ' ')
        .substring(0, 500);

      const utterance = new SpeechSynthesisUtterance(clean);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      utterance.onstart = () => setSpeechState('speaking');
      utterance.onend = () => setSpeechState('idle');
      utterance.onerror = () => setSpeechState('idle');

      window.speechSynthesis.speak(utterance);
    } catch {
      setSpeechState('idle');
    }
  }, [voiceOutputEnabled]);

  // Send Message to Gemini Flash AI Sales Copilot
  const handleSendMessage = async (customPrompt?: string) => {
    const text = customPrompt || inputMessage;
    if (!text.trim() || loading) return;

    const userMsg: SalesMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    if (!customPrompt) setInputMessage('');
    setLoading(true);

    try {
      const res = await fetch('/api/sales-copilot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          currentReferralCount: referralCount,
          currentTierId: selectedTierId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          const aiMsg: SalesMessage = {
            id: `b_${Date.now()}`,
            role: 'assistant',
            content: data.data.response,
            timestamp: data.data.timestamp,
            triggerCheckout: data.data.triggerCheckout,
            planId: data.data.planId,
            calculation: data.data.calculation,
          };

          setMessages(prev => [...prev, aiMsg]);
          speakText(data.data.response);

          if (data.data.triggerCheckout) {
            setCheckoutPlanId(data.data.planId || 'creator');
            setTimeout(() => {
              setCheckoutModalOpen(true);
            }, 600);
          }
        }
      }
    } catch (err) {
      console.error('Chat error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Speech Recognition (Mic Input)
  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }
      setIsListening(false);
      setSpeechState('idle');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognitionRef.current = recognition;
      recognition.lang = 'en-US';
      recognition.continuous = false;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechState('listening');
        setInterimTranscript('');
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }
        const text = final || interim;
        setInterimTranscript(text);

        if (final.trim()) {
          setInputMessage(final.trim());
          handleSendMessage(final.trim());
        }
      };

      recognition.onerror = () => {
        setIsListening(false);
        setSpeechState('idle');
      };

      recognition.onend = () => {
        setIsListening(false);
        setSpeechState('idle');
      };

      recognition.start();
    } catch {
      setIsListening(false);
      setSpeechState('idle');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="w-full bg-[#080b11] border border-cyan-500/30 rounded-3xl p-4 sm:p-6 text-white shadow-2xl relative overflow-hidden font-sans space-y-6">
      {/* Background Ambient Glow */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10 relative z-10">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-emerald-400 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-slate-950 font-black">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-bold tracking-tight text-white">
                AI Sales Copilot
              </h2>
              <span className="px-2.5 py-0.5 text-[10px] font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded-full flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-cyan-400" /> Gemini 2.5 Flash
              </span>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Tier Guidance • Interactive Affiliate Calculator • One-Click Checkout Trigger
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Audio Output Toggle */}
          <button
            onClick={() => {
              if (voiceOutputEnabled && 'speechSynthesis' in window) {
                window.speechSynthesis.cancel();
              }
              setVoiceOutputEnabled(!voiceOutputEnabled);
            }}
            className={`px-3 py-2 rounded-xl text-xs font-mono font-bold border transition-colors flex items-center gap-1.5 cursor-pointer ${
              voiceOutputEnabled
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : 'bg-white/5 text-slate-400 border-white/10 hover:text-white'
            }`}
            title="Toggle Voice Speech Output"
          >
            {voiceOutputEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            <span className="hidden sm:inline">{voiceOutputEnabled ? 'Voice ON' : 'Muted'}</span>
          </button>

          {/* Mic Button */}
          <button
            onClick={toggleListening}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold border transition-all flex items-center gap-2 cursor-pointer shadow-lg ${
              isListening
                ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 shadow-rose-500/20 animate-pulse'
                : 'bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 border-cyan-400 hover:opacity-90 shadow-cyan-500/20'
            }`}
          >
            {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            <span>{isListening ? 'Stop Mic' : 'Live Mic'}</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">

        {/* Left Section: Interactive Calculator & Subscription Tiers (5 Cols) */}
        <div className="lg:col-span-5 space-y-5">

          {/* Calculator Card */}
          <div className="bg-black/50 border border-cyan-500/30 rounded-2xl p-4 sm:p-5 space-y-4 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-cyan-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Calculator className="w-4 h-4" /> Interactive Affiliate Yield Calculator
              </span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 font-bold">
                Tier Multiplier Active
              </span>
            </div>

            {/* Slider 1: Referral Count */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-400">Monthly Referrals:</span>
                <span className="text-cyan-400 font-bold text-sm">{referralCount} signups</span>
              </div>
              <input
                type="range"
                min="1"
                max="250"
                value={referralCount}
                onChange={(e) => setReferralCount(parseInt(e.target.value, 10))}
                className="w-full accent-cyan-400 h-2 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Slider 2: Selected Tier Level */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-slate-400">Your Subscription Tier:</span>
                <span className="text-emerald-400 font-bold uppercase">{selectedTierId}</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 font-mono text-[10px]">
                {[
                  { id: 'free', label: 'Free (10%)' },
                  { id: 'creator', label: 'Creator (20%)' },
                  { id: 'pro', label: 'Pro (35%)' },
                  { id: 'enterprise', label: 'Enterprise (50%)' },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTierId(t.id)}
                    className={`py-1.5 px-1 rounded-lg border text-center transition-all cursor-pointer font-bold ${
                      selectedTierId === t.id
                        ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-md shadow-cyan-500/20'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Results Display */}
            {calculationResult && (
              <div className="p-3.5 rounded-xl bg-black/80 border border-emerald-500/40 space-y-2 font-mono text-xs">
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                    <span className="text-[10px] text-slate-400 uppercase block">Monthly Recurring MRR:</span>
                    <span className="text-base font-black text-emerald-400">{calculationResult.formatted.monthly}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                    <span className="text-[10px] text-slate-400 uppercase block">Annual Projected Yield:</span>
                    <span className="text-base font-black text-cyan-300">{calculationResult.formatted.annual}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-white/10 text-[11px]">
                  <span className="text-slate-400">Direct Signup Bonus:</span>
                  <span className="text-white font-bold">{calculationResult.formatted.directBonus}</span>
                </div>
                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-400">3-Year Compound Value:</span>
                  <span className="text-emerald-300 font-bold">{calculationResult.formatted.threeYear}</span>
                </div>
              </div>
            )}
          </div>

          {/* Quick Subscription Tier Cards */}
          <div className="space-y-2">
            <span className="text-xs font-mono text-slate-400 font-bold uppercase tracking-wider block">
              Quick Upgrade Tiers:
            </span>

            <div className="grid grid-cols-2 gap-2 font-mono text-xs">
              {[
                { id: 'creator', name: 'Creator', price: '$29/mo', desc: '20% Comm + Voice AI' },
                { id: 'pro', name: 'Pro', price: '$149/mo', desc: '35% Comm + 12 AI Modules' },
              ].map((card) => (
                <div key={card.id} className="p-3 rounded-xl bg-black/40 border border-white/10 flex flex-col justify-between space-y-2">
                  <div>
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-white">{card.name}</span>
                      <span className="text-[10px] text-cyan-300 font-bold">{card.price}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">{card.desc}</p>
                  </div>

                  <button
                    onClick={() => {
                      setCheckoutPlanId(card.id);
                      setCheckoutModalOpen(true);
                    }}
                    className="w-full py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-200 text-[10px] font-bold uppercase transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    <CreditCard className="w-3 h-3" />
                    <span>Checkout →</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Section: Gemini Flash Voice Chat Stream (7 Cols) */}
        <div className="lg:col-span-7 flex flex-col h-[480px] bg-black/50 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-md">

          {/* Stream Header */}
          <div className="p-3 bg-white/5 border-b border-white/10 flex items-center justify-between font-mono text-xs text-slate-400">
            <span className="flex items-center gap-1.5 text-cyan-300 font-bold">
              <Bot className="w-4 h-4 text-emerald-400" /> Conversational Copilot Stream
            </span>
            <span className="text-[10px] text-slate-500">
              State: <strong className="text-emerald-400 uppercase">{speechState}</strong>
            </span>
          </div>

          {/* Chat Transcript */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 font-mono text-xs">
            {messages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <div key={m.id} className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-[10px] shrink-0 ${
                    isUser ? 'bg-purple-600 text-white' : 'bg-gradient-to-tr from-cyan-400 to-emerald-400 text-slate-950 font-black'
                  }`}>
                    {isUser ? 'YOU' : 'AI'}
                  </div>

                  <div className={`max-w-[85%] p-3 rounded-2xl space-y-2 ${
                    isUser
                      ? 'bg-purple-600/30 border border-purple-500/40 text-white'
                      : 'bg-white/5 border border-white/10 text-slate-200'
                  }`}>
                    <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>

                    {m.triggerCheckout && (
                      <button
                        onClick={() => {
                          setCheckoutPlanId(m.planId || 'creator');
                          setCheckoutModalOpen(true);
                        }}
                        className="mt-2 w-full py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-black font-mono text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/20 hover:scale-[1.02] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>Open Instant Checkout ({m.planId || 'Creator'}) →</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex items-center gap-2 text-slate-400 italic">
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <span>Gemini Flash is analyzing pricing & earnings calculations...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          <div className="p-2 bg-black/60 border-t border-white/5 flex items-center gap-1.5 overflow-x-auto font-mono text-[10px]">
            {[
              'Compare Creator vs Pro',
              'Calculate 50 referrals',
              'Open Creator Checkout',
              'What is Enterprise price?',
            ].map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleSendMessage(prompt)}
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-400/40 text-slate-300 hover:text-cyan-200 whitespace-nowrap transition-all cursor-pointer"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input Bar */}
          <div className="p-3 bg-black/80 border-t border-white/10 flex items-center gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              placeholder="Ask about tiers, calculations, or tell me to upgrade..."
              className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 font-mono text-xs text-white focus:outline-none focus:border-cyan-400"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={!inputMessage.trim() || loading}
              className="p-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-bold disabled:opacity-50 transition-all cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

        </div>

      </div>

      {/* Instant Checkout Modal */}
      <SalesCheckoutModal
        isOpen={checkoutModalOpen}
        onClose={() => setCheckoutModalOpen(false)}
        selectedPlanId={checkoutPlanId}
      />
    </div>
  );
};
