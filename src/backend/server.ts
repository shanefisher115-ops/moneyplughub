import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import { config } from './config';
import { db, initDb } from './db';
import { setupVoiceWebSocket, voiceWsManager } from './voice/ws';
import { setupSyndicateWebSocket, syndicateWsManager } from './syndicates/syndicateWs';
import authRoutes from './routes/auth';
import referralRoutes from './routes/referrals';
import adminRoutes from './routes/admin';
import financeRoutes from './routes/finance';
import gamificationRoutes from './routes/gamification';
import cryptoRoutes from './routes/crypto';
import routingRoutes from './routes/routing';
import programRoutes from './routes/programs';
import cashbackRoutes from './routes/cashback';
import referralHubRoutes from './routes/referralHub';
import balanceAgentRoutes from './routes/balanceAgent';
import earningsAgentRoutes from './routes/earningsAgent';
import referralAgentRoutes from './routes/referralAgent';
import automationAgentRoutes from './routes/automationAgent';
import insightAgentRoutes from './routes/insightAgent';
import orchestratorRoutes from './routes/orchestrator';
import affiliateRoutes from './routes/affiliate';
import commandCenterRoutes from './routes/commandCenter';
import generateRoutes from './routes/generate';
import aiOrchestratorRoutes from './routes/aiOrchestrator';
import moneyosRoutes from './routes/moneyos';
import ttsRoutes from './routes/tts';
import billingRoutes from './routes/billing';
import sigilRoutes from './routes/sigil';
import growthRoutes from './routes/growth';
import viralRoutes from './routes/viral';
import supportRoutes from './routes/support';
import paywallRoutes from './routes/paywall';
import adaptiveProfileRoutes from './routes/adaptiveProfile';
import voiceRoutes from './voice/router';
import lootRoutes from './routes/loot';
import syndicatesRoutes from './routes/syndicates';
import achievementsRoutes from './routes/achievements';
import { primordiaRouter, initPrimordiaSchema } from './routes/primordia';
import { primordiaNuclearRouter, initPrimordiaNuclearSchema } from './routes/primordiaNuclear';
import { xpEconomyRouter } from './routes/xpEconomy';
import { economyRouter } from './routes/economy';
import { peerSignalRouter } from './routes/peerSignal';
import { agkRouter } from './routes/agk';
import { transactionsRouter } from './routes/transactions';
import { stripeWebhookRouter } from './routes/stripeWebhook';
import { voiceOsRouter } from './routes/voiceOsRoutes';
import { davinciRouter } from './davinci/davinciBridge';
import videoProductionRouter from './routes/videoProduction';
import referralRealmsRouter from './routes/referralRealms';
import creatorOsMediaRouter from './routes/creatorOsMedia';
import { signalRealmRouter } from './routes/signalRealmOutreach';
import { supabaseRouter } from './supabase';
import { unrealRouter } from './routes/unrealEngine';
import { unrealBridge } from './unreal/unrealBridge';

const app = express();

