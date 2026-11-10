-- Phase 5: problems → specialities, clinics, doctors, slots, appointments, reviews, reminders.

-- ---------------------------------------------------------------------------
-- Problems and the doctor-reviewed problem → speciality mapping
-- (initial mapping written for review by a doctor before launch)
-- ---------------------------------------------------------------------------
create table public.problems (
  id serial primary key,
  code text not null unique,
  name_en text not null,
  name_kn text not null,
  body_area text not null check (body_area in
    ('head', 'chest', 'stomach', 'back', 'arms', 'legs', 'skin', 'general', 'mind', 'women', 'child')),
  icon text not null,                          -- Ionicons name
  is_red_flag boolean not null default false,  -- skip doctor search, show the emergency screen
  usually_specialist boolean not null default false,
  sort int not null default 100
);

create table public.problem_specialities (
  problem_id int not null references public.problems (id) on delete cascade,
  speciality_code text not null references public.specialities (code),
  weight numeric not null check (weight > 0 and weight <= 1),
  primary key (problem_id, speciality_code)
);

alter table public.problems enable row level security;
alter table public.problem_specialities enable row level security;
create policy "problems: anyone can read" on public.problems for select to anon, authenticated using (true);
create policy "problem_specialities: anyone can read" on public.problem_specialities for select to anon, authenticated using (true);
revoke all on public.problems, public.problem_specialities from anon, authenticated;
grant select on public.problems, public.problem_specialities to anon, authenticated;

