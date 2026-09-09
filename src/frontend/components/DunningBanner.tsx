import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, RefreshCw, Tag, ShieldAlert, CheckCircle2, X } from 'lucide-react';

interface DunningBannerProps {
  onSuccess?: () => void;
}

export const DunningBanner: React.FC<DunningBannerProps> = ({ onSuccess }) => {
  const [dunningData, setDunningData] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [retrying, setRetrying] = useState<boolean>(false);
  const [acceptingOffer, setAcceptingOffer] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchDunningStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/billing/dunning/status', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await res.json();
      if (data.success && data.data?.hasActiveDunning) {
        setDunningData(data.data);
      } else {
        setDunningData(null);
      }
    } catch (err) {
      console.error('Failed to fetch dunning status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDunningStatus();
  }, []);

  if (loading || !dunningData || !dunningData.hasActiveDunning) {
    return null;
  }

  const { dunningEvent, offers } = dunningData;

  const handleRetryPayment = async () => {
    try {
      setRetrying(true);
      setMessage(null);
      const res = await fetch('/api/billing/dunning/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          dunning_event_id: dunningEvent.id,
          simulate_success: true, // Retry card charge simulation
        }),
      });
      const data = await res.json();
      if (data.success && data.data?.recovered) {
        setMessage({ type: 'success', text: 'Payment successful! Subscription recovered and active.' });
        setTimeout(() => {
          setDunningData(null);
          onSuccess?.();
        }, 2000);
      } else {
        setMessage({ type: 'error', text: data.data?.message || data.error || 'Retry payment failed.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Payment retry failed.' });
    } finally {
      setRetrying(false);
    }
  };

  const handleAcceptOffer = async (offerId: string) => {
    try {
      setAcceptingOffer(offerId);
      setMessage(null);
      const res = await fetch('/api/billing/dunning/accept-offer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ offer_id: offerId }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: 'success', text: data.data?.message || 'Discount applied!' });
        fetchDunningStatus();
      } else {
        setMessage({ type: 'error', text: data.error || 'Could not accept offer.' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Offer acceptance failed.' });
    } finally {
      setAcceptingOffer(null);
    }
  };

  return (
    <div className="w-full bg-gradient-to-r from-red-950/80 via-amber-950/60 to-slate-900 border border-red-500/40 rounded-xl p-5 mb-6 shadow-2xl backdrop-blur-md relative">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">

        {/* Left Side Info */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-red-400 font-bold text-base">
            <ShieldAlert size={20} className="animate-pulse text-red-400" />
            <span>Action Required: Subscription Payment Past Due</span>
          </div>
          <p className="text-xs text-slate-300">
            We were unable to process your payment of <span className="font-semibold text-white">{dunningEvent.amount_formatted}</span> for your {dunningEvent.plan_name} plan.
          </p>
          <div className="flex items-center gap-4 text-xs font-mono text-amber-300 pt-1">
            <span className="flex items-center gap-1">
              <Clock size={13} /> Grace Period Remaining: <strong className="text-white">{dunningEvent.hoursLeftInGrace} hours</strong>
            </span>
            <span>• Retry Attempt {dunningEvent.attempt_count} / {dunningEvent.max_attempts}</span>
          </div>
        </div>

        {/* Right Side Action */}
        <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 w-full md:w-auto">
          <button
            onClick={handleRetryPayment}
            disabled={retrying}
            className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 font-bold px-4 py-2.5 rounded-lg text-xs flex items-center justify-center gap-2 shadow-lg transition-all"
          >
            <RefreshCw size={14} className={retrying ? 'animate-spin' : ''} />
            {retrying ? 'Processing Retry...' : 'Retry Payment Now'}
          </button>
        </div>
      </div>

      {/* Targeted Retention Offers Banner */}
      {offers && offers.length > 0 && (
        <div className="mt-4 pt-4 border-t border-red-500/20 bg-slate-900/60 rounded-lg p-3 space-y-2">
          <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
            <Tag size={14} />
            <span>Exclusive Retention Offer to Keep Your Creator OS Plan Active:</span>
          </div>
          {offers.map((offer: any) => (
            <div key={offer.id} className="flex items-center justify-between bg-emerald-950/40 border border-emerald-500/30 p-2.5 rounded-lg text-xs">
              <div>
                <span className="font-bold text-emerald-300">{offer.discount_percent}% OFF Next Cycle</span>
                <span className="text-slate-400 text-[11px] ml-2 font-mono">Use code: {offer.offer_code}</span>
              </div>
              <button
                onClick={() => handleAcceptOffer(offer.id)}
                disabled={acceptingOffer === offer.id}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 py-1 rounded text-[11px] transition-colors"
              >
                {acceptingOffer === offer.id ? 'Applying...' : 'Claim & Apply Offer'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Status Alert Message */}
      {message && (
        <div className={`mt-3 p-2.5 rounded-lg text-xs flex items-center gap-2 ${
          message.type === 'success' ? 'bg-emerald-900/80 text-emerald-200 border border-emerald-500/50' : 'bg-red-900/80 text-red-200 border border-red-500/50'
        }`}>
          {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
          <span>{message.text}</span>
        </div>
      )}
    </div>
  );
};
