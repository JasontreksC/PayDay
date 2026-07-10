import type { MonthlyStats } from '../types';
import { formatCurrency } from '../utils/currency';
import './MonthlyStats.css';

interface MonthlyStatsProps {
  stats: MonthlyStats;
  monthLabel: string;
  isCurrentMonth: boolean;
}

export function MonthlyStatsPanel({ stats, monthLabel, isCurrentMonth }: MonthlyStatsProps) {
  const isOverBudget = stats.balance < 0;
  const limitIsNegative = stats.dailySpendingLimit < 0;

  return (
    <div className="monthly-stats">
      <h2 className="stats-title">{monthLabel} 요약</h2>

      <div className="stats-row">
        <div className="stat-item">
          <span className="stat-label">총 수입</span>
          <span className="stat-value income">+{formatCurrency(stats.totalIncome)}원</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">총 지출</span>
          <span className="stat-value expense">-{formatCurrency(stats.totalExpense)}원</span>
        </div>
      </div>

      <div className="stats-balance">
        <span className="stat-label">잔액</span>
        <span className={`stat-value ${isOverBudget ? 'expense' : 'income'}`}>
          {stats.balance >= 0 ? '+' : ''}{formatCurrency(stats.balance)}원
        </span>
      </div>

      <div className="stats-divider" />

      <div className="stats-row">
        <div className="stat-item">
          <span className="stat-label">일 평균 수입</span>
          <span className="stat-value income small">
            +{formatCurrency(stats.avgDailyIncome)}원
          </span>
          <span className="stat-sub">({stats.daysElapsed}일 기준)</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">일 평균 지출</span>
          <span className="stat-value expense small">
            -{formatCurrency(stats.avgDailyExpense)}원
          </span>
          <span className="stat-sub">({stats.daysElapsed}일 기준)</span>
        </div>
      </div>

      {isCurrentMonth && (
        <div className={`daily-limit ${limitIsNegative ? 'over' : 'safe'}`}>
          <div className="limit-header">
            <span className="limit-icon">{limitIsNegative ? '⚠️' : '💡'}</span>
            <span className="limit-title">남은 기간 일일 소비 한도</span>
          </div>
          <p className="limit-value">
            {limitIsNegative ? (
              <>이미 <strong>{formatCurrency(Math.abs(stats.dailySpendingLimit))}원</strong> 초과 소비 중</>
            ) : (
              <>하루 <strong>{formatCurrency(stats.dailySpendingLimit)}원</strong> 이하로 소비</>
            )}
          </p>
          <p className="limit-desc">
            잔액 {formatCurrency(stats.balance)}원 ÷ 남은 {stats.daysRemaining}일
          </p>
        </div>
      )}
    </div>
  );
}
