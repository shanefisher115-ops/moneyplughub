import { Router, Request, Response } from 'express';
import { unrealBridge } from '../unreal/unrealBridge';
import { db, recordAuditLog } from '../db';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

export const unrealRouter = Router();

/**
 * GET /api/unreal/status - Live Telemetry & Bridge Status
 */
unrealRouter.get('/status', (req: Request, res: Response) => {
  const status = unrealBridge.getStatus();
  res.json({
    success: true,
    data: {
      ...status,
      pixelStreamingUrl: 'http://localhost:8888',
      signalingWs: 'ws://localhost:8888',
      engineVersion: 'Unreal Engine 5.4.4',
      renderMode: 'DirectX 12 / Vulkan Hardware Accelerated',
      niagaraSystemsActive: [
        'NS_CosmicWealthVortex',
        'NS_MoltenGoldCascades',
        'NS_SolfeggioHarmonicWave',
        'NS_SubatomicSigilExplosion'
      ]
    }
  });
});

/**
 * POST /api/unreal/niagara - Trigger Niagara Particle Bursts
 */
unrealRouter.post('/niagara', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id || 'system';
    const { particleCount = 150, colorHex = '#10b981', impulseForce = 2.5 } = req.body;

    unrealBridge.triggerNiagaraBurst(Number(particleCount), colorHex, Number(impulseForce));
    recordAuditLog(userId, 'UNREAL_NIAGARA_BURST', 'simulation', 'unreal_bridge', { particleCount, colorHex, impulseForce });

    res.json({
      success: true,
      message: '⚡ Niagara Cosmic Particle Burst Dispatched to Unreal Engine.',
      data: { particleCount, colorHex, impulseForce }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/unreal/camera - Switch Active Camera Viewport
 */
unrealRouter.post('/camera', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const { cameraMode = 'CINEMATIC_ORBIT_4K' } = req.body;
    unrealBridge.setCameraMode(cameraMode);

    res.json({
      success: true,
      message: `🎥 Unreal Camera switched to ${cameraMode}.`,
      data: { cameraMode }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/unreal/events - Query Recent Simulation Events
 */
unrealRouter.get('/events', (req: Request, res: Response) => {
  try {
    const events = db.prepare('SELECT * FROM unreal_simulation_events ORDER BY created_at DESC LIMIT 20').all();
    res.json({
      success: true,
      data: events
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/unreal/stream-config - Pixel Streaming WebRTC Signaling Settings
 */
unrealRouter.get('/stream-config', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      signallingServerUrl: 'ws://localhost:8888',
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ],
      autoConnect: true,
      controlScheme: 'HoveringMouse',
      enableAudio: true,
      codec: 'H264'
    }
  });
});

export default unrealRouter;
