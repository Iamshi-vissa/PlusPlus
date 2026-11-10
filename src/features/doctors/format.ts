/** PURE helpers for showing times and doctor details in India time. */
const IST = 'Asia/Kolkata';

export function formatSlotTime(iso: string, language: string): string {
  return new Intl.DateTimeFormat(language === 'kn' ? 'kn-IN' : 'en-IN', {
    timeZone: IST,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function formatDay(iso: string, language: string): string {
  return new Intl.DateTimeFormat(language === 'kn' ? 'kn-IN' : 'en-IN', {
    timeZone: IST,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(iso));
}

export function formatDateTime(iso: string, language: string): string {
  return `${formatDay(iso, language)}, ${formatSlotTime(iso, language)}`;
}

/** "2026-11-10" in India time — used to group slots by day. */
export function istDateKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}

export function istHour(iso: string): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: IST, hour: '2-digit', hour12: false }).format(
      new Date(iso),
    ),
  );
}

export function groupSlotsByDay<T extends { starts_at: string }>(
  slots: T[],
): { day: string; slots: T[] }[] {
  const map = new Map<string, T[]>();
  for (const s of slots) {
    const key = istDateKey(s.starts_at);
    map.set(key, [...(map.get(key) ?? []), s]);
  }
  return [...map.entries()].map(([day, list]) => ({ day, slots: list }));
}

export function partOfDay(iso: string): 'morning' | 'afternoon' | 'evening' {
  const h = istHour(iso);
  return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening';
}

/** Can the patient still cancel / reschedule online? */
export function canChangeOnline(
  startsAt: string,
  cutoffMinutes: number,
  now: Date = new Date(),
): boolean {
  return new Date(startsAt).getTime() - cutoffMinutes * 60000 > now.getTime();
}
