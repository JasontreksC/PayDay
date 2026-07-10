import type { DaySummary, MonthlyStats, Transaction } from '../types';
import { formatDateKey, getDaysInMonth } from './date';

export function summarizeByDay(transactions: Transaction[]): Map<string, DaySummary> {
  const map = new Map<string, DaySummary>();

  for (const tx of transactions) {
    const current = map.get(tx.date) ?? { income: 0, expense: 0 };
    if (tx.type === 'income') {
      current.income += tx.amount;
    } else {
      current.expense += tx.amount;
    }
    map.set(tx.date, current);
  }

  return map;
}

export function getMonthTransactions(
  transactions: Transaction[],
  year: number,
  month: number,
): Transaction[] {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  return transactions.filter((tx) => tx.date.startsWith(prefix));
}

export function calculateMonthlyStats(
  transactions: Transaction[],
  year: number,
  month: number,
  referenceDate: Date = new Date(),
): MonthlyStats {
  const monthTx = getMonthTransactions(transactions, year, month);

  const totalIncome = monthTx
    .filter((tx) => tx.type === 'income')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalExpense = monthTx
    .filter((tx) => tx.type === 'expense')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const balance = totalIncome - totalExpense;
  const daysInMonth = getDaysInMonth(year, month);

  const isCurrentMonth =
    referenceDate.getFullYear() === year && referenceDate.getMonth() === month;

  const daysElapsed = isCurrentMonth
    ? referenceDate.getDate()
    : daysInMonth;

  const daysRemaining = isCurrentMonth
    ? Math.max(daysInMonth - referenceDate.getDate() + 1, 1)
    : 0;

  const avgDailyIncome = daysElapsed > 0 ? totalIncome / daysElapsed : 0;
  const avgDailyExpense = daysElapsed > 0 ? totalExpense / daysElapsed : 0;

  const dailySpendingLimit =
    isCurrentMonth && daysRemaining > 0 ? balance / daysRemaining : balance;

  return {
    totalIncome,
    totalExpense,
    balance,
    daysElapsed,
    daysRemaining,
    avgDailyIncome,
    avgDailyExpense,
    dailySpendingLimit,
  };
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function getMonthLabel(year: number, month: number): string {
  return `${year}년 ${month + 1}월`;
}

export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const date = new Date(year, month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

export function clampSelectedDate(
  year: number,
  month: number,
  selectedDateKey: string,
): string {
  const { year: selYear, month: selMonth } = parseDateKeySafe(selectedDateKey);
  if (selYear === year && selMonth === month) {
    return selectedDateKey;
  }
  const today = new Date();
  if (today.getFullYear() === year && today.getMonth() === month) {
    return formatDateKey(year, month, today.getDate());
  }
  return formatDateKey(year, month, 1);
}

function parseDateKeySafe(dateKey: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateKey.split('-').map(Number);
  return { year, month: month - 1, day };
}
