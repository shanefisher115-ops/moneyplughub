import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { db, recordAuditLog } from '../db';

export interface UnrealTelemetryState {
  connected: boolean;
  unrealInstanceId: string;
  fps: number;
  frameTimeMs: number;
  activeCamera: string;
  niagaraParticleCount: number;
  solfeggioFreqHz: number;
  physicsImpulseLevel: number;
  liquidGoldFlowRate: number;
  gravitationalConstant: number;
  subChamber: string;
  lastPingAt: string;
}

class UnrealBridgeManager {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private telemetry: UnrealTelemetryState = {
    connected: false,
    unrealInstanceId: 'UE54_PrimordiaRealm_01',
    fps: 60.0,
    frameTimeMs: 16.6,
    activeCamera: 'CINEMATIC_ORBIT_4K',
    niagaraParticleCount: 128,
    solfeggioFreqHz: 528.0,
    physicsImpulseLevel: 1.0,
    liquidGoldFlowRate: 24.5,
    gravitationalConstant: 9.81,
    subChamber: 'reality',
    lastPingAt: new Date().toISOString(),
  };

  /**
   * Attach WebSocket Server for Unreal Engine IPC
   */
  public init(server: http.Server): void {
    try {
      this.wss = new WebSocketServer({ server, path: '/api/unreal/ws' });

      this.wss.on('connection', (ws: WebSocket, req) => {
        this.clients.add(ws);
        this.telemetry.connected = true;
        this.telemetry.lastPingAt = new Date().toISOString();

        // Send initial state handshake
        ws.send(JSON.stringify({
          type: 'UNREAL_HANDSHAKE_ACK',
          payload: this.telemetry,
          timestamp: new Date().toISOString()
        }));

        ws.on('message', (data: string) => {
          try {
            const message = JSON.parse(data.toString());
            this.handleInboundUnrealMessage(message, ws);
          } catch (err) {
            console.error('[Unreal WS Message Error]:', err);
          }
        });

        ws.on('close', () => {
          this.clients.delete(ws);
          if (this.clients.size === 0) {
            this.telemetry.connected = false;
          }
        });

        ws.on('error', (err) => {
          console.error('[Unreal WS Error]:', err);
          this.clients.delete(ws);
        });
      });
    } catch (e) {
      console.error('[Unreal Bridge Init Error]:', e);
    }
  }

  /**
   * Handle HTTP Upgrade for /api/unreal/ws
   */
  public handleUpgrade(req: any, socket: any, head: any): boolean {
    if (req.url === '/api/unreal/ws' || req.url?.startsWith('/api/unreal/telemetry-ws')) {
      this.wss?.handleUpgrade(req, socket, head, (ws) => {
        this.wss?.emit('connection', ws, req);
      });
      return true;
    }
    return false;
  }

  /**
   * Inbound message processor from Unreal Engine 5.4 C++ / Blueprint bridge
   */
  private handleInboundUnrealMessage(msg: any, sourceWs: WebSocket): void {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'UE_HEARTBEAT':
        this.telemetry.fps = msg.fps || 60.0;
        this.telemetry.frameTimeMs = msg.frameTimeMs || 16.6;
        this.telemetry.lastPingAt = new Date().toISOString();
        break;

      case 'UE_SIMULATION_EVENT':
        if (msg.payload) {
          try {
            db.prepare(`
              INSERT INTO unreal_simulation_events (
                user_id, event_type, physics_impulse, niagara_particle_count,
                solfeggio_freq, camera_mode, viewport_state, created_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              msg.userId || 'system',
              msg.payload.eventType || 'PHYSICS_COLLISION',
              msg.payload.physicsImpulse || 0.0,
              msg.payload.particleCount || 100,
              msg.payload.solfeggioFreq || 528.0,
              msg.payload.cameraMode || 'CINEMATIC_ORBIT_4K',
              JSON.stringify(msg.payload),
              new Date().toISOString()
            );
          } catch {}
        }
        // Broadcast event to frontend listeners
        this.broadcast({ type: 'SIMULATION_TELEMETRY_UPDATE', payload: msg.payload });
        break;

      default:
        break;
    }
  }

  /**
   * Broadcast message to all connected Unreal Engine viewports and web clients
   */
  public broadcast(data: any): void {
    const payload = JSON.stringify(data);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  /**
   * Dispatch Niagara Particle Burst Command into Unreal
   */
  public triggerNiagaraBurst(particleCount: number, colorHex: string, impulseForce: number): void {
    this.telemetry.niagaraParticleCount = particleCount;
    this.telemetry.physicsImpulseLevel = impulseForce;

    this.broadcast({
      type: 'NIAGARA_BURST_COMMAND',
      payload: {
        particleCount,
        colorHex,
        impulseForce,
        timestamp: Date.now()
      }
    });
  }

  /**
   * Switch Camera Viewport in Unreal
   */
  public setCameraMode(mode: string): void {
    this.telemetry.activeCamera = mode;
    this.broadcast({
      type: 'CAMERA_SWITCH_COMMAND',
      payload: { cameraMode: mode }
    });
  }

  /**
   * Get Current Live Telemetry
   */
  public getStatus(): UnrealTelemetryState & { clientCount: number } {
    return {
      ...this.telemetry,
      clientCount: this.clients.size,
      connected: this.clients.size > 0 || this.telemetry.connected
    };
  }
}

export const unrealBridge = new UnrealBridgeManager();
