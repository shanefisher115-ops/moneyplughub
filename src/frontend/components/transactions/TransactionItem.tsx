import React, { useState } from 'react';
import { Transaction, XPPurchaseMetadata, CommissionMetadata, StripeMetadata } from '../../../types/transactions';
import { TransactionBadge } from './TransactionBadge';
import { ChevronDown, ChevronUp, Copy, Check, Clock, Key } from 'lucide-react';

interface TransactionItemProps {
  transaction: Transaction;
}

export const TransactionItem: React.FC<TransactionItemProps> = ({ transaction }) => {
  const [expanded, setExpanded] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: (transaction.metadata as StripeMetadata)?.currency || 'USD',
  }).format(transaction.amount);

  const formattedDate = new Date(transaction.timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const copyProcessorId = () => {
    if (!transaction.processor_id) return;
    navigator.clipboard.writeText(transaction.processor_id);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderContextualSummary = () => {
    if (transaction.source === 'xp_purchase') {
      const meta = transaction.metadata as XPPurchaseMetadata;
      return (
        <span className="text-slate-300 text-xs font-mono">
          Item: <strong className="text-cyan-300">{meta.item || 'Custom Unlock'}</strong> • Awarded: <strong className="text-amber-400">+{meta.xp_awarded ?? 0} XP</strong>
        </span>
      );
    }

    if (transaction.source === 'commission') {
      const meta = transaction.metadata as CommissionMetadata;
      return (
        <span className="text-slate-300 text-xs font-mono">
          Reason: <strong className="text-amber-300">{meta.reason || 'Referral Payout'}</strong>
        </span>
      );
    }

    if (transaction.source === 'stripe') {
      const meta = transaction.metadata as StripeMetadata;
      return (
        <span className="text-slate-300 text-xs font-mono">
          Card Payment ({meta.payment_method_type || 'Visa/Mastercard'}) • <span className="text-emerald-400 font-bold">Processed</span>
        </span>
      );
    }

    return <span className="text-slate-400 text-xs font-mono">Internal Ledger Event</span>;
  };

  return (
    <div className="p-4 rounded-2xl bg-slate-900/70 hover:bg-slate-900/90 border border-slate-800 hover:border-slate-700 transition-all space-y-3">
      {/* Top Row: Amount, Badge, Date, Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <div className="text-lg font-black font-mono text-white tracking-tight">
            {formattedAmount}
          </div>
          <TransactionBadge transaction={transaction} />
        </div>

        <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            {formattedDate}
          </span>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            title="Toggle Metadata Details"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Middle Row: Context Summary */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        {renderContextualSummary()}

        {transaction.processor_id && (
          <button
            onClick={copyProcessorId}
            className="flex items-center gap-1 text-[11px] font-mono text-slate-400 hover:text-slate-200 bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-700 transition-colors cursor-pointer"
          >
            <Key className="w-3 h-3 text-slate-500" />
            <span>{transaction.processor_id.slice(0, 14)}...</span>
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>
        )}
      </div>

      {/* Expanded Metadata Viewer */}
      {expanded && (
        <div className="pt-3 border-t border-slate-800 text-xs font-mono space-y-2 animate-in fade-in duration-200">
          <div className="text-slate-400 font-bold uppercase text-[10px] tracking-wider">
            Raw Metadata Payload
          </div>
          <pre className="p-3 rounded-xl bg-slate-950/90 border border-slate-800/80 text-emerald-300 text-[11px] overflow-x-auto max-h-48 leading-relaxed">
            {JSON.stringify(transaction.metadata, null, 2)}
          </pre>
          <div className="text-[10px] text-slate-500 flex justify-between">
            <span>Transaction ID: {transaction.id}</span>
            <span>Real Settlement: {transaction.is_real ? 'TRUE' : 'FALSE'}</span>
          </div>
        </div>
      )}
    </div>
  );
};
