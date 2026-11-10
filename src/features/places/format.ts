import type { DayKey, Filters, OpeningHours, Where } from './types';

/** PURE: "350 m", "2.4 km", "18 km". */
export function formatDistance(m: number | null): string | null {
  if (m === null || !Number.isFinite(m)) return null;
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m`;
  if (m < 10000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m / 1000)} km`;
}

/** PURE: opens Google Maps directions (app if installed, else browser). */
export function directionsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

export const DAY_KEYS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/** PURE: today's key in India time. */
export function todayKey(now: Date = new Date()): DayKey {
  const ist = new Date(now.getTime() + (5 * 60 + 30) * 60000);
  return DAY_KEYS[(ist.getUTCDay() + 6) % 7];
}

/** PURE: "09:00–13:00, 17:00–21:00" or null if closed / unknown. */
export function formatDayHours(hours: OpeningHours | null, day: DayKey): string | null {
  const spans = hours?.[day];
  if (!spans || spans.length === 0) return null;
  return spans.map(([a, b]) => `${a}–${b}`).join(', ');
}

/** PURE: the arguments for the search_places database function. */
export function searchArgs(where: Where, filters: Filters): Record<string, unknown> {
  const args: Record<string, unknown> = {
    p_types: filters.types.length > 0 ? filters.types : null,
    p_open_now: filters.openNow,
    p_24x7: filters.is24x7,
    p_emergency: filters.emergency,
    p_ownership: filters.ownership,
    p_query: filters.query.trim() || null,
    p_limit: 50,
  };
  if (where.kind === 'near')
    Object.assign(args, { p_lat: where.lat, p_lng: where.lng, p_radius_m: where.radiusM });
  if (where.kind === 'taluk') args.p_taluk_id = where.talukId;
  if (where.kind === 'district') args.p_district_id = where.districtId;
  if (where.kind === 'pincode') args.p_pincode = where.pincode;
  return args;
}

/** PURE: next wider radius for "Search a wider area" (5 → 10 → 20 → 50 km). */
export function widerRadius(radiusM: number): number | null {
  const steps = [5000, 10000, 20000, 50000];
  return steps.find((s) => s > radiusM) ?? null;
}
