import React, { useState, useEffect } from 'react';
import { AlertTriangle, ShieldAlert, RefreshCw, Sparkles, CheckCircle2, Clock, Mail, MessageSquare } from 'lucide-react';

interface DunningStatusData {
  dunning_id: string;
  subscription_id: string;
  invoice_id: string;
  amount_formatted: string;
  status: string;
  attempt_count: number;
  max_attempts: number;
  next_retry_at: string | null;
  grace_period_ends_at: string;
  grace_hours_remaining: number;
  last_failure_reason: string;
  retention_offer_code: string;
  retention_offer_applied: boolean;
}

export const DunningWarningBanner: React.FC<{ onResolved?: () => void }> = ({ onResolved }) => {
  const [dunningData, setDunningData] = useState<DunningStatusData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [applyingCode, setApplyingCode] = useState<boolean>(false);
  const [codeApplied, setCodeApplied] = useState<boolean>(false);
  const [retryExecuting, setRetryExecuting] = useState<boolean>(false);
  const [message, setMessage] = useState<string | null>(null);

  const fetchDunningStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/billing/dunning/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        },
      });
      const data = await res.json();
      if (data.success && data.has_active_dunning) {
        setDunningData(data.data);
        if (data.data.retention_offer_applied) {
          setCodeApplied(true);
        }
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

  const handleApplyOffer = async () => {
    if (!dunningData?.retention_offer_code) return;
    try {
      setApplyingCode(true);
      setMessage(null);
      const res = await fetch('/api/billing/dunning/apply-retention-offer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify({ code: dunningData.retention_offer_code }),
      });
      const data = await res.json();
      if (data.success) {
        setCodeApplied(true);
        setMessage(data.message);
        fetchDunningStatus();
      } else {
        setMessage(data.error || 'Failed to apply retention discount.');
      }
    } catch (err) {
      setMessage('Error redeeming discount offer.');
    } finally {
      setApplyingCode(false);
    }
  };

  const handleRetryPayment = async () => {
    if (!dunningData?.dunning_id) return;
    try {
      setRetryExecuting(true);
      setMessage(null);
      const res = await fetch('/api/billing/dunning/process-retries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`,
        },
        body: JSON.stringify({
          dunning_id: dunningData.dunning_id,
          force_outcome: 'success',
        }),
      });
      const data = await res.json();
      if (data.success && data.result?.success) {
        setMessage('Payment successful! Your subscription is active again.');
        setTimeout(() => {
          setDunningData(null);
          if (onResolved) onResolved();
        }, 2000);
      } else {
        setMessage('Retry failed. Please check your credit card details.');
      }
    } catch (err) {
      setMessage('Error executing payment retry.');
    } finally {
      setRetryExecuting(false);
    }
  };

  if (loading || !dunningData) return null;

  return (
    <div className="w-full bg-gradient-to-r from-amber-950/90 via-red-950/90 to-purple-950/90 border-b border-amber-500/40 p-4 shadow-xl text-white backdrop-blur-md relative z-40">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">

        {/* Left Status Alert */}
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/30 shrink-0">
            <AlertTriangle className="w-6 h-6 animate-pulse text-amber-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-amber-300 text-sm tracking-wide uppercase">
                Payment Action Required
              </span>
              <span className="text-xs bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30 font-mono">
                Grace Period: {dunningData.grace_hours_remaining}h remaining
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-xl">
              Your recent subscription invoice ({dunningData.amount_formatted}) failed due to <span className="font-semibold text-white">{dunningData.last_failure_reason}</span>. Your Creator Money OS access remains active during the grace period.
            </p>
          </div>
        </div>

        {/* Action Offers & Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">

          {/* Targeted Retention Offer Badge */}
          {dunningData.retention_offer_code && !codeApplied && (
            <button
              onClick={handleApplyOffer}
              disabled={applyingCode}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 border border-emerald-500/40 transition duration-200"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              {applyingCode ? 'Applying 30% Off...' : `Redeem 30% Off (${dunningData.retention_offer_code})`}
            </button>
          )}

          {codeApplied && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              30% Retention Discount Applied!
            </div>
          )}

          {/* Retry Payment Button */}
          <button
            onClick={handleRetryPayment}
            disabled={retryExecuting}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition duration-200 shadow-lg shadow-amber-500/20"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${retryExecuting ? 'animate-spin' : ''}`} />
            {retryExecuting ? 'Processing Card...' : 'Retry Payment Now'}
          </button>
        </div>
      </div>

      {message && (
        <div className="mt-2 text-center text-xs font-mono text-amber-200 bg-amber-900/40 py-1 px-3 rounded border border-amber-500/30 max-w-2xl mx-auto">
          {message}
        </div>
      )}
    </div>
  );
};
