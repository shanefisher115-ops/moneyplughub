import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Syndicate } from '../../types';
import { getChannelCryptoKey, encryptTextMessage, decryptTextMessage } from '../lib/syndicateCrypto';
import { SyndicateVoiceClient } from '../lib/syndicateVoice';
import {
  Shield, Lock, Mic, MicOff, Volume2, Send, Zap, Users,
  MessageSquare, Radio, Sparkles, CheckCircle2, AlertTriangle,
  ChevronRight, ArrowUpRight, Crown, Award, Key, RefreshCw
} from 'lucide-react';

interface ChannelItem {
  id: string;
  syndicate_id: string;
  name: string;
  type: 'text' | 'voice';
  min_wealth_tier: number;
  required_tier_name: string;
  required_tier_color: string;
  description: string;
  is_locked: boolean;
}

interface ChatMessageItem {
  id: string;
  syndicateId: string;
  channelId: string;
  senderId: string;
  senderName: string;
  senderTierLevel: number;
  senderTierName: string;
  senderTierColor: string;
  encryptedPayload: string;
  iv: string;
  createdAt: string;
  decryptedText?: string;
}

interface VoiceParticipant {
  userId: string;
  userName: string;
  tier: any;
  isMuted: boolean;
  isSpeaking: boolean;
}

interface SyndicateChatVoiceModalProps {
  syndicate: Syndicate;
  onClose: () => void;
  onNavigate?: (tab: string) => void;
}

