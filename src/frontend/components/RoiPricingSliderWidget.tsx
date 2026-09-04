import React, { useState } from 'react';
import {
  Users, DollarSign, Percent, TrendingUp, Sparkles, Zap,
  ArrowRight, Award, BarChart3, PieChart, CheckCircle2,
  Calculator, RefreshCw, ShieldCheck, Check, Layers
} from 'lucide-react';

interface RoiPricingSliderWidgetProps {
  onNavigate?: (tab: string) => void;
  className?: string;
}

export const RoiPricingSliderWidget: React.FC<RoiPricingSliderWidgetProps> = ({
  onNavigate,
  className = ''
}) => {
  // Inputs
  const [audienceSize, setAudienceSize] = useState<number>(25000);
  const [avgOrderValue, setAvgOrderValue] = useState<number>(50);
  const [conversionRate, setConversionRate] = useState<number>(2.0);
  const [creatorCommission, setCreatorCommission] = useState<number>(15);

  // Calculations
  const monthlyBuyers = Math.round(audienceSize * (conversionRate / 100));
  const grossMonthlyGmv = Math.round(monthlyBuyers * avgOrderValue);
  const monthlyIncome = Math.round(grossMonthlyGmv * (creatorCommission / 100));
  const annualIncome = monthlyIncome * 12;
  const dailyIncome = Math.round((monthlyIncome / 30) * 100) / 100;

  // Plan Costs
  const creatorPlanCostMonthly = 29;
  const proPlanCostMonthly = 149;

  // ROI Metrics
  const creatorPlanNetProfit = Math.max(0, monthlyIncome - creatorPlanCostMonthly);
  const creatorRoiPercent = Math.round((creatorPlanNetProfit / creatorPlanCostMonthly) * 100);
  const creatorRoiMultiplier = (monthlyIncome / creatorPlanCostMonthly).toFixed(1);

  const proPlanNetProfit = Math.max(0, monthlyIncome - proPlanCostMonthly);
  const proRoiPercent = Math.round((proPlanNetProfit / proPlanCostMonthly) * 100);
  const proRoiMultiplier = (monthlyIncome / proPlanCostMonthly).toFixed(1);

  // Recommendation
  const recommendedPlan = monthlyIncome >= 3000 ? 'pro' : monthlyIncome >= 150 ? 'creator' : 'free';

  // Number Formatters
  const formatAudienceNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(num % 1000000 === 0 ? 0 : 1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(num % 1000 === 0 ? 0 : 1) + 'K';
    }
    return num.toLocaleString();
  };

  // Preset Handlers
  const applyPreset = (audience: number, aov: number, conv: number, comm: number) => {
    setAudienceSize(audience);
    setAvgOrderValue(aov);
    setConversionRate(conv);
    setCreatorCommission(comm);
  };

  return (
    <div className={`bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-plug-accent/30 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden space-y-8 ${className}`}>
      {/* Background Ambient Glows */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-plug-accent/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6 relative z-10">
        <div>
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-plug-accent/15 border border-plug-accent/30 text-plug-accent text-xs font-mono font-bold uppercase tracking-wider mb-2">
            <Calculator className="w-3.5 h-3.5" />
            Interactive Creator ROI Engine
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Calculate Your Creator Earnings & Plan ROI
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 font-mono mt-1 max-w-2xl">
            Adjust your audience parameters, conversion rate, and average order value to project monthly creator income and compare your return on investment against MoneyPlug plans.
          </p>
        </div>

        {/* Audience Scale Presets */}
        <div className="flex flex-wrap items-center gap-2 relative z-10">
          <span className="text-[11px] font-mono text-slate-500 uppercase font-bold mr-1">Presets:</span>
          <button
            onClick={() => applyPreset(5000, 35, 1.5, 15)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-mono transition-all cursor-pointer ${
              audienceSize === 5000 && avgOrderValue === 35
                ? 'bg-sky-500/20 border-sky-400 text-sky-300 font-bold'
                : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            🌱 Nano (5K)
          </button>
          <button
            onClick={() => applyPreset(25000, 50, 2.0, 15)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-mono transition-all cursor-pointer ${
              audienceSize === 25000 && avgOrderValue === 50
                ? 'bg-plug-accent/20 border-plug-accent text-plug-accent font-bold'
                : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            📱 Micro (25K)
          </button>
          <button
            onClick={() => applyPreset(100000, 75, 2.5, 20)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-mono transition-all cursor-pointer ${
              audienceSize === 100000 && avgOrderValue === 75
                ? 'bg-amber-500/20 border-amber-400 text-amber-300 font-bold'
                : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            🔥 Macro (100K)
          </button>
          <button
            onClick={() => applyPreset(500000, 100, 3.0, 25)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-mono transition-all cursor-pointer ${
              audienceSize === 500000 && avgOrderValue === 100
                ? 'bg-purple-500/20 border-purple-400 text-purple-300 font-bold'
                : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            🚀 Viral (500K)
          </button>
        </div>
      </div>

      {/* Main Interactive Grid: Controls vs Revenue Output */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">

        {/* Left Column: Interactive Sliders (7 Cols) */}
        <div className="lg:col-span-7 space-y-5">

          {/* Slider 1: Audience Size */}
          <div className="p-5 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-bold text-slate-300 flex items-center gap-2">
                <Users className="w-4 h-4 text-plug-accent" />
                Audience Size (Followers / Monthly Viewers):
              </label>
              <span className="text-lg font-black text-plug-accent font-mono px-3 py-0.5 rounded-md bg-plug-accent/10 border border-plug-accent/20">
                {formatAudienceNumber(audienceSize)} <span className="text-xs text-slate-400 font-normal">creators/fans</span>
              </span>
            </div>
            <input
              type="range"
              min={1000}
              max={1000000}
              step={1000}
              value={audienceSize}
              onChange={(e) => setAudienceSize(Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-plug-accent"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>1K (Starter)</span>
              <span>100K (Mid-tier)</span>
              <span>500K (Powerhouse)</span>
              <span>1M+ (Celebrity)</span>
            </div>
          </div>

          {/* Slider 2: Average Order Value (AOV) */}
          <div className="p-5 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-bold text-slate-300 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                Average Order / Transaction Value (AOV):
              </label>
              <span className="text-lg font-black text-emerald-400 font-mono px-3 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                ${avgOrderValue}.00 <span className="text-xs text-slate-400 font-normal">/ order</span>
              </span>
            </div>
            <input
              type="range"
              min={10}
              max={300}
              step={5}
              value={avgOrderValue}
              onChange={(e) => setAvgOrderValue(Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>$10 (Micro product / app)</span>
              <span>$50 (E-com / Digital asset)</span>
              <span>$150 (SaaS / Course)</span>
              <span>$300+ (High-ticket)</span>
            </div>
          </div>

          {/* Slider 3: Conversion Rate */}
          <div className="p-5 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-bold text-slate-300 flex items-center gap-2">
                <Percent className="w-4 h-4 text-sky-400" />
                Audience Conversion Rate (%):
              </label>
              <span className="text-lg font-black text-sky-400 font-mono px-3 py-0.5 rounded-md bg-sky-500/10 border border-sky-500/20">
                {conversionRate.toFixed(1)}% <span className="text-xs text-slate-400 font-normal">buyer rate</span>
              </span>
            </div>
            <input
              type="range"
              min={0.1}
              max={10.0}
              step={0.1}
              value={conversionRate}
              onChange={(e) => setConversionRate(Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>0.1% (Low intent)</span>
              <span>2.0% (Average creator)</span>
              <span>5.0% (High trust bio link)</span>
              <span>10.0% (Hot warm leads)</span>
            </div>
          </div>

          {/* Slider 4: Creator Commission / Revenue Share */}
          <div className="p-5 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-bold text-slate-300 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-purple-400" />
                Creator Commission Share / Take Rate:
              </label>
              <span className="text-lg font-black text-purple-400 font-mono px-3 py-0.5 rounded-md bg-purple-500/10 border border-purple-500/20">
                {creatorCommission}% <span className="text-xs text-slate-400 font-normal">cut</span>
              </span>
            </div>
            <input
              type="range"
              min={5}
              max={50}
              step={5}
              value={creatorCommission}
              onChange={(e) => setCreatorCommission(Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-400"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>5% (Affiliate)</span>
              <span>15% (MoneyPlug default)</span>
              <span>30% (High-margin digital)</span>
              <span>50% (Own brand)</span>
            </div>
          </div>

        </div>

        {/* Right Column: Calculated Earnings & Metrics Cards (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-4">

          {/* Main Earnings Projection Card */}
          <div className="p-6 rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border-2 border-plug-accent shadow-2xl shadow-plug-accent/15 space-y-4 relative">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400 uppercase font-bold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-plug-accent" /> Projected Income
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                {monthlyBuyers.toLocaleString()} buyers / mo
              </span>
            </div>

            <div>
              <span className="text-xs font-mono text-slate-400 block">Monthly Creator Income</span>
              <div className="text-4xl sm:text-5xl font-black text-white font-mono tracking-tight flex items-baseline gap-2 mt-1">
                ${monthlyIncome.toLocaleString()}
                <span className="text-xs font-mono text-slate-400 font-normal">/ month</span>
              </div>
              <span className="text-xs font-mono text-plug-accent block mt-1 font-bold">
                ${annualIncome.toLocaleString()} / year projected ARR
              </span>
            </div>

            {/* Run-Rate Micro Breakdown */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800 text-xs font-mono">
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Gross Monthly GMV</span>
                <span className="text-sm font-bold text-sky-300">${grossMonthlyGmv.toLocaleString()}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-500 block uppercase font-bold">Daily Earnings Run-Rate</span>
                <span className="text-sm font-bold text-emerald-400">${dailyIncome.toFixed(2)}/day</span>
              </div>
            </div>
          </div>

          {/* Quick ROI Formula Summary */}
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-2 text-xs font-mono">
            <div className="text-slate-300 font-bold flex items-center justify-between">
              <span>Monthly Buyer Volume:</span>
              <span className="text-white font-black">{formatAudienceNumber(audienceSize)} × {conversionRate}% = {monthlyBuyers.toLocaleString()} buyers</span>
            </div>
            <div className="text-slate-400 text-[11px] leading-relaxed">
              Generating <strong className="text-white">${avgOrderValue} AOV</strong> with a <strong className="text-purple-400">{creatorCommission}% revenue share</strong> turns {formatAudienceNumber(audienceSize)} audience members into <strong className="text-plug-accent">${monthlyIncome.toLocaleString()}/mo</strong> pure cashflow.
            </div>
          </div>

        </div>
      </div>

      {/* ═══ MONEYPLUG PLAN ROI COMPARISON CARDS ═══ */}
      <div className="pt-4 space-y-4 relative z-10">
        <div className="text-center space-y-1">
          <h3 className="text-lg sm:text-xl font-black text-white flex items-center justify-center gap-2">
            <Zap className="w-5 h-5 text-plug-accent" /> MoneyPlug Plan ROI Analysis
          </h3>
          <p className="text-xs text-slate-400 font-mono">
            See how your projected monthly earnings compare against MoneyPlug subscription costs.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card 1: Free Lite */}
          <div className={`p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
            recommendedPlan === 'free'
              ? 'bg-slate-900/90 border-slate-600 shadow-lg'
              : 'bg-slate-950/70 border-slate-800 opacity-90'
          }`}>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-300 uppercase font-mono">Free Lite</span>
                {recommendedPlan === 'free' && (
                  <span className="px-2 py-0.5 rounded-md bg-slate-700 text-slate-200 text-[10px] font-bold">
                    RECOMMENDED
                  </span>
                )}
              </div>

              <div>
                <div className="text-2xl font-black text-white font-mono">$0 <span className="text-xs text-slate-400 font-normal">/ mo</span></div>
                <p className="text-[11px] text-slate-400 font-mono mt-1">For getting started with basic referral links.</p>
              </div>

              <div className="pt-2 border-t border-slate-800 space-y-1.5 text-xs font-mono text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-500">Monthly Net Revenue:</span>
                  <strong className="text-white">${monthlyIncome.toLocaleString()}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Plan ROI:</span>
                  <strong className="text-slate-400">Baseline ($0 cost)</strong>
                </div>
              </div>
            </div>

            <button
              onClick={() => onNavigate?.('register')}
              className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold font-mono text-xs transition-colors cursor-pointer"
            >
              Start Free
            </button>
          </div>

          {/* Card 2: Creator Plan ($29/mo) */}
          <div className={`p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 relative ${
            recommendedPlan === 'creator'
              ? 'bg-gradient-to-br from-slate-900 via-slate-900 to-plug-accent/10 border-plug-accent shadow-xl ring-1 ring-plug-accent'
              : 'bg-slate-950/80 border-slate-800'
          }`}>
            {recommendedPlan === 'creator' && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-plug-accent text-slate-950 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md">
                <Zap className="w-3 h-3 fill-current" /> Recommended For You
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-plug-accent uppercase font-mono">Creator Plan</span>
                <span className="px-2 py-0.5 rounded-md bg-plug-accent/20 text-plug-accent text-[10px] font-bold">
                  {creatorRoiMultiplier}x ROI
                </span>
              </div>

              <div>
                <div className="text-2xl font-black text-white font-mono">$29 <span className="text-xs text-slate-400 font-normal">/ mo</span></div>
                <p className="text-[11px] text-slate-400 font-mono mt-1">Unlimited links, ElevenLabs Voice AI, Yield Simulator.</p>
              </div>

              <div className="pt-2 border-t border-slate-800 space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Net Profit / mo:</span>
                  <strong className="text-emerald-400">${creatorPlanNetProfit.toLocaleString()}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Return on Investment:</span>
                  <strong className="text-plug-accent">+{creatorRoiPercent.toLocaleString()}% ROI</strong>
                </div>
              </div>
            </div>

            <button
              onClick={() => onNavigate?.('pricing')}
              className="w-full py-2.5 rounded-xl bg-plug-accent hover:bg-plug-accentHover text-slate-950 font-black font-mono text-xs transition-all shadow-md shadow-plug-accent/20 cursor-pointer"
            >
              Get Creator Plan →
            </button>
          </div>

          {/* Card 3: Pro Plan ($149/mo) */}
          <div className={`p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 relative ${
            recommendedPlan === 'pro'
              ? 'bg-gradient-to-br from-slate-900 via-indigo-950/30 to-purple-950/30 border-purple-500 shadow-xl ring-1 ring-purple-500'
              : 'bg-slate-950/80 border-slate-800'
          }`}>
            {recommendedPlan === 'pro' && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-purple-500 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-md">
                <Award className="w-3 h-3 fill-current" /> High-Scale Tier
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-400 uppercase font-mono">Pro Plan</span>
                <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-[10px] font-bold">
                  {proRoiMultiplier}x ROI
                </span>
              </div>

              <div>
                <div className="text-2xl font-black text-white font-mono">$149 <span className="text-xs text-slate-400 font-normal">/ mo</span></div>
                <p className="text-[11px] text-slate-400 font-mono mt-1">Full 12-Module AI Swarm, Analytics, API & Priority.</p>
              </div>

              <div className="pt-2 border-t border-slate-800 space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Net Profit / mo:</span>
                  <strong className="text-emerald-400">${proPlanNetProfit.toLocaleString()}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Return on Investment:</span>
                  <strong className="text-purple-400">+{proRoiPercent.toLocaleString()}% ROI</strong>
                </div>
              </div>
            </div>

            <button
              onClick={() => onNavigate?.('pricing')}
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold font-mono text-xs transition-all shadow-md shadow-purple-600/20 cursor-pointer"
            >
              Scale with Pro →
            </button>
          </div>
        </div>
      </div>

      {/* Bottom CTA Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-plug-accent/10 via-emerald-500/10 to-indigo-500/10 border border-plug-accent/30 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-slate-300 relative z-10">
        <div className="flex items-center gap-3 text-center sm:text-left">
          <div className="w-10 h-10 rounded-xl bg-plug-accent/20 border border-plug-accent/40 text-plug-accent flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <span className="text-white font-bold block text-sm">
              Ready to claim your ${monthlyIncome.toLocaleString()}/month projected earnings?
            </span>
            <span className="text-slate-400 text-[11px]">
              Setup takes under 2 minutes. Start building recurring revenue with Creator Money OS today.
            </span>
          </div>
        </div>
        <button
          onClick={() => onNavigate?.('register')}
          className="px-6 py-3 rounded-xl bg-plug-accent hover:bg-plug-accentHover text-slate-950 font-black text-xs uppercase tracking-wider shrink-0 transition-all shadow-lg shadow-plug-accent/25 hover:scale-105 cursor-pointer flex items-center gap-2"
        >
          <span>Claim Earnings</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

    </div>
  );
};
