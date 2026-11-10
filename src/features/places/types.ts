export type PlaceType = 'hospital' | 'clinic' | 'medical_store';

export type PlaceResult = {
  id: string;
  name_en: string;
  name_kn: string | null;
  type: PlaceType;
  address: string | null;
  pincode: string | null;
  phone: string | null;
  district_name_en: string | null;
  district_name_kn: string | null;
  taluk_name_en: string | null;
  is_24x7: boolean;
  has_emergency: boolean;
  trauma_care: boolean;
  ownership: 'government' | 'private' | null;
  is_registered: boolean;
  specialities: string[];
  open_now: boolean | null;
  distance_m: number | null;
  lat: number;
  lng: number;
};

export type Where =
  | { kind: 'near'; lat: number; lng: number; radiusM: number }
  | { kind: 'taluk'; talukId: number; label: string }
  | { kind: 'district'; districtId: number; label: string }
  | { kind: 'pincode'; pincode: string };

export type Filters = {
  types: PlaceType[];
  openNow: boolean;
  is24x7: boolean;
  emergency: boolean;
  ownership: 'government' | 'private' | null;
  query: string;
};

export const NO_FILTERS: Filters = {
  types: [],
  openNow: false,
  is24x7: false,
  emergency: false,
  ownership: null,
  query: '',
};

export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';
export type OpeningHours = Partial<Record<DayKey, [string, string][]>>;
