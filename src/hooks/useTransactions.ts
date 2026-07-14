import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Transaction, TransactionType } from '../types';

type TransactionRow = {
  id: string;
  transaction_date: string;
  type: TransactionType;
  amount: number;
  memo: string | null;
};

function mapRow(row: TransactionRow): Transaction {
  return {
    id: row.id,
    date: row.transaction_date,
    type: row.type,
    amount: Number(row.amount),
    memo: row.memo ?? undefined,
  };
}

export function useTransactions() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTransactions = useCallback(async () => {
    if (!user) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error: fetchError } = await supabase
      .from('transactions')
      .select('id, transaction_date, type, amount, memo')
      .eq('user_id', user.id)
      .order('transaction_date', { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
      setTransactions([]);
    } else {
      setError(null);
      setTransactions((data ?? []).map(mapRow));
    }

    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const addTransaction = useCallback(
    async (date: string, type: TransactionType, amount: number, memo?: string) => {
      if (!user || amount <= 0) return false;

      const { data, error: insertError } = await supabase
        .from('transactions')
        .insert({
          user_id: user.id,
          transaction_date: date,
          type,
          amount,
          memo: memo?.trim() || null,
        })
        .select('id, transaction_date, type, amount, memo')
        .single();

      if (insertError || !data) {
        setError(insertError?.message ?? '등록에 실패했습니다.');
        return false;
      }

      setError(null);
      setTransactions((prev) => [...prev, mapRow(data)]);
      return true;
    },
    [user],
  );

  const removeTransaction = useCallback(async (id: string) => {
    const { error: deleteError } = await supabase.from('transactions').delete().eq('id', id);

    if (deleteError) {
      setError(deleteError.message);
      return false;
    }

    setError(null);
    setTransactions((prev) => prev.filter((tx) => tx.id !== id));
    return true;
  }, []);

  return {
    transactions,
    loading,
    error,
    addTransaction,
    removeTransaction,
    refetch: fetchTransactions,
  };
}
