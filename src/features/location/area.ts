import { isInKarnataka, type LatLng } from '@/lib/geo/karnataka';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

export type Area =
  | { status: 'outside' }
  | {
      status: 'inside';
      /** Missing when the server can't be reached; the inside/outside answer still holds. */
      district?: { id: number; en: string; kn: string };
      taluk?: { id: number; en: string; kn: string | null };
    };

type LocateRow = {
  district_id: number;
  district_name_en: string;
  district_name_kn: string;
  taluk_id: number;
  taluk_name_en: string;
  taluk_name_kn: string | null;
};

/** Is this point in Karnataka, and if so, which district and taluk? */
export async function describeArea(p: LatLng): Promise<Area> {
  if (!(await isInKarnataka(p))) return { status: 'outside' };
  if (!isSupabaseConfigured()) return { status: 'inside' };
  try {
    const { data, error } = await getSupabase()
      .rpc('locate_in_karnataka', { lat: p.lat, lng: p.lng })
      .returns<LocateRow[]>();
    const row = !error && Array.isArray(data) ? data[0] : undefined;
    if (!row) return { status: 'inside' };
    return {
      status: 'inside',
      district: { id: row.district_id, en: row.district_name_en, kn: row.district_name_kn },
      taluk: { id: row.taluk_id, en: row.taluk_name_en, kn: row.taluk_name_kn },
    };
  } catch {
    return { status: 'inside' };
  }
}

/** PURE: pick the name in the app language, falling back to English. */
export function localName(name: { en: string; kn: string | null }, language: string): string {
  return language === 'kn' && name.kn ? name.kn : name.en;
}
