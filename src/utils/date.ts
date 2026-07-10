export function formatDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function parseDateKey(dateKey: string): { year: number; month: number; day: number } {
  const [year, month, day] = dateKey.split('-').map(Number);
  return { year, month: month - 1, day };
}

export function getTodayKey(): string {
  const now = new Date();
  return formatDateKey(now.getFullYear(), now.getMonth(), now.getDate());
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

export function isSameMonth(dateKey: string, year: number, month: number): boolean {
  const { year: y, month: m } = parseDateKey(dateKey);
  return y === year && m === month;
}

export function isToday(dateKey: string): boolean {
  return dateKey === getTodayKey();
}
