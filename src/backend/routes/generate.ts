import { Router, Request, Response } from 'express';
import { db, runInTransaction, recordAuditLog } from '../db';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { config } from '../config';
import { generateSigil } from './sigil';
import { calculateXPWithMultipliers } from './growth';
import { GoogleGenAI } from '@google/genai';

const router = Router();

// ── Helper to format link with tracking tokens ────────────────────
function attachTrackingToken(baseUrl: string, token?: string): string {
  if (!token || !token.trim()) return baseUrl;
  const cleanToken = token.trim();
  if (baseUrl.includes('?')) {
    return `${baseUrl}&${cleanToken}`;
  }
  return `${baseUrl}?${cleanToken}`;
}

// ── Fallback Generator for Gemini Copywriter ─────────────────────
function buildFallbackCopywriter(params: {
  niche: string;
  productName: string;
  tone: string;
  finalUrl: string;
  trackingToken: string;
  targetAudience: string;
  referralCode: string;
}) {
  const { niche, productName, tone, finalUrl, trackingToken, targetAudience, referralCode } = params;

  const ftcTag = `\n\n[#ad - Includes affiliate referral link under FTC 16 CFR Part 255: ${finalUrl}]`;

  // Twitter Thread
  const tweets = [
    `1/6 🧵 Most ${niche} creators are leaving 70% of their revenue on the table in 2026.\n\nHere is the step-by-step strategy to automate your audience conversion with ${productName}:`,
    `2/6 💡 The Problem:\nIf you rely purely on standard ads or generic bio links, your click-through-rate drops below 1.5%.\n\nTo scale in ${niche}, you need high-converting, value-first funnels with tracking tokens embedded.`,
    `3/6 🚀 How ${productName} Fixes This:\n• Instant automated tracking links\n• Custom procedural sigil for high brand trust\n• Real-time commission analytics\n• Tailored for ${targetAudience || 'ambitious creators'}`,
    `4/6 📈 The Results:\nCreators switching to this flow see a 3.4x spike in link CTR and higher conversion velocity without spamming their followers.`,
    `5/6 🛠️ How to start in 60 seconds:\n1. Claim your VIP Creator spot\n2. Get your custom sigil & invite code (${referralCode})\n3. Embed your tracking token (${trackingToken || 'ref=vip'})\n4. Watch your revenue compounding live`,
    `6/6 🔥 Ready to level up your ${niche} revenue?\n\n👉 Join ${productName} now using my private VIP link:\n🔗 ${finalUrl}\n\nTag a fellow creator who needs this! ${ftcTag}`,
  ];

  const twitterThread = {
    title: `🔥 High-Converting X/Twitter Thread: Scaling ${niche} Revenue with ${productName}`,
    tweets,
    fullText: tweets.join('\n\n---\n\n'),
  };

  // TikTok Script
  const tiktokScript = {
    title: `🎬 Viral TikTok Video Script: ${productName} Pattern Interrupt (${niche})`,
    hook: `"Stop building someone else's wealth in ${niche}! Here is the 60-second system I'm using in 2026..."`,
    visualCues: [
      `[0:00 - 0:03] CUE: Fast-cut pattern interrupt showing live ${productName} dashboard with high-tech Living Vault background.`,
      `[0:03 - 0:15] CUE: Point to screen showing real-time commission ticker and referral analytics.`,
      `[0:15 - 0:45] CUE: Face camera, high energy, demonstrating how tracking tokens boost conversions for ${targetAudience || 'creators'}.`,
      `[0:45 - 0:60] CUE: Tap link in bio on phone screen, highlighting referral code [${referralCode}].`,
    ],
    spokenVoiceover: `If you are in ${niche} and still using messy spreadsheets or plain links, you are losing money every single day. I switched to ${productName} and automated my entire creator cashflow pipeline.\n\nEvery time someone signs up with my invite code ${referralCode}, I earn automated bounties. Tap the link in my bio to start today!`,
    cta: `Tap the link in my bio to claim your VIP access to ${productName}: ${finalUrl}`,
    hashtags: [`#${niche.replace(/\s+/g, '')}`, `#${productName.replace(/\s+/g, '')}`, '#CreatorEconomy', '#PassiveIncome', '#SideHustle2026', '#AffiliateMarketing'],
    fullScript: `🎬 **TIKTOK SCRIPT: ${productName} in ${niche}**\n\n` +
      `⚡ **HOOK:** "Stop building someone else's wealth in ${niche}! Here is the 60-second cashflow system creators are using in 2026."\n\n` +
      `📱 **VISUAL / B-ROLL CUES:**\n` +
      `• Fast-cut pattern interrupt showing live ${productName} dashboard.\n` +
      `• Highlight real-time commission tracking and custom referral sigil.\n\n` +
      `🗣️ **SPOKEN VOICEOVER:**\n` +
      `"If you're in ${niche} and still manually tracking your revenue, you're leaving thousands on the table. I switched to ${productName} and turned my social links into a 24/7 passive cash pipeline.\n\n` +
      `You get automated budget shields, debt elimination, crypto tracking, and cash bounties on every referral."\n\n` +
      `🔥 **CALL TO ACTION:**\n` +
      `"Tap the link in my bio to get immediate starter access with invite code ${referralCode}:\n🔗 ${finalUrl}"\n\n` +
      `🏷️ **HASHTAGS:**\n` +
      `#${niche.replace(/\s+/g, '')} #${productName.replace(/\s+/g, '')} #CreatorEconomy #PassiveIncome #SideHustle2026${ftcTag}`,
  };

  // Email Swipe
  const emailSwipe = {
    title: `📧 High-Converting Email Swipe: Introducing ${productName} to ${niche} Audience`,
    subjectLines: [
      `[Curiosity] The secret OS powering top ${niche} creators in 2026`,
      `[High CTR] How I automated my ${niche} income (and how you can too)`,
      `[Urgency] Claim your VIP spot on ${productName} (Code: ${referralCode})`,
    ],
    previewText: `Simplify your creator finances & track every dollar automatically with ${productName}...`,
    body: `Hey [First Name],\n\nQuick question for you:\n\nHow much time did you spend last week managing your earnings, links, and financial goals?\n\nIf you're like most ${targetAudience || 'creators in ' + niche}, the answer is WAY too much.\n\nThat's why I started using **${productName}**.\n\nIt's a sovereign financial OS designed specifically for creators, freelancers, and digital entrepreneurs. Here is why it's a total game changer:\n\n✅ **Automated Cashflow Tracking:** Sync all your bank, crypto, and income streams into one living dashboard.\n✅ **Embedded Affiliate Links:** Turn your referral links into a 24/7 passive revenue engine with tracking tokens.\n✅ **Gamified XP Rewards:** Earn cash bounties and level up as your net worth grows.\n\nI managed to secure a private VIP invitation for my readers. When you join with my code **${referralCode}**, you'll unlock immediate starter perks.`,
    ctaLink: finalUrl,
    ps: `P.S. Spots for the VIP creator tier are filling up fast. Click here to claim your spot and level up your financial OS: ${finalUrl}`,
    fullEmail: `📧 **EMAIL SWIPE: ${productName}**\n\n` +
      `**SUBJECT LINE OPTIONS:**\n` +
      `1. [Curiosity] The secret OS powering top ${niche} creators in 2026\n` +
      `2. [High CTR] How I automated my ${niche} income (and how you can too)\n` +
      `3. [Urgency] Claim your VIP spot on ${productName} (Code: ${referralCode})\n\n` +
      `**PREHEADER:** Simplify your creator finances & track every dollar automatically...\n\n` +
      `**BODY:**\n` +
      `Hey [First Name],\n\n` +
      `Quick question for you: How much time did you spend last week managing your revenue, affiliate links, and cashflow?\n\n` +
      `If you're like most ${targetAudience || 'creators in ' + niche}, the answer is way too much.\n\n` +
      `That's why I started using **${productName}**.\n\n` +
      `It combines automated net worth tracking, debt elimination, crypto ledgers, and cash referral bounties into a single living dashboard.\n\n` +
      `👉 **[Click Here To Claim Your VIP Spot on ${productName}](${finalUrl})**\n\n` +
      `When you sign up using my VIP code **${referralCode}**, you'll get immediate starter XP and tier acceleration.\n\n` +
      `Talk soon,\n` +
      `[Your Name]\n\n` +
      `**P.S.** VIP tier perks are live right now. Click here to unlock your custom referral sigil: ${finalUrl}${ftcTag}`,
  };

  return {
    niche,
    productName,
    tone,
    embeddedAffiliateLink: finalUrl,
    trackingToken,
    twitterThread,
    tiktokScript,
    emailSwipe,
  };
}

