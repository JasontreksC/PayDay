import { formatCompactCurrency } from '../utils/currency';
import {
  getDaysInMonth,
  getFirstDayOfWeek,
  formatDateKey,
  isToday,
} from '../utils/date';
import type { DaySummary } from '../types';
import './Calendar.css';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

interface CalendarProps {
  year: number;
  month: number;
  daySummaries: Map<string, DaySummary>;
  selectedDate: string;
  onSelectDate: (dateKey: string) => void;
}

export function Calendar({
  year,
  month,
  daySummaries,
  selectedDate,
  onSelectDate,
}: CalendarProps) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const cells: (number | null)[] = [];

  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="calendar">
      <div className="calendar-weekdays">
        {WEEKDAYS.map((day, i) => (
          <span key={day} className={`weekday ${i === 0 ? 'sunday' : i === 6 ? 'saturday' : ''}`}>
            {day}
          </span>
        ))}
      </div>
      <div className="calendar-grid">
        {cells.map((day, index) => {
          if (day === null) {
            return <div key={`empty-${index}`} className="calendar-cell empty" />;
          }

          const dateKey = formatDateKey(year, month, day);
          const summary = daySummaries.get(dateKey);
          const isSelected = dateKey === selectedDate;
          const today = isToday(dateKey);
          const dayOfWeek = (firstDay + day - 1) % 7;

          return (
            <button
              key={dateKey}
              type="button"
              className={`calendar-cell ${isSelected ? 'selected' : ''} ${today ? 'today' : ''}`}
              onClick={() => onSelectDate(dateKey)}
            >
              <span
                className={`day-number ${dayOfWeek === 0 ? 'sunday' : dayOfWeek === 6 ? 'saturday' : ''}`}
              >
                {day}
              </span>
              {summary && summary.income > 0 && (
                <span className="day-income">+{formatCompactCurrency(summary.income)}</span>
              )}
              {summary && summary.expense > 0 && (
                <span className="day-expense">-{formatCompactCurrency(summary.expense)}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
