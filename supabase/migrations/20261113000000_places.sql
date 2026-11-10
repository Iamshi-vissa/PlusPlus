-- Phase 4: places (hospitals, clinics, medical stores), specialities, and search.
-- Public directory: anyone may read; only platform admins (phase 8) and clinic admins
-- for their own place (phase 5) may change anything.

-- ---------------------------------------------------------------------------
-- Platform admins (used by policies from here on; managed in the admin panel).
-- ---------------------------------------------------------------------------
create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.platform_admins enable row level security;
revoke all on public.platform_admins from anon, authenticated;

create function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()));
$$;
-- Used inside access rules that anonymous users also hit; it answers false for them.
revoke execute on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Specialities (shared by search and the doctor finder)
-- ---------------------------------------------------------------------------
create table public.specialities (
  code text primary key,
  name_en text not null,
  name_kn text not null,
  search_terms text[] not null default '{}'   -- e.g. 'orthopaedic', 'bone', 'ortho'
);
alter table public.specialities enable row level security;
create policy "specialities: anyone can read" on public.specialities for select to anon, authenticated using (true);
revoke all on public.specialities from anon, authenticated;
grant select on public.specialities to anon, authenticated;

insert into public.specialities (code, name_en, name_kn, search_terms) values
  ('gp', 'General physician', 'ಸಾಮಾನ್ಯ ವೈದ್ಯರು', '{general,physician,fever,doctor,gp}'),
  ('family_medicine', 'Family medicine', 'ಕುಟುಂಬ ವೈದ್ಯಕೀಯ', '{family,general}'),
  ('internal_medicine', 'Internal medicine', 'ಆಂತರಿಕ ವೈದ್ಯಕೀಯ', '{internal,medicine,md}'),
  ('paeds', 'Paediatrics (child specialist)', 'ಮಕ್ಕಳ ತಜ್ಞರು', '{paediatric,pediatric,child,children,baby,kids}'),
  ('obgyn', 'Obstetrics & gynaecology', 'ಪ್ರಸೂತಿ ಮತ್ತು ಸ್ತ್ರೀರೋಗ', '{gynaecology,gynecology,pregnancy,women,obstetrics,maternity}'),
  ('ortho', 'Orthopaedics (bones & joints)', 'ಮೂಳೆ ಮತ್ತು ಕೀಲು ತಜ್ಞರು', '{orthopaedic,orthopedic,bone,joint,fracture,knee,back}'),
  ('dental', 'Dentistry', 'ದಂತ ವೈದ್ಯಕೀಯ', '{dental,dentist,tooth,teeth}'),
  ('derma', 'Dermatology (skin)', 'ಚರ್ಮರೋಗ ತಜ್ಞರು', '{dermatology,skin,rash,hair}'),
  ('ent', 'ENT (ear, nose, throat)', 'ಕಿವಿ, ಮೂಗು, ಗಂಟಲು', '{ent,ear,nose,throat}'),
  ('eye', 'Ophthalmology (eyes)', 'ನೇತ್ರ ತಜ್ಞರು', '{eye,ophthalmology,vision,eyes}'),
  ('cardio', 'Cardiology (heart)', 'ಹೃದಯ ತಜ್ಞರು', '{cardiology,heart,cardiac,bp}'),
  ('neuro', 'Neurology (brain & nerves)', 'ನರರೋಗ ತಜ್ಞರು', '{neurology,brain,nerve,headache,stroke}'),
  ('gastro', 'Gastroenterology (stomach)', 'ಜೀರ್ಣಾಂಗ ತಜ್ಞರು', '{gastroenterology,stomach,digestion,liver}'),
  ('pulmo', 'Pulmonology (lungs)', 'ಶ್ವಾಸಕೋಶ ತಜ್ಞರು', '{pulmonology,lungs,breathing,asthma,cough}'),
  ('endo', 'Endocrinology (diabetes & thyroid)', 'ಮಧುಮೇಹ ಮತ್ತು ಥೈರಾಯ್ಡ್ ತಜ್ಞರು', '{endocrinology,diabetes,sugar,thyroid}'),
  ('psych', 'Psychiatry (mental health)', 'ಮನೋವೈದ್ಯಕೀಯ', '{psychiatry,mental,anxiety,depression,mood}'),
  ('uro', 'Urology', 'ಮೂತ್ರರೋಗ ತಜ್ಞರು', '{urology,kidney,urine}'),
  ('general_surgery', 'General surgery', 'ಸಾಮಾನ್ಯ ಶಸ್ತ್ರಚಿಕಿತ್ಸೆ', '{surgery,surgeon}'),
  ('physio', 'Physiotherapy', 'ಫಿಸಿಯೋಥೆರಪಿ', '{physiotherapy,physio,rehab}'),
  ('emergency', 'Emergency medicine', 'ತುರ್ತು ವೈದ್ಯಕೀಯ', '{emergency,casualty,trauma,accident}');

