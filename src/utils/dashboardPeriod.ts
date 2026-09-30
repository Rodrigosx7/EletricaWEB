function isoLocal(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Compara o mês em curso com o mesmo intervalo de dias do mês anterior. */
export function dashboardPeriod(today: Date) {
  const year = today.getFullYear();
  const month = today.getMonth();
  const previousMonthLastDay = new Date(year, month, 0).getDate();
  const previousEndDay = Math.min(today.getDate(), previousMonthLastDay);

  return {
    currentStart: isoLocal(new Date(year, month, 1)),
    currentEnd: isoLocal(today),
    previousStart: isoLocal(new Date(year, month - 1, 1)),
    previousEnd: isoLocal(new Date(year, month - 1, previousEndDay)),
    previousEndDay,
  };
}