insert into public.problems (code, name_en, name_kn, body_area, icon, is_red_flag, usually_specialist, sort) values
  -- emergencies first (red flags)
  ('chest_pain', 'Chest pain or pressure', 'ಎದೆ ನೋವು ಅಥವಾ ಒತ್ತಡ', 'chest', 'heart', true, false, 1),
  ('cant_breathe', 'Severe difficulty breathing', 'ಉಸಿರಾಡಲು ತೀವ್ರ ತೊಂದರೆ', 'chest', 'cloud', true, false, 2),
  ('fainting', 'Fainting or unconscious', 'ಮೂರ್ಛೆ ಅಥವಾ ಪ್ರಜ್ಞೆ ತಪ್ಪಿದೆ', 'general', 'bed', true, false, 3),
  ('stroke_signs', 'Face drooping, arm weakness or slurred speech', 'ಮುಖ ವಾಲುವುದು, ಕೈ ದುರ್ಬಲತೆ ಅಥವಾ ಮಾತು ತೊದಲುವುದು', 'head', 'flash', true, false, 4),
  ('heavy_bleeding', 'Heavy bleeding', 'ತೀವ್ರ ರಕ್ತಸ್ರಾವ', 'general', 'water', true, false, 5),
  ('severe_injury', 'Serious injury or accident', 'ಗಂಭೀರ ಗಾಯ ಅಥವಾ ಅಪಘಾತ', 'general', 'car', true, false, 6),
  ('seizure', 'Fits or seizure', 'ಫಿಟ್ಸ್ ಅಥವಾ ಸೆಳವು', 'head', 'pulse', true, false, 7),
  ('child_fever_drowsy', 'Child with high fever and very drowsy', 'ಹೆಚ್ಚು ಜ್ವರ ಮತ್ತು ತುಂಬಾ ಮಂಪರಿನಲ್ಲಿರುವ ಮಗು', 'child', 'thermometer', true, false, 8),
  ('poisoning_bite', 'Poisoning or snake bite', 'ವಿಷ ಸೇವನೆ ಅಥವಾ ಹಾವು ಕಡಿತ', 'general', 'warning', true, false, 9),
  ('severe_burns', 'Severe burns', 'ತೀವ್ರ ಸುಟ್ಟ ಗಾಯ', 'skin', 'flame', true, false, 10),
  -- common problems
  ('fever_cold', 'Fever & cold', 'ಜ್ವರ ಮತ್ತು ನೆಗಡಿ', 'general', 'thermometer', false, false, 20),
  ('cough', 'Cough', 'ಕೆಮ್ಮು', 'chest', 'chatbubble', false, false, 21),
  ('stomach_pain', 'Stomach pain', 'ಹೊಟ್ಟೆ ನೋವು', 'stomach', 'body', false, false, 22),
  ('vomiting_diarrhoea', 'Vomiting or loose motions', 'ವಾಂತಿ ಅಥವಾ ಭೇದಿ', 'stomach', 'water', false, false, 23),
  ('acidity', 'Acidity or gas', 'ಆಮ್ಲೀಯತೆ ಅಥವಾ ಗ್ಯಾಸ್', 'stomach', 'flame', false, false, 24),
  ('skin_rash', 'Skin rash', 'ಚರ್ಮದ ದದ್ದು', 'skin', 'hand-left', false, true, 25),
  ('itching_allergy', 'Itching or allergy', 'ತುರಿಕೆ ಅಥವಾ ಅಲರ್ಜಿ', 'skin', 'leaf', false, true, 26),
  ('hair_loss', 'Hair fall', 'ಕೂದಲು ಉದುರುವುದು', 'skin', 'cut', false, true, 27),
  ('tooth_pain', 'Tooth pain', 'ಹಲ್ಲು ನೋವು', 'head', 'happy', false, true, 28),
  ('back_pain', 'Back pain', 'ಬೆನ್ನು ನೋವು', 'back', 'body', false, false, 29),
  ('neck_shoulder_pain', 'Neck or shoulder pain', 'ಕುತ್ತಿಗೆ ಅಥವಾ ಭುಜ ನೋವು', 'back', 'body', false, false, 30),
  ('joint_knee_pain', 'Joint or knee pain', 'ಕೀಲು ಅಥವಾ ಮಂಡಿ ನೋವು', 'legs', 'walk', false, false, 31),
  ('arm_hand_pain', 'Arm or hand pain', 'ಕೈ ನೋವು', 'arms', 'hand-right', false, false, 32),
  ('injury_sprain', 'Injury or sprain', 'ಗಾಯ ಅಥವಾ ಉಳುಕು', 'legs', 'bandage', false, false, 33),
  ('leg_swelling', 'Swelling in the legs', 'ಕಾಲುಗಳಲ್ಲಿ ಊತ', 'legs', 'footsteps', false, false, 34),
  ('eye_problem', 'Eye problem', 'ಕಣ್ಣಿನ ಸಮಸ್ಯೆ', 'head', 'eye', false, true, 35),
  ('ear_nose_throat', 'Ear, nose or throat problem', 'ಕಿವಿ, ಮೂಗು ಅಥವಾ ಗಂಟಲು ಸಮಸ್ಯೆ', 'head', 'ear', false, false, 36),
  ('headache', 'Headache', 'ತಲೆನೋವು', 'head', 'sad', false, false, 37),
  ('breathing_wheeze', 'Wheezing or asthma', 'ಉಬ್ಬಸ ಅಥವಾ ಅಸ್ತಮಾ', 'chest', 'cloud', false, false, 38),
  ('heart_checkup', 'Heart check-up (known heart problem)', 'ಹೃದಯ ತಪಾಸಣೆ (ತಿಳಿದಿರುವ ಹೃದಯ ಸಮಸ್ಯೆ)', 'chest', 'heart', false, true, 39),
  ('pregnancy_care', 'Pregnancy care', 'ಗರ್ಭಧಾರಣೆ ಆರೈಕೆ', 'women', 'heart-circle', false, true, 40),
  ('womens_health', 'Women''s health', 'ಮಹಿಳೆಯರ ಆರೋಗ್ಯ', 'women', 'female', false, true, 41),
  ('period_problems', 'Period problems', 'ಮುಟ್ಟಿನ ಸಮಸ್ಯೆಗಳು', 'women', 'calendar', false, true, 42),
  ('child_unwell', 'Child is unwell', 'ಮಗುವಿಗೆ ಹುಷಾರಿಲ್ಲ', 'child', 'happy', false, false, 43),
  ('child_vaccination', 'Child vaccination', 'ಮಕ್ಕಳ ಲಸಿಕೆ', 'child', 'medkit', false, true, 44),
  ('diabetes_bp_checkup', 'Diabetes / BP check-up', 'ಮಧುಮೇಹ / ರಕ್ತದೊತ್ತಡ ತಪಾಸಣೆ', 'general', 'speedometer', false, true, 45),
  ('thyroid', 'Thyroid', 'ಥೈರಾಯ್ಡ್', 'general', 'medical', false, true, 46),
  ('weakness_tiredness', 'Weakness or tiredness', 'ದುರ್ಬಲತೆ ಅಥವಾ ಆಯಾಸ', 'general', 'battery-dead', false, false, 47),
  ('general_checkup', 'General health check-up', 'ಸಾಮಾನ್ಯ ಆರೋಗ್ಯ ತಪಾಸಣೆ', 'general', 'clipboard', false, false, 48),
  ('urine_problem', 'Urine problem', 'ಮೂತ್ರದ ಸಮಸ್ಯೆ', 'stomach', 'water', false, false, 49),
  ('anxiety_low_mood', 'Anxiety or low mood', 'ಆತಂಕ ಅಥವಾ ಮನಸ್ಸು ಕುಗ್ಗುವುದು', 'mind', 'cloudy', false, false, 50),
  ('sleep_problems', 'Sleep problems', 'ನಿದ್ರೆಯ ಸಮಸ್ಯೆ', 'mind', 'moon', false, false, 51);