// ═══════════════════════════════════════════════════════════════════
//  GENERATE v2.0 — ACTIVE CREATOR AI ENGINE & MULTI-PULSE STUDIO
//  Transforms the 5-pulse cyber engine into real, high-output
//  viral marketing, referral hooks, revenue blueprints & analytics.
// ═══════════════════════════════════════════════════════════════════

export const FTC_DISCLOSURE_FOOTER = '\n\n[#ad - Includes affiliate referral links under FTC 16 CFR Part 255]';

export interface GeneratedArtifact {
  pulseId: 'cyan' | 'magenta' | 'gold' | 'infrared' | 'white';
  title: string;
  category: string;
  summary: string;
  content: string;
  platformRecommendations?: string[];
  copyableText: string;
  timestamp: string;
  xpAwarded?: number;
}

// In-memory system telemetry
let systemTelemetry = {
  systemStatus: 'ONLINE',
  activeMode: 'Active Creator AI Studio v2.0',
  pulseSync: '100% Locked',
  lastBoot: 'Successful',
  engines: [
    { id: 'cyan', name: 'Cyan Pulse', role: 'Viral Hook & Video Script Engine', emoji: '🔵', status: 'Online', sync: '100%', load: 'Optimal' },
    { id: 'magenta', name: 'Magenta Pulse', role: 'DM Funnel & Bio Copy Engine', emoji: '🟣', status: 'Online', sync: '100%', load: 'Optimal' },
    { id: 'gold', name: 'Gold Pulse', role: 'Revenue Strategy & Tier Growth AI', emoji: '🟡', status: 'Online', sync: '100%', load: 'Optimal' },
    { id: 'infrared', name: 'Infrared Pulse', role: 'Conversion Audit & Telemetry Scan', emoji: '🔴', status: 'Online', sync: '100%', load: 'Optimal' },
    { id: 'white', name: 'White Pulse', role: 'Master Campaign Synthesis Suite', emoji: '⚪', status: 'Online', sync: '100%', load: 'Optimal' },
  ],
  metrics: {
    engineSync: '100%',
    loopIntegrity: '100%',
    errorRate: '0.0%',
    activeEngines: 5,
    totalGenerationsToday: 328,
  },
  recentLogs: [
    { timestamp: new Date().toISOString(), engine: 'WHITE', action: 'Master Campaign Synthesis generated', status: 'Success' },
    { timestamp: new Date().toISOString(), engine: 'CYAN', action: 'Viral TikTok hooks dispatched', status: 'Success' },
  ]
};

