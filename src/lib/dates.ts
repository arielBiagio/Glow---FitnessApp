export function localDate(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const value = (type: string) => parts.find(part => part.type === type)!.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function weekStart(date = new Date(), timezone = deviceTimezone()): string {
  const day = localDate(date, timezone);
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
  return shiftDate(day, -((weekday + 6) % 7));
}

export function deviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

export function weekLabel(start: string): string {
  const format = (date: string) => new Intl.DateTimeFormat('es', {
    day: 'numeric', month: 'short', timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
  return `${format(start)} – ${format(shiftDate(start, 6))}`;
}
