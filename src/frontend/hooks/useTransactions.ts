import { useState, useEffect, useCallback, useMemo } from 'react';
import { Transaction } from '../../types/transactions';
import { useAuth } from '../context/AuthContext';

interface UseTransactionsResult {
  transactions: Transaction[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createXPPurchase: (itemId: string, amount: number, xpAwarded?: number) => Promise<Transaction | null>;
  createCommission: (amount: number, reason: string, referralUserId?: string) => Promise<Transaction | null>;
}

export function useTransactions(userId?: string): UseTransactionsResult {
  const { token } = useAuth();
  const [rawData, setRawData] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    if (!token && !userId) {
      setRawData([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/transactions', { headers });
      if (!res.ok) {
        throw new Error('Failed to load transaction history.');
      }
      const json = await res.json();
      if (json.success && Array.isArray(json.data?.transactions)) {
        setRawData(json.data.transactions);
      } else {
        setRawData([]);
      }
    } catch (err: any) {
      console.error('[useTransactions] Fetch error:', err);
      setError(err.message || 'Failed to load transaction history.');
    } finally {
      setLoading(false);
    }
  }, [token, userId]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Client-Side Cleaning, Filtering, and Strict Deduplication Pipeline
  const transactions = useMemo(() => {
    const seenIds = new Set<string>();
    const seenCompositeKeys = new Set<string>();
    const sanitized: Transaction[] = [];

    for (const item of rawData) {
      // 1. Basic integrity check
      if (!item.id || !item.user_id || typeof item.amount !== 'number' || item.amount < 0 || !item.timestamp) {
        continue;
      }

      // 2. Primary Key Deduplication
      if (seenIds.has(item.id)) continue;
      seenIds.add(item.id);

      // 3. Composite Key Deduplication (user_id + amount + timestamp rounded to second)
      const secTimestamp = Math.floor(new Date(item.timestamp).getTime() / 1000);
      const compositeKey = `${item.user_id}_${item.amount}_${secTimestamp}_${item.type}`;
      if (seenCompositeKeys.has(compositeKey)) continue;
      seenCompositeKeys.add(compositeKey);

      sanitized.push(item);
    }

    // 4. Sort descending by timestamp
    return sanitized.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [rawData]);

  const createXPPurchase = async (itemId: string, amount: number, xpAwarded = 100): Promise<Transaction | null> => {
    if (!token) return null;
    try {
      const res = await fetch('/api/transactions/xp-purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ itemId, amount, xpAwarded }),
      });
      if (res.ok) {
        const j = await res.json();
        if (j.success && j.data?.transaction) {
          setRawData(prev => [j.data.transaction, ...prev]);
          return j.data.transaction;
        }
      }
    } catch {}
    return null;
  };

  const createCommission = async (amount: number, reason: string, referralUserId?: string): Promise<Transaction | null> => {
    if (!token) return null;
    try {
      const res = await fetch('/api/transactions/commission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount, reason, referralUserId }),
      });
      if (res.ok) {
        const j = await res.json();
        if (j.success && j.data?.transaction) {
          setRawData(prev => [j.data.transaction, ...prev]);
          return j.data.transaction;
        }
      }
    } catch {}
    return null;
  };

  return { transactions, loading, error, refetch: fetchTransactions, createXPPurchase, createCommission };
}