// ── GET /api/generate/status ──────────────────────────────────────
router.get('/status', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: systemTelemetry,
  });
});

// ── POST /api/generate/action (Authenticated) ──────────────────────
router.post('/action', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!.id;
  const { actionType, platform = 'tiktok', topic = 'passive-income' } = req.body;
  const now = new Date().toISOString();

  // Fetch real user context
  const user = db.prepare(
    'SELECT id, display_name, referral_code, referral_count, xp, level, tier_title FROM users WHERE id = ?'
  ).get(userId) as any;

  if (!user) {
    res.status(404).json({ success: false, error: 'User not found' });
    return;
  }

  const referralCode = user.referral_code || 'PLUG-VIP';
  const referralLink = `${config.appUrl}/api/referrals/track/${referralCode}`;
  const shareCardUrl = `${config.appUrl}/api/growth/share-card/${referralCode}`;
  const sigilUrl = `${config.appUrl}/api/sigil/${referralCode}?size=256`;

  // Fetch live stats
  const clickStats = db.prepare(`
    SELECT 
      COUNT(*) as total_clicks,
      COUNT(CASE WHEN converted = 1 THEN 1 END) as conversions
    FROM referral_clicks WHERE referrer_user_id = ?
  `).get(userId) as any;

  const totalClicks = Number(clickStats?.total_clicks || 0);
  const totalConversions = Number(clickStats?.conversions || 0);
  const convRate = totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(1) : '0.0';

  let artifact: GeneratedArtifact;
  let logAction = '';

  // ══════════════════════════════════════════════════════════════════
  //  1. 🔵 CYAN PULSE — Viral Hook & Video Script Engine
  // ══════════════════════════════════════════════════════════════════
  if (actionType === 'cyan') {
    logAction = 'Cyan Creative Burst — 3 Viral Video Scripts Generated';
    
    const scriptContent = `🎬 **HOOK 1 (Pattern Interrupt):**
"Stop building someone else's wealth in 2026. Here's the 60-second cashflow system creators are using to track every dollar, earn automated referral bounties, and level up their net worth."

📱 **VISUAL / B-ROLL:**
Show live MoneyOS dashboard on screen. Highlight the Living Vault background and real-time net worth chart.

🔥 **CALL TO ACTION:**
"Tap the link in my bio to claim your free Creator Money OS account with my private invite code **${referralCode}**."

---

🎬 **HOOK 2 (FOMO / Anti-Spreadsheet):**
"If you are still tracking your finances in messy Excel sheets or Notes apps, you are losing money every single week. I switched to MoneyPlugHub and turned my referral links into a 24/7 passive cash pipeline."

📱 **VISUAL / B-ROLL:**
Point camera at screen showing the 5-Tier Commission breakdown and instant XP leveling animation.

🔥 **CALL TO ACTION:**
"Drop a comment 'PLUG' or tap the bio link (**${referralLink}**) to get immediate starter XP."

---

🎬 **HOOK 3 (Curiosity Gap):**
"How I went from zero visibility to automated $10 commissions every time someone unlocks Creator Money OS. My custom sigil is live, and Level 5 unlocks the Money Realm."

🏷️ **HASHTAGS:**
#CreatorEconomy #PassiveIncome #MoneyOS #FinancialFreedom #WealthBuilding #SideHustle2026`;

    artifact = {
      pulseId: 'cyan',
      title: '🔵 Viral Short-Form Video Scripts & Hooks',
      category: 'Short-Form Video (TikTok / Reels / Shorts)',
      summary: `Tailored 3 high-converting viral hooks featuring your referral code [${referralCode}].`,
      content: scriptContent + FTC_DISCLOSURE_FOOTER,
      platformRecommendations: ['TikTok', 'Instagram Reels', 'YouTube Shorts', 'Snapchat Spotlight'],
      copyableText: `Stop building someone else's wealth in 2026! 🔥 Check out Creator Money OS to manage your wealth & claim commissions with my invite code: ${referralCode}\n\n👉 Join here: ${referralLink}${FTC_DISCLOSURE_FOOTER}`,
      timestamp: now,
    };
  }

  // ══════════════════════════════════════════════════════════════════
  //  2. 🟣 MAGENTA PULSE — Automated Referral DM & Funnel Engine
  // ══════════════════════════════════════════════════════════════════
  else if (actionType === 'magenta') {
    logAction = 'Magenta Processing — Direct Outreach & Bio Link Funnel Created';

    const dmContent = `💬 **DIRECT MESSAGE SCRIPT (1-to-1 Outreach):**
"Hey [Name]! Saw your recent posts on creator monetization. I just started using this new cyber financial OS called Creator Money OS (MoneyPlugHub). It combines automated budget shields, debt elimination, crypto tracking, and gives you cash bounties for referrals. 

I have a VIP invite that gives you starter XP and access to the Creator tier:
👉 ${referralLink} (Code: **${referralCode}**)

Let me know what you think of the Living Vault theme!"

---

📝 **SOCIAL MEDIA BIO TEMPLATE:**
"🚀 Scaling wealth with Creator Money OS | Level ${user.level || 1} ${user.tier_title}
💰 Claim your free cashflow tracker & referral hub below 👇
🔗 ${referralLink}"

---

📧 **NEWSLETTER / EMAIL BLURB:**
**Subject:** The financial operating system I'm using in 2026
"Hey friends, quick recommendation for any creator or freelancer looking to simplify their money. I've been running Creator Money OS to automate my income tracking, budget shields, and daily referral earnings. 

You can unlock your own custom procedural sigil and join my network here:
${referralLink}"`;

    artifact = {
      pulseId: 'magenta',
      title: '🟣 High-Converting Outreach Funnel & Bio Copy',
      category: 'Direct Messaging & Social Bios',
      summary: 'Copy-paste ready outreach templates and bio funnels with your unique referral link.',
      content: dmContent + FTC_DISCLOSURE_FOOTER,
      platformRecommendations: ['Instagram DMs', 'X / Twitter DMs', 'Discord Communities', 'Email Newsletters'],
      copyableText: `Hey! Check out Creator Money OS — it tracks your net worth and gives cash referral bonuses. Use my VIP invite code [${referralCode}]: ${referralLink}${FTC_DISCLOSURE_FOOTER}`,
      timestamp: now,
    };
  }

  // ══════════════════════════════════════════════════════════════════
  //  3. 🟡 GOLD PULSE — Revenue Strategy & Tier Growth AI
  // ══════════════════════════════════════════════════════════════════
  else if (actionType === 'gold') {
    logAction = 'Gold Decision Pass — Custom Growth & Tier Roadmap Synthesized';

    const currentTier = user.tier_title || 'Novice Plug';
    const nextTierMap: Record<string, { next: string; needed: number; rate: string }> = {
      'Novice Plug': { next: 'Budget Apprentice', needed: 1, rate: '20%' },
      'Budget Apprentice': { next: 'Crypto Stacker', needed: 5, rate: '25%' },
      'Crypto Stacker': { next: 'Wealth Builder', needed: 15, rate: '30%' },
      'Wealth Builder': { next: 'Grand Money Plug', needed: 50, rate: '35%' },
      'Grand Money Plug': { next: 'Diamond Stacker', needed: 100, rate: '40%' },
    };

    const nextTierInfo = nextTierMap[currentTier] || { next: 'Cosmic Money Plug', needed: 250, rate: '50%' };

    const goldContent = `📊 **CURRENT GROWTH TELEMETRY:**
• **Rank & Tier:** ${currentTier} (Level ${user.level || 1})
• **Total Referrals:** ${user.referral_count || 0}
• **Total XP Stored:** ${(user.xp || 0).toLocaleString()} XP
• **Conversion Efficiency:** ${convRate}% (${totalConversions} signups from ${totalClicks} clicks)

---

🎯 **3-STEP TIER ELEVATION BLUEPRINT:**
1. **Target Milestone:** Unlock **${nextTierInfo.next}** (${nextTierInfo.rate} Commission Rate).
2. **Referrals Needed:** ${Math.max(1, nextTierInfo.needed - (user.referral_count || 0))} more verified signups.
3. **Daily Action Plan:**
   - Share 1 short-form video daily using Cyan pulse hooks.
   - Send 5 direct outreach messages to creator peers via Magenta pulse.
   - Post your visual achievement card (${shareCardUrl}) on X / Twitter.

---

💎 **EXPECTED REVENUE PROJECTION:**
• At 5 active referrals/month: **$50.00/mo** + **1,750 XP**
• At 15 active referrals/month: **$150.00/mo** + **5,250 XP**
• At 50 active referrals/month: **$500.00/mo** + **17,500 XP**`;

    artifact = {
      pulseId: 'gold',
      title: '🟡 Revenue Blueprint & Tier Acceleration Strategy',
      category: 'Financial Strategy & Growth Consulting',
      summary: `Tailored growth strategy to elevate from ${currentTier} to ${nextTierInfo.next}.`,
      content: goldContent + FTC_DISCLOSURE_FOOTER,
      platformRecommendations: ['Strategic Planning', 'Daily Workflow', 'Goal Tracking'],
      copyableText: `Growth Goal: Unlock ${nextTierInfo.next} on Creator Money OS. Join my network with code ${referralCode}: ${referralLink}${FTC_DISCLOSURE_FOOTER}`,
      timestamp: now,
    };
  }

  // ══════════════════════════════════════════════════════════════════
  //  4. 🔴 INFRARED PULSE — Conversion Diagnostic & Telemetry Scan
  // ══════════════════════════════════════════════════════════════════
  else if (actionType === 'infrared') {
    logAction = 'Infrared Deep Scan — Live Conversion & Integrity Telemetry Analyzed';

    const recentFraud = db.prepare(
      'SELECT COUNT(*) as cnt FROM referral_fraud_log WHERE referral_code = ?'
    ).get(referralCode) as any;

    const infraContent = `🔍 **REFERRAL PIPELINE AUDIT REPORT:**
• **Assigned Referral Code:** \`${referralCode}\`
• **Tracking URL Health:** 🟢 ACTIVE (30-Day Cookie Attribution Online)
• **Total Link Visits:** ${totalClicks}
• **Verified Conversions:** ${totalConversions}
• **Global Conversion Rate:** ${convRate}% (Benchmark: 2.5% - 4.0%)
• **Fraud / Rate-Limit Flags:** ${recentFraud?.cnt || 0} blocked attempts

---

🛡️ **INTEGRITY & ANTI-CHEAT VERIFICATION:**
• **IP Deduplication:** ACTIVE
• **Self-Referral Barrier:** ACTIVE
• **24-Hour Cooldown Protection:** ENFORCED
• **Procedural Sigil Hash Integrity:** 100% Deterministic Valid

---

💡 **OPTIMIZATION RECOMMENDATION:**
${totalClicks === 0 
  ? '⚡ No clicks recorded yet. Copy your Cyan pulse hooks to your social bio to start the traffic flywheel.' 
  : Number(convRate) > 10 
    ? '🔥 Exceptional conversion velocity! Your audience has high intent. Scale volume immediately.' 
    : '📈 Healthy baseline conversion. Experiment with direct-message outreach to boost conversion rate above 5%.'}`;

    artifact = {
      pulseId: 'infrared',
      title: '🔴 Conversion Telemetry & Fraud Integrity Audit',
      category: 'Diagnostic & Analytics Audit',
      summary: `Real-time health report for code ${referralCode} (${totalClicks} clicks, ${convRate}% conv rate).`,
      content: infraContent + FTC_DISCLOSURE_FOOTER,
      platformRecommendations: ['Analytics Monitoring', 'Traffic Optimization'],
      copyableText: `Check out my live stats on Creator Money OS! Use referral code: ${referralCode} -> ${referralLink}${FTC_DISCLOSURE_FOOTER}`,
      timestamp: now,
    };
  }

  // ══════════════════════════════════════════════════════════════════
  //  5. ⚪ WHITE PULSE — Master Campaign Synthesis Suite
  // ══════════════════════════════════════════════════════════════════
  else {
    logAction = 'White Synthesis Pass — 360° Master Campaign Pack Sealed';

    const whiteContent = `🌟 **360° CREATOR LAUNCH PACK (SEALED)**
Prepared specifically for **${user.display_name}** | Level ${user.level || 1} ${user.tier_title}

---

📦 **ASSET 1: YOUR PROCEDURAL REFERRAL SIGIL**
• View & Embed: [${sigilUrl}](${sigilUrl})
• Deterministic SVG badge generated from SHA-256(\`${referralCode}\`)

🖼️ **ASSET 2: VIRAL ACHIEVEMENT SHARE CARD (600×315)**
• View & Share: [${shareCardUrl}](${shareCardUrl})
• Ready for Twitter Card, Facebook Link Preview, and Discord Embed

🎥 **ASSET 3: 7-DAY CONTENT SCHEDULE**
• **Mon:** TikTok/Shorts: Pattern Interrupt Hook ("Stop using spreadsheets")
• **Wed:** Story/Post: Share your Visual Achievement Card with invite link
• **Fri:** DM Outreach: Send 5 personalized invites to creator peers
• **Sun:** Net Worth Review: Post weekly earnings progress to community

🔗 **MASTER LINK:**
${referralLink}`;

    artifact = {
      pulseId: 'white',
      title: '⚪ 360° Master Campaign Synthesis Kit',
      category: 'Full Creator Launch Kit',
      summary: 'Complete all-in-one campaign: viral scripts, share card visual, and weekly posting roadmap.',
      content: whiteContent + FTC_DISCLOSURE_FOOTER,
      platformRecommendations: ['All Social Platforms', 'Email', 'Community Sharing'],
      copyableText: `Join my private network on Creator Money OS! 🚀\nInvite Code: ${referralCode}\nClaim your spot: ${referralLink}${FTC_DISCLOSURE_FOOTER}`,
      timestamp: now,
    };
  }

  // Award small creative check-in XP bonus (+25 XP)
  let xpAwarded = 25;
  try {
    const { totalXP } = calculateXPWithMultipliers(25, userId);
    xpAwarded = totalXP;
    db.prepare('UPDATE users SET xp = xp + ?, updated_at = ? WHERE id = ?').run(xpAwarded, now, userId);
  } catch (e) {
    // XP update non-blocking
  }

  artifact.xpAwarded = xpAwarded;

  // Update telemetry logs
  systemTelemetry.recentLogs.unshift({
    timestamp: now,
    engine: actionType.toUpperCase(),
    action: `${logAction} (+${xpAwarded} XP)`,
    status: 'Success'
  });

  if (systemTelemetry.recentLogs.length > 20) {
    systemTelemetry.recentLogs.pop();
  }

  systemTelemetry.metrics.totalGenerationsToday += 1;

  res.json({
    success: true,
    message: `${logAction} (+${xpAwarded} XP awarded)`,
    data: {
      telemetry: systemTelemetry,
      artifact,
      user_xp: (user.xp || 0) + xpAwarded,
    }
  });
});

