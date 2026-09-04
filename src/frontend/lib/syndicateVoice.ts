/**
 * WebRTC Audio Channel Manager for Token-Gated Syndicate Voice Rooms
 * Path: src/frontend/lib/syndicateVoice.ts
 */

export interface VoicePeer {
  userId: string;
  userName: string;
  tier: any;
  pc: RTCPeerConnection | null;
  audioElement?: HTMLAudioElement;
  isMuted: boolean;
  isSpeaking: boolean;
}

export type VoiceEventCallback = (event: 'peers_change' | 'local_mute' | 'speaking' | 'error', data?: any) => void;

export class SyndicateVoiceClient {
  private localStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micVolumeInterval: any = null;
  private isMuted: boolean = false;
  private isSpeaking: boolean = false;
  private peers = new Map<string, VoicePeer>();
  private sendSignalCallback: ((signalType: string, targetUserId: string | undefined, signalData: any) => void) | null = null;
  private eventListeners: VoiceEventCallback[] = [];

  constructor() {}

  public setSignalSender(fn: (signalType: string, targetUserId: string | undefined, signalData: any) => void) {
    this.sendSignalCallback = fn;
  }

  public onEvent(callback: VoiceEventCallback) {
    this.eventListeners.push(callback);
  }

  private emit(event: 'peers_change' | 'local_mute' | 'speaking' | 'error', data?: any) {
    this.eventListeners.forEach((cb) => cb(event, data));
  }

  public async startMicrophone(): Promise<boolean> {
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn('[SyndicateVoice] mediaDevices.getUserMedia not supported in this environment');
        return false;
      }

      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: fontNoiseSuppression(),
          autoGainControl: true,
        },
        video: false,
      });

      this.setupActiveSpeakerDetection();
      return true;
    } catch (err: any) {
      console.warn('[SyndicateVoice] Microphone access error:', err.message);
      this.emit('error', 'Microphone access denied or unavailable.');
      return false;
    }
  }

  private setupActiveSpeakerDetection() {
    if (!this.localStream) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(this.localStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      source.connect(this.analyser);

      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);

      this.micVolumeInterval = setInterval(() => {
        if (!this.analyser || this.isMuted) {
          if (this.isSpeaking) {
            this.isSpeaking = false;
            this.emit('speaking', { isSpeaking: false });
          }
          return;
        }

        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        const nowSpeaking = average > 25;

        if (nowSpeaking !== this.isSpeaking) {
          this.isSpeaking = nowSpeaking;
          this.emit('speaking', { isSpeaking: nowSpeaking });
        }
      }, 150);
    } catch (e) {
      console.warn('[SyndicateVoice] Active speaker detection failed to initialize:', e);
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !this.isMuted;
      });
    }
    this.emit('local_mute', { isMuted: this.isMuted });
    return this.isMuted;
  }

  public async initiatePeerConnection(targetUserId: string, targetUserName: string, targetTier: any, createOffer: boolean): Promise<RTCPeerConnection | null> {
    if (typeof window === 'undefined' || !('RTCPeerConnection' in window)) {
      return null;
    }

    try {
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      });

      // Add local tracks to PeerConnection
      if (this.localStream) {
        this.localStream.getTracks().forEach((track) => {
          pc.addTrack(track, this.localStream!);
        });
      }

      // Handle incoming ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate && this.sendSignalCallback) {
          this.sendSignalCallback('ice_candidate', targetUserId, event.candidate);
        }
      };

      // Handle remote audio stream track
      pc.ontrack = (event) => {
        let audioEl = document.getElementById(`audio_peer_${targetUserId}`) as HTMLAudioElement;
        if (!audioEl) {
          audioEl = document.createElement('audio');
          audioEl.id = `audio_peer_${targetUserId}`;
          audioEl.autoplay = true;
          audioEl.style.display = 'none';
          document.body.appendChild(audioEl);
        }
        audioEl.srcObject = event.streams[0];
      };

      const peerRecord: VoicePeer = {
        userId: targetUserId,
        userName: targetUserName,
        tier: targetTier,
        pc,
        isMuted: false,
        isSpeaking: false,
      };

      this.peers.set(targetUserId, peerRecord);
      this.emit('peers_change', Array.from(this.peers.values()));

      if (createOffer && this.sendSignalCallback) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this.sendSignalCallback('offer', targetUserId, offer);
      }

      return pc;
    } catch (e: any) {
      console.warn('[SyndicateVoice] Failed to create RTCPeerConnection:', e);
      return null;
    }
  }

  public async handleIncomingSignal(senderId: string, senderName: string, senderTier: any, signalType: 'offer' | 'answer' | 'ice_candidate' | 'voice_state', signalData: any) {
    let peer = this.peers.get(senderId);

    if (signalType === 'offer') {
      let pc = peer?.pc;
      if (!pc) {
        pc = await this.initiatePeerConnection(senderId, senderName, senderTier, false);
      }
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(signalData));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        if (this.sendSignalCallback) {
          this.sendSignalCallback('answer', senderId, answer);
        }
      }
    } else if (signalType === 'answer' && peer && peer.pc) {
      await peer.pc.setRemoteDescription(new RTCSessionDescription(signalData));
    } else if (signalType === 'ice_candidate' && peer && peer.pc) {
      try {
        await peer.pc.addIceCandidate(new RTCIceCandidate(signalData));
      } catch (e) {
        console.warn('[SyndicateVoice] Error adding ICE candidate:', e);
      }
    }
  }

  public removePeer(userId: string) {
    const peer = this.peers.get(userId);
    if (peer) {
      if (peer.pc) {
        try { peer.pc.close(); } catch {}
      }
      const audioEl = document.getElementById(`audio_peer_${userId}`);
      if (audioEl) audioEl.remove();
      this.peers.delete(userId);
      this.emit('peers_change', Array.from(this.peers.values()));
    }
  }

  public getPeers(): VoicePeer[] {
    return Array.from(this.peers.values());
  }

  public leave() {
    if (this.micVolumeInterval) {
      clearInterval(this.micVolumeInterval);
      this.micVolumeInterval = null;
    }

    if (this.audioContext) {
      try { this.audioContext.close(); } catch {}
      this.audioContext = null;
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    this.peers.forEach((peer, userId) => {
      this.removePeer(userId);
    });

    this.peers.clear();
    this.eventListeners = [];
  }
}

function fontNoiseSuppression(): boolean {
  return true;
}
