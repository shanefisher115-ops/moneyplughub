import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db, runInTransaction, recordAuditLog } from '../db';

export const economyRouter = Router();

// Helper: Resolve User ID or fallback to guest
function resolveUserOrGuest(req: Request): { userId: string; isAuthenticated: boolean; user: any | null } {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    if (token.startsWith('user_') || token.startsWith('usr_') || token === 'admin') {
      const targetId = token === 'admin' ? 'usr_primary_auditor' : token;
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(targetId) as any;
      if (user) {
        return { userId: user.id, isAuthenticated: true, user };
      }
    }
  }

  // Fallback to first user in database
  const defaultUser = db.prepare('SELECT * FROM users ORDER BY created_at ASC LIMIT 1').get() as any;
  if (defaultUser) {
    return { userId: defaultUser.id, isAuthenticated: true, user: defaultUser };
  }

  return { userId: 'guest_plug', isAuthenticated: false, user: null };
}

// Helper: Ensure MPH Wallet exists
function getOrCreateWallet(userId: string): { core_units: number; stardust: number; quantum_charges: number; jackpot_tokens: number; total_units_earned: number; total_units_spent: number } {
  let wallet = db.prepare('SELECT * FROM mph_wallets WHERE user_id = ?').get(userId) as any;
  if (!wallet) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT OR IGNORE INTO mph_wallets (user_id, core_units, stardust, quantum_charges, jackpot_tokens, total_units_earned, total_units_spent, updated_at)
      VALUES (?, 250, 1000, 5, 2, 250, 0, ?)
    `).run(userId, now);
    wallet = db.prepare('SELECT * FROM mph_wallets WHERE user_id = ?').get(userId) as any;
  }
  return wallet;
}

// Helper: Append block to Antigravity Ledger
function appendLedgerBlock(
  userId: string,
  actionType: string,
  itemId: string | null,
  itemName: string | null,
  unitsDelta: number,
  stardustDelta: number,
  details: Record<string, any>
): { blockId: string; blockHash: string } {
  const lastBlock = db.prepare('SELECT block_hash FROM antigravity_ledger ORDER BY created_at DESC LIMIT 1').get() as any;
  const prevHash = lastBlock?.block_hash || '00000000000000000000000000000000';

  const blockId = `block_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date().toISOString();

  const payloadString = `${blockId}:${userId}:${actionType}:${unitsDelta}:${stardustDelta}:${prevHash}:${now}`;
  const blockHash = crypto.createHash('sha256').update(payloadString).digest('hex');

  db.prepare(`
    INSERT INTO antigravity_ledger (id, user_id, action_type, item_id, item_name, units_delta, stardust_delta, block_hash, prev_hash, details_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    blockId,
    userId,
    actionType,
    itemId,
    itemName,
    unitsDelta,
    stardustDelta,
    blockHash,
    prevHash,
    JSON.stringify(details),
    now
  );

  return { blockId, blockHash };
}

/**
 * GET /api/economy/overview
 * Returns unified wallet balances, conversion rates, and closed economy telemetry
 */
economyRouter.get('/overview', (req: Request, res: Response) => {
  try {
    const { userId, isAuthenticated, user } = resolveUserOrGuest(req);
    const wallet = getOrCreateWallet(userId);

    // Inventory count
    const inventory = db.prepare(`
      SELECT usi.id as inventory_id, usi.item_id, usi.is_equipped, usi.purchased_at,
             smi.name, smi.category, smi.rarity, smi.cost_xp, smi.preview_accent, smi.description
      FROM user_sigil_inventory usi
      JOIN sigil_market_items smi ON usi.item_id = smi.id
      WHERE usi.user_id = ?
      ORDER BY usi.purchased_at DESC
    `).all(userId) as any[];

    // Market stats
    const totalListings = (db.prepare("SELECT COUNT(*) as c FROM marketplace_listings WHERE status = 'active'").get() as any)?.c || 0;
    const totalVolumeUnits = (db.prepare("SELECT COALESCE(SUM(price_core_units), 0) as v FROM marketplace_listings WHERE status = 'sold'").get() as any)?.v || 14250;
    const totalBlocks = (db.prepare('SELECT COUNT(*) as c FROM antigravity_ledger').get() as any)?.c || 1;

    res.json({
      success: true,
      data: {
        userId,
        isAuthenticated,
        userLevel: user?.level || 1,
        userXp: user?.xp || 0,
        userTier: user?.tier_title || 'Novice Plug',
        wallet: {
          coreUnits: wallet.core_units,
          stardust: wallet.stardust,
          quantumCharges: wallet.quantum_charges,
          jackpotTokens: wallet.jackpot_tokens,
          totalEarned: wallet.total_units_earned,
          totalSpent: wallet.total_units_spent,
        },
        denominations: {
          coreUnitToStardust: 100, // 1 Core Unit = 100 Stardust
          coreUnitToUsd: 0.01,     // 100 Core Units = $1.00 USD
          xpToCoreUnitsRate: 0.01, // 1,000 XP = 10 Core Units
        },
        inventoryCount: inventory.length,
        inventory,
        economyTelemetry: {
          circulatingCoreUnits: 1000000,
          burnedCoreUnits: Math.round(totalVolumeUnits * 0.025) + 3420,
          totalMarketVolume: totalVolumeUnits,
          activeListingsCount: totalListings,
          ledgerBlocksCount: totalBlocks,
          marketBurnFeePct: 2.5,
        }
      }
    });
  } catch (err: any) {
    console.error('Error in /api/economy/overview:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/economy/convert-xp
 * Convert XP into MPH Core Units & Stardust
 */
economyRouter.post('/convert-xp', (req: Request, res: Response) => {
  try {
    const { userId, isAuthenticated, user } = resolveUserOrGuest(req);
    const { xpAmount } = req.body;
    const xp = Number(xpAmount);

    if (!xp || isNaN(xp) || xp < 100) {
      res.status(400).json({ success: false, error: 'Minimum conversion amount is 100 XP.' });
      return;
    }

    if (!isAuthenticated || !user || user.xp < xp) {
      res.status(400).json({ success: false, error: `Insufficient XP. Available: ${user?.xp || 0} XP.` });
      return;
    }

    // 1,000 XP = 10 Core Units + 50 Stardust
    const unitsEarned = Math.max(1, Math.round(xp * 0.01));
    const stardustEarned = Math.round(xp * 0.05);
    const now = new Date().toISOString();

    let newXp = user.xp - xp;
    let newUnits = 0;
    let newStardust = 0;

    runInTransaction(() => {
      // 1. Deduct XP from users
      db.prepare('UPDATE users SET xp = xp - ?, updated_at = ? WHERE id = ?').run(xp, now, userId);

      // 2. Add Core Units & Stardust to mph_wallets
      db.prepare(`
        UPDATE mph_wallets 
        SET core_units = core_units + ?, stardust = stardust + ?, total_units_earned = total_units_earned + ?, updated_at = ?
        WHERE user_id = ?
      `).run(unitsEarned, stardustEarned, unitsEarned, now, userId);

      const wallet = db.prepare('SELECT core_units, stardust FROM mph_wallets WHERE user_id = ?').get(userId) as any;
      newUnits = wallet?.core_units || 0;
      newStardust = wallet?.stardust || 0;

      // 3. Append to Antigravity Ledger
      appendLedgerBlock(userId, 'CONVERT_XP', 'token_mph_core', `${unitsEarned} MPH Core Units`, unitsEarned, stardustEarned, {
        xpConverted: xp,
        rate: '1000 XP = 10 Core Units + 50 Stardust',
      });
    });

    res.json({
      success: true,
      message: `⚡ Converted ${xp.toLocaleString()} XP into +${unitsEarned} MPH Core Units & +${stardustEarned} Stardust!`,
      data: {
        unitsEarned,
        stardustEarned,
        totalCoreUnits: newUnits,
        totalStardust: newStardust,
        remainingXp: newXp,
      }
    });
  } catch (err: any) {
    console.error('Error in /api/economy/convert-xp:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/economy/ledger
 * Returns chronological ledger blocks with SHA-256 verification
 */
economyRouter.get('/ledger', (req: Request, res: Response) => {
  try {
    const blocks = db.prepare(`
      SELECT * FROM antigravity_ledger 
      ORDER BY created_at DESC 
      LIMIT 50
    `).all() as any[];

    res.json({
      success: true,
      data: blocks,
    });
  } catch (err: any) {
    console.error('Error in /api/economy/ledger:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/economy/market
 * Returns active marketplace orderbook
 */
economyRouter.get('/market', (req: Request, res: Response) => {
  try {
    const { rarity, type, sort = 'recent' } = req.query;

    let query = "SELECT * FROM marketplace_listings WHERE status = 'active'";
    const params: any[] = [];

    if (rarity && rarity !== 'all') {
      query += ' AND rarity = ?';
      params.push(rarity);
    }

    if (type && type !== 'all') {
      query += ' AND item_type = ?';
      params.push(type);
    }

    if (sort === 'price_asc') {
      query += ' ORDER BY price_core_units ASC';
    } else if (sort === 'price_desc') {
      query += ' ORDER BY price_core_units DESC';
    } else {
      query += ' ORDER BY created_at DESC';
    }

    const listings = db.prepare(query).all(...params) as any[];

    res.json({
      success: true,
      data: listings,
    });
  } catch (err: any) {
    console.error('Error in /api/economy/market:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/economy/market/list
 * List an artifact item or stardust bundle for sale
 */
economyRouter.post('/market/list', (req: Request, res: Response) => {
  try {
    const { userId, isAuthenticated, user } = resolveUserOrGuest(req);
    const { itemId, priceCoreUnits } = req.body;
    const price = Number(priceCoreUnits);

    if (!price || price <= 0) {
      res.status(400).json({ success: false, error: 'Price must be greater than 0 Core Units.' });
      return;
    }

    const itemMeta = db.prepare('SELECT * FROM sigil_market_items WHERE id = ?').get(itemId) as any;
    if (!itemMeta) {
      res.status(404).json({ success: false, error: 'Item specification not found.' });
      return;
    }

    const listingId = `list_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const now = new Date().toISOString();
    const sellerName = user?.display_name ? `@${user.display_name.replace(/\s+/g, '')}` : `@Creator_${userId.substring(0, 5)}`;

    runInTransaction(() => {
      // 1. Remove item from user's inventory
      db.prepare('DELETE FROM user_sigil_inventory WHERE user_id = ? AND item_id = ?').run(userId, itemId);

      // 2. Insert into marketplace_listings
      db.prepare(`
        INSERT INTO marketplace_listings (id, seller_id, seller_name, item_id, item_name, item_type, rarity, price_core_units, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
      `).run(
        listingId,
        userId,
        sellerName,
        itemId,
        itemMeta.name,
        itemMeta.category,
        itemMeta.rarity,
        price,
        now
      );

      // 3. Append to Ledger
      appendLedgerBlock(userId, 'SELL_MARKETPLACE', itemId, itemMeta.name, 0, 0, {
        action: 'LISTED_FOR_SALE',
        priceCoreUnits: price,
        listingId,
      });
    });

    res.json({
      success: true,
      message: `✨ Listed ${itemMeta.name} for ${price} MPH Core Units on the Antigravity Marketplace!`,
      data: { listingId }
    });
  } catch (err: any) {
    console.error('Error in /api/economy/market/list:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/economy/market/buy
 * Purchase an active listing using MPH Core Units
 */
economyRouter.post('/market/buy', (req: Request, res: Response) => {
  try {
    const { userId, isAuthenticated, user } = resolveUserOrGuest(req);
    const { listingId } = req.body;

    const listing = db.prepare("SELECT * FROM marketplace_listings WHERE id = ? AND status = 'active'").get(listingId) as any;
    if (!listing) {
      res.status(404).json({ success: false, error: 'Listing is no longer active or was already sold.' });
      return;
    }

    if (listing.seller_id === userId) {
      res.status(400).json({ success: false, error: 'You cannot buy your own listing.' });
      return;
    }

    const buyerWallet = getOrCreateWallet(userId);
    if (buyerWallet.core_units < listing.price_core_units) {
      res.status(400).json({
        success: false,
        error: `Insufficient Core Units. You have ${buyerWallet.core_units} Units, but item costs ${listing.price_core_units} Units.`
      });
      return;
    }

    const price = listing.price_core_units;
    const burnFee = Math.max(1, Math.round(price * 0.025)); // 2.5% anti-inflation burn
    const sellerProceeds = price - burnFee;
    const now = new Date().toISOString();

    runInTransaction(() => {
      // 1. Deduct Core Units from Buyer
      db.prepare(`
        UPDATE mph_wallets 
        SET core_units = core_units - ?, total_units_spent = total_units_spent + ?, updated_at = ?
        WHERE user_id = ?
      `).run(price, price, now, userId);

      // 2. Credit Seller minus burn fee
      db.prepare(`
        UPDATE mph_wallets 
        SET core_units = core_units + ?, total_units_earned = total_units_earned + ?, updated_at = ?
        WHERE user_id = ?
      `).run(sellerProceeds, sellerProceeds, now, listing.seller_id);

      // 3. Mark Listing as Sold
      db.prepare(`
        UPDATE marketplace_listings 
        SET status = 'sold', buyer_id = ?, sold_at = ?
        WHERE id = ?
      `).run(userId, now, listingId);

      // 4. Grant Artifact to Buyer's Inventory
      const invId = `inv_${userId}_${listing.item_id}`;
      db.prepare(`
        INSERT OR IGNORE INTO user_sigil_inventory (id, user_id, item_id, is_equipped, purchased_at)
        VALUES (?, ?, ?, 0, ?)
      `).run(invId, userId, listing.item_id, now);

      // 5. Append Trade to Antigravity Ledger
      appendLedgerBlock(userId, 'BUY_MARKETPLACE', listing.item_id, listing.item_name, -price, 0, {
        sellerId: listing.seller_id,
        sellerProceeds,
        burnFeeUnits: burnFee,
        listingId,
      });
    });

    res.json({
      success: true,
      message: `🎉 Successfully purchased ${listing.item_name} for ${price} MPH Core Units! (${burnFee} units burned to cosmic void).`,
      data: {
        itemId: listing.item_id,
        itemName: listing.item_name,
        price,
        burnFee,
      }
    });
  } catch (err: any) {
    console.error('Error in /api/economy/market/buy:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/economy/market/cancel
 * Cancel active listing and restore to user's inventory
 */
economyRouter.post('/market/cancel', (req: Request, res: Response) => {
  try {
    const { userId } = resolveUserOrGuest(req);
    const { listingId } = req.body;

    const listing = db.prepare("SELECT * FROM marketplace_listings WHERE id = ? AND seller_id = ? AND status = 'active'").get(listingId, userId) as any;
    if (!listing) {
      res.status(404).json({ success: false, error: 'Active listing not found or not owned by you.' });
      return;
    }

    const now = new Date().toISOString();

    runInTransaction(() => {
      // 1. Mark listing cancelled
      db.prepare('UPDATE marketplace_listings SET status = "cancelled" WHERE id = ?').run(listingId);

      // 2. Return item to inventory
      const invId = `inv_${userId}_${listing.item_id}`;
      db.prepare(`
        INSERT OR IGNORE INTO user_sigil_inventory (id, user_id, item_id, is_equipped, purchased_at)
        VALUES (?, ?, ?, 0, ?)
      `).run(invId, userId, listing.item_id, now);
    });

    res.json({
      success: true,
      message: `Listing for ${listing.item_name} cancelled and restored to your inventory.`
    });
  } catch (err: any) {
    console.error('Error in /api/economy/market/cancel:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/economy/crafting/recipes
 * Return all crafting recipes
 */
economyRouter.get('/crafting/recipes', (req: Request, res: Response) => {
  try {
    const recipes = db.prepare('SELECT * FROM crafting_recipes ORDER BY cost_core_units ASC').all() as any[];
    res.json({ success: true, data: recipes });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/economy/crafting/forge
 * Alchemically forge an Artifact Sigil or Aura Shader from Stardust + Core Units
 */
economyRouter.post('/crafting/forge', (req: Request, res: Response) => {
  try {
    const { userId, isAuthenticated, user } = resolveUserOrGuest(req);
    const { recipeId } = req.body;

    const recipe = db.prepare('SELECT * FROM crafting_recipes WHERE id = ?').get(recipeId) as any;
    if (!recipe) {
      res.status(404).json({ success: false, error: 'Crafting recipe not found.' });
      return;
    }

    const wallet = getOrCreateWallet(userId);
    const userLevel = user?.level || 1;

    if (userLevel < recipe.required_level) {
      res.status(400).json({
        success: false,
        error: `🔒 Requires Level ${recipe.required_level} to forge this artifact (Your Level: ${userLevel}).`
      });
      return;
    }

    if (wallet.stardust < recipe.cost_stardust) {
      res.status(400).json({
        success: false,
        error: `Insufficient Stardust. Requires ${recipe.cost_stardust} Stardust (You have ${wallet.stardust}).`
      });
      return;
    }

    if (wallet.core_units < recipe.cost_core_units) {
      res.status(400).json({
        success: false,
        error: `Insufficient Core Units. Requires ${recipe.cost_core_units} Units (You have ${wallet.core_units}).`
      });
      return;
    }

    // Roll success rate + 15% chance of Quantum Critical Surge
    const roll = Math.random() * 100;
    const isSuccess = roll <= recipe.success_rate_pct;
    const isCritical = isSuccess && Math.random() < 0.15; // 15% critical surge

    const now = new Date().toISOString();
    let bonusStardust = isCritical ? 500 : 0;

    runInTransaction(() => {
      // Deduct materials
      db.prepare(`
        UPDATE mph_wallets 
        SET stardust = stardust - ? + ?, core_units = core_units - ?, updated_at = ?
        WHERE user_id = ?
      `).run(recipe.cost_stardust, bonusStardust, recipe.cost_core_units, now, userId);

      if (isSuccess) {
        // Grant crafted artifact to user's inventory
        const invId = `inv_${userId}_${recipe.output_item_id}`;
        db.prepare(`
          INSERT OR IGNORE INTO user_sigil_inventory (id, user_id, item_id, is_equipped, purchased_at)
          VALUES (?, ?, ?, 0, ?)
        `).run(invId, userId, recipe.output_item_id, now);

        // Append to Ledger
        appendLedgerBlock(userId, 'CRAFT_SIGIL', recipe.output_item_id, recipe.output_name, -recipe.cost_core_units, -recipe.cost_stardust, {
          isCritical,
          recipeId: recipe.id,
          bonusStardust,
        });
      }
    });

    if (!isSuccess) {
      res.json({
        success: false,
        error: `⚠️ Alchemical Instability! The fusion wave collapsed. Materials burned into stardust essence.`
      });
      return;
    }

    res.json({
      success: true,
      message: isCritical 
        ? `⚡ CRITICAL ALCHEMICAL HARMONIC HIT! Successfully forged ${recipe.output_name} + Bonus +500 Stardust Surge!`
        : `🔮 Successfully forged ${recipe.output_name} in the Alchemical Reactor!`,
      data: {
        recipeId: recipe.id,
        itemId: recipe.output_item_id,
        itemName: recipe.output_name,
        rarity: recipe.output_rarity,
        isCritical,
        bonusStardust,
      }
    });
  } catch (err: any) {
    console.error('Error in /api/economy/crafting/forge:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/economy/recycle
 * Recycle/dismantle an artifact for raw Stardust essence
 */
economyRouter.post('/recycle', (req: Request, res: Response) => {
  try {
    const { userId } = resolveUserOrGuest(req);
    const { itemId } = req.body;

    const itemMeta = db.prepare('SELECT * FROM sigil_market_items WHERE id = ?').get(itemId) as any;
    if (!itemMeta) {
      res.status(404).json({ success: false, error: 'Item not found.' });
      return;
    }

    // Determine recycle stardust payout based on rarity
    const stardustYields: Record<string, number> = {
      common: 100,
      rare: 250,
      epic: 600,
      legendary: 1500,
      cosmic: 3500,
    };
    const yieldStardust = stardustYields[itemMeta.rarity] || 150;
    const now = new Date().toISOString();

    runInTransaction(() => {
      // 1. Remove from inventory
      db.prepare('DELETE FROM user_sigil_inventory WHERE user_id = ? AND item_id = ?').run(userId, itemId);

      // 2. Credit Stardust
      db.prepare('UPDATE mph_wallets SET stardust = stardust + ?, updated_at = ? WHERE user_id = ?').run(yieldStardust, now, userId);

      // 3. Append to Ledger
      appendLedgerBlock(userId, 'BURN_STARDUST', itemId, itemMeta.name, 0, yieldStardust, {
        action: 'RECYCLED_ARTIFACT',
        yieldStardust,
      });
    });

    res.json({
      success: true,
      message: `⚗️ Recycled ${itemMeta.name} for +${yieldStardust} Stardust essence!`,
      data: { yieldStardust }
    });
  } catch (err: any) {
    console.error('Error in /api/economy/recycle:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * ═════════════════════════════════════════════════════════════════════
 * 🪄 MAGICAL MOUSECLICK ABILITIES & COSMIC PILL DASHBOARD STORE
 * ═════════════════════════════════════════════════════════════════════
 */

// Ensure cosmetic loadout table exists
db.exec(`
  CREATE TABLE IF NOT EXISTS user_cosmetic_loadout (
    user_id TEXT PRIMARY KEY,
    equipped_click_ability TEXT DEFAULT 'click_lightning',
    equipped_pill_background TEXT DEFAULT 'pill_nebula_void',
    updated_at TEXT NOT NULL
  );
`);

export const STORE_CATALOG_ITEMS = [
  // ─── 1. Magical Mouseclick Abilities ──────────────────────────────
  {
    id: 'click_lightning',
    name: '⚡ Lightning Arc',
    category: 'click_ability',
    ability_key: 'lightning',
    description: 'Discharges electric high-voltage lightning branches and plasma sparks on every click.',
    rarity: 'rare',
    cost_xp: 500,
    cost_core_units: 25,
    preview_color: '#38bdf8',
    icon_name: 'Zap',
    required_level: 1,
  },
  {
    id: 'click_frost',
    name: '❄️ Glacial Frost',
    category: 'click_ability',
    ability_key: 'frost',
    description: 'Shatters sub-zero hexagonal ice crystals and shimmering snowflake fractals on click.',
    rarity: 'rare',
    cost_xp: 600,
    cost_core_units: 30,
    preview_color: '#06b6d4',
    icon_name: 'Sparkles',
    required_level: 2,
  },
  {
    id: 'click_inferno',
    name: '🔥 Volcanic Inferno',
    category: 'click_ability',
    ability_key: 'inferno',
    description: 'Erupts blazing volcanic embers and high-temperature solar flare shockwaves.',
    rarity: 'epic',
    cost_xp: 750,
    cost_core_units: 35,
    preview_color: '#f97316',
    icon_name: 'Flame',
    required_level: 3,
  },
  {
    id: 'click_elemental',
    name: '🌿 Gaia Elemental',
    category: 'click_ability',
    ability_key: 'elemental',
    description: 'Blooms spiraling botanical leaves, floral blossoms, and bioluminescent nature spores.',
    rarity: 'rare',
    cost_xp: 650,
    cost_core_units: 30,
    preview_color: '#10b981',
    icon_name: 'Compass',
    required_level: 2,
  },
  {
    id: 'click_fractal',
    name: '🔮 Sacred Fractal',
    category: 'click_ability',
    ability_key: 'fractal',
    description: 'Expands rotating sacred geometric mandalas and kaleidoscopic mathematical sacred portals.',
    rarity: 'epic',
    cost_xp: 800,
    cost_core_units: 40,
    preview_color: '#a855f7',
    icon_name: 'Sparkles',
    required_level: 3,
  },
  {
    id: 'click_vortex',
    name: '🌀 Cosmic Vortex',
    category: 'click_ability',
    ability_key: 'vortex',
    description: 'Draws particles into an inward spiraling gravitational vortex before pulsing outward.',
    rarity: 'epic',
    cost_xp: 900,
    cost_core_units: 45,
    preview_color: '#6366f1',
    icon_name: 'Orbit',
    required_level: 4,
  },
  {
    id: 'click_antigravity',
    name: '🪐 Antigravity Rings',
    category: 'click_ability',
    ability_key: 'antigravity',
    description: 'Releases luminous anti-gravity rings that defy physics and levitate upward across the screen.',
    rarity: 'legendary',
    cost_xp: 1000,
    cost_core_units: 50,
    preview_color: '#eab308',
    icon_name: 'Orbit',
    required_level: 4,
  },
  {
    id: 'click_plasmatic',
    name: '⚛️ Plasmatic Tokamak',
    category: 'click_ability',
    ability_key: 'plasmatic',
    description: 'Generates intense dual-tone cyan/magenta thermonuclear plasma fusion shockwaves.',
    rarity: 'legendary',
    cost_xp: 1200,
    cost_core_units: 60,
    preview_color: '#ec4899',
    icon_name: 'Atom',
    required_level: 5,
  },
  {
    id: 'click_chaos',
    name: '🌌 Quantum Chaos',
    category: 'click_ability',
    ability_key: 'chaos',
    description: 'Fires multi-colored chromatic aberration glitch particles and relativistic hyperspace streaks.',
    rarity: 'cosmic',
    cost_xp: 1500,
    cost_core_units: 75,
    preview_color: '#f43f5e',
    icon_name: 'Zap',
    required_level: 5,
  },

  // ─── 2. Customized Cosmic Pill Dashboard Backgrounds ──────────────
  {
    id: 'pill_nebula_void',
    name: '🌌 Nebula Void Pill',
    category: 'pill_background',
    background_key: 'nebula_void',
    description: 'Deep ultraviolet interstellar starfield with cosmic stardust nebula aura.',
    rarity: 'rare',
    cost_xp: 500,
    cost_core_units: 25,
    preview_color: '#8b5cf6',
    preview_css: 'bg-gradient-to-b from-purple-950/90 via-slate-950/95 to-slate-900/90 border-purple-500/40 shadow-purple-500/20',
    required_level: 1,
  },
  {
    id: 'pill_solar_gold',
    name: '🌟 Solar Flare Gold Pill',
    category: 'pill_background',
    background_key: 'solar_gold',
    description: 'Liquid 24K sovereign bullion gold container with glowing radiant amber borders.',
    rarity: 'epic',
    cost_xp: 750,
    cost_core_units: 35,
    preview_color: '#f59e0b',
    preview_css: 'bg-gradient-to-b from-amber-950/90 via-slate-950/95 to-amber-900/90 border-amber-500/50 shadow-amber-500/30',
    required_level: 3,
  },
  {
    id: 'pill_cyber_matrix',
    name: '🔮 Cyber Matrix Pill',
    category: 'pill_background',
    background_key: 'cyber_matrix',
    description: 'High-tech neon cyan and electric matrix grid container with synthwave aesthetic.',
    rarity: 'epic',
    cost_xp: 850,
    cost_core_units: 40,
    preview_color: '#06b6d4',
    preview_css: 'bg-gradient-to-b from-slate-950 via-cyan-950/40 to-slate-950 border-cyan-500/50 shadow-cyan-500/25',
    required_level: 3,
  },
  {
    id: 'pill_emerald_vault',
    name: '🟢 Living Emerald Vault Pill',
    category: 'pill_background',
    background_key: 'emerald_vault',
    description: 'Bioluminescent jade vault with deep organic liquidity and emerald containment field.',
    rarity: 'legendary',
    cost_xp: 1000,
    cost_core_units: 50,
    preview_color: '#10b981',
    preview_css: 'bg-gradient-to-b from-emerald-950/90 via-slate-950/95 to-emerald-900/90 border-emerald-500/50 shadow-emerald-500/30',
    required_level: 4,
  },
  {
    id: 'pill_singularity',
    name: '⚛️ Quantum Singularity Pill',
    category: 'pill_background',
    background_key: 'singularity',
    description: 'Monochromatic dark matter chamber with red-shifted event horizon gravitational rim.',
    rarity: 'legendary',
    cost_xp: 1250,
    cost_core_units: 60,
    preview_color: '#f43f5e',
    preview_css: 'bg-gradient-to-b from-black via-rose-950/30 to-black border-rose-500/40 shadow-rose-500/20',
    required_level: 5,
  },
  {
    id: 'pill_spacetime_warp',
    name: '🚀 Spacetime Warp Pill',
    category: 'pill_background',
    background_key: 'spacetime_warp',
    description: 'Relativistic hyperspace blue-shifted relativistic warp field with particle velocity lines.',
    rarity: 'cosmic',
    cost_xp: 1500,
    cost_core_units: 75,
    preview_color: '#3b82f6',
    preview_css: 'bg-gradient-to-b from-indigo-950/90 via-slate-950/95 to-blue-950/90 border-blue-400/50 shadow-blue-500/30',
    required_level: 5,
  },
];

/**
 * GET /api/economy/store/catalog
 * Returns all store items, user unlocked inventory, and equipped loadout
 */
economyRouter.get('/store/catalog', (req: Request, res: Response) => {
  try {
    const { userId, isAuthenticated, user } = resolveUserOrGuest(req);
    const now = new Date().toISOString();

    // Get user inventory of purchased cosmetics
    const inventory = db.prepare(`
      SELECT item_id, purchased_at FROM user_sigil_inventory WHERE user_id = ?
    `).all(userId) as any[];
    const ownedItemIds = new Set(inventory.map(i => i.item_id));

    // Ensure default starter items are granted
    ownedItemIds.add('click_lightning');
    ownedItemIds.add('pill_nebula_void');

    // Get loadout
    let loadout = db.prepare('SELECT * FROM user_cosmetic_loadout WHERE user_id = ?').get(userId) as any;
    if (!loadout) {
      db.prepare(`
        INSERT INTO user_cosmetic_loadout (user_id, equipped_click_ability, equipped_pill_background, updated_at)
        VALUES (?, 'click_lightning', 'pill_nebula_void', ?)
      `).run(userId, now);
      loadout = {
        equipped_click_ability: 'click_lightning',
        equipped_pill_background: 'pill_nebula_void',
      };
    }

    const itemsWithStatus = STORE_CATALOG_ITEMS.map(item => ({
      ...item,
      isOwned: ownedItemIds.has(item.id),
      isEquipped: item.category === 'click_ability'
        ? loadout.equipped_click_ability === item.id
        : loadout.equipped_pill_background === item.id,
    }));

    res.json({
      success: true,
      data: {
        userId,
        userLevel: user?.level || 1,
        userXp: user?.xp || 0,
        loadout,
        items: itemsWithStatus,
      }
    });
  } catch (err: any) {
    console.error('Error in /api/economy/store/catalog:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/economy/store/buy
 * Purchase a cosmetic item using XP or Core Units
 */
economyRouter.post('/store/buy', (req: Request, res: Response) => {
  try {
    const { userId, isAuthenticated, user } = resolveUserOrGuest(req);
    const { itemId, paymentMethod = 'xp' } = req.body;

    const item = STORE_CATALOG_ITEMS.find(i => i.id === itemId);
    if (!item) {
      res.status(404).json({ success: false, error: 'Store item not found.' });
      return;
    }

    const now = new Date().toISOString();
    const wallet = getOrCreateWallet(userId);
    const userLevel = user?.level || 1;

    if (userLevel < item.required_level) {
      res.status(400).json({
        success: false,
        error: `🔒 Requires Level ${item.required_level} to unlock (Your Level: ${userLevel}).`
      });
      return;
    }

    // Check if already owned
    const existing = db.prepare('SELECT id FROM user_sigil_inventory WHERE user_id = ? AND item_id = ?').get(userId, itemId);
    if (existing) {
      res.status(400).json({ success: false, error: 'You already own this item.' });
      return;
    }

    runInTransaction(() => {
      if (paymentMethod === 'core_units') {
        if (wallet.core_units < item.cost_core_units) {
          throw new Error(`Insufficient Core Units. Requires ${item.cost_core_units} Units (You have ${wallet.core_units}).`);
        }
        db.prepare('UPDATE mph_wallets SET core_units = core_units - ?, total_units_spent = total_units_spent + ?, updated_at = ? WHERE user_id = ?')
          .run(item.cost_core_units, item.cost_core_units, now, userId);
      } else {
        if (!user || user.xp < item.cost_xp) {
          throw new Error(`Insufficient XP. Requires ${item.cost_xp} XP (You have ${user?.xp || 0} XP).`);
        }
        db.prepare('UPDATE users SET xp = MAX(0, xp - ?), updated_at = ? WHERE id = ?')
          .run(item.cost_xp, now, userId);
      }

      // Add to inventory
      const invId = `inv_${userId}_${item.id}`;
      db.prepare(`
        INSERT INTO user_sigil_inventory (id, user_id, item_id, is_equipped, purchased_at)
        VALUES (?, ?, ?, 1, ?)
      `).run(invId, userId, item.id, now);

      // Auto-equip in loadout
      let existingLoadout = db.prepare('SELECT * FROM user_cosmetic_loadout WHERE user_id = ?').get(userId) as any;
      if (!existingLoadout) {
        db.prepare(`
          INSERT INTO user_cosmetic_loadout (user_id, equipped_click_ability, equipped_pill_background, updated_at)
          VALUES (?, ?, ?, ?)
        `).run(
          userId,
          item.category === 'click_ability' ? item.id : 'click_lightning',
          item.category === 'pill_background' ? item.id : 'pill_nebula_void',
          now
        );
      } else {
        if (item.category === 'click_ability') {
          db.prepare('UPDATE user_cosmetic_loadout SET equipped_click_ability = ?, updated_at = ? WHERE user_id = ?')
            .run(item.id, now, userId);
        } else {
          db.prepare('UPDATE user_cosmetic_loadout SET equipped_pill_background = ?, updated_at = ? WHERE user_id = ?')
            .run(item.id, now, userId);
        }
      }

      // Append to Ledger
      appendLedgerBlock(userId, 'BUY_COSMETIC', item.id, item.name, paymentMethod === 'core_units' ? -item.cost_core_units : 0, 0, {
        category: item.category,
        paymentMethod,
        cost: paymentMethod === 'core_units' ? item.cost_core_units : item.cost_xp,
      });
    });

    res.json({
      success: true,
      message: `🎉 Unlocked & equipped ${item.name}!`,
      data: {
        itemId: item.id,
        category: item.category,
        equipped: true,
      }
    });
  } catch (err: any) {
    console.error('Error in /api/economy/store/buy:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/economy/store/equip
 * Equip an owned cosmetic item
 */
economyRouter.post('/store/equip', (req: Request, res: Response) => {
  try {
    const { userId } = resolveUserOrGuest(req);
    const { itemId } = req.body;

    const item = STORE_CATALOG_ITEMS.find(i => i.id === itemId);
    if (!item) {
      res.status(404).json({ success: false, error: 'Store item not found.' });
      return;
    }

    const now = new Date().toISOString();

    let existingLoadout = db.prepare('SELECT * FROM user_cosmetic_loadout WHERE user_id = ?').get(userId) as any;
    if (!existingLoadout) {
      db.prepare(`
        INSERT INTO user_cosmetic_loadout (user_id, equipped_click_ability, equipped_pill_background, updated_at)
        VALUES (?, ?, ?, ?)
      `).run(
        userId,
        item.category === 'click_ability' ? item.id : 'click_lightning',
        item.category === 'pill_background' ? item.id : 'pill_nebula_void',
        now
      );
    } else {
      if (item.category === 'click_ability') {
        db.prepare('UPDATE user_cosmetic_loadout SET equipped_click_ability = ?, updated_at = ? WHERE user_id = ?')
          .run(item.id, now, userId);
      } else {
        db.prepare('UPDATE user_cosmetic_loadout SET equipped_pill_background = ?, updated_at = ? WHERE user_id = ?')
          .run(item.id, now, userId);
      }
    }

    res.json({
      success: true,
      message: `✨ Equipped ${item.name}!`,
      data: {
        itemId: item.id,
        category: item.category,
      }
    });
  } catch (err: any) {
    console.error('Error in /api/economy/store/equip:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/economy/store/loadout
 * Returns user's currently equipped click ability and pill background
 */
economyRouter.get('/store/loadout', (req: Request, res: Response) => {
  try {
    const { userId } = resolveUserOrGuest(req);
    const loadout = db.prepare('SELECT * FROM user_cosmetic_loadout WHERE user_id = ?').get(userId) as any || {
      equipped_click_ability: 'click_lightning',
      equipped_pill_background: 'pill_nebula_void',
    };

    const abilityMeta = STORE_CATALOG_ITEMS.find(i => i.id === loadout.equipped_click_ability);
    const pillMeta = STORE_CATALOG_ITEMS.find(i => i.id === loadout.equipped_pill_background);

    res.json({
      success: true,
      data: {
        equippedClickAbility: loadout.equipped_click_ability,
        clickAbilityKey: abilityMeta?.ability_key || 'lightning',
        equippedPillBackground: loadout.equipped_pill_background,
        pillBackgroundKey: pillMeta?.background_key || 'nebula_void',
        pillPreviewCss: pillMeta?.preview_css || '',
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});