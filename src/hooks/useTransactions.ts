import { useCallback, useEffect, useState } from 'react';
import type { Transaction, TransactionType } from '../types';
import { generateId } from '../utils/calculations';
import { loadTransactions, saveTransactions } from '../utils/storage';

export function useTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>(() => loadTransactions());

  useEffect(() => {
    saveTransactions(transactions);
  }, [transactions]);

  const addTransaction = useCallback(
    (date: string, type: TransactionType, amount: number, memo?: string) => {
      if (amount <= 0) return false;

      const tx: Transaction = {
        id: generateId(),
        date,
        type,
        amount,
        memo: memo?.trim() || undefined,
      };

      setTransactions((prev) => [...prev, tx]);
      return true;
    },
    [],
  );

  const removeTransaction = useCallback((id: string) => {
    setTransactions((prev) => prev.filter((tx) => tx.id !== id));
  }, []);

  return { transactions, addTransaction, removeTransaction };
}
