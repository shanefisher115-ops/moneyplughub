import React, { useState } from 'react';
import {
  X, Check, Zap, Shield, Sparkles, CreditCard, Lock, CheckCircle2, ArrowRight, Gift
} from 'lucide-react';

interface SalesCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPlanId?: string;
  onSuccess?: (tier: string) => void;
}

export const SalesCheckoutModal: React.FC<SalesCheckoutModalProps> = ({
  isOpen,
  onClose,
  selectedPlanId = 'creator',
  onSuccess,
}) => {
  const [activePlanId, setActivePlanId] = useState<string>(selectedPlanId || 'creator');
  const [isAnnual, setIsAnnual] = useState(true);
  const [promoCode, setPromoCode] = useState('');
  const [promoDiscountPct, setPromoDiscountPct] = useState(0);
  const [promoMessage, setPromoMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activated, setActivated] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const plans = [
    {
      id: 'free',
      name: 'Free Lite',
      priceMonthly: 0,
      priceAnnualMonthly: 0,
      badge: 'Starter',
      description: 'Essential tools for new creators',
    },
    {
      id: 'creator',
      name: 'Creator',
      priceMonthly: 29,
      priceAnnualMonthly: 24,
      badge: 'Most Popular',
      description: 'AI Voice, cashback & unlimited links',
    },
    {
      id: 'pro',
      name: 'Pro',
      priceMonthly: 149,
      priceAnnualMonthly: 124,
      badge: 'Scale Up',
      description: '12 AI modules, crypto & net worth analytics',
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      priceMonthly: 499,
      priceAnnualMonthly: 415,
      badge: 'Custom Agency',
      description: 'White-label, custom models & dedicated SLA',
    },
  ];

  const plan = plans.find(p => p.id === activePlanId) || plans[1];
  const baseMonthlyPrice = isAnnual ? plan.priceAnnualMonthly : plan.priceMonthly;
  const totalPriceBeforeDiscount = isAnnual ? baseMonthlyPrice * 12 : baseMonthlyPrice;
  const discountAmount = (totalPriceBeforeDiscount * promoDiscountPct) / 100;
  const finalPrice = Math.max(0, totalPriceBeforeDiscount - discountAmount);

  const handleApplyPromo = () => {
    const clean = promoCode.trim().toUpperCase();
    if (!clean) return;

    if (clean === 'FOUNDING50') {
      setPromoDiscountPct(100);
      setPromoMessage('🎉 100% OFF — Founding Creator Voucher Applied ($0.00)!');
    } else if (clean === 'VIPCREATOR') {
      setPromoDiscountPct(50);
      setPromoMessage('🔥 50% OFF — VIP Creator Promo Applied!');
    } else if (clean === 'EARLYBIRD') {
      setPromoDiscountPct(20);
      setPromoMessage('⚡ 20% OFF — Early Bird Discount Applied!');
    } else {
      setPromoDiscountPct(0);
      setPromoMessage('❌ Invalid promo code. Try FOUNDING50 or VIPCREATOR.');
    }
  };

  const handleSubscribe = async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: `${plan.id}-${isAnnual ? 'annual' : 'monthly'}`,
          plan_id: plan.id,
          promoCode,
          promo_code: promoCode,
        }),
      });

      const data = await res.json();

      if (res.ok && (data.success || data.status === 'SUCCESS')) {
        setActivated(true);
        if (onSuccess) onSuccess(data.tier || plan.name);
      } else {
        setErrorMsg(data.message || data.error || 'Subscription processing failed.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Network connection error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100000] bg-black/90 backdrop-blur-2xl flex items-center justify-center p-4 font-sans animate-fadeIn overflow-y-auto w-full h-[100dvh]">
      <div className="max-w-xl w-full bg-gradient-to-b from-slate-900 via-slate-950 to-black border-2 border-cyan-500/50 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl text-slate-200 relative overflow-hidden">

        {/* Glow Effects */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {activated ? (
          /* SUCCESS STATE */
          <div className="py-8 text-center space-y-5 animate-fadeIn">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-tr from-emerald-400 to-cyan-400 text-slate-950 flex items-center justify-center shadow-2xl shadow-emerald-500/40 animate-bounce">
              <CheckCircle2 className="w-10 h-10 stroke-[2.5]" />
            </div>

            <div className="space-y-2">
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-xs font-bold uppercase tracking-wider border border-emerald-500/40">
                Subscription Activated
              </span>
              <h2 className="text-3xl font-black text-white">
                Welcome to <span className="bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">{plan.name}</span>!
              </h2>
              <p className="text-xs text-slate-300 font-mono max-w-md mx-auto">
                Your account has been upgraded. All premium voice tools, yield simulators, and affiliate multipliers are now active on your profile.
              </p>
            </div>

            <button
              onClick={onClose}
              className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-950 font-black font-mono text-xs uppercase tracking-wider shadow-xl shadow-emerald-500/30 hover:scale-[1.02] transition-all cursor-pointer"
            >
              Start Using {plan.name} →
            </button>
          </div>
        ) : (
          /* CHECKOUT FORM */
          <>
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-mono font-bold uppercase tracking-wider border border-cyan-500/30">
                <Sparkles className="w-3.5 h-3.5" />
                Instant Access Checkout
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Unlock <span className="text-cyan-400">{plan.name} Tier</span>
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                Select your preferred plan and billing cycle. Zero hidden fees. Cancel anytime.
              </p>
            </div>

            {/* Plan Selector Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {plans.map((p) => {
                const isSelected = p.id === activePlanId;
                return (
                  <button
                    key={p.id}
                    onClick={() => setActivePlanId(p.id)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-500/20 border-cyan-400 text-white ring-2 ring-cyan-400/30 shadow-lg shadow-cyan-500/20'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div className="text-xs font-black font-mono text-white">{p.name}</div>
                    <div className="text-[11px] font-mono text-cyan-300 font-bold mt-0.5">
                      ${isAnnual ? p.priceAnnualMonthly : p.priceMonthly}<span className="text-[9px] text-slate-400">/mo</span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Billing Cycle Toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-white/5 border border-white/10 font-mono text-xs">
              <span className="text-slate-300 font-bold">Billing Cycle:</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsAnnual(false)}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer ${
                    !isAnnual ? 'bg-cyan-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setIsAnnual(true)}
                  className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1 ${
                    isAnnual ? 'bg-cyan-500 text-slate-950 font-black' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <span>Annual</span>
                  <span className="px-1.5 py-0.2 rounded bg-emerald-400 text-slate-950 text-[9px] font-black">2 MO FREE</span>
                </button>
              </div>
            </div>

            {/* Promo Code Input */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  placeholder="Promo code (e.g. FOUNDING50)"
                  className="flex-1 px-3.5 py-2.5 bg-black/60 border border-slate-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-cyan-400 uppercase"
                />
                <button
                  onClick={handleApplyPromo}
                  className="px-4 py-2.5 bg-white/10 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-400 text-xs font-mono font-bold text-slate-200 hover:text-cyan-300 rounded-xl transition-all cursor-pointer"
                >
                  Apply
                </button>
              </div>
              {promoMessage && (
                <p className={`text-[11px] font-mono ${promoDiscountPct > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {promoMessage}
                </p>
              )}
            </div>

            {/* Total Price Summary */}
            <div className="p-4 rounded-2xl bg-black/60 border border-cyan-500/30 space-y-2 font-mono text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Base Price ({isAnnual ? 'Annual Billed' : 'Monthly'}):</span>
                <span className="text-white font-bold">${totalPriceBeforeDiscount.toFixed(2)}</span>
              </div>
              {promoDiscountPct > 0 && (
                <div className="flex justify-between text-emerald-400">
                  <span>Promo Discount ({promoDiscountPct}% OFF):</span>
                  <span className="font-bold">-${discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="pt-2 border-t border-white/10 flex justify-between items-baseline">
                <span className="text-sm font-bold text-white">Total Due Today:</span>
                <span className="text-2xl font-black text-cyan-400">${finalPrice.toFixed(2)}</span>
              </div>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-mono">
                ⚠️ {errorMsg}
              </div>
            )}

            {/* Action Buttons */}
            <button
              onClick={handleSubscribe}
              disabled={loading}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 disabled:opacity-50 text-slate-950 font-black font-mono text-sm uppercase tracking-wider shadow-xl shadow-cyan-500/30 transition-all hover:scale-[1.01] cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <CreditCard className="w-4 h-4" />
                  <span>Activate {plan.name} Tier (${finalPrice.toFixed(2)}) →</span>
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-4 text-[10px] font-mono text-slate-500">
              <span className="flex items-center gap-1"><Lock className="w-3 h-3 text-emerald-400" /> 256-Bit Encrypted</span>
              <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-cyan-400" /> 14-Day Money-Back SLA</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
