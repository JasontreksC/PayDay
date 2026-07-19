import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCrypto } from '../contexts/CryptoContext';
import { isEncryptedMemo } from '../lib/crypto';
import { supabase } from '../lib/supabase';
import type { Transaction, TransactionType } from '../types';

type TransactionRow = {
  id: string;
  transaction_date: string;
  type: TransactionType;
  amount: number;
  memo: string | null;
};

export function useTransactions() {
  const { user } = useAuth();
  const { status, encryptMemoText, decryptMemoText } = useCrypto();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const migratedRef = useRef(false);

  const mapRow = useCallback(
    async (row: TransactionRow): Promise<Transaction> => {
      let memo: string | undefined;
      try {
        memo = await decryptMemoText(row.memo, row.id);
      } catch {
        memo = '[복호화 실패]';
      }

      return {
        id: row.id,
        date: row.transaction_date,
        type: row.type,
        amount: Number(row.amount),
        memo,
      };
    },
    [decryptMemoText],
  );

  /** 예전에 평문으로 저장된 메모를 현재 DEK로 암호화해 DB에 다시 씀 */
  const migratePlaintextMemos = useCallback(
    async (rows: TransactionRow[]) => {
      if (!user || migratedRef.current) return;

      const plainRows = rows.filter(
        (row) => row.memo && row.memo.trim().length > 0 && !isEncryptedMemo(row.memo),
      );

      if (plainRows.length === 0) {
        migratedRef.current = true;
        return;
      }

      await Promise.all(
        plainRows.map(async (row) => {
          const encrypted = await encryptMemoText(row.memo!, row.id);
          const { error: updateError } = await supabase
            .from('transactions')
            .update({ memo: encrypted })
            .eq('id', row.id)
            .eq('user_id', user.id);

          if (updateError) {
            throw new Error(updateError.message);
          }
        }),
      );

      migratedRef.current = true;
    },
    [encryptMemoText, user],
  );

  const fetchTransactions = useCallback(async () => {
    if (!user || status !== 'ready') {
      setTransactions([]);
      setLoading(status === 'loading');
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
      setLoading(false);
      return;
    }

    const rows = data ?? [];

    try {
      await migratePlaintextMemos(rows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '평문 메모 암호화에 실패했습니다.');
    }

    // 화면에는 복호화(또는 평문)된 메모를 그대로 표시. DB는 위에서 암호문으로 갱신됨.
    const mapped = await Promise.all(rows.map(mapRow));
    setTransactions(mapped);
    setLoading(false);
  }, [mapRow, migratePlaintextMemos, status, user]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const addTransaction = useCallback(
    async (date: string, type: TransactionType, amount: number, memo?: string) => {
      if (!user || status !== 'ready' || amount <= 0) return false;

      const trimmed = memo?.trim();
      let encryptedMemo: string | null = null;

      // 메모를 이 거래 id에 AAD로 묶으려면 암호화 전에 id를 알아야 하므로
      // 서버 기본값 대신 클라이언트에서 UUID를 생성해 함께 저장한다.
      const id = crypto.randomUUID();

      try {
        if (trimmed) {
          encryptedMemo = await encryptMemoText(trimmed, id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '메모 암호화에 실패했습니다.');
        return false;
      }

      const { data, error: insertError } = await supabase
        .from('transactions')
        .insert({
          id,
          user_id: user.id,
          transaction_date: date,
          type,
          amount,
          memo: encryptedMemo,
        })
        .select('id, transaction_date, type, amount, memo')
        .single();

      if (insertError || !data) {
        setError(insertError?.message ?? '등록에 실패했습니다.');
        return false;
      }

      setError(null);
      setTransactions((prev) => [...prev, {
        id: data.id,
        date: data.transaction_date,
        type: data.type,
        amount: Number(data.amount),
        memo: trimmed || undefined,
      }]);
      return true;
    },
    [encryptMemoText, status, user],
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

  const clearAllTransactions = useCallback(async () => {
    if (!user) return '로그인이 필요합니다.';

    const { error: deleteError } = await supabase
      .from('transactions')
      .delete()
      .eq('user_id', user.id);

    if (deleteError) {
      setError(deleteError.message);
      return deleteError.message;
    }

    setError(null);
    setTransactions([]);
    return null;
  }, [user]);

  return {
    transactions,
    loading,
    error,
    addTransaction,
    removeTransaction,
    clearAllTransactions,
    refetch: fetchTransactions,
  };
}