export const SyndicateChatVoiceModal: React.FC<SyndicateChatVoiceModalProps> = ({
  syndicate,
  onClose,
  onNavigate,
}) => {
  const { user, token } = useAuth();

  // State
  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<ChannelItem | null>(null);
  const [userTier, setUserTier] = useState<any>(null);
  const [isLoadingChannels, setIsLoadingChannels] = useState<boolean>(true);

  // WebSocket State
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Messages State
  const [messages, setMessages] = useState<ChatMessageItem[]>([]);
  const [inputMessage, setInputMessage] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Voice State
  const [voiceParticipants, setVoiceParticipants] = useState<VoiceParticipant[]>([]);
  const [isMicMuted, setIsMicMuted] = useState<boolean>(false);
  const [isSelfSpeaking, setIsSelfSpeaking] = useState<boolean>(false);
  const voiceClientRef = useRef<SyndicateVoiceClient | null>(null);

  // Lock Banner State
  const [lockedChannelAttempt, setLockedChannelAttempt] = useState<ChannelItem | null>(null);

  // Fetch Channels on Mount
  useEffect(() => {
    fetchChannels();
    initWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (voiceClientRef.current) {
        voiceClientRef.current.leave();
      }
    };
  }, [syndicate.id, token]);

  const fetchChannels = async () => {
    setIsLoadingChannels(true);
    try {
      const res = await fetch(`/api/syndicates/${syndicate.id}/channels`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setChannels(data.data.channels);
          setUserTier(data.data.user_tier);

          // Default select first unlocked channel
          const firstUnlocked = data.data.channels.find((c: ChannelItem) => !c.is_locked);
          if (firstUnlocked) {
            setSelectedChannel(firstUnlocked);
          }
        }
      }
    } catch (err) {
      console.error('Failed to fetch syndicate channels:', err);
    } finally {
      setIsLoadingChannels(false);
    }
  };

  const initWebSocket = () => {
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/syndicate`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // Authenticate frame
      ws.send(JSON.stringify({
        type: 'auth',
        token,
        syndicateId: syndicate.id,
      }));
    };

    ws.onmessage = async (event) => {
      try {
        const frame = JSON.parse(event.data);
        await handleServerFrame(frame);
      } catch (err) {
        console.error('Error handling WebSocket frame:', err);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
    };

    ws.onerror = (err) => {
      console.warn('Syndicate WebSocket error:', err);
    };
  };

  const handleServerFrame = async (frame: any) => {
    switch (frame.type) {
      case 'auth_success':
        setIsConnected(true);
        setAuthError(null);
        if (selectedChannel && !selectedChannel.is_locked) {
          joinChannelWs(selectedChannel.id);
        }
        break;

      case 'access_denied':
        setAuthError(frame.message);
        break;

      case 'channel_joined':
        setVoiceParticipants(frame.activeUsers || []);
        if (selectedChannel && selectedChannel.type === 'text') {
          fetchMessageHistory(selectedChannel.id);
        } else if (selectedChannel && selectedChannel.type === 'voice') {
          initVoiceWebRtc();
        }
        break;

      case 'chat_message':
        await handleIncomingChatMessage(frame.message);
        break;

      case 'user_joined':
        setVoiceParticipants((prev) => {
          if (prev.some((u) => u.userId === frame.user.userId)) return prev;
          return [...prev, { ...frame.user, isMuted: false, isSpeaking: false }];
        });
        break;

      case 'user_left':
        setVoiceParticipants((prev) => prev.filter((u) => u.userId !== frame.userId));
        if (voiceClientRef.current) {
          voiceClientRef.current.removePeer(frame.userId);
        }
        break;

      case 'voice_presence_update':
        setVoiceParticipants(frame.users || []);
        break;

      case 'webrtc_signal':
        if (voiceClientRef.current) {
          await voiceClientRef.current.handleIncomingSignal(
            frame.senderId,
            frame.senderName,
            frame.senderTier,
            frame.signalType,
            frame.signalData
          );
        }
        break;

      case 'error':
        console.warn('Syndicate WS Server Error:', frame.message);
        break;
    }
  };

  const joinChannelWs = (channelId: string) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'join_channel',
        channelId,
      }));
    }
  };

  const fetchMessageHistory = async (channelId: string) => {
    try {
      const res = await fetch(`/api/syndicates/${syndicate.id}/channels/${channelId}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data.messages) {
          const key = await getChannelCryptoKey(syndicate.id, channelId);
          const decryptedMsgs = await Promise.all(
            data.data.messages.map(async (m: any) => {
              const text = await decryptTextMessage(m.encrypted_payload, m.iv, key);
              return {
                id: m.id,
                syndicateId: m.syndicate_id,
                channelId: m.channel_id,
                senderId: m.sender_id,
                senderName: m.sender_name,
                senderTierLevel: m.sender_tier_level,
                senderTierName: m.sender_tier_name,
                senderTierColor: m.sender_tier_color,
                encryptedPayload: m.encrypted_payload,
                iv: m.iv,
                createdAt: m.created_at,
                decryptedText: text,
              };
            })
          );
          setMessages(decryptedMsgs);
          scrollToBottom();
        }
      }
    } catch (err) {
      console.error('Failed to load channel history:', err);
    }
  };

  const handleIncomingChatMessage = async (msg: any) => {
    if (!selectedChannel || selectedChannel.id !== msg.channelId) return;

    const key = await getChannelCryptoKey(syndicate.id, msg.channelId);
    const text = await decryptTextMessage(msg.encryptedPayload, msg.iv, key);

    const decryptedMsg: ChatMessageItem = {
      ...msg,
      decryptedText: text,
    };

    setMessages((prev) => [...prev, decryptedMsg]);
    scrollToBottom();
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !selectedChannel || selectedChannel.is_locked || isSending) return;

    setIsSending(true);
    try {
      const key = await getChannelCryptoKey(syndicate.id, selectedChannel.id);
      const { ciphertext, iv } = await encryptTextMessage(inputMessage.trim(), key);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'send_message',
          channelId: selectedChannel.id,
          encryptedPayload: ciphertext,
          iv,
        }));
        setInputMessage('');
      }
    } catch (err) {
      console.error('Failed to encrypt/send message:', err);
    } finally {
      setIsSending(false);
    }
  };

  const initVoiceWebRtc = async () => {
    if (!voiceClientRef.current) {
      voiceClientRef.current = new SyndicateVoiceClient();
      voiceClientRef.current.setSignalSender((signalType, targetUserId, signalData) => {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && selectedChannel) {
          wsRef.current.send(JSON.stringify({
            type: 'webrtc_signal',
            channelId: selectedChannel.id,
            targetUserId,
            signalType,
            signalData,
          }));
        }
      });

      voiceClientRef.current.onEvent((event, data) => {
        if (event === 'local_mute') {
          setIsMicMuted(data.isMuted);
          broadcastVoiceState(data.isMuted, isSelfSpeaking);
        } else if (event === 'speaking') {
          setIsSelfSpeaking(data.isSpeaking);
          broadcastVoiceState(isMicMuted, data.isSpeaking);
        }
      });
    }

    await voiceClientRef.current.startMicrophone();
  };

  const broadcastVoiceState = (isMuted: boolean, isSpeaking: boolean) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && selectedChannel) {
      wsRef.current.send(JSON.stringify({
        type: 'voice_state',
        channelId: selectedChannel.id,
        isMuted,
        isSpeaking,
      }));
    }
  };

  const toggleMic = () => {
    if (voiceClientRef.current) {
      const muted = voiceClientRef.current.toggleMute();
      setIsMicMuted(muted);
    }
  };

  const handleChannelSelect = (ch: ChannelItem) => {
    if (ch.is_locked) {
      setLockedChannelAttempt(ch);
      return;
    }

    setLockedChannelAttempt(null);
    setSelectedChannel(ch);
    setMessages([]);

    if (voiceClientRef.current && ch.type !== 'voice') {
      voiceClientRef.current.leave();
      voiceClientRef.current = null;
    }

    if (isConnected) {
      joinChannelWs(ch.id);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-3 sm:p-6">
      <div className="bg-slate-950 border border-plug-border rounded-3xl w-full max-w-6xl h-[88vh] flex flex-col overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-200">

        {/* Modal Top Header */}
        <div className="bg-slate-900/90 border-b border-slate-800 px-6 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-plug-accent text-plug-dark font-black flex items-center justify-center text-xl shadow-md">
              🛡️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-plug-accent/20 text-plug-accent border border-plug-accent/40 text-[10px] font-mono font-bold">
                  [{syndicate.tag}]
                </span>
                <span className="text-xs font-mono font-bold text-white">{syndicate.name}</span>
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  <Shield className="w-3 h-3" /> E2EE AES-GCM
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                Token-Gated Syndicate Chat & WebRTC Voice Rooms • Wealth Tier Gated
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {userTier && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono">
                <span className="text-slate-500">Your Badge:</span>
                <span className="font-bold" style={{ color: userTier.accentColor }}>
                  {userTier.name} (T{userTier.tier})
                </span>
              </div>
            )}
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center font-mono text-sm transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Main Body Grid */}
        <div className="flex-1 flex overflow-hidden">

          {/* Left Sidebar: Channel Directory */}
          <div className="w-64 sm:w-72 bg-slate-900/60 border-r border-slate-800/80 p-4 space-y-4 flex flex-col shrink-0 overflow-y-auto">
            <div>
              <div className="text-[10px] font-mono font-bold uppercase text-slate-500 tracking-wider mb-2">
                Syndicate Channels
              </div>

              {isLoadingChannels ? (
                <div className="text-xs font-mono text-slate-500 p-2">Loading channels...</div>
              ) : (
                <div className="space-y-1.5">
                  {channels.map((ch) => {
                    const isSelected = selectedChannel?.id === ch.id;

                    return (
                      <button
                        key={ch.id}
                        onClick={() => handleChannelSelect(ch)}
                        className={`w-full text-left p-2.5 rounded-xl text-xs font-mono transition-all flex items-center justify-between group ${
                          isSelected
                            ? 'bg-plug-accent/20 border border-plug-accent/50 text-white font-bold'
                            : ch.is_locked
                            ? 'bg-slate-950/40 text-slate-500 border border-slate-900 hover:border-slate-800'
                            : 'hover:bg-slate-800/60 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {ch.type === 'text' ? (
                            <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-plug-accent' : 'text-slate-400'}`} />
                          ) : (
                            <Radio className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-purple-400' : 'text-purple-400/70'}`} />
                          )}
                          <span className="truncate">{ch.name}</span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {ch.is_locked ? (
                            <span
                              className="px-1.5 py-0.5 rounded text-[9px] font-bold border flex items-center gap-1"
                              style={{
                                color: ch.required_tier_color,
                                borderColor: `${ch.required_tier_color}40`,
                                backgroundColor: `${ch.required_tier_color}10`,
                              }}
                            >
                              <Lock className="w-2.5 h-2.5" />
                              <span>T{ch.min_wealth_tier}</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-emerald-400 font-bold">T{ch.min_wealth_tier}+</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Connection Status Widget */}
            <div className="mt-auto pt-4 border-t border-slate-800/80 space-y-2 font-mono text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">WS Relay:</span>
                <span className={`font-bold flex items-center gap-1.5 ${isConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
                  <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                  {isConnected ? 'Connected' : 'Connecting...'}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-500">Encryption:</span>
                <span className="text-plug-accent font-bold">AES-256-GCM</span>
              </div>
            </div>
          </div>

          {/* Right Main Content Area */}
          <div className="flex-1 flex flex-col bg-slate-950 overflow-hidden relative">

            {/* Lock Banner Overlay if user attempted locked channel */}
            {lockedChannelAttempt ? (
              <div className="flex-1 p-8 flex flex-col items-center justify-center text-center space-y-4 max-w-lg mx-auto">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center text-3xl">
                  🔒
                </div>

                <div>
                  <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-mono font-bold uppercase">
                    Wealth Tier Gate Locked
                  </span>
                  <h3 className="text-xl font-bold text-white mt-2">
                    #{lockedChannelAttempt.name} Required: {lockedChannelAttempt.required_tier_name}
                  </h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                    Access to this syndicate {lockedChannelAttempt.type === 'voice' ? 'voice room' : 'chat channel'} is restricted to creators with <strong style={{ color: lockedChannelAttempt.required_tier_color }}>Tier {lockedChannelAttempt.min_wealth_tier} ({lockedChannelAttempt.required_tier_name})</strong> or higher.
                  </p>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 w-full text-left font-mono text-xs space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Your Current Tier:</span>
                    <span className="font-bold text-white">{userTier?.name || 'Tier 1'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Required Minimum Tier:</span>
                    <span className="font-bold" style={{ color: lockedChannelAttempt.required_tier_color }}>
                      {lockedChannelAttempt.required_tier_name}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => {
                    onClose();
                    if (onNavigate) onNavigate('net-worth');
                  }}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black font-mono text-xs shadow-lg hover:scale-105 transition-transform flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Elevate Net Worth to Ascend</span>
                </button>
              </div>
            ) : selectedChannel ? (
              <>
                {/* Active Channel Header */}
                <div className="bg-slate-900/50 border-b border-slate-800/80 px-6 py-3 flex items-center justify-between shrink-0 font-mono">
                  <div className="flex items-center gap-2.5">
                    {selectedChannel.type === 'text' ? (
                      <MessageSquare className="w-4 h-4 text-plug-accent" />
                    ) : (
                      <Radio className="w-4 h-4 text-purple-400 animate-pulse" />
                    )}
                    <span className="font-black text-white text-sm">#{selectedChannel.name}</span>
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-bold border"
                      style={{
                        color: selectedChannel.required_tier_color,
                        borderColor: `${selectedChannel.required_tier_color}40`,
                        backgroundColor: `${selectedChannel.required_tier_color}10`,
                      }}
                    >
                      {selectedChannel.required_tier_name} Badge Required
                    </span>
                  </div>

                  <div className="text-xs text-slate-400">
                    {selectedChannel.description}
                  </div>
                </div>

                {/* View: Text Chat Channel */}
                {selectedChannel.type === 'text' && (
                  <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Chat Messages Log */}
                    <div className="flex-1 p-6 overflow-y-auto space-y-4">
                      {messages.map((msg) => {
                        const isSelf = msg.senderId === user?.id;

                        return (
                          <div
                            key={msg.id}
                            className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'} space-y-1`}
                          >
                            <div className="flex items-center gap-2 text-xs font-mono">
                              <span className="font-bold text-slate-200">{msg.senderName}</span>
                              <span
                                className="px-2 py-0.2 rounded text-[9px] font-bold border"
                                style={{
                                  color: msg.senderTierColor,
                                  borderColor: `${msg.senderTierColor}40`,
                                  backgroundColor: `${msg.senderTierColor}15`,
                                }}
                              >
                                {msg.senderTierName}
                              </span>
                              <span className="text-[10px] text-slate-500">
                                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>

                            <div
                              className={`max-w-md p-3 rounded-2xl text-xs sm:text-sm font-sans space-y-1 shadow-md ${
                                isSelf
                                  ? 'bg-plug-accent/20 border border-plug-accent/40 text-slate-100 rounded-tr-none'
                                  : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'
                              }`}
                            >
                              <p>{msg.decryptedText || '[Decrypting E2EE Payload...]'}</p>
                              <div className="flex items-center justify-end gap-1 text-[9px] font-mono text-slate-400 opacity-70 pt-0.5">
                                <Shield className="w-2.5 h-2.5 text-plug-accent" />
                                <span>E2EE Encrypted</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Chat Message Input Bar */}
                    <form onSubmit={handleSendMessage} className="p-4 bg-slate-900/80 border-t border-slate-800 flex items-center gap-3">
                      <input
                        type="text"
                        placeholder={`Message #${selectedChannel.name} (AES-256 E2EE)...`}
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-plug-accent"
                      />
                      <button
                        type="submit"
                        disabled={isSending || !inputMessage.trim()}
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-plug-accent text-plug-dark font-black font-mono text-xs shadow-md shadow-plug-accent/20 hover:scale-105 transition-transform flex items-center gap-1.5 disabled:opacity-50"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Send</span>
                      </button>
                    </form>
                  </div>
                )}

                {/* View: WebRTC Voice Room Channel */}
                {selectedChannel.type === 'voice' && (
                  <div className="flex-1 flex flex-col p-6 space-y-6 overflow-y-auto">
                    <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-bold text-white flex items-center gap-2 font-mono">
                            <Radio className="w-5 h-5 text-purple-400 animate-pulse" />
                            WebRTC Audio Channel • #{selectedChannel.name}
                          </h3>
                          <p className="text-xs text-slate-400 font-mono mt-0.5">
                            Real-time encrypted audio channel restricted to verified Wealth Tier badge holders.
                          </p>
                        </div>

                        {/* Mic Controls */}
                        <div className="flex items-center gap-3">
                          <button
                            onClick={toggleMic}
                            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition-all ${
                              isMicMuted
                                ? 'bg-red-500/20 border border-red-500/40 text-red-300'
                                : 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                            }`}
                          >
                            {isMicMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                            <span>{isMicMuted ? 'Muted' : 'Mic Live'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Participant Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pt-4">
                        {voiceParticipants.map((p) => (
                          <div
                            key={p.userId}
                            className={`bg-slate-950 border rounded-2xl p-4 text-center space-y-2 relative transition-all ${
                              p.isSpeaking
                                ? 'border-purple-400/80 ring-2 ring-purple-400/40 shadow-lg shadow-purple-500/20'
                                : 'border-slate-800'
                            }`}
                          >
                            <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-500 text-white mx-auto flex items-center justify-center font-black text-xl shadow-md relative">
                              {p.userName.substring(0, 2).toUpperCase()}
                              {p.isMuted && (
                                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-red-600 text-white flex items-center justify-center text-[10px]">
                                  <MicOff className="w-3 h-3" />
                                </div>
                              )}
                            </div>

                            <div>
                              <div className="font-bold text-white text-xs truncate font-mono">{p.userName}</div>
                              <div
                                className="text-[10px] font-mono font-bold mt-0.5"
                                style={{ color: p.tier?.accentColor || '#00ff88' }}
                              >
                                {p.tier?.name || 'Emerald Tier'}
                              </div>
                            </div>
                          </div>
                        ))}

                        {voiceParticipants.length === 0 && (
                          <div className="col-span-full text-center py-12 text-xs font-mono text-slate-500">
                            Connecting audio peers... Speak freely in this channel.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
