import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { SyndicateChannel, SyndicateMessage } from '../../types';
import { encryptSyndicateMessage, decryptSyndicateMessage } from '../utils/syndicateE2EE';
import {
  MessageSquare, Volume2, Lock, Unlock, Send,
  Mic, MicOff, VolumeX, Shield, ShieldAlert, Zap,
  Users, Sparkles, Check, PhoneOff, Radio
} from 'lucide-react';

interface SyndicateChatVoiceProps {
  syndicateId: string;
  syndicateName: string;
  syndicateTag: string;
}

interface DecryptedMessage extends SyndicateMessage {
  plainText?: string;
}

export const SyndicateChatVoice: React.FC<SyndicateChatVoiceProps> = ({
  syndicateId,
  syndicateName,
  syndicateTag,
}) => {
  const { token, user } = useAuth();

  // State
  const [channels, setChannels] = useState<SyndicateChannel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<SyndicateChannel | null>(null);
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [newMessageText, setNewMessageText] = useState<string>('');
  const [isWsConnected, setIsWsConnected] = useState<boolean>(false);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState<string | null>(null);
  const [isLoadingChannels, setIsLoadingChannels] = useState<boolean>(true);
  const [userWealthTier, setUserWealthTier] = useState<{ level: number; tier_title: string }>({
    level: user?.level || 1,
    tier_title: user?.tier_title || 'Novice Plug',
  });

  // Voice State
  const [activeVoiceChannel, setActiveVoiceChannel] = useState<SyndicateChannel | null>(null);
  const [voiceMembers, setVoiceMembers] = useState<Array<{ user_id: string; display_name: string; tier_title: string; level: number; voiceState?: any }>>([]);
  const [isMicMuted, setIsMicMuted] = useState<boolean>(false);
  const [isDeafened, setIsDeafened] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const messageEndRef = useRef<HTMLDivElement | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localAudioStreamRef = useRef<MediaStream | null>(null);
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Fetch Channels
  const fetchChannels = async () => {
    setIsLoadingChannels(true);
    try {
      const res = await fetch(`/api/syndicates/${syndicateId}/channels`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          setChannels(json.data);
          if (json.user_wealth_tier) {
            setUserWealthTier(json.user_wealth_tier);
          }
          // Select default general chat
          if (!selectedChannel && json.data.length > 0) {
            const firstUnlockedChat = json.data.find((c: SyndicateChannel) => c.type === 'chat' && c.unlocked);
            setSelectedChannel(firstUnlockedChat || json.data[0]);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load syndicate channels:', err);
    } finally {
      setIsLoadingChannels(false);
    }
  };

  useEffect(() => {
    if (token && syndicateId) {
      fetchChannels();
    }
  }, [token, syndicateId]);

  // WebSocket Connection Lifecycle
  useEffect(() => {
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname === 'localhost' ? 'localhost:3001' : window.location.host;
    const wsUrl = `${protocol}//${host}/ws/syndicates?token=${encodeURIComponent(token)}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsWsConnected(true);
      ws.send(JSON.stringify({ type: 'session_init', token }));
    };

    ws.onmessage = async (evt) => {
      try {
        const frame = JSON.parse(evt.data);

        switch (frame.type) {
          case 'session_ready': {
            if (frame.channels) setChannels(frame.channels);
            break;
          }

          case 'channel_joined': {
            setAccessDeniedMessage(null);
            if (frame.members) {
              setVoiceMembers(frame.members);
            }
            break;
          }

          case 'access_denied': {
            setAccessDeniedMessage(frame.message || 'Access denied: Wealth Tier requirement not met.');
            break;
          }

          case 'message': {
            const msg: SyndicateMessage = frame.message;
            if (selectedChannel && msg.channel_id === selectedChannel.id) {
              const decrypted = await decryptSyndicateMessage(msg.encrypted_content, msg.channel_id);
              setMessages((prev) => [...prev, { ...msg, plainText: decrypted }]);
            }
            break;
          }

          case 'user_joined': {
            if (activeVoiceChannel && frame.channel_id === activeVoiceChannel.id) {
              setVoiceMembers((prev) => {
                if (prev.some((m) => m.user_id === frame.user_id)) return prev;
                return [...prev, { user_id: frame.user_id, display_name: frame.display_name, tier_title: frame.tier_title, level: frame.level }];
              });
              // Initiate WebRTC offer if in voice channel
              if (localAudioStreamRef.current) {
                createWebRtcOffer(frame.user_id, frame.channel_id);
              }
            }
            break;
          }

          case 'user_left': {
            setVoiceMembers((prev) => prev.filter((m) => m.user_id !== frame.user_id));
            closePeerConnection(frame.user_id);
            break;
          }

          case 'webrtc_offer': {
            handleWebRtcOffer(frame.sender_user_id, frame.channel_id, frame.offer);
            break;
          }

          case 'webrtc_answer': {
            handleWebRtcAnswer(frame.sender_user_id, frame.answer);
            break;
          }

          case 'webrtc_candidate': {
            handleWebRtcCandidate(frame.sender_user_id, frame.candidate);
            break;
          }

          case 'voice_state_update': {
            setVoiceMembers((prev) =>
              prev.map((m) =>
                m.user_id === frame.user_id
                  ? { ...m, voiceState: { isMuted: frame.is_muted, isDeafened: frame.is_deafened, isSpeaking: frame.is_speaking } }
                  : m
              )
            );
            break;
          }
        }
      } catch (e) {
        console.error('[SyndicateWS] Frame parse error:', e);
      }
    };

    ws.onclose = () => {
      setIsWsConnected(false);
    };

    ws.onerror = () => {
      setIsWsConnected(false);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      leaveVoiceRoom();
    };
  }, [token, syndicateId]);

  // Handle Channel Switch
  useEffect(() => {
    if (!selectedChannel || !token || !isWsConnected) return;

    if (selectedChannel.type === 'chat') {
      setAccessDeniedMessage(null);
      // Fetch channel message history
      fetch(`/api/syndicates/channels/${selectedChannel.id}/messages`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.json())
        .then(async (json) => {
          if (json.success && json.data) {
            const decryptedList = await Promise.all(
              json.data.map(async (msg: SyndicateMessage) => ({
                ...msg,
                plainText: await decryptSyndicateMessage(msg.encrypted_content, msg.channel_id),
              }))
            );
            setMessages(decryptedList);
          } else if (json.error) {
            setAccessDeniedMessage(json.error);
            setMessages([]);
          }
        })
        .catch(() => setMessages([]));

      // Join channel over WS
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'join_channel', channel_id: selectedChannel.id }));
      }
    }
  }, [selectedChannel, token, isWsConnected]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // WebRTC Helper Functions
  const createWebRtcOffer = async (targetUserId: string, channelId: string) => {
    try {
      const pc = getOrCreatePeerConnection(targetUserId, channelId);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'webrtc_offer',
            channel_id: channelId,
            target_user_id: targetUserId,
            offer,
          })
        );
      }
    } catch (err) {
      console.error('WebRTC offer failed:', err);
    }
  };

  const handleWebRtcOffer = async (senderUserId: string, channelId: string, offer: any) => {
    try {
      const pc = getOrCreatePeerConnection(senderUserId, channelId);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'webrtc_answer',
            channel_id: channelId,
            target_user_id: senderUserId,
            answer,
          })
        );
      }
    } catch (err) {
      console.error('WebRTC offer handling failed:', err);
    }
  };

  const handleWebRtcAnswer = async (senderUserId: string, answer: any) => {
    const pc = peerConnectionsRef.current.get(senderUserId);
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  };

  const handleWebRtcCandidate = async (senderUserId: string, candidate: any) => {
    const pc = peerConnectionsRef.current.get(senderUserId);
    if (pc && candidate) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  };

  const getOrCreatePeerConnection = (targetUserId: string, channelId: string): RTCPeerConnection => {
    if (peerConnectionsRef.current.has(targetUserId)) {
      return peerConnectionsRef.current.get(targetUserId)!;
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    });

    if (localAudioStreamRef.current) {
      localAudioStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localAudioStreamRef.current!);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'webrtc_candidate',
            channel_id: channelId,
            target_user_id: targetUserId,
            candidate: event.candidate,
          })
        );
      }
    };

    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      let audioEl = audioElementsRef.current.get(targetUserId);
      if (!audioEl) {
        audioEl = new Audio();
        audioEl.autoplay = true;
        audioElementsRef.current.set(targetUserId, audioEl);
      }
      audioEl.srcObject = remoteStream;
    };

    peerConnectionsRef.current.set(targetUserId, pc);
    return pc;
  };

  const closePeerConnection = (userId: string) => {
    const pc = peerConnectionsRef.current.get(userId);
    if (pc) {
      pc.close();
      peerConnectionsRef.current.delete(userId);
    }
    const audioEl = audioElementsRef.current.get(userId);
    if (audioEl) {
      audioEl.srcObject = null;
      audioElementsRef.current.delete(userId);
    }
  };

  // Join Voice Channel
  const handleJoinVoiceChannel = async (channel: SyndicateChannel) => {
    if (!channel.unlocked) {
      setAccessDeniedMessage(`Access denied: Voice room "${channel.name}" requires Wealth Tier Badge [${channel.required_tier}] (Level ${channel.required_level}+).`);
      return;
    }

    try {
      leaveVoiceRoom();

      // Acquire microphone
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localAudioStreamRef.current = stream;
      } catch (micErr) {
        console.warn('Microphone access not granted:', micErr);
      }

      setActiveVoiceChannel(channel);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'join_channel', channel_id: channel.id }));
      }
    } catch (err) {
      console.error('Failed to join voice channel:', err);
    }
  };

  const leaveVoiceRoom = () => {
    if (activeVoiceChannel && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'leave_channel', channel_id: activeVoiceChannel.id }));
    }

    if (localAudioStreamRef.current) {
      localAudioStreamRef.current.getTracks().forEach((track) => track.stop());
      localAudioStreamRef.current = null;
    }

    peerConnectionsRef.current.forEach((pc) => pc.close());
    peerConnectionsRef.current.clear();

    audioElementsRef.current.forEach((audio) => {
      audio.srcObject = null;
    });
    audioElementsRef.current.clear();

    setActiveVoiceChannel(null);
    setVoiceMembers([]);
  };

  const handleToggleMic = () => {
    if (localAudioStreamRef.current) {
      const audioTrack = localAudioStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        const muted = !audioTrack.enabled;
        setIsMicMuted(muted);

        if (activeVoiceChannel && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(
            JSON.stringify({
              type: 'voice_state_update',
              channel_id: activeVoiceChannel.id,
              is_muted: muted,
              is_deafened: isDeafened,
              is_speaking: isSpeaking,
            })
          );
        }
      }
    }
  };

  const handleToggleDeafen = () => {
    const newDeafened = !isDeafened;
    setIsDeafened(newDeafened);
    audioElementsRef.current.forEach((audio) => {
      audio.muted = newDeafened;
    });

    if (activeVoiceChannel && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'voice_state_update',
          channel_id: activeVoiceChannel.id,
          is_muted: isMicMuted,
          is_deafened: newDeafened,
          is_speaking: isSpeaking,
        })
      );
    }
  };

  // Send Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessageText.trim() || !selectedChannel || !wsRef.current) return;

    if (!selectedChannel.unlocked) {
      setAccessDeniedMessage(`Access denied: Cannot send message. Requires Wealth Tier Badge [${selectedChannel.required_tier}].`);
      return;
    }

    const plainText = newMessageText.trim();
    setNewMessageText('');

    // Encrypt payload with E2EE Web Crypto API
    const encryptedContent = await encryptSyndicateMessage(plainText, selectedChannel.id);

    wsRef.current.send(
      JSON.stringify({
        type: 'send_message',
        channel_id: selectedChannel.id,
        encrypted_content: encryptedContent,
      })
    );
  };

  const chatChannels = useMemo(() => channels.filter((c) => c.type === 'chat'), [channels]);
  const voiceChannels = useMemo(() => channels.filter((c) => c.type === 'voice'), [channels]);

  return (
    <div className="bg-slate-950/90 border border-plug-border rounded-3xl overflow-hidden shadow-2xl flex flex-col lg:flex-row h-[680px]">
      {/* Sidebar: Channels List */}
      <div className="w-full lg:w-72 bg-slate-900/90 border-b lg:border-b-0 lg:border-r border-slate-800 p-4 flex flex-col justify-between shrink-0">
        <div className="space-y-5 overflow-y-auto pr-1">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-plug-accent/20 border border-plug-accent/40 text-plug-accent text-[10px] font-mono font-bold">
                [{syndicateTag}]
              </span>
              <h3 className="font-black text-white text-sm truncate">{syndicateName}</h3>
            </div>
            <div className={`w-2.5 h-2.5 rounded-full ${isWsConnected ? 'bg-emerald-400 shadow-lg shadow-emerald-400/50' : 'bg-red-500'}`} />
          </div>

          {/* User Wealth Tier Badge */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-400 to-yellow-600 flex items-center justify-center text-slate-950 font-black text-xs">
              ⚡
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-mono uppercase text-slate-400">Your Wealth Tier</div>
              <div className="text-xs font-bold text-white truncate">{userWealthTier.tier_title}</div>
              <div className="text-[10px] text-plug-accent font-mono">Level {userWealthTier.level} Operative</div>
            </div>
          </div>

          {/* Text Channels Group */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-mono uppercase text-slate-500 font-bold px-2 tracking-wider">
              Text Vaults
            </div>
            {chatChannels.map((channel) => {
              const isSelected = selectedChannel?.id === channel.id;
              return (
                <button
                  key={channel.id}
                  onClick={() => {
                    if (channel.unlocked) {
                      setSelectedChannel(channel);
                    } else {
                      setAccessDeniedMessage(
                        `🔒 Access Denied: "${channel.name}" requires Wealth Tier Badge [${channel.required_tier}] (Level ${channel.required_level}+).`
                      );
                    }
                  }}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl font-mono text-xs transition-all ${
                    isSelected
                      ? 'bg-plug-accent/20 border border-plug-accent/50 text-plug-accent font-bold shadow-sm'
                      : channel.unlocked
                      ? 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                      : 'text-slate-500 bg-slate-950/40 border border-slate-800/40 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">#{channel.name}</span>
                  </div>

                  {channel.unlocked ? (
                    <Unlock className="w-3 h-3 text-emerald-400 shrink-0" />
                  ) : (
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-bold">
                        {channel.required_tier.split(' ')[0]}
                      </span>
                      <Lock className="w-3 h-3 text-amber-400" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Voice Channels Group */}
          <div className="space-y-1.5">
            <div className="text-[10px] font-mono uppercase text-slate-500 font-bold px-2 tracking-wider">
              WebRTC Voice Rooms
            </div>
            {voiceChannels.map((channel) => {
              const isVoiceConnected = activeVoiceChannel?.id === channel.id;
              return (
                <button
                  key={channel.id}
                  onClick={() => handleJoinVoiceChannel(channel)}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl font-mono text-xs transition-all ${
                    isVoiceConnected
                      ? 'bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 font-bold shadow-md shadow-emerald-500/10'
                      : channel.unlocked
                      ? 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                      : 'text-slate-500 bg-slate-950/40 border border-slate-800/40 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Volume2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                    <span className="truncate">{channel.name}</span>
                  </div>

                  {isVoiceConnected ? (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                  ) : channel.unlocked ? (
                    <Unlock className="w-3 h-3 text-emerald-400 shrink-0" />
                  ) : (
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-bold">
                        {channel.required_tier.split(' ')[0]}
                      </span>
                      <Lock className="w-3 h-3 text-amber-400" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Voice Control Bar */}
        {activeVoiceChannel && (
          <div className="bg-slate-950 border border-emerald-500/40 rounded-2xl p-3 space-y-2 mt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                <span className="text-xs font-mono font-bold text-emerald-300 truncate">
                  {activeVoiceChannel.name}
                </span>
              </div>
              <button
                onClick={leaveVoiceRoom}
                className="w-7 h-7 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 flex items-center justify-center transition-colors"
                title="Leave Voice Channel"
              >
                <PhoneOff className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center justify-center gap-2 pt-1 border-t border-slate-800">
              <button
                onClick={handleToggleMic}
                className={`p-2 rounded-xl text-xs font-mono flex items-center gap-1.5 transition-all ${
                  isMicMuted
                    ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
              >
                {isMicMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
                <span>{isMicMuted ? 'Muted' : 'Mic On'}</span>
              </button>

              <button
                onClick={handleToggleDeafen}
                className={`p-2 rounded-xl text-xs font-mono flex items-center gap-1.5 transition-all ${
                  isDeafened
                    ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
              >
                <VolumeX className="w-3.5 h-3.5" />
                <span>{isDeafened ? 'Deafened' : 'Audio On'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main View Area */}
      <div className="flex-1 flex flex-col justify-between bg-slate-950/60 p-4 sm:p-6 relative">
        {/* Token Gate Lock Warning Banner */}
        {accessDeniedMessage && (
          <div className="absolute top-4 left-4 right-4 z-20 bg-amber-950/90 border border-amber-500/60 p-3.5 rounded-2xl backdrop-blur-md flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-200 text-xs font-mono text-amber-200 shadow-xl">
            <Lock className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="flex-1">{accessDeniedMessage}</span>
            <button
              onClick={() => setAccessDeniedMessage(null)}
              className="text-amber-400 hover:text-white font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* Chat / Voice Room Header */}
        {selectedChannel && (
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white font-mono flex items-center gap-2">
                  <span>#{selectedChannel.name}</span>
                  {selectedChannel.unlocked ? (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px]">
                      Unlocked
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px]">
                      Gated [{selectedChannel.required_tier}]
                    </span>
                  )}
                </h2>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{selectedChannel.description}</p>
            </div>

            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-xl text-xs font-mono text-slate-300">
              <Shield className="w-3.5 h-3.5 text-plug-accent" />
              <span>E2EE AES-GCM Encrypted</span>
            </div>
          </div>
        )}

        {/* WebRTC Active Voice Members Overlay */}
        {activeVoiceChannel && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 mb-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-mono font-bold text-white flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-emerald-400" />
                <span>WebRTC Voice Room Peers ({voiceMembers.length})</span>
              </div>
              <span className="text-[10px] font-mono text-emerald-400">● Live Audio Active</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {voiceMembers.map((member) => (
                <div
                  key={member.user_id}
                  className={`p-2.5 rounded-xl border flex items-center gap-2.5 font-mono text-xs transition-all ${
                    member.voiceState?.isSpeaking
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 ring-2 ring-emerald-400/50'
                      : 'bg-slate-950 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-500 to-indigo-500 flex items-center justify-center font-black text-white text-xs shrink-0">
                    {member.display_name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold truncate text-white">{member.display_name}</div>
                    <div className="text-[9px] text-slate-400 truncate">{member.tier_title}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chat Messages Stream */}
        <div className="flex-1 overflow-y-auto space-y-3 py-4 pr-1">
          {messages.length > 0 ? (
            messages.map((msg, idx) => {
              const isSelf = msg.sender_id === user?.id;
              return (
                <div
                  key={msg.id || idx}
                  className={`flex flex-col space-y-1 ${isSelf ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                    <span className="font-bold text-white">{msg.sender_name || 'Operative'}</span>
                    <span className="px-1.5 py-0.2 rounded bg-slate-800 text-plug-accent">
                      {msg.sender_tier || 'Novice Plug'}
                    </span>
                    <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>

                  <div
                    className={`p-3 rounded-2xl max-w-md text-xs font-mono leading-relaxed shadow-md ${
                      isSelf
                        ? 'bg-gradient-to-r from-emerald-600 to-plug-accent text-plug-dark font-medium rounded-tr-none'
                        : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-tl-none'
                    }`}
                  >
                    {msg.plainText}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-16 text-slate-500 font-mono text-xs space-y-2">
              <ShieldAlert className="w-8 h-8 mx-auto text-slate-600" />
              <div>No end-to-end encrypted messages in #{selectedChannel?.name || 'channel'} yet.</div>
              <p className="text-[10px] text-slate-600">
                Messages sent here are encrypted client-side using Web Crypto AES-GCM before transmission.
              </p>
            </div>
          )}
          <div ref={messageEndRef} />
        </div>

        {/* E2EE Message Composer */}
        <form onSubmit={handleSendMessage} className="pt-3 border-t border-slate-800 flex items-center gap-3">
          <input
            type="text"
            disabled={!selectedChannel?.unlocked}
            placeholder={
              selectedChannel?.unlocked
                ? `Send E2EE message to #${selectedChannel.name}...`
                : `🔒 Token-gated channel (Requires Wealth Tier [${selectedChannel?.required_tier}])`
            }
            value={newMessageText}
            onChange={(e) => setNewMessageText(e.target.value)}
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-plug-accent disabled:bg-slate-950 disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={!newMessageText.trim() || !selectedChannel?.unlocked}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-plug-accent text-plug-dark font-mono text-xs font-black hover:scale-105 transition-all shadow-md shadow-plug-accent/20 disabled:opacity-50 disabled:hover:scale-100 flex items-center gap-1.5 shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
