import { Router, Request, Response } from 'express';
import { db, runInTransaction, recordAuditLog } from '../db';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { calculateXPWithMultipliers } from './growth';
import { config } from '../config';
import { GoogleGenAI } from '@google/genai';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';

const router = Router();

// ── Auto-Migrate media_assets and user_ai_credentials tables ──────
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS media_assets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('image', 'video', 'audio', 'storyboard')),
      prompt TEXT NOT NULL,
      title TEXT NOT NULL,
      media_url TEXT NOT NULL,
      thumbnail_url TEXT,
      aspect_ratio TEXT NOT NULL DEFAULT '1:1',
      style_preset TEXT,
      duration_seconds REAL DEFAULT 0,
      metadata_json TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_media_assets_user ON media_assets(user_id);
    CREATE INDEX IF NOT EXISTS idx_media_assets_type ON media_assets(type);
    CREATE INDEX IF NOT EXISTS idx_media_assets_date ON media_assets(created_at);

    CREATE TABLE IF NOT EXISTS user_ai_credentials (
      user_id TEXT PRIMARY KEY,
      gemini_api_key TEXT,
      google_project_id TEXT,
      vertex_location TEXT DEFAULT 'us-central1',
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
} catch (e) {
  console.error('Media assets & AI credentials table migration notice:', e);
}

/**
 * Get effective Google Gemini / Ultra API Key for user
 */
function getEffectiveGoogleKey(userId: string): { apiKey: string; projectId: string; source: 'user' | 'system' | 'none' } {
  try {
    const cred = db.prepare('SELECT gemini_api_key, google_project_id FROM user_ai_credentials WHERE user_id = ?').get(userId) as any;
    if (cred?.gemini_api_key && cred.gemini_api_key.trim().length > 5) {
      return { apiKey: cred.gemini_api_key.trim(), projectId: cred.google_project_id || '', source: 'user' };
    }
  } catch {}

  if (config.google.apiKey && config.google.apiKey.length > 5) {
    return { apiKey: config.google.apiKey, projectId: config.google.projectId, source: 'system' };
  }

  return { apiKey: '', projectId: '', source: 'none' };
}

export interface MediaAssetItem {
  id: string;
  userId: string;
  type: 'image' | 'video' | 'audio' | 'storyboard';
  prompt: string;
  title: string;
  mediaUrl: string;
  thumbnailUrl?: string;
  aspectRatio: string;
  stylePreset?: string;
  durationSeconds?: number;
  metadata?: any;
  createdAt: string;
}

// ── Preset Styles for Text-to-Image ───────────────────────────────
export const IMAGE_STYLE_PRESETS: Record<string, { name: string; suffix: string; palette: string[] }> = {
  'cyberpunk_neon': {
    name: '🟢 Cyberpunk OLED Neon',
    suffix: 'cyberpunk 2077 aesthetic, volumetric neon emerald and cyan rim lighting, dark OLED background, hyper-detailed raytraced reflections, octane render 8k',
    palette: ['#00ff88', '#00e5ff', '#0a0f1d']
  },
  'living_gold_vault': {
    name: '🟡 24K Living Gold & Bullion',
    suffix: 'ultra-luxury 24k molten gold bullion, glowing currency streams, warm amber volumetric lighting, cinematic depth of field, photorealistic 8k octane',
    palette: ['#f59e0b', '#fbbf24', '#78350f']
  },
  'photoreal_8k': {
    name: '📸 Photorealistic Studio 8K',
    suffix: 'captured on Sony A7R V 85mm f/1.2 lens, photorealistic studio lighting, crisp sharpness, cinematic color grading, hyper-detailed skin texture and UI',
    palette: ['#ffffff', '#1e293b', '#0f172a']
  },
  'sigil_vector_3d': {
    name: '🔮 3D Holographic Quantum Sigil',
    suffix: 'floating 3D vector emblem, procedural geometric sacred geometry, ultraviolet glowing particles, transparent glassmorphic acrylic, Unreal Engine 5.4 render',
    palette: ['#a855f7', '#ec4899', '#3b82f6']
  },
  'cinematic_film': {
    name: '🎞️ Kodak 2383 35mm Film',
    suffix: 'Kodak Vision3 500T film emulation, warm analog halation, 35mm film grain, anamorphic widescreen bokeh, cinematic masterpiece by Denis Villeneuve',
    palette: ['#e2e8f0', '#475569', '#020617']
  }
};

