import { booleanPointInPolygon } from '@turf/boolean-point-in-polygon';
import { multiPolygon, point } from '@turf/helpers';

import { getSupabase } from '@/lib/supabase';

import shape from './karnataka-check.json';

export type LatLng = { lat: number; lng: number };

/**
 * - `inside` / `outside`: certain, even offline.
 * - `near_border`: within about 1.5 km of the state border; ask the server (exact boundary).
 */
export type KarnatakaCheck = 'inside' | 'outside' | 'near_border';

const inner = multiPolygon(shape.inner as number[][][][]);
const outer = multiPolygon(shape.outer as number[][][][]);

export function isValidLatLng({ lat, lng }: LatLng): boolean {
  return (
    Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
  );
}

/**
 * PURE, works offline: is this point in Karnataka?
 * Uses the state outline shrunk and grown by ~1.5 km, so a simplified outline can never
 * wrongly say "outside" to someone who is just inside the border.
 */
export function checkInKarnataka(p: LatLng): KarnatakaCheck {
  if (!isValidLatLng(p)) return 'outside';
  const pt = point([p.lng, p.lat]);
  if (booleanPointInPolygon(pt, inner)) return 'inside';
  if (!booleanPointInPolygon(pt, outer)) return 'outside';
  return 'near_border';
}

/** PURE: Karnataka PIN codes are 6 digits starting with 56, 57, 58 or 59. */
export function isKarnatakaPincode(input: string): boolean {
  return /^5[6-9]\d{4}$/.test(input.replace(/\s/g, ''));
}

/**
 * The final answer. Certain cases are answered on the phone; near the border the server
 * checks the exact boundary. If the server can't be reached, near-border points are
 * allowed (never block someone who may well be in Karnataka).
 */
export async function isInKarnataka(p: LatLng): Promise<boolean> {
  const quick = checkInKarnataka(p);
  if (quick !== 'near_border') return quick === 'inside';
  try {
    const { data, error } = await getSupabase().rpc('is_in_karnataka', { lat: p.lat, lng: p.lng });
    if (error || typeof data !== 'boolean') return true;
    return data;
  } catch {
    return true;
  }
}
