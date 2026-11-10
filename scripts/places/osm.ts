/**
 * PURE: turn OpenStreetMap health facilities into plusplus places.
 * Used by scripts/places/import-osm.ts; unit-tested in tests/osm.test.ts.
 */
export type OsmElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

export type DayHours = [string, string][];
export type OpeningHours = Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', DayHours>;

export type ImportedPlace = {
  sourceId: string;
  name_en: string;
  name_kn: string | null;
  type: 'hospital' | 'clinic' | 'medical_store';
  ownership: 'government' | 'private' | null;
  lat: number;
  lng: number;
  address: string | null;
  pincode: string | null;
  phone: string | null;
  opening_hours: OpeningHours | null;
  is_24x7: boolean;
  has_emergency: boolean;
  specialities: string[];
};

const DAYS = ['mo', 'tu', 'we', 'th', 'fr', 'sa', 'su'] as const;
const KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;

const SPECIALITY_TAGS: Record<string, string> = {
  general: 'gp',
  gynaecology: 'obgyn',
  obstetrics: 'obgyn',
  paediatrics: 'paeds',
  orthopaedics: 'ortho',
  dentist: 'dental',
  dental: 'dental',
  dermatology: 'derma',
  otolaryngology: 'ent',
  ophthalmology: 'eye',
  cardiology: 'cardio',
  neurology: 'neuro',
  gastroenterology: 'gastro',
  pulmonology: 'pulmo',
  endocrinology: 'endo',
  psychiatry: 'psych',
  urology: 'uro',
  surgery: 'general_surgery',
  physiotherapy: 'physio',
  emergency: 'emergency',
  internal: 'internal_medicine',
};

function placeType(tags: Record<string, string>): ImportedPlace['type'] | null {
  const amenity = tags.amenity ?? '';
  const healthcare = tags.healthcare ?? '';
  if (amenity === 'hospital' || healthcare === 'hospital') return 'hospital';
  if (amenity === 'pharmacy' || healthcare === 'pharmacy' || tags.shop === 'chemist')
    return 'medical_store';
  if (
    ['clinic', 'doctors', 'dentist'].includes(amenity) ||
    ['clinic', 'doctor', 'dentist', 'centre'].includes(healthcare)
  ) {
    return 'clinic';
  }
  return null;
}

/**
 * Parses the common OSM opening_hours forms: "24/7", "Mo-Sa 09:00-13:00,17:00-21:00; Su off",
 * "Mo-Fr 09:00-17:00; Sa 09:00-13:00". Anything more complex returns null (= unknown hours).
 */
export function parseOpeningHours(raw: string | undefined): {
  hours: OpeningHours | null;
  is24x7: boolean;
} {
  if (!raw) return { hours: null, is24x7: false };
  const text = raw.trim().toLowerCase();
  if (text === '24/7' || text === 'mo-su 00:00-24:00') return { hours: null, is24x7: true };

  const hours = Object.fromEntries(KEYS.map((k) => [k, [] as DayHours])) as OpeningHours;
  for (const rule of text
    .split(';')
    .map((r) => r.trim())
    .filter(Boolean)) {
    const match = /^([a-z,\- ]+?)\s+(off|closed|[0-9:,\- ]+)$/.exec(rule);
    if (!match) return { hours: null, is24x7: false };
    const days = new Set<number>();
    for (const part of match[1].split(',').map((p) => p.trim())) {
      const range = part.split('-').map((d) => DAYS.indexOf(d.trim() as (typeof DAYS)[number]));
      if (range.some((i) => i < 0) || range.length > 2) return { hours: null, is24x7: false };
      const [from, to = from] = range;
      for (let i = from; ; i = (i + 1) % 7) {
        days.add(i);
        if (i === to) break;
      }
    }
    const spans: DayHours = [];
    if (!['off', 'closed'].includes(match[2])) {
      for (const span of match[2].split(',').map((s) => s.trim())) {
        const t = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec(span);
        if (!t) return { hours: null, is24x7: false };
        const pad = (h: string, m: string) => `${h.padStart(2, '0')}:${m}`;
        const close = t[3] === '24' ? '23:59' : pad(t[3], t[4]);
        spans.push([pad(t[1], t[2]), close]);
      }
    }
    for (const d of days) hours[KEYS[d]] = spans;
  }
  return { hours, is24x7: false };
}

function normalizePhone(raw: string | undefined): string | null {
  if (!raw) return null;
  const first = raw.split(/[;,/]/)[0].replace(/[\s\-()]/g, '');
  return /^\+?\d{8,13}$/.test(first)
    ? first.startsWith('+')
      ? first
      : `+91${first.replace(/^0/, '')}`
    : null;
}

export function osmToPlace(el: OsmElement): ImportedPlace | null {
  const tags = el.tags ?? {};
  const type = placeType(tags);
  const name = (tags['name:en'] ?? tags.name ?? '').trim();
  const lat = el.lat ?? el.center?.lat;
  const lng = el.lon ?? el.center?.lon;
  if (!type || name.length < 2 || lat === undefined || lng === undefined) return null;

  const { hours, is24x7 } = parseOpeningHours(tags.opening_hours);
  const operatorType = (tags['operator:type'] ?? '').toLowerCase();
  const ownership = ['government', 'public'].includes(operatorType)
    ? 'government'
    : ['private', 'commercial', 'charitable', 'ngo'].includes(operatorType)
      ? 'private'
      : null;
  const specialities = new Set<string>();
  for (const s of (tags['healthcare:speciality'] ?? '').split(/[;,]/)) {
    const code = SPECIALITY_TAGS[s.trim().toLowerCase()];
    if (code) specialities.add(code);
  }
  if (tags.amenity === 'dentist' || tags.healthcare === 'dentist') specialities.add('dental');
  const pincode = /^5[6-9]\d{4}$/.test(tags['addr:postcode'] ?? '') ? tags['addr:postcode'] : null;
  const address = [
    tags['addr:housenumber'],
    tags['addr:street'],
    tags['addr:suburb'],
    tags['addr:city'],
  ]
    .filter(Boolean)
    .join(', ');

  return {
    sourceId: `${el.type}/${el.id}`,
    name_en: name,
    name_kn: tags['name:kn']?.trim() || null,
    type,
    ownership,
    lat,
    lng,
    address: address || null,
    pincode,
    phone: normalizePhone(tags.phone ?? tags['contact:phone']),
    opening_hours: hours,
    is_24x7: is24x7,
    has_emergency: tags.emergency === 'yes',
    specialities: [...specialities].sort(),
  };
}
