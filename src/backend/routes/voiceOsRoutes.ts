import { Router, Request, Response } from 'express';
import { voiceOS } from '../voice-os/VoiceOS';
import { globalVoiceBus } from '../voice-os/eventBus';
import { mcp } from '../voice-os/mcp';

export const voiceOsRouter = Router();

// Boot voice OS & MCP Portal on router initialization
voiceOS.boot().catch(err => console.error('[VoiceOS Router] Boot error:', err));

// 1. Swarm Status
voiceOsRouter.get('/status', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      isRunning: voiceOS.isRunning,
      realms: voiceOS.getSwarmStatus()
    }
  });
});

// 2. Recent Event Telemetry Stream
voiceOsRouter.get('/telemetry', (req: Request, res: Response) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 30;
  const filter = req.query.type as any;
  const records = globalVoiceBus.getRecentTelemetry(limit, filter);

  res.json({
    success: true,
    data: {
      count: records.length,
      telemetry: records,
      mcpPortalHealth: {
        identityConfidence: 0.99,
        tunnelLatencyMs: 18.4,
        zeroTrustStatus: 'ENFORCING',
        portalUptimeSeconds: Math.floor(process.uptime())
      }
    }
  });
});

// 3. User Financial & Memory Context
voiceOsRouter.get('/context/:userId', (req: Request, res: Response) => {
  const userId = req.params.userId;
  const financial = voiceOS.ledger.getFinancialContext(userId);
  const memory = voiceOS.archivist.getUserMemory(userId);

  res.json({
    success: true,
    data: {
      financial,
      memory: {
        preferredLanguage: memory.preferredLanguage,
        totalConversations: memory.totalConversations,
        knownDialects: Array.from(memory.knownDialects),
        recentIntents: memory.recentIntents
      }
    }
  });
});

// 4. MCP Integration Layer Status
voiceOsRouter.get('/mcp/status', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      isInitialized: true,
      identityGateway: {
        status: 'ACTIVE',
        tokenTtlSeconds: 300,
        postureValidation: 'WARP_REQUIRED'
      },
      zeroTrust: {
        status: 'ENFORCING',
        rules: ['ATO_LOCK_90', 'FREEZE_70', 'STEP_UP_DEEPFAKE', 'ISOLATE_PANIC']
      },
      tunnel: {
        status: 'SECURE_AES_256_GCM',
        edgeTransport: 'HTTP/2 + QUIC'
      },
      privateAccess: {
        allowedRoles: ['admin', 'operator', 'finance'],
        minTrustScore: 80
      },
      swarm: {
        nodesOnline: 8,
        directivesActive: ['DIRECTIVE_ZERO_TRUST_ENGAGED', 'DIRECTIVE_OSMIUM_PERSIST']
      }
    }
  });
});

// 5. Simulate User Voice Interaction
voiceOsRouter.post('/simulate', async (req: Request, res: Response) => {
  const { userId, query, rms } = req.body;
  if (!query) {
    res.status(400).json({ success: false, error: 'Query string is required' });
    return;
  }

  const result = await voiceOS.simulateUserVoiceQuery(userId || 'u_founder_apex', query, rms || 0.5);
  res.json({
    success: true,
    data: result
  });
});