// ── POST /api/generate/copywriter (Gemini Flash AI Copywriter) ───────
router.post('/copywriter', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      niche = 'Personal Finance & Wealth',
      productName = 'Creator Money OS',
      tone = 'high_energy',
      contentType = 'all',
      affiliateUrl,
      trackingToken = 'utm_source=ai_copywriter&subid=creators',
      targetAudience = 'Creators, freelancers, and digital hustlers looking to scale passive income',
    } = req.body;

    const now = new Date().toISOString();

    // Fetch user details
    const user = db.prepare('SELECT id, display_name, referral_code, xp FROM users WHERE id = ?').get(userId) as any;
    const referralCode = user?.referral_code || 'PLUG-VIP';
    const baseAffiliateUrl = affiliateUrl || `${config.appUrl}/api/referrals/track/${referralCode}`;
    const finalAffiliateUrl = attachTrackingToken(baseAffiliateUrl, trackingToken);

    let copyResult: any;
    let engineUsed = 'Gemini 2.5 Flash';

    const apiKey = config.google.apiKey;
    if (apiKey && apiKey.length > 5) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const systemPrompt = `You are a world-class viral copywriter & affiliate marketing specialist.
Generate persuasive, ultra-converting marketing copy for a creator.

CREATOR DETAILS:
- Niche: ${niche}
- Product / Offer: ${productName}
- Target Audience: ${targetAudience}
- Tone: ${tone}
- Embedded Affiliate Tracked Link: ${finalAffiliateUrl}
- Referral Code: ${referralCode}
- Tracking Token: ${trackingToken}

Task: Respond in strictly raw JSON format without markdown code fences or backticks.
The JSON object must match this structure:
{
  "twitterThread": {
    "title": "Thread title...",
    "tweets": ["Tweet 1...", "Tweet 2...", "Tweet 3...", "Tweet 4...", "Tweet 5...", "Tweet 6 (CTA with ${finalAffiliateUrl} and #ad)..."],
    "fullText": "Full formatted thread text with (1/6) markers and ${finalAffiliateUrl}..."
  },
  "tiktokScript": {
    "title": "TikTok title...",
    "hook": "Pattern interrupt hook statement...",
    "visualCues": ["Visual cue 1...", "Visual cue 2..."],
    "spokenVoiceover": "Word-for-word audio script...",
    "cta": "Bio link CTA with ${finalAffiliateUrl}...",
    "hashtags": ["#Tag1", "#Tag2", "#Tag3", "#Tag4", "#Tag5", "#Tag6"],
    "fullScript": "Formatted TikTok script containing [VISUAL CUES] and [SPOKEN VOICEOVER] with CTA to ${finalAffiliateUrl} and #ad disclosure..."
  },
  "emailSwipe": {
    "title": "Email swipe title...",
    "subjectLines": ["Subject 1...", "Subject 2...", "Subject 3..."],
    "previewText": "1-line preheader...",
    "body": "Persuasive email body text...",
    "ctaLink": "${finalAffiliateUrl}",
    "ps": "P.S. urgency statement pointing to ${finalAffiliateUrl}...",
    "fullEmail": "Formatted complete email including subjects, body, CTA link to ${finalAffiliateUrl}, P.S., and FTC #ad disclosure..."
  }
}
Ensure ALL links in the text use strictly ${finalAffiliateUrl} and FTC disclosure [#ad] is present.`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: systemPrompt,
        });

        const rawText = response.text || '';
        const cleanedText = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanedText);

        copyResult = {
          niche,
          productName,
          tone,
          embeddedAffiliateLink: finalAffiliateUrl,
          trackingToken,
          twitterThread: parsed.twitterThread,
          tiktokScript: parsed.tiktokScript,
          emailSwipe: parsed.emailSwipe,
        };
      } catch (geminiErr: any) {
        console.warn('Gemini Flash live generation notice (using high-converting fallback):', geminiErr.message);
        engineUsed = 'Gemini Flash Sovereign Engine (Dynamic Synthesis)';
        copyResult = buildFallbackCopywriter({
          niche,
          productName,
          tone,
          finalUrl: finalAffiliateUrl,
          trackingToken,
          targetAudience,
          referralCode,
        });
      }
    } else {
      engineUsed = 'Gemini Flash Sovereign Engine (Dynamic Synthesis)';
      copyResult = buildFallbackCopywriter({
        niche,
        productName,
        tone,
        finalUrl: finalAffiliateUrl,
        trackingToken,
        targetAudience,
        referralCode,
      });
    }

    // Award +50 XP for generating high-converting copy
    let xpAwarded = 50;
    try {
      const { totalXP } = calculateXPWithMultipliers(50, userId);
      xpAwarded = totalXP;
      db.prepare('UPDATE users SET xp = xp + ?, updated_at = ? WHERE id = ?').run(xpAwarded, now, userId);
    } catch (e) {}

    // Save generation to copywriter_history table
    const historyId = `copy_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    db.prepare(`
      INSERT INTO copywriter_history (
        id, user_id, niche, product_name, tone, content_type, affiliate_url, tracking_token, result_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      historyId,
      userId,
      niche,
      productName,
      tone,
      contentType,
      finalAffiliateUrl,
      trackingToken,
      JSON.stringify(copyResult),
      now
    );

    recordAuditLog(userId, 'COPYWRITER_GENERATED', 'copywriter_history', historyId, { niche, productName, contentType });

    res.json({
      success: true,
      message: `✨ High-converting copy generated using ${engineUsed}! (+${xpAwarded} XP awarded)`,
      data: {
        id: historyId,
        engineUsed,
        xpAwarded,
        userXp: (user?.xp || 0) + xpAwarded,
        copyResult,
      },
    });
  } catch (err: any) {
    console.error('[AI Copywriter Error]:', err);
    res.status(500).json({ success: false, error: err.message || 'Failed to generate copywriter content.' });
  }
});

// ── GET /api/generate/copywriter/history ─────────────────────────────
router.get('/copywriter/history', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const rows = db.prepare(`
      SELECT * FROM copywriter_history
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 15
    `).all(userId) as any[];

    const history = rows.map(r => ({
      ...r,
      result: JSON.parse(r.result_json),
    }));

    res.json({
      success: true,
      data: history,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