-- ---------------------------------------------------------------------------
-- Places
-- ---------------------------------------------------------------------------
create table public.places (
  id uuid primary key default gen_random_uuid(),
  name_en text not null check (char_length(btrim(name_en)) between 2 and 200),
  name_kn text,
  normalized_name text generated always as (
    btrim(regexp_replace(lower(name_en), '[^a-z0-9]+', ' ', 'g'))
  ) stored,
  type text not null check (type in ('hospital', 'clinic', 'medical_store')),
  hfr_facility_id text unique check (hfr_facility_id is null or hfr_facility_id ~ '^[0-9A-Z]{12}$'),
  trauma_care boolean not null default false,
  ownership text check (ownership in ('government', 'private')),
  location extensions.geography(Point, 4326) not null,
  address text,
  district_id smallint references public.districts (id),
  taluk_id int references public.taluks (id),
  pincode text check (pincode is null or pincode ~ '^5[6-9][0-9]{4}$'),
  phone text,
  -- {"mon": [["09:00","13:00"],["17:00","21:00"]], ..., "sun": []}; times in IST
  opening_hours jsonb,
  is_24x7 boolean not null default false,
  has_emergency boolean not null default false,
  specialities text[] not null default '{}',
  is_registered boolean not null default false,   -- bookable on plusplus (phase 5)
  verified_at timestamptz,
  source text not null default 'plusplus' check (source in ('plusplus', 'hfr', 'google', 'osm', 'demo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index places_location_idx on public.places using gist (location);
create index places_normalized_name_trgm_idx on public.places using gin (normalized_name extensions.gin_trgm_ops);
create index places_name_kn_trgm_idx on public.places using gin (name_kn extensions.gin_trgm_ops);
create index places_taluk_idx on public.places (taluk_id);
create index places_pincode_idx on public.places (pincode);

create trigger places_set_updated_at before update on public.places
  for each row execute function public.set_updated_at();

-- Fill district / taluk from the location (keeps area search consistent).
create function public.places_fill_area()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  loc record;
begin
  select * into loc
  from public.locate_in_karnataka(extensions.st_y(new.location::extensions.geometry),
                                  extensions.st_x(new.location::extensions.geometry));
  if not found then
    raise exception 'place_outside_karnataka' using errcode = 'P0001';
  end if;
  new.district_id := loc.district_id;
  new.taluk_id := loc.taluk_id;
  return new;
end;
$$;

create trigger places_fill_area before insert or update of location on public.places
  for each row execute function public.places_fill_area();

create table public.place_sources (
  place_id uuid not null references public.places (id) on delete cascade,
  source text not null check (source in ('plusplus', 'hfr', 'google', 'osm', 'demo')),
  source_id text not null,
  fetched_at timestamptz not null default now(),
  primary key (source, source_id)
);

alter table public.places enable row level security;
alter table public.place_sources enable row level security;
create policy "places: anyone can read" on public.places for select to anon, authenticated using (true);
create policy "places: admins manage" on public.places for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "place_sources: admins read" on public.place_sources for select to authenticated
  using (public.is_platform_admin());
revoke all on public.places, public.place_sources from anon, authenticated;
grant select on public.places to anon, authenticated;
grant insert, update, delete on public.places to authenticated;   -- limited by the admin policy
grant select on public.place_sources to authenticated;

-- ---------------------------------------------------------------------------
-- Open now? (all times India Standard Time)
-- ---------------------------------------------------------------------------
create function public.is_open_at(hours jsonb, is_24x7 boolean, at timestamptz default now())
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  local_ts timestamp := at at time zone 'Asia/Kolkata';
  today text := (array['sun','mon','tue','wed','thu','fri','sat'])[extract(dow from local_ts)::int + 1];
  yesterday text := (array['sun','mon','tue','wed','thu','fri','sat'])[((extract(dow from local_ts)::int + 6) % 7) + 1];
  now_t time := local_ts::time;
  slot jsonb;
  open_t time;
  close_t time;
begin
  if is_24x7 then return true; end if;
  if hours is null then return null; end if;   -- unknown
  for slot in select * from jsonb_array_elements(coalesce(hours -> today, '[]'::jsonb)) loop
    open_t := (slot ->> 0)::time;
    close_t := (slot ->> 1)::time;
    if close_t > open_t and now_t >= open_t and now_t < close_t then return true; end if;
    if close_t <= open_t and now_t >= open_t then return true; end if;       -- runs past midnight
  end loop;
  for slot in select * from jsonb_array_elements(coalesce(hours -> yesterday, '[]'::jsonb)) loop
    open_t := (slot ->> 0)::time;
    close_t := (slot ->> 1)::time;
    if close_t <= open_t and now_t < close_t then return true; end if;        -- yesterday's late shift
  end loop;
  return false;
end;
$$;

-- ---------------------------------------------------------------------------
-- Search
--   Near a point (p_lat/p_lng + radius), or inside a taluk, or by PIN code.
--   p_query matches names (typos allowed) and speciality words ("dental", "ortho").
-- ---------------------------------------------------------------------------
create function public.search_places(
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_m int default 5000,
  p_taluk_id int default null,
  p_district_id smallint default null,
  p_pincode text default null,
  p_types text[] default null,
  p_open_now boolean default false,
  p_24x7 boolean default false,
  p_emergency boolean default false,
  p_ownership text default null,
  p_query text default null,
  p_limit int default 50
)
returns table (
  id uuid, name_en text, name_kn text, type text, address text, pincode text, phone text,
  district_name_en text, district_name_kn text, taluk_name_en text,
  is_24x7 boolean, has_emergency boolean, trauma_care boolean, ownership text,
  is_registered boolean, specialities text[], open_now boolean,
  distance_m double precision, lat double precision, lng double precision
)
language sql
stable
set search_path = ''
as $$
  with params as (
    select
      case when p_lat is not null and p_lng is not null
           then extensions.st_setsrid(extensions.st_point(p_lng, p_lat), 4326)::extensions.geography end as pt,
      nullif(btrim(regexp_replace(lower(coalesce(p_query, '')), '[^a-z0-9ಀ-೿]+', ' ', 'g')), '') as q,
      least(greatest(coalesce(p_radius_m, 5000), 100), 50000) as radius,
      least(greatest(coalesce(p_limit, 50), 1), 100) as lim
  ),
  matching_specialities as (
    select s.code from public.specialities s, params
    where params.q is not null
      and (s.code = params.q or lower(s.name_en) like '%' || params.q || '%'
           or exists (select 1 from unnest(s.search_terms) t
                      where t like params.q || '%' or params.q like t || '%'
                         or (char_length(params.q) >= 4 and extensions.similarity(t, params.q) > 0.4)))
  )
  select p.id, p.name_en, p.name_kn, p.type, p.address, p.pincode, p.phone,
         d.name_en, d.name_kn, t.name_en,
         p.is_24x7, p.has_emergency, p.trauma_care, p.ownership, p.is_registered, p.specialities,
         public.is_open_at(p.opening_hours, p.is_24x7),
         case when params.pt is not null then extensions.st_distance(p.location, params.pt) end,
         extensions.st_y(p.location::extensions.geometry), extensions.st_x(p.location::extensions.geometry)
  from public.places p
  cross join params
  left join public.districts d on d.id = p.district_id
  left join public.taluks t on t.id = p.taluk_id
  where (params.pt is null or extensions.st_dwithin(p.location, params.pt, params.radius))
    and (p_taluk_id is null or p.taluk_id = p_taluk_id)
    and (p_district_id is null or p.district_id = p_district_id)
    and (p_pincode is null or p.pincode = p_pincode)
    and (p_types is null or cardinality(p_types) = 0 or p.type = any (p_types))
    and (not coalesce(p_open_now, false) or public.is_open_at(p.opening_hours, p.is_24x7) is true)
    and (not coalesce(p_24x7, false) or p.is_24x7)
    and (not coalesce(p_emergency, false) or p.has_emergency)
    and (p_ownership is null or p.ownership = p_ownership)
    and (params.q is null
         or params.q operator(extensions.<%) p.normalized_name   -- word-level, typo tolerant
         or p.normalized_name like '%' || params.q || '%'
         or coalesce(p.name_kn, '') like '%' || params.q || '%'
         or p.specialities && array(select code from matching_specialities))
    -- at least one way of saying "where"
    and (params.pt is not null or p_taluk_id is not null or p_district_id is not null or p_pincode is not null)
  order by
    case when params.q is not null then extensions.word_similarity(params.q, p.normalized_name) end desc nulls last,
    case when params.pt is not null then p.location operator(extensions.<->) params.pt end,
    p.name_en
  limit (select lim from params);
$$;

revoke execute on function public.search_places from public;
grant execute on function public.search_places to anon, authenticated, service_role;
revoke execute on function public.is_open_at(jsonb, boolean, timestamptz) from public;
grant execute on function public.is_open_at(jsonb, boolean, timestamptz) to anon, authenticated, service_role;

-- Area picker: centre point of a taluk (for "Choose area" maps).
create function public.taluk_centre(p_taluk_id int)
returns table (lat double precision, lng double precision)
language sql stable set search_path = ''
as $$
  select extensions.st_y(c), extensions.st_x(c)
  from (select extensions.st_pointonsurface(geom::extensions.geometry) c from public.taluks where id = p_taluk_id) x;
$$;
grant execute on function public.taluk_centre(int) to anon, authenticated;
