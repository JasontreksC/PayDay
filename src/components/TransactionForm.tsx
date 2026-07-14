import { useState } from 'react';
import type { Transaction, TransactionType } from '../types';
import { formatCurrency } from '../utils/currency';
import { parseDateKey } from '../utils/date';
import './TransactionForm.css';

interface TransactionFormProps {
  selectedDate: string;
  transactions: Transaction[];
  onAdd: (type: TransactionType, amount: number, memo?: string) => Promise<boolean>;
  onRemove: (id: string) => void;
}

export function TransactionForm({
  selectedDate,
  transactions,
  onAdd,
  onRemove,
}: TransactionFormProps) {
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { month, day } = parseDateKey(selectedDate);
  const dayTransactions = transactions
    .filter((tx) => tx.date === selectedDate)
    .sort((a, b) => b.id.localeCompare(a.id));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Number(amount.replace(/,/g, ''));
    if (!parsed || parsed <= 0) return;

    setSubmitting(true);
    const success = await onAdd(type, parsed, memo);
    setSubmitting(false);

    if (success) {
      setAmount('');
      setMemo('');
    }
  };

  const handleAmountChange = (value: string) => {
    const digits = value.replace(/[^\d]/g, '');
    setAmount(digits ? Number(digits).toLocaleString('ko-KR') : '');
  };

  return (
    <div className="transaction-form">
      <h3 className="form-title">
        {month + 1}월 {day}일
      </h3>

      <form onSubmit={handleSubmit} className="form">
        <div className="type-toggle">
          <button
            type="button"
            className={`toggle-btn income ${type === 'income' ? 'active' : ''}`}
            onClick={() => setType('income')}
          >
            수입
          </button>
          <button
            type="button"
            className={`toggle-btn expense ${type === 'expense' ? 'active' : ''}`}
            onClick={() => setType('expense')}
          >
            지출
          </button>
        </div>

        <div className="input-group">
          <label htmlFor="amount">금액</label>
          <div className="amount-input-wrap">
            <input
              id="amount"
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              required
            />
            <span className="currency-suffix">원</span>
          </div>
        </div>

        <div className="input-group">
          <label htmlFor="memo">메모 (선택)</label>
          <input
            id="memo"
            type="text"
            placeholder="예: 점심, 월급"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            maxLength={50}
          />
        </div>

        <button type="submit" className="submit-btn" disabled={submitting}>
          {submitting ? '등록 중...' : type === 'income' ? '수입 등록' : '지출 등록'}
        </button>
      </form>

      {dayTransactions.length > 0 && (
        <div className="day-list">
          <h4 className="list-title">이 날의 내역</h4>
          <ul>
            {dayTransactions.map((tx) => (
              <li key={tx.id} className="list-item">
                <div className="item-info">
                  <span className={`item-amount ${tx.type}`}>
                    {tx.type === 'income' ? '+' : '-'}
                    {formatCurrency(tx.amount)}원
                  </span>
                  {tx.memo && <span className="item-memo">{tx.memo}</span>}
                </div>
                <button
                  type="button"
                  className="delete-btn"
                  onClick={() => onRemove(tx.id)}
                  aria-label="삭제"
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