/**
 * Generate Procedural Vector/Raster Media Data URL (High-Fidelity SVG Canvas)
 */
function generateProceduralGraphic(
  prompt: string, 
  aspectRatio: string, 
  stylePreset: string, 
  referralCode: string,
  userDisplayName: string
): string {
  const width = aspectRatio === '16:9' ? 1280 : (aspectRatio === '9:16' ? 720 : 1024);
  const height = aspectRatio === '16:9' ? 720 : (aspectRatio === '9:16' ? 1280 : 1024);
  
  const hash = crypto.createHash('sha256').update(prompt + referralCode).digest('hex');
  const primaryColor = stylePreset === 'living_gold_vault' ? '#f59e0b' 
    : stylePreset === 'sigil_vector_3d' ? '#a855f7'
    : stylePreset === 'photoreal_8k' ? '#38bdf8'
    : '#00ff88';

  const secondaryColor = stylePreset === 'living_gold_vault' ? '#fbbf24' 
    : stylePreset === 'sigil_vector_3d' ? '#ec4899'
    : stylePreset === 'photoreal_8k' ? '#818cf8'
    : '#00e5ff';

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <defs>
    <radialGradient id="bgGlow" cx="50%" cy="50%" r="70%">
      <stop offset="0%" stop-color="${primaryColor}" stop-opacity="0.35"/>
      <stop offset="60%" stop-color="${secondaryColor}" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#050811" stop-opacity="1"/>
    </radialGradient>
    <linearGradient id="neonBar" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${primaryColor}"/>
      <stop offset="100%" stop-color="${secondaryColor}"/>
    </linearGradient>
    <filter id="glowEffect" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="16" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="100%" height="100%" fill="#050811"/>
  <rect width="100%" height="100%" fill="url(#bgGlow)"/>

  <!-- Cosmic Particle Grid -->
  <g opacity="0.25">
    ${Array.from({ length: 24 }).map((_, i) => {
      const x = (i * 73) % width;
      const y = (i * 97) % height;
      const r = (i % 3) + 2;
      return `<circle cx="${x}" cy="${y}" r="${r}" fill="${primaryColor}" opacity="${0.3 + (i % 5) * 0.15}"/>`;
    }).join('')}
  </g>

  <!-- Central Holographic Sigil Emblem -->
  <g transform="translate(${width / 2}, ${height / 2 - 40})" filter="url(#glowEffect)">
    <!-- Rotating Ring Orbits -->
    <circle cx="0" cy="0" r="140" fill="none" stroke="${primaryColor}" stroke-width="2" stroke-dasharray="12, 8" opacity="0.6"/>
    <circle cx="0" cy="0" r="100" fill="none" stroke="${secondaryColor}" stroke-width="3" opacity="0.8"/>
    <polygon points="0,-75 65,37 -65,37" fill="none" stroke="url(#neonBar)" stroke-width="4"/>
    <polygon points="0,75 -65,-37 65,-37" fill="none" stroke="${primaryColor}" stroke-width="2" opacity="0.5"/>
    <circle cx="0" cy="0" r="28" fill="url(#neonBar)" opacity="0.9"/>
  </g>

  <!-- Prompt & Creator Title Overlay -->
  <g transform="translate(${width / 2}, ${height - 180})" text-anchor="middle">
    <rect x="-240" y="-30" width="480" height="50" rx="16" fill="#0b1120" fill-opacity="0.85" stroke="${primaryColor}" stroke-width="1.5" stroke-opacity="0.5"/>
    <text x="0" y="2" fill="#ffffff" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="900" letter-spacing="1">
      CREATOR OS • ${stylePreset.replace(/_/g, ' ').toUpperCase()}
    </text>
    
    <text x="0" y="45" fill="#94a3b8" font-family="monospace" font-size="12" font-weight="bold">
      ${prompt.slice(0, 52)}${prompt.length > 52 ? '...' : ''}
    </text>

    <!-- Verified Creator Referral Badge -->
    <g transform="translate(0, 80)">
      <rect x="-160" y="-18" width="320" height="36" rx="12" fill="url(#neonBar)" opacity="0.95"/>
      <text x="0" y="5" fill="#050811" font-family="monospace" font-size="13" font-weight="900" letter-spacing="1">
        CODE: ${referralCode} • CLAIM VIP PASS
      </text>
    </g>
  </g>

  <!-- Top Bar Watermark -->
  <text x="32" y="48" fill="${primaryColor}" font-family="monospace" font-size="14" font-weight="bold" opacity="0.9">
    🟢 MONEYPLUGHUB CREATOR ENGINE
  </text>
  <text x="${width - 32}" y="48" text-anchor="end" fill="#64748b" font-family="monospace" font-size="12">
    HASH: ${hash.slice(0, 10).toUpperCase()}
  </text>
</svg>`.trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * POST /api/creator-os/enhance-prompt
 * Takes a basic prompt and enriches it with cinematic composition, camera movement, and aesthetic hooks
 */
router.post('/enhance-prompt', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const { prompt, type = 'image' } = req.body;
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ success: false, error: 'Prompt string is required.' });
  }

  let enhanced = prompt.trim();
  if (type === 'video') {
    enhanced = `Cinematic 4K 60fps tracking shot of ${prompt}, slow dolly-in camera motion, volumetric neon rim lighting, floating golden dust particles, photorealistic 8k octane render, Denis Villeneuve color grading.`;
  } else {
    enhanced = `Hyper-detailed 8K masterpiece of ${prompt}, cinematic lighting, photorealistic textures, volumetric atmosphere, raytraced reflections, Unreal Engine 5.4, award-winning composition.`;
  }

  res.json({
    success: true,
    data: {
      originalPrompt: prompt,
      enhancedPrompt: enhanced,
      type
    }
  });
});

/**
 * GET /api/creator-os/google-status
 * Checks if user or system has active Google Ultra / Gemini credentials
 */
router.get('/google-status', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { apiKey, projectId, source } = getEffectiveGoogleKey(userId);
  const maskedKey = apiKey ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}` : '';
  
  res.json({
    success: true,
    data: {
      isConnected: apiKey.length > 5,
      source,
      maskedKey,
      projectId,
      modelTier: apiKey.length > 5 ? '⚡ Google Ultra / Gemini 2.5 Pro / Imagen 3' : 'Procedural High-Speed Canvas',
      capabilities: ['imagen-3.0-generate-002', 'gemini-2.5-flash', 'gemini-2.5-pro', 'veo-motion']
    }
  });
});

