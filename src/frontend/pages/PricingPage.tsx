import React, { useState } from 'react';
import { Check, X, Zap, Globe, MapPin, Percent, Sparkles } from 'lucide-react';
import { useGeoPricing, LocalizedPlan } from '../hooks/useGeoPricing';

interface PricingPageProps {
  onNavigate: (tab: string) => void;
}

export const PricingPage: React.FC<PricingPageProps> = ({ onNavigate }) => {
  const [isAnnual, setIsAnnual] = useState(true);
  const { data: geoData, loading: geoLoading, selectedCountry, changeCountry } = useGeoPricing();

  const isPppActive = geoData?.ppp.has_discount;
  const pppPercent = geoData?.ppp.discount_percent || 0;

  // Plan metadata helper
  const planDescriptions: Record<string, { tag?: string; description: string; cta: string; highlight: boolean }> = {
    plan_free: {
      tag: "Get Started",
      description: "Perfect for new creators getting started with tracking.",
      cta: "Start Free",
      highlight: false,
    },
    plan_creator: {
      tag: "Most Popular",
      description: "Everything you need to grow your financial empire.",
      cta: "Start Creator Plan",
      highlight: true,
    },
    plan_pro: {
      tag: "Scale Up",
      description: "Advanced tools for high-volume creators.",
      cta: "Go Pro",
      highlight: false,
    },
    plan_enterprise: {
      tag: "Custom",
      description: "Bespoke solutions for large creator agencies.",
      cta: "Contact Sales",
      highlight: false,
    },
  };

  const getFormattedPriceDisplay = (plan: LocalizedPlan) => {
    if (plan.slug === 'free') {
      return { current: `${plan.local_symbol}0`, original: null };
    }

    if (isAnnual) {
      return {
        current: plan.ppp_local_annual_monthly_formatted,
        original: isPppActive
          ? `${plan.local_symbol}${Math.round(plan.original_local_annual / 12)}`
          : null,
        period: "/mo",
        subnote: `Billed annually (${plan.ppp_local_annual_formatted}/yr)`
      };
    } else {
      return {
        current: plan.ppp_local_monthly_formatted,
        original: isPppActive ? plan.original_local_monthly_formatted : null,
        period: "/mo",
        subnote: "Billed monthly"
      };
    }
  };

  return (
    <div className="w-full min-h-screen bg-slate-900/50 p-6 space-y-10 text-slate-300">
      
      {/* Geo-Pricing PPP Banner */}
      {geoData && isPppActive && (
        <div className="max-w-5xl mx-auto bg-gradient-to-r from-purple-900/80 via-emerald-900/80 to-purple-900/80 border border-emerald-500/40 rounded-2xl p-4 sm:p-5 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0">
              <Percent size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-bold text-base sm:text-lg">
                  {geoData.location.country_name} Purchasing Power Parity (PPP) Discount
                </span>
                <span className="text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Sparkles size={12} /> {pppPercent}% OFF
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 mt-1">
                Prices are automatically adjusted for purchasing power in {geoData.location.country_name} ({geoData.currency.code}).
              </p>
            </div>
          </div>
          <div className="text-xs font-mono text-emerald-300 bg-emerald-950/60 border border-emerald-500/30 px-3 py-1.5 rounded-lg shrink-0">
            PPP Multiplier: {(geoData.ppp.ppp_factor * 100).toFixed(0)}% of USD standard
          </div>
        </div>
      )}

      {/* Header & Location Selector Bar */}
      <div className="text-center space-y-4 max-w-3xl mx-auto">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">Simple, global pricing</h1>
        <p className="text-base sm:text-lg text-slate-400">
          Unlock Creator Money OS with automatic local currency and Purchasing Power Parity pricing.
        </p>
        
        {/* Country & Currency Selector Bar */}
        {geoData && (
          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <div className="inline-flex items-center gap-2 bg-slate-800/90 border border-slate-700/80 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-300">
              <MapPin size={16} className="text-emerald-400" />
              <span>Detected: <strong className="text-white">{geoData.location.country_name}</strong> ({geoData.currency.code} - {geoData.currency.symbol})</span>
            </div>

            <div className="inline-flex items-center gap-2 bg-slate-800/90 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs sm:text-sm">
              <Globe size={16} className="text-plug-accent" />
              <label htmlFor="geo-country-select" className="text-slate-400 font-medium">Currency / Region:</label>
              <select
                id="geo-country-select"
                value={selectedCountry}
                onChange={(e) => changeCountry(e.target.value)}
                className="bg-slate-900 text-white font-medium text-xs sm:text-sm rounded-md border border-slate-700 px-2 py-1 outline-none focus:border-plug-accent"
              >
                {geoData.supported_countries.map((c) => (
                  <option key={c.country_code} value={c.country_code}>
                    {c.country_name} ({c.currency_code} {c.currency_symbol}){c.ppp_discount_percent > 0 ? ` - ${c.ppp_discount_percent}% PPP` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Billing Toggle */}
        <div className="flex items-center justify-center space-x-3 pt-4">
          <span className={`text-sm font-medium ${!isAnnual ? 'text-white' : 'text-slate-400'}`}>Monthly</span>
          <button 
            onClick={() => setIsAnnual(!isAnnual)}
            className="w-14 h-7 bg-plug-card border border-plug-border rounded-full flex items-center p-1 relative transition-colors duration-300 focus:outline-none"
            aria-label="Toggle annual or monthly billing"
          >
            <div className={`w-5 h-5 bg-plug-accent rounded-full transform transition-transform duration-300 ${isAnnual ? 'translate-x-7' : 'translate-x-0'}`} />
          </button>
          <span className={`text-sm font-medium flex items-center gap-1 ${isAnnual ? 'text-white' : 'text-slate-400'}`}>
            Annually <span className="text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full ml-1 font-bold">2 months free</span>
          </span>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
        {(geoData?.plans || []).map((plan) => {
          const meta = planDescriptions[plan.id] || { description: '', cta: 'Get Started', highlight: false };
          const displayPrice = getFormattedPriceDisplay(plan);

          return (
            <div
              key={plan.id}
              className={`bg-plug-card rounded-2xl p-6 border flex flex-col relative transition-all duration-300 hover:-translate-y-1 ${
                meta.highlight
                  ? 'border-plug-accent shadow-[0_0_25px_rgba(16,185,129,0.2)] ring-1 ring-plug-accent'
                  : 'border-plug-border hover:border-slate-500'
              }`}
            >
              {meta.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-plug-accent text-white text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1 shadow-md">
                  <Zap size={12} className="fill-current" />
                  Most Popular
                </div>
              )}

              <div className="mb-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white">{plan.name}</h3>
                  {isPppActive && plan.slug !== 'free' && (
                    <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-md">
                      {plan.ppp_discount_percent}% PPP
                    </span>
                  )}
                </div>

                <div className="mt-4 flex flex-col">
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl sm:text-4xl font-extrabold text-white">
                      {displayPrice.current}
                    </span>
                    {displayPrice.period && <span className="text-slate-400 text-sm">{displayPrice.period}</span>}
                    {displayPrice.original && (
                      <span className="text-slate-500 line-through text-sm font-medium ml-1">
                        {displayPrice.original}/mo
                      </span>
                    )}
                  </div>
                  {displayPrice.subnote && (
                    <span className="text-xs text-slate-400 mt-1 font-mono">
                      {displayPrice.subnote}
                    </span>
                  )}
                </div>

                <p className="text-xs sm:text-sm text-slate-400 mt-3 min-h-[38px]">
                  {meta.description}
                </p>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-3 text-xs sm:text-sm">
                    <Check size={16} className={`mt-0.5 shrink-0 ${meta.highlight ? 'text-plug-accent' : 'text-slate-400'}`} />
                    <span className={i === 0 && feature.includes('Everything') ? 'font-medium text-slate-200' : 'text-slate-400'}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => onNavigate('register')}
                className={`w-full py-3 px-4 rounded-xl font-semibold text-sm transition-all shadow-md ${
                  meta.highlight
                    ? 'bg-plug-accent text-white hover:bg-plug-accent/90 shadow-plug-accent/20'
                    : 'bg-slate-800 text-white hover:bg-slate-700 border border-slate-700'
                }`}
              >
                {meta.cta} ({displayPrice.current})
              </button>
            </div>
          );
        })}
      </div>

      {/* Feature Matrix */}
      <div className="max-w-5xl mx-auto pt-12">
        <h2 className="text-2xl font-bold text-white text-center mb-8">Compare Plans</h2>
        <div className="overflow-x-auto rounded-xl border border-plug-border bg-plug-card">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-plug-border bg-slate-800/50">
                <th className="py-4 px-6 text-slate-300 font-medium">Features</th>
                <th className="py-4 px-6 text-center text-slate-300 font-medium">Free Lite</th>
                <th className="py-4 px-6 text-center text-plug-accent font-medium">Creator</th>
                <th className="py-4 px-6 text-center text-slate-300 font-medium">Pro</th>
                <th className="py-4 px-6 text-center text-slate-300 font-medium">Enterprise</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              <tr className="border-b border-plug-border/50">
                <td className="py-4 px-6 text-slate-400">Referral Links</td>
                <td className="py-4 px-6 text-center text-slate-300">5</td>
                <td className="py-4 px-6 text-center text-slate-300">Unlimited</td>
                <td className="py-4 px-6 text-center text-slate-300">Unlimited</td>
                <td className="py-4 px-6 text-center text-slate-300">Unlimited</td>
              </tr>
              <tr className="border-b border-plug-border/50">
                <td className="py-4 px-6 text-slate-400">AI Chat & Voice</td>
                <td className="py-4 px-6 text-center text-slate-300">Text Only</td>
                <td className="py-4 px-6 text-center text-slate-300">Text + Voice</td>
                <td className="py-4 px-6 text-center text-slate-300">Text + Voice + Swarm</td>
                <td className="py-4 px-6 text-center text-slate-300">Custom Models</td>
              </tr>
              <tr className="border-b border-plug-border/50">
                <td className="py-4 px-6 text-slate-400">Geo-Pricing & PPP Discount</td>
                <td className="py-4 px-6 text-center"><Check size={16} className="mx-auto text-emerald-400" /></td>
                <td className="py-4 px-6 text-center"><Check size={16} className="mx-auto text-emerald-400" /></td>
                <td className="py-4 px-6 text-center"><Check size={16} className="mx-auto text-emerald-400" /></td>
                <td className="py-4 px-6 text-center"><Check size={16} className="mx-auto text-emerald-400" /></td>
              </tr>
              <tr className="border-b border-plug-border/50">
                <td className="py-4 px-6 text-slate-400">Yield Simulator</td>
                <td className="py-4 px-6 text-center"><X size={16} className="mx-auto text-slate-600" /></td>
                <td className="py-4 px-6 text-center"><Check size={16} className="mx-auto text-plug-accent" /></td>
                <td className="py-4 px-6 text-center"><Check size={16} className="mx-auto text-plug-accent" /></td>
                <td className="py-4 px-6 text-center"><Check size={16} className="mx-auto text-plug-accent" /></td>
              </tr>
              <tr className="border-b border-plug-border/50">
                <td className="py-4 px-6 text-slate-400">API Access</td>
                <td className="py-4 px-6 text-center"><X size={16} className="mx-auto text-slate-600" /></td>
                <td className="py-4 px-6 text-center"><X size={16} className="mx-auto text-slate-600" /></td>
                <td className="py-4 px-6 text-center"><Check size={16} className="mx-auto text-plug-accent" /></td>
                <td className="py-4 px-6 text-center"><Check size={16} className="mx-auto text-plug-accent" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQs */}
      <div className="max-w-3xl mx-auto pt-12 pb-12">
        <h2 className="text-2xl font-bold text-white text-center mb-8">Frequently Asked Questions</h2>
        <div className="space-y-4">
          <div className="bg-plug-card border border-plug-border rounded-xl p-6">
            <h4 className="text-white font-medium mb-2">How does IP location detection and PPP geo-pricing work?</h4>
            <p className="text-sm text-slate-400">We automatically detect your IP location and calculate local currency exchange rates along with Purchasing Power Parity (PPP) discounts to ensure accessible pricing worldwide.</p>
          </div>
          <div className="bg-plug-card border border-plug-border rounded-xl p-6">
            <h4 className="text-white font-medium mb-2">Can I manually select a different country or currency?</h4>
            <p className="text-sm text-slate-400">Yes! Use the Currency / Region dropdown at the top of the pricing page to switch to your preferred currency at any time.</p>
          </div>
          <div className="bg-plug-card border border-plug-border rounded-xl p-6">
            <h4 className="text-white font-medium mb-2">Can I switch plans later?</h4>
            <p className="text-sm text-slate-400">Absolutely. You can upgrade or downgrade your plan at any time. Prorated charges or credits will be applied to your account automatically.</p>
          </div>
          <div className="bg-plug-card border border-plug-border rounded-xl p-6">
            <h4 className="text-white font-medium mb-2">Do you offer refunds?</h4>
            <p className="text-sm text-slate-400">We offer a 14-day money-back guarantee on all premium plans. If you're not satisfied, just let us know within your first 14 days and we'll refund you in full.</p>
          </div>
        </div>
      </div>

    </div>
  );
};
