import React, { useState, useMemo } from 'react';
import { useTransactions } from '../../hooks/useTransactions';
import { TransactionItem } from './TransactionItem';
import { Search, Filter, RefreshCw, AlertCircle, Inbox, Layers, Zap, DollarSign, ShieldCheck } from 'lucide-react';

interface TransactionListProps {
  userId?: string;
}

type FilterTab = 'ALL' | 'REAL' | 'XP' | 'COMMISSION';

export const TransactionList: React.FC<TransactionListProps> = ({ userId }) => {
  const { transactions, loading, error, refetch, createXPPurchase, createCommission } = useTransactions(userId);
  const [filterTab, setFilterTab] = useState<FilterTab>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      // 1. Tab filtering
      if (filterTab === 'REAL' && !t.is_real) return false;
      if (filterTab === 'XP' && t.source !== 'xp_purchase') return false;
      if (filterTab === 'COMMISSION' && t.source !== 'commission') return false;

      // 2. Search query filtering
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const metaStr = JSON.stringify(t.metadata).toLowerCase();
      const processor = (t.processor_id || '').toLowerCase();
      const id = t.id.toLowerCase();

      return id.includes(q) || processor.includes(q) || metaStr.includes(q);
    });
  }, [transactions, filterTab, searchQuery]);

  const handleSimulateXPPurchase = async () => {
    setIsSubmitting(true);
    await createXPPurchase('Fractal Tokamak Reactor Core', 20.00, 500);
    setIsSubmitting(false);
  };

  const handleSimulateCommission = async () => {
    setIsSubmitting(true);
    await createCommission(35.00, 'Direct Viral Tier-1 Syndicate Commission', 'u_founder_sovereign_1');
    setIsSubmitting(false);
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Header & Controls Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-slate-900/90 border border-slate-800 backdrop-blur-xl shadow-2xl">
        <div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-400" />
            <span>Financial & Settlement Ledger</span>
          </h2>
          <p className="text-xs text-slate-400 font-mono mt-0.5">
            Deduplicated real-time transaction stream with fraud verification
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleSimulateXPPurchase}
            disabled={isSubmitting}
            className="px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Simulate synthetic XP purchase"
          >
            <Zap className="w-3.5 h-3.5 text-cyan-400 fill-current" />
            <span>+ XP Event</span>
          </button>

          <button
            onClick={handleSimulateCommission}
            disabled={isSubmitting}
            className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
            title="Simulate affiliate commission"
          >
            <DollarSign className="w-3.5 h-3.5 text-amber-400" />
            <span>+ Commission</span>
          </button>

          <button
            onClick={() => refetch()}
            disabled={loading}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-slate-800 w-full sm:w-auto overflow-x-auto">
          {[
            { id: 'ALL', label: 'All Events' },
            { id: 'REAL', label: 'Real Charges' },
            { id: 'XP', label: 'XP Purchases' },
            { id: 'COMMISSION', label: 'Commissions' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id as FilterTab)}
              className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold font-mono transition-all cursor-pointer whitespace-nowrap ${
                filterTab === tab.id
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
          />
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-3 text-rose-300 text-xs font-mono">
          <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && transactions.length === 0 && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 animate-pulse space-y-3">
              <div className="h-4 bg-slate-800 rounded w-1/3" />
              <div className="h-3 bg-slate-800/60 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredTransactions.length === 0 && (
        <div className="p-12 text-center rounded-3xl bg-slate-900/30 border border-slate-800 space-y-3">
          <Inbox className="w-10 h-10 text-slate-600 mx-auto" />
          <div className="text-white font-bold font-mono text-sm">No transactions found</div>
          <p className="text-slate-400 text-xs max-w-sm mx-auto font-mono">
            {searchQuery
              ? `No transactions matched query "${searchQuery}".`
              : 'No settled transactions have been recorded in your ledger yet.'}
          </p>
        </div>
      )}

      {/* Transaction List Feed */}
      <div className="space-y-3">
        {filteredTransactions.map((tx) => (
          <TransactionItem key={tx.id} transaction={tx} />
        ))}
      </div>
    </div>
  );
};
