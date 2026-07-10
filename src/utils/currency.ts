export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ko-KR').format(Math.round(amount));
}

export function formatCompactCurrency(amount: number): string {
  const abs = Math.abs(amount);
  if (abs >= 10000) {
    const man = amount / 10000;
    const formatted = man % 1 === 0 ? man.toString() : man.toFixed(1);
    return `${formatted}만`;
  }
  return formatCurrency(amount);
}