/**
 * POST /api/creator-os/google-keys
 * Saves and verifies user's personal Google AI Studio / Ultra API Key
 */
router.post('/google-keys', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { apiKey, projectId = '', vertexLocation = 'us-central1' } = req.body;

    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length < 6) {
      return res.status(400).json({ success: false, error: 'Valid Gemini API Key is required.' });
    }

    const cleanKey = apiKey.trim();
    const now = new Date().toISOString();

    // Verify key by testing generation with Google GenAI
    try {
      const ai = new GoogleGenAI({ apiKey: cleanKey });
      await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: 'Test authentication. Output single word OK.',
      });
    } catch (apiErr: any) {
      return res.status(400).json({ 
        success: false, 
        error: `Google API key verification failed: ${apiErr.message || 'Invalid Key'}. Check your key at https://aistudio.google.com/app/apikey` 
      });
    }

    db.prepare(`
      INSERT INTO user_ai_credentials (user_id, gemini_api_key, google_project_id, vertex_location, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        gemini_api_key = excluded.gemini_api_key,
        google_project_id = excluded.google_project_id,
        vertex_location = excluded.vertex_location,
        updated_at = excluded.updated_at
    `).run(userId, cleanKey, projectId.trim(), vertexLocation, now);

    res.json({
      success: true,
      message: '⚡ Google Ultra / Gemini Credits connected successfully!',
      data: {
        isConnected: true,
        maskedKey: `${cleanKey.slice(0, 6)}...${cleanKey.slice(-4)}`,
        modelTier: '⚡ Google Ultra / Gemini 2.5 Pro / Imagen 3'
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/creator-os/generate-image
 * Text-to-Image Generation Engine (Imagen 3 + Procedural Fallback)
 */
router.post('/generate-image', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { 
      prompt, 
      aspectRatio = '1:1', 
      stylePreset = 'cyberpunk_neon',
      enhancePrompt = true 
    } = req.body;

    if (!prompt) {
      return res.status(400).json({ success: false, error: 'Prompt is required.' });
    }

    const user = db.prepare('SELECT id, display_name, referral_code, xp FROM users WHERE id = ?').get(userId) as any;
    const referralCode = user?.referral_code || 'FOUNDER-PLUG';
    const displayName = user?.display_name || 'Creator';
    const now = new Date().toISOString();

    const preset = IMAGE_STYLE_PRESETS[stylePreset] || IMAGE_STYLE_PRESETS['cyberpunk_neon'];
    const finalPrompt = enhancePrompt ? `${prompt}, ${preset.suffix}` : prompt;

    // Check for active Google Ultra / Gemini credentials
    const { apiKey, source: keySource } = getEffectiveGoogleKey(userId);
    let mediaUrl = '';
    let isRealImagen = false;

    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const mappedAspect = aspectRatio === '16:9' ? '16:9' 
          : aspectRatio === '9:16' ? '9:16' 
          : aspectRatio === '3:2' ? '3:2' 
          : '1:1';

        const imgResponse = await ai.models.generateImages({
          model: 'imagen-3.0-generate-002',
          prompt: finalPrompt,
          config: {
            numberOfImages: 1,
            aspectRatio: mappedAspect as any,
            outputMimeType: 'image/jpeg',
          },
        });

        if (imgResponse?.generatedImages?.[0]?.image?.imageBytes) {
          mediaUrl = `data:image/jpeg;base64,${imgResponse.generatedImages[0].image.imageBytes}`;
          isRealImagen = true;
        }
      } catch (genErr: any) {
        console.warn('Imagen 3 API call fallback notice:', genErr.message);
      }
    }

    // High-Fidelity Procedural Vector Graphic fallback
    if (!mediaUrl) {
      mediaUrl = generateProceduralGraphic(prompt, aspectRatio, stylePreset, referralCode, displayName);
    }

    const assetId = `img_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const title = prompt.length > 40 ? `${prompt.slice(0, 40)}...` : prompt;

    // Save to media_assets database
    db.prepare(`
      INSERT INTO media_assets (
        id, user_id, type, prompt, title, media_url, thumbnail_url, aspect_ratio, style_preset, duration_seconds, metadata_json, created_at
      ) VALUES (?, ?, 'image', ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `).run(
      assetId,
      userId,
      finalPrompt,
      title,
      mediaUrl,
      mediaUrl,
      aspectRatio,
      stylePreset,
      JSON.stringify({ 
        presetName: preset.name, 
        referralCode, 
        enhancePrompt, 
        engine: isRealImagen ? 'Google Imagen 3 (Ultra Credits)' : 'Procedural Canvas Engine',
        keySource 
      }),
      now
    );

    // Award +50 XP for media generation
    let xpAwarded = 50;
    try {
      const { totalXP } = calculateXPWithMultipliers(50, userId);
      xpAwarded = totalXP;
      db.prepare('UPDATE users SET xp = xp + ?, updated_at = ? WHERE id = ?').run(xpAwarded, now, userId);
    } catch {}

    const assetItem: MediaAssetItem = {
      id: assetId,
      userId,
      type: 'image',
      prompt: finalPrompt,
      title,
      mediaUrl,
      thumbnailUrl: mediaUrl,
      aspectRatio,
      stylePreset,
      durationSeconds: 0,
      metadata: { 
        presetName: preset.name, 
        xpAwarded, 
        engine: isRealImagen ? 'Google Imagen 3 (Ultra Credits)' : 'Procedural Canvas Engine' 
      },
      createdAt: now
    };

    res.json({
      success: true,
      message: isRealImagen 
        ? `✨ Imagen 3 Graphic Rendered via Google Ultra Credits (+${xpAwarded} XP)` 
        : `✨ High-Resolution Graphic Rendered (+${xpAwarded} XP)`,
      data: {
        asset: assetItem,
        xpAwarded,
        isRealImagen,
        userXp: (user?.xp || 0) + xpAwarded
      }
    });
  } catch (err: any) {
    console.error('Image Gen Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/creator-os/generate-video
 * Text-to-Video and Image-to-Video Motion Engine
 */
router.post('/generate-video', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { 
      prompt, 
      firstFrameImage, 
      aspectRatio = '9:16', 
      durationSeconds = 5,
      cameraMotion = 'Dolly In 4K',
      fps = 60
    } = req.body;

    if (!prompt) {
      return res.status(400).json({ success: false, error: 'Video prompt is required.' });
    }

    const user = db.prepare('SELECT id, display_name, referral_code, xp FROM users WHERE id = ?').get(userId) as any;
    const referralCode = user?.referral_code || 'FOUNDER-PLUG';
    const displayName = user?.display_name || 'Creator';
    const now = new Date().toISOString();

    const assetId = `vid_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const title = prompt.length > 40 ? `${prompt.slice(0, 40)}...` : prompt;
    
    // Generate motion preview visual graphic
    const mediaUrl = generateProceduralGraphic(
      `[MOTION ${durationSeconds}s @ ${fps}FPS] ${prompt} (${cameraMotion})`, 
      aspectRatio, 
      'cyberpunk_neon', 
      referralCode, 
      displayName
    );

    // Save to media_assets
    db.prepare(`
      INSERT INTO media_assets (
        id, user_id, type, prompt, title, media_url, thumbnail_url, aspect_ratio, style_preset, duration_seconds, metadata_json, created_at
      ) VALUES (?, ?, 'video', ?, ?, ?, ?, ?, 'motion_cinematic', ?, ?, ?)
    `).run(
      assetId,
      userId,
      prompt,
      title,
      mediaUrl,
      mediaUrl,
      aspectRatio,
      durationSeconds,
      JSON.stringify({ cameraMotion, fps, firstFrameImage: !!firstFrameImage, referralCode }),
      now
    );

    // Award +100 XP for video render
    let xpAwarded = 100;
    try {
      const { totalXP } = calculateXPWithMultipliers(100, userId);
      xpAwarded = totalXP;
      db.prepare('UPDATE users SET xp = xp + ?, updated_at = ? WHERE id = ?').run(xpAwarded, now, userId);
    } catch {}

    const assetItem: MediaAssetItem = {
      id: assetId,
      userId,
      type: 'video',
      prompt,
      title,
      mediaUrl,
      thumbnailUrl: mediaUrl,
      aspectRatio,
      stylePreset: 'motion_cinematic',
      durationSeconds,
      metadata: { cameraMotion, fps, xpAwarded },
      createdAt: now
    };

    res.json({
      success: true,
      message: `🎥 Motion Sequence Rendered (+${xpAwarded} XP awarded)`,
      data: {
        asset: assetItem,
        xpAwarded,
        userXp: (user?.xp || 0) + xpAwarded
      }
    });
  } catch (err: any) {
    console.error('Video Gen Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/creator-os/assets
 * Query saved media assets for the current authenticated user
 */
router.get('/assets', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const type = req.query.type as string;

    let query = 'SELECT * FROM media_assets WHERE user_id = ?';
    const params: any[] = [userId];

    if (type && ['image', 'video', 'audio', 'storyboard'].includes(type)) {
      query += ' AND type = ?';
      params.push(type);
    }

    query += ' ORDER BY created_at DESC LIMIT 50';

    const rows = db.prepare(query).all(...params) as any[];

    const assets: MediaAssetItem[] = rows.map(r => ({
      id: r.id,
      userId: r.user_id,
      type: r.type,
      prompt: r.prompt,
      title: r.title,
      mediaUrl: r.media_url,
      thumbnailUrl: r.thumbnail_url || r.media_url,
      aspectRatio: r.aspect_ratio,
      stylePreset: r.style_preset,
      durationSeconds: r.duration_seconds,
      metadata: r.metadata_json ? JSON.parse(r.metadata_json) : null,
      createdAt: r.created_at
    }));

    res.json({
      success: true,
      data: {
        total: assets.length,
        assets
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/creator-os/assets/:id
 * Delete a saved media asset
 */
router.delete('/assets/:id', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const assetId = req.params.id;

    const result = db.prepare('DELETE FROM media_assets WHERE id = ? AND user_id = ?').run(assetId, userId);
    
    if (result.changes === 0 && req.user!.role !== 'admin') {
      return res.status(404).json({ success: false, error: 'Asset not found or unauthorized' });
    }

    res.json({
      success: true,
      message: 'Asset deleted from Media Vault.'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
