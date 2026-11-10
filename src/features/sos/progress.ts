import type { SosView } from './api';

export type Message = { key: string; params?: Record<string, string | number> };

/** PURE: minutes for an ETA in seconds ("1" minimum). */
export function etaMinutes(seconds: number | null | undefined): number | null {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return null;
  return Math.max(1, Math.round(seconds / 60));
}

/** PURE: what to tell the person who raised the SOS, in plain words. */
export function progressMessage(
  s: Pick<SosView, 'status' | 'alerted' | 'deciding' | 'radius_m' | 'responder' | 'hospital'>,
): Message {
  switch (s.status) {
    case 'searching':
      if (s.alerted === 0) return { key: 'sos.progress.starting' };
      return {
        key: 'sos.progress.searching',
        params: {
          count: s.deciding > 0 ? s.deciding : s.alerted,
          km: Math.round(s.radius_m / 1000),
        },
      };
    case 'assigned':
    case 'en_route_to_scene': {
      const minutes = etaMinutes(s.responder?.eta_s);
      return minutes
        ? { key: 'sos.progress.coming', params: { name: s.responder?.name ?? '', minutes } }
        : { key: 'sos.progress.comingNoEta', params: { name: s.responder?.name ?? '' } };
    }
    case 'picked_up':
      return s.hospital
        ? { key: 'sos.progress.pickedUp', params: { hospital: s.hospital.name } }
        : { key: 'sos.progress.pickedUpNoHospital' };
    case 'reached_hospital':
      return { key: 'sos.progress.reached', params: { hospital: s.hospital?.name ?? '' } };
    case 'no_responder':
      return { key: 'sos.progress.noResponder' };
    case 'cancelled':
      return { key: 'sos.progress.cancelled' };
    case 'closed':
      return { key: 'sos.progress.closed' };
  }
}

/** PURE: seconds left to decide on an alert. */
export function secondsLeft(decideBy: string, now: number): number {
  return Math.max(0, Math.ceil((new Date(decideBy).getTime() - now) / 1000));
}

/** PURE: Android opens turn-by-turn navigation directly; others open Google Maps directions. */
export function navigationUrl(lat: number, lng: number, platform: string): string {
  return platform === 'android'
    ? `google.navigation:q=${lat.toFixed(6)},${lng.toFixed(6)}`
    : `https://www.google.com/maps/dir/?api=1&destination=${lat.toFixed(6)},${lng.toFixed(6)}&travelmode=driving`;
}
