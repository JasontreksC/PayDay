export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  date: string;
  type: TransactionType;
  amount: number;
  memo?: string;
}

export interface DaySummary {
  income: number;
  expense: number;
}

export interface MonthlyStats {
  totalIncome: number;
  totalExpense: number;
  balance: number;
  daysElapsed: number;
  daysRemaining: number;
  avgDailyIncome: number;
  avgDailyExpense: number;
  dailySpendingLimit: number;
}
