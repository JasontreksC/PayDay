import { useMemo, useState } from 'react';
import { Calendar } from '../components/Calendar';
import { MonthlyStatsPanel } from '../components/MonthlyStats';
import { TransactionForm } from '../components/TransactionForm';
import { AccountScreen } from '../components/auth/AccountScreen';
import { useAuth } from '../contexts/AuthContext';
import { useTelegram } from '../hooks/useTelegram';
import { useTransactions } from '../hooks/useTransactions';
import {
  calculateMonthlyStats,
  clampSelectedDate,
  getMonthLabel,
  shiftMonth,
  summarizeByDay,
} from '../utils/calculations';
import { getTodayKey } from '../utils/date';
import '../App.css';

export function LedgerApp() {
  useTelegram();
  const { user } = useAuth();
  const { transactions, loading, error, addTransaction, removeTransaction } = useTransactions();
  const [showAccount, setShowAccount] = useState(false);

  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(getTodayKey());

  const daySummaries = useMemo(() => summarizeByDay(transactions), [transactions]);

  const monthlyStats = useMemo(
    () => calculateMonthlyStats(transactions, viewYear, viewMonth),
    [transactions, viewYear, viewMonth],
  );

  const isCurrentMonth =
    viewYear === today.getFullYear() && viewMonth === today.getMonth();

  const goToPrevMonth = () => {
    const { year, month } = shiftMonth(viewYear, viewMonth, -1);
    setViewYear(year);
    setViewMonth(month);
    setSelectedDate((prev) => clampSelectedDate(year, month, prev));
  };

  const goToNextMonth = () => {
    const { year, month } = shiftMonth(viewYear, viewMonth, 1);
    setViewYear(year);
    setViewMonth(month);
    setSelectedDate((prev) => clampSelectedDate(year, month, prev));
  };

  const goToToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelectedDate(getTodayKey());
  };

  const handleAdd = async (type: 'income' | 'expense', amount: number, memo?: string) => {
    return addTransaction(selectedDate, type, amount, memo);
  };

  if (showAccount) {
    return <AccountScreen onBack={() => setShowAccount(false)} />;
  }

  if (loading) {
    return <div className="auth-loading">거래 내역 불러오는 중...</div>;
  }

  return (
    <div className="app">
      <header className="header">
        <h1 className="app-title">PayDay</h1>
        <button type="button" className="account-entry" onClick={() => setShowAccount(true)}>
          {user?.email}
        </button>
      </header>

      <div className="month-nav">
        <button type="button" className="nav-btn" onClick={goToPrevMonth} aria-label="이전 달">
          ‹
        </button>
        <button type="button" className="month-label" onClick={goToToday}>
          {getMonthLabel(viewYear, viewMonth)}
          {!isCurrentMonth && <span className="today-hint">오늘로</span>}
        </button>
        <button type="button" className="nav-btn" onClick={goToNextMonth} aria-label="다음 달">
          ›
        </button>
      </div>

      <main className="main">
        {error && <p className="ledger-error">{error}</p>}

        <MonthlyStatsPanel
          stats={monthlyStats}
          monthLabel={getMonthLabel(viewYear, viewMonth)}
          isCurrentMonth={isCurrentMonth}
        />

        <Calendar
          year={viewYear}
          month={viewMonth}
          daySummaries={daySummaries}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
        />

        <TransactionForm
          selectedDate={selectedDate}
          transactions={transactions}
          onAdd={handleAdd}
          onRemove={removeTransaction}
        />
      </main>
    </div>
  );
}
