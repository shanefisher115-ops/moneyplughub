import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { SyndicateVoiceClient, VoicePeer } from '../src/frontend/lib/syndicateVoice';

describe('SyndicateVoiceClient', () => {
  let originalDocument: any;
  let originalRTCPeerConnection: any;
  let originalRTCSessionDescription: any;
  let originalRTCIceCandidate: any;
  let originalAudioContext: any;
  let originalNavigatorDescriptor: PropertyDescriptor | undefined;

  let domElements: Map<string, { id: string; removed: boolean; remove: () => void; srcObject?: any; style?: any }>;
  let createdPeerConnections: MockRTCPeerConnection[];
  let stoppedTracks: MockMediaStreamTrack[];
  let closedAudioContexts: MockAudioContext[];

  class MockMediaStreamTrack {
    kind: string;
    enabled: boolean = true;
    stopped: boolean = false;
    constructor(kind: string = 'audio') {
      this.kind = kind;
    }
    stop() {
      this.stopped = true;
      stoppedTracks.push(this);
    }
  }

  class MockMediaStream {
    tracks: MockMediaStreamTrack[];
    constructor(tracks: MockMediaStreamTrack[] = [new MockMediaStreamTrack()]) {
      this.tracks = tracks;
    }
    getTracks() {
      return this.tracks;
    }
    getAudioTracks() {
      return this.tracks.filter((t) => t.kind === 'audio');
    }
  }

  class MockRTCPeerConnection {
    closeCalled = false;
    closeShouldThrow = false;
    onicecandidate: ((event: any) => void) | null = null;
    ontrack: ((event: any) => void) | null = null;

    addTrack(track: any, stream: any) {}
    async createOffer() {
      return { type: 'offer', sdp: 'mock_sdp' };
    }
    async setLocalDescription(desc: any) {}
    async setRemoteDescription(desc: any) {}
    async createAnswer() {
      return { type: 'answer', sdp: 'mock_sdp' };
    }
    async addIceCandidate(candidate: any) {}

    close() {
      this.closeCalled = true;
      if (this.closeShouldThrow) {
        throw new Error('PeerConnection close error');
      }
    }
  }

  class MockAudioContext {
    closed = false;
    closeShouldThrow = false;

    createMediaStreamSource(stream: any) {
      return {
        connect(target: any) {},
      };
    }
    createAnalyser() {
      return {
        fftSize: 512,
        frequencyBinCount: 256,
        getByteFrequencyData(array: Uint8Array) {
          array.fill(30); // simulates active audio
        },
      };
    }
    close() {
      this.closed = true;
      closedAudioContexts.push(this);
      if (this.closeShouldThrow) {
        throw new Error('AudioContext close error');
      }
    }
  }

  beforeEach(() => {
    originalDocument = (globalThis as any).document;
    originalRTCPeerConnection = (globalThis as any).RTCPeerConnection;
    originalRTCSessionDescription = (globalThis as any).RTCSessionDescription;
    originalRTCIceCandidate = (globalThis as any).RTCIceCandidate;
    originalAudioContext = (globalThis as any).AudioContext;
    originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

    domElements = new Map();
    createdPeerConnections = [];
    stoppedTracks = [];
    closedAudioContexts = [];

    (globalThis as any).window = globalThis;

    (globalThis as any).document = {
      getElementById: (id: string) => {
        return domElements.get(id) || null;
      },
      createElement: (tag: string) => {
        const el = {
          id: '',
          removed: false,
          style: {} as any,
          srcObject: null as any,
          autoplay: false,
          remove() {
            this.removed = true;
            if (this.id) {
              domElements.delete(this.id);
            }
          },
        };
        return el;
      },
      body: {
        appendChild: (el: any) => {
          if (el.id) {
            domElements.set(el.id, el);
          }
        },
      },
    };

    (globalThis as any).RTCPeerConnection = function () {
      const pc = new MockRTCPeerConnection();
      createdPeerConnections.push(pc);
      return pc;
    } as any;

    (globalThis as any).RTCSessionDescription = function (data: any) {
      return data;
    } as any;

    (globalThis as any).RTCIceCandidate = function (data: any) {
      return data;
    } as any;

    (globalThis as any).AudioContext = function () {
      const ac = new MockAudioContext();
      return ac;
    } as any;

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        mediaDevices: {
          getUserMedia: async (constraints: any) => {
            return new MockMediaStream();
          },
        },
      },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    (globalThis as any).document = originalDocument;
    (globalThis as any).RTCPeerConnection = originalRTCPeerConnection;
    (globalThis as any).RTCSessionDescription = originalRTCSessionDescription;
    (globalThis as any).RTCIceCandidate = originalRTCIceCandidate;
    (globalThis as any).AudioContext = originalAudioContext;

    if (originalNavigatorDescriptor) {
      Object.defineProperty(globalThis, 'navigator', originalNavigatorDescriptor);
    }
  });

  describe('removePeer', () => {
    it('should close peer connection, remove audio DOM element, delete peer from map, and emit peers_change event', async () => {
      const client = new SyndicateVoiceClient();
      let peersChangeEvents: VoicePeer[][] = [];
      client.onEvent((event, data) => {
        if (event === 'peers_change') {
          peersChangeEvents.push(data);
        }
      });

      // Initiate peer connection for user1
      const pc = await client.initiatePeerConnection('user1', 'Alice', 'gold', true);
      assert.ok(pc);
      assert.equal(client.getPeers().length, 1);

      // Simulate remote audio track arriving to trigger audio element creation
      const mockPc = createdPeerConnections[0];
      mockPc.ontrack!({ streams: [{ id: 'stream1' }] });

      const audioEl = (globalThis as any).document.getElementById('audio_peer_user1');
      assert.ok(audioEl, 'Audio DOM element should exist before removal');
      assert.equal(audioEl.removed, false);

      // Call removePeer
      client.removePeer('user1');

      // Assertions
      assert.equal(mockPc.closeCalled, true, 'RTCPeerConnection close() should be called');
      assert.equal(audioEl.removed, true, 'Audio DOM element should be removed');
      assert.equal((globalThis as any).document.getElementById('audio_peer_user1'), null);
      assert.equal(client.getPeers().length, 0, 'Peers map should no longer contain user1');
      assert.ok(peersChangeEvents.length >= 2, 'peers_change event should be emitted');
      assert.equal(peersChangeEvents[peersChangeEvents.length - 1].length, 0);
    });

    it('should handle missing audio DOM element gracefully', async () => {
      const client = new SyndicateVoiceClient();
      await client.initiatePeerConnection('user2', 'Bob', 'silver', false);

      const mockPc = createdPeerConnections[0];
      assert.equal(client.getPeers().length, 1);

      // Remove peer without creating audio DOM element first
      client.removePeer('user2');

      assert.equal(mockPc.closeCalled, true);
      assert.equal(client.getPeers().length, 0);
    });

    it('should catch and ignore errors thrown during peer.pc.close()', async () => {
      const client = new SyndicateVoiceClient();
      await client.initiatePeerConnection('user3', 'Charlie', 'bronze', false);

      const mockPc = createdPeerConnections[0];
      mockPc.closeShouldThrow = true;

      // Should not throw exception
      assert.doesNotThrow(() => {
        client.removePeer('user3');
      });

      assert.equal(mockPc.closeCalled, true);
      assert.equal(client.getPeers().length, 0);
    });

    it('should do nothing if peer userId does not exist', () => {
      const client = new SyndicateVoiceClient();
      let eventCount = 0;
      client.onEvent(() => eventCount++);

      client.removePeer('nonexistent');

      assert.equal(eventCount, 0);
      assert.equal(client.getPeers().length, 0);
    });
  });

  describe('leave', () => {
    it('should perform complete cleanup of local stream tracks, mic interval, audioContext, peers, and event listeners', async () => {
      const client = new SyndicateVoiceClient();

      let eventEmittedAfterLeave = false;
      client.onEvent(() => {
        eventEmittedAfterLeave = true;
      });

      // Start mic to create localStream and active speaker interval
      const micStarted = await client.startMicrophone();
      assert.ok(micStarted, 'startMicrophone should return true');

      // Add multiple peers
      await client.initiatePeerConnection('user1', 'Alice', 'gold', true);
      await client.initiatePeerConnection('user2', 'Bob', 'silver', true);

      // Create audio DOM element for user1
      createdPeerConnections[0].ontrack!({ streams: [{ id: 'stream1' }] });

      assert.equal(client.getPeers().length, 2);
      assert.equal(stoppedTracks.length, 0);

      // Call leave()
      client.leave();

      // Assertions
      assert.equal(stoppedTracks.length, 1, 'Local stream track should be stopped');
      assert.equal(stoppedTracks[0].stopped, true);

      assert.equal(closedAudioContexts.length, 1, 'AudioContext should be closed');
      assert.equal(closedAudioContexts[0].closed, true);

      assert.equal(createdPeerConnections[0].closeCalled, true, 'Peer 1 PC close should be called');
      assert.equal(createdPeerConnections[1].closeCalled, true, 'Peer 2 PC close should be called');

      assert.equal(client.getPeers().length, 0, 'Peers map should be cleared');

      // Check event listeners cleared
      eventEmittedAfterLeave = false;
      // Toggle mute to see if event listeners emit
      client.toggleMute();
      assert.equal(eventEmittedAfterLeave, false, 'Event listeners should have been cleared');
    });

    it('should safely execute leave() on an uninitialized client or when called multiple times', () => {
      const client = new SyndicateVoiceClient();

      assert.doesNotThrow(() => {
        client.leave();
        client.leave();
      });

      assert.equal(client.getPeers().length, 0);
    });

    it('should handle errors gracefully when closing AudioContext during leave', async () => {
      const client = new SyndicateVoiceClient();
      await client.startMicrophone();

      // Mock audioContext close to throw
      const acMock = closedAudioContexts.length > 0 ? closedAudioContexts[0] : null;
      if (acMock) {
        acMock.closeShouldThrow = true;
      }

      assert.doesNotThrow(() => {
        client.leave();
      });

      assert.equal(client.getPeers().length, 0);
    });
  });
});