insert into public.problem_specialities (problem_id, speciality_code, weight)
select p.id, m.code, m.weight from (values
  ('chest_pain','emergency',1.0), ('cant_breathe','emergency',1.0), ('fainting','emergency',1.0),
  ('stroke_signs','emergency',1.0), ('heavy_bleeding','emergency',1.0), ('severe_injury','emergency',1.0),
  ('seizure','emergency',1.0), ('child_fever_drowsy','emergency',1.0), ('poisoning_bite','emergency',1.0),
  ('severe_burns','emergency',1.0),
  ('fever_cold','gp',1.0), ('fever_cold','internal_medicine',0.6),
  ('cough','gp',1.0), ('cough','pulmo',0.6),
  ('stomach_pain','gastro',1.0), ('stomach_pain','gp',0.6),
  ('vomiting_diarrhoea','gp',1.0), ('vomiting_diarrhoea','gastro',0.6),
  ('acidity','gp',1.0), ('acidity','gastro',0.6),
  ('skin_rash','derma',1.0), ('skin_rash','gp',0.6),
  ('itching_allergy','derma',1.0), ('itching_allergy','gp',0.6),
  ('hair_loss','derma',1.0),
  ('tooth_pain','dental',1.0),
  ('back_pain','ortho',1.0), ('back_pain','physio',0.6), ('back_pain','gp',0.6),
  ('neck_shoulder_pain','ortho',1.0), ('neck_shoulder_pain','physio',0.6), ('neck_shoulder_pain','gp',0.6),
  ('joint_knee_pain','ortho',1.0), ('joint_knee_pain','gp',0.6),
  ('arm_hand_pain','ortho',1.0), ('arm_hand_pain','gp',0.6),
  ('injury_sprain','ortho',1.0), ('injury_sprain','gp',0.6),
  ('leg_swelling','gp',1.0), ('leg_swelling','internal_medicine',0.8), ('leg_swelling','cardio',0.6),
  ('eye_problem','eye',1.0),
  ('ear_nose_throat','ent',1.0), ('ear_nose_throat','gp',0.6),
  ('headache','gp',1.0), ('headache','neuro',0.6),
  ('breathing_wheeze','pulmo',1.0), ('breathing_wheeze','gp',0.6),
  ('heart_checkup','cardio',1.0), ('heart_checkup','gp',0.6),
  ('pregnancy_care','obgyn',1.0),
  ('womens_health','obgyn',1.0), ('womens_health','gp',0.6),
  ('period_problems','obgyn',1.0), ('period_problems','gp',0.6),
  ('child_unwell','paeds',1.0), ('child_unwell','gp',0.6),
  ('child_vaccination','paeds',1.0),
  ('diabetes_bp_checkup','endo',1.0), ('diabetes_bp_checkup','internal_medicine',0.8), ('diabetes_bp_checkup','gp',0.6),
  ('thyroid','endo',1.0), ('thyroid','gp',0.6),
  ('weakness_tiredness','gp',1.0), ('weakness_tiredness','internal_medicine',0.8),
  ('general_checkup','gp',1.0), ('general_checkup','family_medicine',1.0),
  ('urine_problem','uro',1.0), ('urine_problem','gp',0.6),
  ('anxiety_low_mood','psych',1.0), ('anxiety_low_mood','gp',0.6),
  ('sleep_problems','gp',1.0), ('sleep_problems','psych',0.6)
) as m(problem, code, weight)
join public.problems p on p.code = m.problem;

-- ---------------------------------------------------------------------------
-- Clinics: admins and onboarding applications
-- ---------------------------------------------------------------------------
alter table public.places add column cancel_cutoff_minutes int not null default 120
  check (cancel_cutoff_minutes between 0 and 2880);

create table public.clinic_admins (
  user_id uuid not null references auth.users (id) on delete cascade,
  place_id uuid not null references public.places (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, place_id)
);
alter table public.clinic_admins enable row level security;
create policy "clinic_admins: read own" on public.clinic_admins for select to authenticated
  using (user_id = (select auth.uid()) or public.is_platform_admin());
revoke all on public.clinic_admins from anon, authenticated;
grant select on public.clinic_admins to authenticated;

