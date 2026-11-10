import { getSupabase } from '@/lib/supabase';

import { searchArgs } from './format';
import type { Filters, OpeningHours, PlaceResult, PlaceType, Where } from './types';

export async function searchPlaces(where: Where, filters: Filters): Promise<PlaceResult[]> {
  const { data, error } = await getSupabase().rpc('search_places', searchArgs(where, filters));
  if (error) throw new Error('places.errors.searchFailed');
  return (data ?? []) as PlaceResult[];
}

export type District = { id: number; name_en: string; name_kn: string };
export type Taluk = { id: number; name_en: string; name_kn: string | null };

export async function listDistricts(): Promise<District[]> {
  const { data, error } = await getSupabase()
    .from('districts')
    .select('id, name_en, name_kn')
    .order('name_en');
  if (error) throw new Error('places.errors.searchFailed');
  return data ?? [];
}

export async function listTaluks(districtId: number): Promise<Taluk[]> {
  const { data, error } = await getSupabase()
    .from('taluks')
    .select('id, name_en, name_kn')
    .eq('district_id', districtId)
    .order('name_en');
  if (error) throw new Error('places.errors.searchFailed');
  return data ?? [];
}

export type PlaceDetails = {
  id: string;
  name_en: string;
  name_kn: string | null;
  type: PlaceType;
  address: string | null;
  pincode: string | null;
  phone: string | null;
  opening_hours: OpeningHours | null;
  is_24x7: boolean;
  has_emergency: boolean;
  trauma_care: boolean;
  ownership: 'government' | 'private' | null;
  is_registered: boolean;
  specialities: string[];
  source: string;
  district: { name_en: string; name_kn: string } | null;
  taluk: { name_en: string; name_kn: string | null } | null;
  lat: number;
  lng: number;
};

export async function getPlace(id: string): Promise<PlaceDetails | null> {
  // Location comes back via the search function's lat/lng; use a tiny RPC-free query here.
  const { data, error } = await getSupabase()
    .from('places')
    .select(
      'id, name_en, name_kn, type, address, pincode, phone, opening_hours, is_24x7, has_emergency, trauma_care, ownership, is_registered, specialities, source, location, district:districts(name_en, name_kn), taluk:taluks(name_en, name_kn)',
    )
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error('places.errors.loadFailed');
  if (!data) return null;
  const { location, ...rest } = data as unknown as Omit<PlaceDetails, 'lat' | 'lng'> & {
    location: unknown;
  };
  const [lng, lat] = parsePoint(location);
  return { ...rest, lat, lng };
}

/** PostgREST returns geography as GeoJSON or as hex WKB depending on settings; handle both. */
export function parsePoint(value: unknown): [number, number] {
  if (value && typeof value === 'object' && 'coordinates' in value) {
    const [x, y] = (value as { coordinates: [number, number] }).coordinates;
    return [x, y];
  }
  if (typeof value === 'string' && /^[0-9a-fA-F]+$/.test(value)) {
    // EWKB point (little endian): 1 byte order + 4 type + (4 srid) + 8 x + 8 y
    const bytes = value.match(/../g)!.map((h) => parseInt(h, 16));
    const view = new DataView(new Uint8Array(bytes).buffer);
    const little = view.getUint8(0) === 1;
    const type = view.getUint32(1, little);
    const offset = type & 0x20000000 ? 9 : 5;
    return [view.getFloat64(offset, little), view.getFloat64(offset + 8, little)];
  }
  return [Number.NaN, Number.NaN];
}
