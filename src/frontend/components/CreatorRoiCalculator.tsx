import React, { useState } from 'react';
import {
  Calculator, DollarSign, Users, Percent, Sparkles, TrendingUp,
  ArrowRight, Award, Zap, ShieldCheck, CheckCircle, BarChart3, HelpCircle
} from 'lucide-react';

interface CreatorRoiCalculatorProps {
  onNavigate?: (tab: string) => void;
}

export const CreatorRoiCalculator: React.FC<CreatorRoiCalculatorProps> = ({ onNavigate }) => {
  // Inputs
  const [audienceSize, setAudienceSize] = useState<number>(25000);
  const [conversionRate, setConversionRate] = useState<number>(2.5); // %
  const [averagePrice, setAveragePrice] = useState<number>(29); // $ / month / customer
  const [retentionMonths, setRetentionMonths] = useState<number>(8); // months avg retention
  const [referralYieldBonus, setReferralYieldBonus] = useState<boolean>(true); // +15% referral boost

  // Presets
  const applyPreset = (audience: number, conv: number, price: number, retention: number) => {
    setAudienceSize(audience);
    setConversionRate(conv);
    setAveragePrice(price);
    setRetentionMonths(retention);
  };

  // Core Calculations
  const payingCustomers = Math.round(audienceSize * (conversionRate / 100));
  const baseMrr = Math.round(payingCustomers * averagePrice);
  const referralYield = referralYieldBonus ? Math.round(baseMrr * 0.15) : 0;
  const totalMrr = baseMrr + referralYield;
  const totalArr = totalMrr * 12;
  const avgLtv = Math.round(averagePrice * retentionMonths);
  const totalLifetimeValue = payingCustomers * avgLtv;

  // Comparison: Traditional platforms (charging 15%-30% cut) vs Creator OS (0% cut + SaaS plan)
  const traditionalPlatformFee = Math.round(baseMrr * 0.20); // 20% platform take-rate
  const creatorOsMonthlyFee = 24; // Creator plan cost
  const monthlySavingsWithCreatorOs = Math.max(0, traditionalPlatformFee - creatorOsMonthlyFee);
  const annualSavingsWithCreatorOs = monthlySavingsWithCreatorOs * 12;

  return (
    <div className="bg-slate-900/90 border border-plug-border rounded-3xl p-6 sm:p-8 shadow-2xl space-y-8 relative overflow-hidden my-12">
      {/* Background Ambient Glow */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-plug-accent/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-plug-border/80 pb-6 relative z-10">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 rounded-full bg-plug-accent/20 text-plug-accent text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Calculator className="w-3.5 h-3.5" /> Creator ROI & Revenue Calculator
            </span>
            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-mono font-bold">
              MRR & Cashflow Estimator
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-white mt-2 tracking-tight">
            Estimate Your Monthly Recurring Revenue (MRR)
          </h2>
          <p className="text-xs sm:text-sm text-slate-400 font-mono mt-1">
            Adjust your audience size and conversion benchmarks to model recurring earnings with Creator OS.
          </p>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-mono text-slate-400 uppercase font-bold mr-1">Presets:</span>
          <button
            onClick={() => applyPreset(3000, 3.0, 19, 6)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-mono transition-all"
          >
            🌱 Starter (3k)
          </button>
          <button
            onClick={() => applyPreset(25000, 2.5, 29, 8)}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-mono transition-all"
          >
            📱 Creator (25k)
          </button>
          <button
            onClick={() => applyPreset(100000, 1.8, 39, 12)}
            className="px-3 py-1.5 rounded-xl bg-plug-accent/10 hover:bg-plug-accent/20 border border-plug-accent/40 text-plug-accent text-xs font-mono font-bold transition-all"
          >
            🚀 Pro (100k)
          </button>
        </div>
      </div>

      {/* Calculator Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 relative z-10">

        {/* Left Column: Sliders & Controls */}
        <div className="lg:col-span-7 space-y-6">

          {/* Slider 1: Total Audience Size */}
          <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-bold text-slate-300 flex items-center gap-2">
                <Users className="w-4 h-4 text-plug-accent" />
                Total Audience Size (Followers / Email Subscribers):
              </label>
              <div className="flex items-center gap-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1">
                <input
                  type="number"
                  min={500}
                  max={1000000}
                  step={500}
                  value={audienceSize}
                  onChange={(e) => setAudienceSize(Math.max(1, Number(e.target.value)))}
                  className="w-20 bg-transparent text-right text-sm font-bold text-plug-accent font-mono outline-none"
                />
                <span className="text-xs text-slate-400 font-mono">subs</span>
              </div>
            </div>
            <input
              type="range"
              min={500}
              max={250000}
              step={500}
              value={Math.min(audienceSize, 250000)}
              onChange={(e) => setAudienceSize(Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-plug-accent"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>500 (Niche)</span>
              <span>10k (Growing)</span>
              <span>50k (Established)</span>
              <span>250k+ (Scale)</span>
            </div>
          </div>

          {/* Slider 2: Conversion Rate % */}
          <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-bold text-slate-300 flex items-center gap-2">
                <Percent className="w-4 h-4 text-sky-400" />
                Audience Conversion Rate (% to Paying Members):
              </label>
              <span className="text-lg font-black text-sky-400 font-mono">
                {conversionRate}%
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
              <span>0.5% (Passive Social)</span>
              <span>2.5% (Industry Avg)</span>
              <span>5.0% (Engaged Niche)</span>
              <span>10.0% (High-Intent)</span>
            </div>
          </div>

          {/* Slider 3: Average Product / Subscription Price ($/mo) */}
          <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-bold text-slate-300 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                Average Monthly Revenue per Paying User (ARPU):
              </label>
              <span className="text-lg font-black text-emerald-400 font-mono">
                ${averagePrice}/mo
              </span>
            </div>
            <input
              type="range"
              min={5}
              max={250}
              step={1}
              value={averagePrice}
              onChange={(e) => setAveragePrice(Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
            />
            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>$5 (Basic sub)</span>
              <span>$29 (Community)</span>
              <span>$99 (Mastermind)</span>
              <span>$250+ (High ticket)</span>
            </div>
          </div>

          {/* Secondary Controls: Retention & Referral Yield Toggle */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Avg Member Retention Slider */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-bold text-slate-300">Member Retention:</span>
                <span className="text-purple-400 font-bold">{retentionMonths} mo</span>
              </div>
              <input
                type="range"
                min={2}
                max={24}
                step={1}
                value={retentionMonths}
                onChange={(e) => setRetentionMonths(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-400"
              />
              <p className="text-[10px] font-mono text-slate-500">
                Average lifetime subscription duration per customer.
              </p>
            </div>

            {/* Referral yield toggle */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-mono font-bold text-slate-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  Referral Stack Boost (+15%):
                </label>
                <button
                  onClick={() => setReferralYieldBonus(!referralYieldBonus)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${
                    referralYieldBonus ? 'bg-plug-accent' : 'bg-slate-800'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-slate-950 absolute top-0.5 transition-transform ${
                      referralYieldBonus ? 'right-0.5' : 'left-0.5'
                    }`}
                  />
                </button>
              </div>
              <p className="text-[10px] font-mono text-slate-500 leading-tight">
                Includes automated affiliate & partner ecosystem revenue multipliers.
              </p>
            </div>

          </div>

        </div>

        {/* Right Column: Live Calculated Metrics Card */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-4">

          {/* Main Revenue Card */}
          <div className="p-6 sm:p-7 rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-plug-card border-2 border-plug-accent shadow-2xl shadow-plug-accent/10 space-y-5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400 uppercase font-bold flex items-center gap-1">
                <Award className="w-4 h-4 text-plug-accent" /> Estimated Monthly Revenue
              </span>
              <span className="px-2.5 py-0.5 rounded-full bg-plug-accent/20 text-plug-accent font-bold">
                {payingCustomers.toLocaleString()} Paying Members
              </span>
            </div>

            <div className="space-y-1">
              <div className="text-4xl sm:text-5xl font-black text-white tracking-tight flex items-baseline gap-1">
                ${totalMrr.toLocaleString()}
                <span className="text-xs sm:text-sm font-mono text-slate-400 font-normal">/mo MRR</span>
              </div>
              <p className="text-xs font-mono text-emerald-400 flex items-center gap-1 pt-1">
                <TrendingUp className="w-3.5 h-3.5" />
                ${totalArr.toLocaleString()}/yr Projected ARR
              </p>
            </div>

            {/* Quick Metrics Breakdown */}
            <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800/80 text-xs font-mono">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                <span className="text-[10px] text-slate-500 block uppercase">Customer LTV</span>
                <span className="text-base font-bold text-sky-400">${avgLtv.toLocaleString()}</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80">
                <span className="text-[10px] text-slate-500 block uppercase">Total Portfolio LTV</span>
                <span className="text-base font-bold text-plug-accent">${totalLifetimeValue.toLocaleString()}</span>
              </div>
            </div>

            {/* Referral Yield Breakdown Item if enabled */}
            {referralYieldBonus && (
              <div className="p-3 rounded-xl bg-plug-accent/10 border border-plug-accent/30 text-xs font-mono flex items-center justify-between">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-plug-accent" /> Includes Partner Referral Yield
                </span>
                <span className="font-bold text-plug-accent">+${referralYield.toLocaleString()}/mo</span>
              </div>
            )}
          </div>

          {/* Platform Fee Savings Comparison Card */}
          <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3 text-xs font-mono">
            <div className="flex items-center justify-between">
              <span className="text-slate-300 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" /> Platform Fee Take-Rate Savings
              </span>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                0% Revenue Cut
              </span>
            </div>

            <div className="space-y-2 pt-1 text-[11px]">
              <div className="flex justify-between text-slate-400">
                <span>Traditional Platforms (15-20% take rate):</span>
                <span className="text-red-400 font-bold">-${traditionalPlatformFee.toLocaleString()}/mo</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Creator OS Plan:</span>
                <span className="text-emerald-400 font-bold">${creatorOsMonthlyFee}/mo flat</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-slate-800 font-bold text-white text-xs">
                <span>Estimated Creator Savings:</span>
                <span className="text-emerald-400 text-sm">+${monthlySavingsWithCreatorOs.toLocaleString()}/mo (${annualSavingsWithCreatorOs.toLocaleString()}/yr)</span>
              </div>
            </div>
          </div>

          {/* CTA Button */}
          <button
            onClick={() => onNavigate ? onNavigate('register') : null}
            className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-plug-accent via-emerald-500 to-sky-500 text-white font-bold text-sm shadow-xl hover:opacity-95 transition-all flex items-center justify-center gap-2 group"
          >
            <span>Start Building Your ${totalMrr.toLocaleString()}/mo MRR</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>

        </div>

      </div>

      {/* Footer Info / Methodology */}
      <div className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-[11px] font-mono text-slate-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-slate-500 shrink-0" />
          <span>
            Projections use standard digital product & community conversion metrics. Actual revenue depends on audience engagement, offering quality, and distribution velocity.
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-slate-300">MoneyPlug Zero Take-Rate Guarantee</span>
        </div>
      </div>
    </div>
  );
};