create function public.is_clinic_admin(p_place_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.clinic_admins where user_id = (select auth.uid()) and place_id = p_place_id);
$$;
-- Used inside access rules that anonymous users also hit; it answers false for them.
revoke execute on function public.is_clinic_admin(uuid) from public;
grant execute on function public.is_clinic_admin(uuid) to anon, authenticated;

create table public.clinic_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 200),
  type text not null check (type in ('hospital', 'clinic')),
  address text not null check (char_length(address) <= 500),
  phone text not null check (phone ~ '^\+91[0-9]{10}$'),
  location extensions.geography(Point, 4326) not null,
  registration_no text not null check (char_length(registration_no) between 3 and 60),  -- KPME Act registration
  hfr_facility_id text check (hfr_facility_id is null or hfr_facility_id ~ '^[0-9A-Z]{12}$'),
  document_path text,                     -- private storage: clinic-docs/<user_id>/...
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewer_note text,
  place_id uuid references public.places (id),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
alter table public.clinic_applications enable row level security;
create policy "clinic_applications: read own" on public.clinic_applications for select to authenticated
  using (user_id = (select auth.uid()) or public.is_platform_admin());
create policy "clinic_applications: submit own" on public.clinic_applications for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'pending');
revoke all on public.clinic_applications from anon, authenticated;
grant select, insert on public.clinic_applications to authenticated;

-- Must be inside Karnataka; one pending application per person at a time.
create function public.clinic_applications_check()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not public.is_in_karnataka(extensions.st_y(new.location::extensions.geometry), extensions.st_x(new.location::extensions.geometry)) then
    raise exception 'outside_karnataka' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.clinic_applications where user_id = new.user_id and status = 'pending' and id <> new.id) then
    raise exception 'application_pending' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger clinic_applications_check before insert on public.clinic_applications
  for each row execute function public.clinic_applications_check();

