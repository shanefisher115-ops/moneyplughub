import { Router, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { config } from '../config';
import { db } from '../db';
import jwt from 'jsonwebtoken';

export const salesCopilotRouter = Router();

// Subscription Tiers Source of Truth
export const SUBSCRIPTION_TIERS = [
  {
    id: 'free',
    name: 'Free Lite',
    priceMonthlyUsd: 0,
    priceAnnualMonthlyUsd: 0,
    commissionRatePct: 10,
    referralBonusUsd: 5.0,
    features: [
      '5 referral links',
      'Basic earnings dashboard',
      'MoneyOS AI chat (text only)',
      'Commission tracking',
      'Community access'
    ],
    badge: 'Starter',
  },
  {
    id: 'creator',
    name: 'Creator',
    priceMonthlyUsd: 29,
    priceAnnualMonthlyUsd: 24,
    commissionRatePct: 20,
    referralBonusUsd: 10.0,
    features: [
      'Unlimited referral links',
      'MoneyOS AI Voice (ElevenLabs)',
      'Voice navigation commands',
      'Budget & debt tools',
      'Synthetic yield simulator',
      'Cashback pack access',
      'Priority support'
    ],
    badge: 'Most Popular',
  },
  {
    id: 'pro',
    name: 'Pro',
    priceMonthlyUsd: 149,
    priceAnnualMonthlyUsd: 124,
    commissionRatePct: 35,
    referralBonusUsd: 15.0,
    features: [
      'Full AI Swarm Orchestrator (12 modules)',
      'Advanced net worth analytics',
      'Crypto portfolio tracking',
      'Custom Living Vault themes',
      'Multi-platform referral hub',
      'API access',
      'Dedicated account manager'
    ],
    badge: 'Scale Up',
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    priceMonthlyUsd: 499,
    priceAnnualMonthlyUsd: 415,
    commissionRatePct: 50,
    referralBonusUsd: 25.0,
    features: [
      'White-label deployment',
      'Custom AI agent training',
      'Dedicated infrastructure',
      'SLA guarantees',
      'Bulk referral management',
      'Custom integrations',
      'Priority engineering support'
    ],
    badge: 'Custom & Agency',
  },
];

export interface CalculateEarningsParams {
  referralCount: number;
  tierId: string;
  avgSubscriptionSpendUsd?: number;
}

export function calculateAffiliateEarnings(params: CalculateEarningsParams) {
  const referralCount = Math.max(0, params.referralCount || 0);
  const tier = SUBSCRIPTION_TIERS.find(t => t.id === params.tierId?.toLowerCase()) || SUBSCRIPTION_TIERS[1]; // default Creator
  const avgSpend = Math.max(10, params.avgSubscriptionSpendUsd || tier.priceMonthlyUsd || 29);

  const directBonusTotal = referralCount * tier.referralBonusUsd;
  const monthlyRecurringCommission = Math.round(referralCount * avgSpend * (tier.commissionRatePct / 100) * 100) / 100;
  const annualRecurringCommission = Math.round(monthlyRecurringCommission * 12 * 100) / 100;
  const threeYearProjectedYield = Math.round((directBonusTotal + annualRecurringCommission * 3.5) * 100) / 100;

  return {
    referralCount,
    tierId: tier.id,
    tierName: tier.name,
    commissionRatePct: tier.commissionRatePct,
    referralBonusPerSignupUsd: tier.referralBonusUsd,
    directBonusTotalUsd: directBonusTotal,
    monthlyRecurringUsd: monthlyRecurringCommission,
    annualRecurringUsd: annualRecurringCommission,
    threeYearProjectedYieldUsd: threeYearProjectedYield,
    formatted: {
      monthly: `$${monthlyRecurringCommission.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo`,
      annual: `$${annualRecurringCommission.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/yr`,
      threeYear: `$${threeYearProjectedYield.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      directBonus: `$${directBonusTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    }
  };
}

/**
 * Detect Intent to Trigger Checkout Modal
 */
export function detectCheckoutIntent(prompt: string): { triggerCheckout: boolean; planId?: string } {
  const lower = prompt.toLowerCase();

  if (
    /checkout|upgrade|subscribe|buy|purchase|sign\s*up\s*for|get\s*started\s*with|activate/i.test(lower) ||
    /i\s*want\s*(to\s*)?(buy|upgrade|subscribe|get)|let'?s\s*do\s*(the\s*)?/i.test(lower)
  ) {
    if (/enterprise/i.test(lower)) return { triggerCheckout: true, planId: 'enterprise' };
    if (/pro/i.test(lower)) return { triggerCheckout: true, planId: 'pro' };
    if (/creator/i.test(lower)) return { triggerCheckout: true, planId: 'creator' };
    if (/free|lite/i.test(lower)) return { triggerCheckout: true, planId: 'free' };

    // General upgrade intent defaults to Creator tier
    return { triggerCheckout: true, planId: 'creator' };
  }

  return { triggerCheckout: false };
}

/**
 * POST /api/sales-copilot/chat
 * Gemini Flash AI Voice Sales Copilot Chat Handler
 */
salesCopilotRouter.post('/chat', async (req: Request, res: Response) => {
  try {
    const { message, history = [], currentReferralCount = 10, currentTierId = 'creator' } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ success: false, error: 'Message is required' });
      return;
    }

    const cleanPrompt = message.trim();
    const checkoutInfo = detectCheckoutIntent(cleanPrompt);

    // Calculate sample earnings for context
    const currentCalculation = calculateAffiliateEarnings({
      referralCount: currentReferralCount,
      tierId: currentTierId,
    });

    const sample100 = calculateAffiliateEarnings({ referralCount: 100, tierId: 'creator' });
    const samplePro50 = calculateAffiliateEarnings({ referralCount: 50, tierId: 'pro' });

    // Try Gemini Flash API Inference
    const apiKey = config.google.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_CLOUD_API_KEY;
    let copilotResponse = '';

    const systemPrompt = `You are the AI Sales Copilot for MoneyPlugHub (Creator Money OS) powered by Gemini Flash.
Your goal is to assist users with:
1. Answering questions about subscription tiers (Free Lite $0, Creator $29/mo, Pro $149/mo, Enterprise $499/mo).
2. Calculating projected affiliate earnings interactively.
3. Helping users select the best tier and triggering checkout modals.

=== SUBSCRIPTION TIERS ===
- Free Lite: $0/mo. 5 links, basic dashboard, text AI. 10% commission rate ($5/signup bonus).
- Creator: $29/mo ($24/mo annual). Unlimited links, ElevenLabs AI Voice, budget & debt tools, cashback pack. 20% commission rate ($10/signup bonus).
- Pro: $149/mo ($124/mo annual). Full 12 AI modules, net worth analytics, crypto ledger, custom Living Vault themes, API access. 35% commission rate ($15/signup bonus).
- Enterprise: $499/mo ($415/mo annual). White-label, custom AI agent training, SLA guarantees, dedicated infrastructure. 50% commission rate ($25/signup bonus).

=== AFFILIATE EARNINGS MATH ===
- At 10 referrals on Creator ($29/mo at 20% + $10 bonus): ${currentCalculation.formatted.monthly} ($${currentCalculation.annualRecurringUsd}/yr).
- At 100 referrals on Creator: ${sample100.formatted.monthly} ($${sample100.annualRecurringUsd}/yr).
- At 50 referrals on Pro tier (35% commission): ${samplePro50.formatted.monthly} ($${samplePro50.annualRecurringUsd}/yr).

=== GUIDELINES ===
- Be enthusiastic, professional, articulate, and persuasive.
- Keep responses punchy, concise, and structured with clean markdown tables and bullet points.
- If the user asks about earnings or numbers, show clear calculations.
- If the user shows interest in subscribing or upgrading, explicitly offer to trigger the checkout modal for them.`;

    if (apiKey && apiKey.length > 5) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const result = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `System Directive:\n${systemPrompt}\n\nUser Question:\n"${cleanPrompt}"`,
        });

        copilotResponse = result.text || '';
      } catch (geminiErr: any) {
        console.warn('[SalesCopilot] Gemini Flash fallback notice:', geminiErr.message);
      }
    }

    // Fallback if Gemini Flash API is offline or unconfigured
    if (!copilotResponse) {
      if (checkoutInfo.triggerCheckout) {
        const plan = SUBSCRIPTION_TIERS.find(t => t.id === checkoutInfo.planId) || SUBSCRIPTION_TIERS[1];
        copilotResponse = `### 🚀 Excellent Choice! Opening Checkout for **${plan.name}**

The **${plan.name}** plan is priced at **$${plan.priceMonthlyUsd}/month** (or **$${plan.priceAnnualMonthlyUsd}/month** billed annually with 2 months free).

**Included Features:**
${plan.features.map(f => `* ✅ ${f}`).join('\n')}

* **Commission Rate**: **${plan.commissionRatePct}% recurring** + **$${plan.referralBonusUsd}.00** per direct signup bonus!

Opening the instant checkout modal for you now...`;
      } else if (/tier|plan|pricing|cost|price|feature/i.test(cleanPrompt)) {
        copilotResponse = `### 💎 MoneyPlugHub Subscription Tiers

We offer 4 flexible tiers designed for creators at every stage:

| Plan | Price (Monthly / Annual) | Commission Rate | Key Highlights |
|---|---|---|---|
| **Free Lite** | **$0** / mo | **10%** + $5 Bonus | 5 Referral Links, Text AI, Basic Dashboard |
| **Creator** | **$29** / $24 mo | **20%** + $10 Bonus | Unlimited Links, ElevenLabs AI Voice, Cashback Pack |
| **Pro** | **$149** / $124 mo | **35%** + $15 Bonus | 12 AI Modules, Crypto Ledger, API Access |
| **Enterprise** | **$499** / $415 mo | **50%** + $25 Bonus | White-Label, Custom AI Agent, Dedicated Infrastructure |

Would you like me to calculate your projected earnings or open the checkout modal for a plan?`;
      } else if (/earning|calculate|calculator|commission|referral|yield|make\s*money|mrr/i.test(cleanPrompt)) {
        copilotResponse = `### 💰 Interactive Affiliate Earnings Projection

Here is what you can earn on the **Creator Tier** (20% commission + $10 signup bonus):

* **10 Referrals**: **${currentCalculation.formatted.monthly}** (${currentCalculation.formatted.annual})
* **50 Referrals**: **$290.00/mo** ($3,480.00/yr + $500 direct bonus)
* **100 Referrals**: **${sample100.formatted.monthly}** (${sample100.formatted.annual} + $1,000 direct bonus)

Upgrading to **Pro (35% commission)** boosts 50 referrals to **${samplePro50.formatted.monthly}** (${samplePro50.formatted.annual})!

How many referrals do you plan on bringing in per month?`;
      } else {
        copilotResponse = `### 🤖 AI Sales Copilot (Gemini Flash)

Welcome! I can answer questions about our **Subscription Tiers**, calculate your projected **Affiliate Earnings**, and trigger your **Checkout Modal** instantly.

How can I assist your wealth growth today?`;
      }
    }

    res.json({
      success: true,
      data: {
        response: copilotResponse,
        triggerCheckout: checkoutInfo.triggerCheckout,
        planId: checkoutInfo.planId || null,
        calculation: currentCalculation,
        timestamp: new Date().toISOString(),
      }
    });
  } catch (err: any) {
    console.error('Sales Copilot error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/sales-copilot/calculate
 * Standalone API for real-time interactive affiliate earnings calculations
 */
salesCopilotRouter.post('/calculate', (req: Request, res: Response) => {
  try {
    const { referralCount = 10, tierId = 'creator', avgSubscriptionSpendUsd = 29 } = req.body;

    const result = calculateAffiliateEarnings({
      referralCount: Number(referralCount),
      tierId: String(tierId),
      avgSubscriptionSpendUsd: Number(avgSubscriptionSpendUsd),
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/sales-copilot/tiers
 * Returns all subscription tier specifications and perks
 */
salesCopilotRouter.get('/tiers', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: SUBSCRIPTION_TIERS,
  });
});

export default salesCopilotRouter;
