/** Responder location rules (PROJECT.md "Responder location updates"). All PURE. */
export const LOCATION_RULES = {
  maxAccuracyM: 100, // drop worse fixes
  idleIntervalMs: 30000, // while available
  activeIntervalMs: 5000, // during an active SOS
  minMoveM: 100, // or when moved this far
  smoothWindow: 3, // moving average of the last 3 fixes
} as const;

export type Fix = { lat: number; lng: number; accuracyM: number; at: number };

/** Great-circle distance in metres. */
export function distanceM(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function isUsableFix(fix: Fix): boolean {
  return Number.isFinite(fix.accuracyM) && fix.accuracyM <= LOCATION_RULES.maxAccuracyM;
}

/** Average of the last few usable fixes, so the marker doesn't jump around. */
export function smooth(recent: Fix[]): Fix | null {
  const usable = recent.filter(isUsableFix).slice(-LOCATION_RULES.smoothWindow);
  if (usable.length === 0) return null;
  const n = usable.length;
  return {
    lat: usable.reduce((s, f) => s + f.lat, 0) / n,
    lng: usable.reduce((s, f) => s + f.lng, 0) / n,
    accuracyM: Math.max(...usable.map((f) => f.accuracyM)),
    at: usable[n - 1].at,
  };
}

/** Should this (smoothed) fix be sent to the server now? */
export function shouldSend(lastSent: Fix | null, next: Fix, activeSos: boolean): boolean {
  if (!isUsableFix(next)) return false;
  if (!lastSent) return true;
  const interval = activeSos ? LOCATION_RULES.activeIntervalMs : LOCATION_RULES.idleIntervalMs;
  return next.at - lastSent.at >= interval || distanceM(lastSent, next) >= LOCATION_RULES.minMoveM;
}

/** Indian registration numbers like KA01AB1234 (spaces and dashes allowed when typing). */
export function normalizeVehicleNumber(input: string): string | null {
  const v = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return /^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{1,4}$/.test(v) ? v : null;
}

/** Driving licence numbers are 15–16 characters, e.g. KA0120230001234; we only check the shape. */
export function isLicenceNumber(input: string): boolean {
  return /^[A-Z]{2}[0-9]{2}[0-9A-Z ]{9,16}$/.test(input.toUpperCase().replace(/-/g, '').trim());
}
