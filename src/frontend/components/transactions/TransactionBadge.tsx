import React from 'react';
import { ShieldCheck, Zap, DollarSign, RefreshCw, ArrowRightLeft } from 'lucide-react';
import { Transaction } from '../../../types/transactions';

interface TransactionBadgeProps {
  transaction: Transaction;
}

export const TransactionBadge: React.FC<TransactionBadgeProps> = ({ transaction }) => {
  if (transaction.is_real && transaction.source === 'stripe') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
        <span>Real Charge</span>
      </span>
    );
  }

  if (transaction.source === 'xp_purchase') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
        <Zap className="w-3.5 h-3.5 text-cyan-400 fill-current" />
        <span>XP Event</span>
      </span>
    );
  }

  if (transaction.source === 'commission') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30">
        <DollarSign className="w-3.5 h-3.5 text-amber-400" />
        <span>Commission</span>
      </span>
    );
  }

  if (transaction.type === 'refund') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-500/15 text-rose-300 border border-rose-500/30">
        <RefreshCw className="w-3.5 h-3.5 text-rose-400" />
        <span>Refund</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-slate-800 text-slate-300 border border-slate-700">
      <ArrowRightLeft className="w-3.5 h-3.5" />
      <span>{transaction.type.replace('_', ' ')}</span>
    </span>
  );
};