-- Platform admin decides. Approving creates the place (or registers an existing one) and the clinic admin.
create function public.review_clinic_application(p_id uuid, p_approve boolean, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  app public.clinic_applications;
  new_place uuid;
begin
  if not public.is_platform_admin() then raise exception 'not_allowed' using errcode = '42501'; end if;
  select * into app from public.clinic_applications where id = p_id for update;
  if not found or app.status <> 'pending' then raise exception 'not_pending' using errcode = 'P0001'; end if;
  if p_approve then
    insert into public.places (name_en, type, location, address, phone, hfr_facility_id, is_registered, verified_at, source)
    values (app.name, app.type, app.location, app.address, app.phone, app.hfr_facility_id, true, now(), 'plusplus')
    returning id into new_place;
    insert into public.clinic_admins (user_id, place_id) values (app.user_id, new_place);
  end if;
  update public.clinic_applications
     set status = case when p_approve then 'approved' else 'rejected' end,
         reviewer_note = p_note, reviewed_at = now(), place_id = new_place
   where id = p_id;
  return new_place;
end;
$$;
revoke execute on function public.review_clinic_application(uuid, boolean, text) from public, anon;
grant execute on function public.review_clinic_application(uuid, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Doctors and slots
-- ---------------------------------------------------------------------------
create table public.doctors (
  id uuid primary key default gen_random_uuid(),
  place_id uuid not null references public.places (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 120),
  gender text check (gender in ('female', 'male', 'other')),
  specialities text[] not null check (cardinality(specialities) between 1 and 5),
  qualifications text not null check (char_length(qualifications) <= 200),
  years_experience int not null default 0 check (years_experience between 0 and 70),
  languages text[] not null default '{kn,en}',
  fee int not null check (fee between 0 and 100000),          -- rupees, paid at the clinic
  nmc_registration_no text check (char_length(nmc_registration_no) <= 40),
  rating_sum int not null default 0,
  rating_count int not null default 0,
  verified_at timestamptz,                                    -- set by a platform admin
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index doctors_place_idx on public.doctors (place_id);
create index doctors_specialities_idx on public.doctors using gin (specialities);

-- Specialities must be known codes.
create function public.doctors_check_specialities()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from unnest(new.specialities) s where s not in (select code from public.specialities)) then
    raise exception 'unknown_speciality' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger doctors_check_specialities before insert or update of specialities on public.doctors
  for each row execute function public.doctors_check_specialities();

-- Rating fields are only changed by the review trigger; verification only by admins.
create function public.doctors_protect_fields()
returns trigger language plpgsql set search_path = '' as $$
begin
  if public.is_platform_admin() or current_user in ('postgres', 'service_role') then return new; end if;
  if tg_op = 'INSERT' then
    new.rating_sum := 0; new.rating_count := 0; new.verified_at := null;
  else
    new.rating_sum := old.rating_sum; new.rating_count := old.rating_count;
    -- changing qualifications or registration number needs re-verification
    if new.nmc_registration_no is distinct from old.nmc_registration_no
       or new.qualifications is distinct from old.qualifications then
      new.verified_at := null;
    else
      new.verified_at := old.verified_at;
    end if;
  end if;
  return new;
end;
$$;
create trigger doctors_protect_fields before insert or update on public.doctors
  for each row execute function public.doctors_protect_fields();

alter table public.doctors enable row level security;
create policy "doctors: anyone can read active, verified doctors" on public.doctors for select to anon, authenticated
  using ((is_active and verified_at is not null) or public.is_clinic_admin(place_id) or public.is_platform_admin());
create policy "doctors: clinic admins add" on public.doctors for insert to authenticated
  with check (public.is_clinic_admin(place_id));
create policy "doctors: clinic admins edit" on public.doctors for update to authenticated
  using (public.is_clinic_admin(place_id) or public.is_platform_admin())
  with check (public.is_clinic_admin(place_id) or public.is_platform_admin());
revoke all on public.doctors from anon, authenticated;
grant select on public.doctors to anon, authenticated;
grant insert (place_id, name, gender, specialities, qualifications, years_experience, languages, fee, nmc_registration_no, is_active)
  on public.doctors to authenticated;
grant update (name, gender, specialities, qualifications, years_experience, languages, fee, nmc_registration_no, is_active, verified_at)
  on public.doctors to authenticated;

create table public.slots (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references public.doctors (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'open' check (status in ('open', 'booked', 'blocked')),
  check (ends_at > starts_at),
  unique (doctor_id, starts_at)
);
create index slots_open_idx on public.slots (doctor_id, starts_at) where status = 'open';

alter table public.slots enable row level security;
create policy "slots: anyone can read open future slots" on public.slots for select to anon, authenticated
  using ((status = 'open' and starts_at > now()) or exists (
    select 1 from public.doctors d where d.id = doctor_id and public.is_clinic_admin(d.place_id)));
create policy "slots: clinic admins block or reopen" on public.slots for update to authenticated
  using (exists (select 1 from public.doctors d where d.id = doctor_id and public.is_clinic_admin(d.place_id)))
  with check (status in ('open', 'blocked'));
revoke all on public.slots from anon, authenticated;
grant select on public.slots to anon, authenticated;
grant update (status) on public.slots to authenticated;

-- Clinic admins create a doctor's weekly timetable as slots.
-- p_week: {"mon":[["09:00","13:00"]], ...} in IST. Existing slots are left alone.
create function public.generate_slots(p_doctor_id uuid, p_from date, p_days int, p_week jsonb, p_slot_minutes int default 15)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  place uuid;
  day date;
  key text;
  span jsonb;
  t timestamp;
  stop timestamp;
  added int := 0;
  n int;
begin
  select place_id into place from public.doctors where id = p_doctor_id;
  if place is null or not (public.is_clinic_admin(place) or public.is_platform_admin()) then
    raise exception 'not_allowed' using errcode = '42501';
  end if;
  if p_days not between 1 and 60 or p_slot_minutes not between 5 and 120 then
    raise exception 'bad_range' using errcode = 'P0001';
  end if;
  for day in select generate_series(p_from, p_from + p_days - 1, interval '1 day')::date loop
    key := (array['sun','mon','tue','wed','thu','fri','sat'])[extract(dow from day)::int + 1];
    for span in select * from jsonb_array_elements(coalesce(p_week -> key, '[]'::jsonb)) loop
      t := day + (span ->> 0)::time;
      stop := day + (span ->> 1)::time;
      while t + make_interval(mins => p_slot_minutes) <= stop loop
        insert into public.slots (doctor_id, starts_at, ends_at)
        values (p_doctor_id, t at time zone 'Asia/Kolkata', (t + make_interval(mins => p_slot_minutes)) at time zone 'Asia/Kolkata')
        on conflict (doctor_id, starts_at) do nothing;
        get diagnostics n = row_count;
        added := added + n;
        t := t + make_interval(mins => p_slot_minutes);
      end loop;
    end loop;
  end loop;
  return added;
end;
$$;
revoke execute on function public.generate_slots(uuid, date, int, jsonb, int) from public, anon;
grant execute on function public.generate_slots(uuid, date, int, jsonb, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Appointments, reminders, reviews
-- ---------------------------------------------------------------------------
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null unique references public.slots (id),   -- one booking per slot, ever
  user_id uuid not null references auth.users (id) on delete cascade,
  doctor_id uuid not null references public.doctors (id),
  place_id uuid not null references public.places (id),
  starts_at timestamptz not null,
  status text not null default 'confirmed'
    check (status in ('pending', 'confirmed', 'completed', 'cancelled', 'no_show')),
  problem_code text references public.problems (code),
  problem_description text check (char_length(problem_description) <= 1000),   -- shown to the doctor
  doctor_type_choice text check (doctor_type_choice in ('general', 'specialist', 'not_sure')),
  duration text check (duration in ('today', 'few_days', 'weeks')),
  severity text check (severity in ('mild', 'moderate', 'severe')),
  patient_group text check (patient_group in ('adult', 'child', 'elderly', 'pregnant')),
  cancelled_by text check (cancelled_by in ('patient', 'clinic')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index appointments_user_idx on public.appointments (user_id, starts_at desc);
create index appointments_place_idx on public.appointments (place_id, starts_at);
create trigger appointments_set_updated_at before update on public.appointments
  for each row execute function public.set_updated_at();

alter table public.appointments enable row level security;
create policy "appointments: patients read own" on public.appointments for select to authenticated
  using (user_id = (select auth.uid()));
create policy "appointments: clinic admins read their clinic's" on public.appointments for select to authenticated
  using (public.is_clinic_admin(place_id));
-- All changes go through the functions below.
revoke all on public.appointments from anon, authenticated;
grant select on public.appointments to authenticated;

-- Outbox for push / SMS (reminders now; SOS alerts later). A worker sends and marks them.
create table public.notification_outbox (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete cascade,
  phone text,                                   -- for SMS to people without the app
  channel text not null check (channel in ('push', 'sms')),
  template text not null,
  payload jsonb not null default '{}',
  ref_type text,                                -- e.g. 'appointment', 'sos'
  ref_id uuid,
  send_after timestamptz not null default now(),
  sent_at timestamptz,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed', 'cancelled')),
  attempts int not null default 0,
  created_at timestamptz not null default now()
);
create index notification_outbox_due_idx on public.notification_outbox (send_after) where status = 'queued';
create index notification_outbox_ref_idx on public.notification_outbox (ref_type, ref_id);
alter table public.notification_outbox enable row level security;
revoke all on public.notification_outbox from anon, authenticated;   -- server only

create function public.queue_appointment_reminders(p_appointment uuid)
returns void language sql security definer set search_path = '' as $$
  insert into public.notification_outbox (user_id, channel, template, payload, ref_type, ref_id, send_after)
  select a.user_id, 'push', r.template,
         jsonb_build_object('appointment_id', a.id, 'starts_at', a.starts_at, 'doctor_id', a.doctor_id, 'place_id', a.place_id),
         'appointment', a.id, a.starts_at - r.before
  from public.appointments a
  cross join (values ('appointment_reminder_24h', interval '24 hours'), ('appointment_reminder_1h', interval '1 hour')) r(template, before)
  where a.id = p_appointment and a.starts_at - r.before > now();
$$;
revoke execute on function public.queue_appointment_reminders(uuid) from public, anon, authenticated;

create function public.cancel_appointment_reminders(p_appointment uuid)
returns void language sql security definer set search_path = '' as $$
  update public.notification_outbox set status = 'cancelled'
  where ref_type = 'appointment' and ref_id = p_appointment and status = 'queued';
$$;
revoke execute on function public.cancel_appointment_reminders(uuid) from public, anon, authenticated;

-- Book a slot. Atomic: the slot flips from open to booked in one UPDATE, so two people
-- can never both get it (and slot_id is UNIQUE on appointments as a second guard).
create function public.book_appointment(
  p_slot_id uuid,
  p_problem_code text default null,
  p_description text default null,
  p_doctor_type_choice text default null,
  p_duration text default null,
  p_severity text default null,
  p_patient_group text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  s record;
  appt uuid;
begin
  if uid is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  if (select count(*) from public.appointments where user_id = uid and status in ('pending', 'confirmed') and starts_at > now()) >= 5 then
    raise exception 'too_many_upcoming' using errcode = 'P0001';
  end if;

  update public.slots sl set status = 'booked'
  from public.doctors d, public.places p
  where sl.id = p_slot_id and sl.status = 'open' and sl.starts_at > now()
    and d.id = sl.doctor_id and d.is_active and d.verified_at is not null
    and p.id = d.place_id and p.is_registered
  returning sl.id, sl.doctor_id, sl.starts_at, d.place_id into s;
  if s.id is null then raise exception 'slot_taken' using errcode = 'P0001'; end if;

  insert into public.appointments (slot_id, user_id, doctor_id, place_id, starts_at, problem_code,
                                   problem_description, doctor_type_choice, duration, severity, patient_group)
  values (s.id, uid, s.doctor_id, s.place_id, s.starts_at, p_problem_code, nullif(btrim(p_description), ''),
          p_doctor_type_choice, p_duration, p_severity, p_patient_group)
  returning id into appt;
  perform public.queue_appointment_reminders(appt);
  return appt;
end;
$$;
revoke execute on function public.book_appointment(uuid, text, text, text, text, text, text) from public, anon;
grant execute on function public.book_appointment(uuid, text, text, text, text, text, text) to authenticated;

-- Cancel: the patient (up to the clinic's cut-off) or the clinic (any time before the visit).
-- The slot opens again for others.
create function public.cancel_appointment(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a record;
  by_clinic boolean;
begin
  select ap.*, pl.cancel_cutoff_minutes into a
  from public.appointments ap join public.places pl on pl.id = ap.place_id
  where ap.id = p_id for update of ap;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  by_clinic := public.is_clinic_admin(a.place_id);
  if a.user_id <> (select auth.uid()) and not by_clinic then raise exception 'not_allowed' using errcode = '42501'; end if;
  if a.status not in ('pending', 'confirmed') then raise exception 'not_cancellable' using errcode = 'P0001'; end if;
  if not by_clinic and a.starts_at - make_interval(mins => a.cancel_cutoff_minutes) < now() then
    raise exception 'past_cutoff' using errcode = 'P0001';
  end if;
  update public.appointments set status = 'cancelled', cancelled_by = case when by_clinic then 'clinic' else 'patient' end
  where id = p_id;
  -- free the slot for someone else (if it is still in the future)
  update public.slots set status = 'open' where id = a.slot_id and starts_at > now();
  perform public.cancel_appointment_reminders(p_id);
end;
$$;
revoke execute on function public.cancel_appointment(uuid) from public, anon;
grant execute on function public.cancel_appointment(uuid) to authenticated;

-- Reschedule = book the new slot and cancel the old one, all or nothing.
-- The appointment row is replaced (a slot belongs to one appointment forever).
create function public.reschedule_appointment(p_id uuid, p_new_slot_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.appointments;
  new_id uuid;
begin
  select * into a from public.appointments where id = p_id and user_id = (select auth.uid()) for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  perform public.cancel_appointment(p_id);
  new_id := public.book_appointment(p_new_slot_id, a.problem_code, a.problem_description,
                                    a.doctor_type_choice, a.duration, a.severity, a.patient_group);
  return new_id;
end;
$$;
revoke execute on function public.reschedule_appointment(uuid, uuid) from public, anon;
grant execute on function public.reschedule_appointment(uuid, uuid) to authenticated;

-- Clinic marks a visit as completed or no-show (after its start time).
create function public.mark_appointment(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.appointments;
begin
  if p_status not in ('completed', 'no_show') then raise exception 'bad_status' using errcode = 'P0001'; end if;
  select * into a from public.appointments where id = p_id for update;
  if not found or not public.is_clinic_admin(a.place_id) then raise exception 'not_allowed' using errcode = '42501'; end if;
  if a.status not in ('pending', 'confirmed') then raise exception 'not_open' using errcode = 'P0001'; end if;
  if a.starts_at > now() then raise exception 'not_started' using errcode = 'P0001'; end if;
  update public.appointments set status = p_status where id = p_id;
  perform public.cancel_appointment_reminders(p_id);
end;
$$;
revoke execute on function public.mark_appointment(uuid, text) from public, anon;
grant execute on function public.mark_appointment(uuid, text) to authenticated;

-- What a clinic sees for its bookings: the patient's name and phone (to contact them about the visit)
-- and their own description of the problem. Only for that clinic's own appointments.
create function public.clinic_appointments(p_place_id uuid, p_from timestamptz default now() - interval '1 day', p_to timestamptz default now() + interval '14 days')
returns table (
  id uuid, starts_at timestamptz, status text, doctor_id uuid, doctor_name text,
  patient_name text, patient_phone text, problem_code text, problem_description text,
  duration text, severity text, patient_group text
)
language sql
stable
security definer
set search_path = ''
as $$
  select a.id, a.starts_at, a.status, a.doctor_id, d.name, pr.full_name, pr.phone, a.problem_code,
         a.problem_description, a.duration, a.severity, a.patient_group
  from public.appointments a
  join public.doctors d on d.id = a.doctor_id
  left join public.profiles pr on pr.id = a.user_id
  where a.place_id = p_place_id and public.is_clinic_admin(p_place_id)
    and a.starts_at between p_from and p_to
  order by a.starts_at;
$$;
revoke execute on function public.clinic_appointments(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.clinic_appointments(uuid, timestamptz, timestamptz) to authenticated;

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments (id) on delete cascade,
  doctor_id uuid not null references public.doctors (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  stars int not null check (stars between 1 and 5),
  comment text check (char_length(comment) <= 500),
  created_at timestamptz not null default now()
);
alter table public.reviews enable row level security;
create policy "reviews: anyone can read" on public.reviews for select to anon, authenticated using (true);
revoke all on public.reviews from anon, authenticated;
-- Public columns only: who wrote a review is never exposed.
grant select (id, doctor_id, stars, comment, created_at) on public.reviews to anon, authenticated;

-- Only the patient of a completed plusplus appointment can review that doctor, once.
create function public.submit_review(p_appointment_id uuid, p_stars int, p_comment text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  a public.appointments;
  rid uuid;
begin
  select * into a from public.appointments where id = p_appointment_id and user_id = (select auth.uid());
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if a.status <> 'completed' then raise exception 'not_completed' using errcode = 'P0001'; end if;
  insert into public.reviews (appointment_id, doctor_id, user_id, stars, comment)
  values (a.id, a.doctor_id, a.user_id, p_stars, nullif(btrim(p_comment), ''))
  returning id into rid;
  update public.doctors set rating_sum = rating_sum + p_stars, rating_count = rating_count + 1 where id = a.doctor_id;
  return rid;
end;
$$;
revoke execute on function public.submit_review(uuid, int, text) from public, anon;
grant execute on function public.submit_review(uuid, int, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Doctor finder: candidates near a point for a list of specialities.
-- User filters (fee, gender, language, ownership) are applied here, before ranking;
-- ranking itself happens in the app (src/dispatch/rankDoctors.ts) so it is transparent and tested.
-- ---------------------------------------------------------------------------
create function public.find_doctors(
  p_lat double precision,
  p_lng double precision,
  p_specialities text[],
  p_radius_m int default 10000,
  p_max_fee int default null,
  p_gender text default null,
  p_language text default null,
  p_ownership text default null,
  p_today_only boolean default false
)
returns table (
  doctor_id uuid, name text, gender text, specialities text[], qualifications text, years_experience int,
  languages text[], fee int, rating_sum int, rating_count int,
  place_id uuid, place_name text, place_type text, ownership text,
  distance_m double precision, next_slot_at timestamptz, mean_rating double precision
)
language sql
stable
set search_path = ''
as $$
  with pt as (select extensions.st_setsrid(extensions.st_point(p_lng, p_lat), 4326)::extensions.geography g),
  mean as (
    select coalesce(sum(rating_sum)::double precision / nullif(sum(rating_count), 0), 4.0) m
    from public.doctors where rating_count > 0
  )
  select d.id, d.name, d.gender, d.specialities, d.qualifications, d.years_experience, d.languages, d.fee,
         d.rating_sum, d.rating_count, p.id, p.name_en, p.type, p.ownership,
         extensions.st_distance(p.location, pt.g), ns.starts_at, mean.m
  from public.doctors d
  join public.places p on p.id = d.place_id and p.is_registered and p.verified_at is not null
  cross join pt
  cross join mean
  cross join lateral (
    select s.starts_at from public.slots s
    where s.doctor_id = d.id and s.status = 'open' and s.starts_at > now() and s.starts_at < now() + interval '7 days'
    order by s.starts_at limit 1
  ) ns
  where d.is_active and d.verified_at is not null
    and d.specialities && p_specialities
    and extensions.st_dwithin(p.location, pt.g, least(greatest(coalesce(p_radius_m, 10000), 500), 50000))
    and (p_max_fee is null or d.fee <= p_max_fee)
    and (p_gender is null or d.gender = p_gender)
    and (p_language is null or p_language = any (d.languages))
    and (p_ownership is null or p.ownership = p_ownership)
    and (not coalesce(p_today_only, false)
         or (ns.starts_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date)
  limit 200;
$$;
revoke execute on function public.find_doctors from public;
grant execute on function public.find_doctors to anon, authenticated;

-- Realtime: let the app hear about its own appointment changes.
do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.appointments;
  end if;
end $$;

-- Which of my appointments have I already reviewed? (reviews.user_id is not readable directly)
create function public.my_reviewed_appointments()
returns table (appointment_id uuid)
language sql stable security definer set search_path = ''
as $$
  select appointment_id from public.reviews where user_id = (select auth.uid());
$$;
revoke execute on function public.my_reviewed_appointments() from public, anon;
grant execute on function public.my_reviewed_appointments() to authenticated;
