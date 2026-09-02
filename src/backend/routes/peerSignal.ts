import { Router, Response } from 'express';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { AGKEngine } from '../engine/agkEngine';
import { db } from '../db';

export const peerSignalRouter = Router();

/**
 * POST /api/peersignal/emit
 * Ingests any user interaction (clicks, referrals, purchases, ability casts, vault locks)
 * and feeds it directly into SignalCore and the AGK growth engine.
 */
peerSignalRouter.post('/emit', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { signalType, targetResource, trustWeight, influenceDelta, payload } = req.body;

  if (!signalType || typeof signalType !== 'string') {
    res.status(400).json({ success: false, error: 'signalType is required' });
    return;
  }

  const user = db.prepare('SELECT display_name FROM users WHERE id = ?').get(userId) as any;
  const userName = user?.display_name || 'Verified Sovereign';

  const result = AGKEngine.ingestSignal({
    userId,
    signalType,
    targetResource,
    trustWeight,
    influenceDelta,
    payload,
    userName,
  });

  res.json({
    success: true,
    data: {
      signalId: result.signalId,
      agk: result.agk,
      pushEvent: result.pushEvent,
      message: `? PeerSignal [${signalType}] routed into SignalCore and AGK.`,
    },
  });
});

/**
 * GET /api/peersignal/push-events
 * Fetches real-time PeerPush social proof events across the network.
 */
peerSignalRouter.get('/push-events', (req, res) => {
  const limit = Math.min(30, parseInt(req.query.limit as string || '12', 10));
  const events = AGKEngine.getRecentPushEvents(limit);
  res.json({
    success: true,
    data: { events },
  });
});

/**
 * POST /api/peersignal/endorse
 * Community members endorse/boost a live action, amplifying trust and network influence.
 */
peerSignalRouter.post('/endorse', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { eventId } = req.body;
  if (!eventId) {
    res.status(400).json({ success: false, error: 'eventId is required' });
    return;
  }

  const result = AGKEngine.endorseEvent(eventId);
  if (!result.success) {
    res.status(404).json({ success: false, error: 'Event not found' });
    return;
  }

  res.json({
    success: true,
    data: result,
  });
});

/**
 * GET /api/peersignal/recent
 * Returns recent peer signals for live telemetry feeds.
 */
peerSignalRouter.get('/recent', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const limit = Math.min(50, parseInt(req.query.limit as string || '20', 10));
  const signals = db.prepare(`
    SELECT ps.*, u.display_name as user_name 
    FROM peer_signals ps
    LEFT JOIN users u ON ps.user_id = u.id
    ORDER BY ps.created_at DESC
    LIMIT ?
  `).all(limit) as any[];

  res.json({
    success: true,
    data: { signals },
  });
});
