import * as Location from 'expo-location';

import type { LatLng } from '@/lib/geo/karnataka';

export type LocationResult =
  | { ok: true; coords: LatLng; accuracyM: number | null }
  | { ok: false; reason: 'denied' | 'unavailable' };

/** Asks for permission if needed, then gets one location fix. Never logs the location. */
export async function getCurrentLocation(): Promise<LocationResult> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') return { ok: false, reason: 'denied' };
    const fix = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return {
      ok: true,
      coords: { lat: fix.coords.latitude, lng: fix.coords.longitude },
      accuracyM: fix.coords.accuracy ?? null,
    };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}