// High-speed compression (gzip / brotli) for all responses
app.use(compression({
  level: 6,
  threshold: 512,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

// Initialize database
initDb();
initPrimordiaSchema();
initPrimordiaNuclearSchema();

// Middlewares
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    return callback(null, true);
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Top-Level Public Single-Click Redirect Engine (/go/:slug)
app.use('/go', routingRoutes);

// API Route Mounts
app.use('/api/auth', authRoutes);
app.use('/api/referrals', referralRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/finance', financeRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/crypto', cryptoRoutes);
app.use('/api/programs', programRoutes);
app.use('/api/cashback-pack', cashbackRoutes);
app.use('/api/referral-hub', referralHubRoutes);
app.use('/api/agents/balance', balanceAgentRoutes);
app.use('/api/agents/earnings', earningsAgentRoutes);
app.use('/api/agents/referral', referralAgentRoutes);
app.use('/api/agents/automation', automationAgentRoutes);
app.use('/api/agents/insight', insightAgentRoutes);
app.use('/api/orchestrator', orchestratorRoutes);
app.use('/api/affiliate', affiliateRoutes);
app.use('/api/command-center', commandCenterRoutes);
app.use('/api/generate', generateRoutes);
app.use('/api/v5', aiOrchestratorRoutes);
app.use('/api/moneyos', moneyosRoutes);
app.use('/api/tts', ttsRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/sigil', sigilRoutes);
app.use('/api/growth', growthRoutes);
app.use('/api/viral', viralRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/paywall', paywallRoutes);
app.use('/api/profile', adaptiveProfileRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/loot', lootRoutes);
app.use('/api/syndicates', syndicatesRoutes);
app.use('/api/achievements', achievementsRoutes);
app.use('/api/primordia', primordiaRouter);
app.use('/api/primordia/nuclear', primordiaNuclearRouter);
app.use('/api/xp-economy', xpEconomyRouter);
app.use('/api/economy', economyRouter);
app.use('/api/peersignal', peerSignalRouter);
app.use('/api/agk', agkRouter);
app.use('/api/transactions', transactionsRouter);
app.use('/api/webhooks/stripe', stripeWebhookRouter);
app.use('/api/voice-os', voiceOsRouter);
app.use('/api/davinci', davinciRouter);
app.use('/api/video', videoProductionRouter);
app.use('/api/referrals', referralRealmsRouter);
app.use('/api/referral-realms', referralRealmsRouter);
app.use('/api/creator-os', creatorOsMediaRouter);
app.use('/api/signal-realm', signalRealmRouter);
app.use('/api/signalrealm', signalRealmRouter);
app.use('/api/phom', signalRealmRouter);
app.use('/api/apollo', signalRealmRouter);
app.use('/api/supabase', supabaseRouter);
app.use('/api/unreal', unrealRouter);

// Healthcheck Endpoint with instant in-memory response
app.get('/api/health', (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-cache');
  res.json({
    status: 'healthy',
    system: 'Plug In OS v5.0 — Sellable AI Orchestrator SaaS Engine Active',
    commission_rate_usd: config.commissionAmountUsd,
    environment: config.nodeEnv,
    timestamp: new Date().toISOString()
  });
});

// Production SPA Static File Serving with Aggressive Caching
const possibleDistPaths = [
  path.resolve(process.cwd(), 'dist/client'),
  path.resolve(__dirname, '../../client'),
  path.resolve(__dirname, '../../../dist/client'),
];

const clientDistPath = possibleDistPaths.find(p => fs.existsSync(p)) || possibleDistPaths[0];
const clientDistExists = fs.existsSync(clientDistPath);

if (clientDistExists) {
  // Static hashed assets: cache for 1 year immutable
  app.use('/assets', express.static(path.join(clientDistPath, 'assets'), {
    maxAge: '1y',
    immutable: true,
    etag: true
  }));

  // Other static root files (images, icons, etc. but not index.html)
  app.use(express.static(clientDistPath, {
    index: false,
    maxAge: '1h',
    etag: true
  }));
  
  // SPA Catch-all route: ALWAYS serve fresh index.html with no-store
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/go')) {
      next();
      return;
    }
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Global Error Handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({
    success: false,
    error: config.isProd ? 'Internal Server Error' : err.message,
  });
});

// Start Server on Port 3001
const server = http.createServer(app);
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
setupVoiceWebSocket(server);
setupSyndicateWebSocket(server);
unrealBridge.init(server);

server.listen(3001, () => {
  console.log(`⚡ Plug In OS v5.0 Server running on port 3001`);
});

// Also start secondary listener on Port 3000 to catch legacy 3000 tunnel routes
const server3000 = http.createServer(app);
server3000.keepAliveTimeout = 65000;
server3000.headersTimeout = 66000;
setupVoiceWebSocket(server3000);
setupSyndicateWebSocket(server3000);

server3000.listen(3000, () => {
  console.log(`⚡ Plug In OS v5.0 Dual Listener running on port 3000`);
}).on('error', (err: any) => {
  if (err.code === 'EADDRINUSE') {
    console.log('Port 3000 already bound; primary 3001 is active.');
  }
});

const handleShutdown = () => {
  console.log('\nClosing servers...');
  voiceWsManager.close();
  syndicateWsManager.close();
  server.close(() => {
    server3000.close(() => {
      db.close();
      process.exit(0);
    });
  });
};

process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);

export default app;
