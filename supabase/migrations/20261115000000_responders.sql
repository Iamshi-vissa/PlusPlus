-- Phase 6: volunteer responders (3-wheeler and 4-wheeler drivers).
-- A responder's location is NEVER readable by the public: only by themselves and platform admins
-- (and, from phase 7, by the person they are helping during an active SOS, via a function).

create table public.responders (
  user_id uuid primary key references auth.users (id) on delete cascade,
  vehicle_type text not null check (vehicle_type in ('three_wheeler', 'four_wheeler')),
  vehicle_number text not null check (vehicle_number ~ '^[A-Z]{2}[0-9]{1,2}[A-Z]{0,3}[0-9]{1,4}$'),
  licence_number text not null check (char_length(licence_number) between 6 and 20),
  licence_doc_path text not null,     -- private bucket responder-docs/<user id>/...
  rc_doc_path text not null,
  vehicle_photo_path text not null,
  selfie_path text not null,
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'verified', 'rejected', 'suspended')),
  reviewer_note text,
  verified_at timestamptz,
  guide_completed_at timestamptz,     -- must read the first-aid guide before going live
  is_available boolean not null default false,
  last_location extensions.geography(Point, 4326),
  last_accuracy_m real,
  last_seen_at timestamptz,
  alerts_received int not null default 0,
  alerts_accepted int not null default 0,
  no_shows int not null default 0,     -- accepted but never arrived (phase 7)
  helped_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index responders_last_location_idx on public.responders using gist (last_location);
create index responders_available_idx on public.responders (last_seen_at) where is_available and verification_status = 'verified';
create trigger responders_set_updated_at before update on public.responders
  for each row execute function public.set_updated_at();

alter table public.responders enable row level security;
create policy "responders: read own" on public.responders for select to authenticated
  using (user_id = (select auth.uid()) or public.is_platform_admin());
-- All writes go through the functions below.
revoke all on public.responders from anon, authenticated;
grant select on public.responders to authenticated;

-- PURE helper: "KA 01 AB 1234" / "ka-01-ab-1234" → "KA01AB1234"
create function public.normalize_vehicle_number(v text)
returns text language sql immutable set search_path = ''
as $$ select upper(regexp_replace(coalesce(v, ''), '[^A-Za-z0-9]', '', 'g')); $$;

-- Apply, or re-apply after a rejection. Changing details of a verified responder sends them back to review.
create function public.responder_apply(
  p_vehicle_type text, p_vehicle_number text, p_licence_number text,
  p_licence_doc_path text, p_rc_doc_path text, p_vehicle_photo_path text, p_selfie_path text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  folder text := (select auth.uid())::text || '/';
begin
  if uid is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  if exists (select 1 from public.responders where user_id = uid and verification_status = 'suspended') then
    raise exception 'suspended' using errcode = 'P0001';
  end if;
  -- documents must be the person's own uploads
  if not (p_licence_doc_path like folder || '%' and p_rc_doc_path like folder || '%'
          and p_vehicle_photo_path like folder || '%' and p_selfie_path like folder || '%') then
    raise exception 'bad_document' using errcode = 'P0001';
  end if;
  insert into public.responders (user_id, vehicle_type, vehicle_number, licence_number, licence_doc_path,
                                 rc_doc_path, vehicle_photo_path, selfie_path)
  values (uid, p_vehicle_type, public.normalize_vehicle_number(p_vehicle_number), upper(btrim(p_licence_number)),
          p_licence_doc_path, p_rc_doc_path, p_vehicle_photo_path, p_selfie_path)
  on conflict (user_id) do update set
    vehicle_type = excluded.vehicle_type, vehicle_number = excluded.vehicle_number,
    licence_number = excluded.licence_number, licence_doc_path = excluded.licence_doc_path,
    rc_doc_path = excluded.rc_doc_path, vehicle_photo_path = excluded.vehicle_photo_path,
    selfie_path = excluded.selfie_path, verification_status = 'pending', verified_at = null,
    reviewer_note = null, is_available = false;
end;
$$;

create function public.responder_complete_guide()
returns void language sql security definer set search_path = ''
as $$ update public.responders set guide_completed_at = now() where user_id = (select auth.uid()); $$;

-- Go available / unavailable. Only verified responders who have read the guide can go live.
create function public.responder_set_available(p_available boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.responders;
begin
  select * into r from public.responders where user_id = (select auth.uid()) for update;
  if not found then raise exception 'not_a_responder' using errcode = 'P0001'; end if;
  if p_available then
    if r.verification_status <> 'verified' then raise exception 'not_verified' using errcode = 'P0001'; end if;
    if r.guide_completed_at is null then raise exception 'guide_not_read' using errcode = 'P0001'; end if;
  end if;
  update public.responders set is_available = p_available,
    -- clear the stored location when going offline: we only keep it while it is useful
    last_location = case when p_available then last_location else null end,
    last_accuracy_m = case when p_available then last_accuracy_m else null end
  where user_id = r.user_id;
end;
$$;

-- Location update from the phone (already filtered and smoothed on the device).
-- Fixes worse than 100 m are refused; nothing is stored while unavailable.
create function public.responder_heartbeat(p_lat double precision, p_lng double precision, p_accuracy_m real)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_accuracy_m is null or p_accuracy_m > 100 or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    return false;
  end if;
  update public.responders
     set last_location = extensions.st_setsrid(extensions.st_point(p_lng, p_lat), 4326)::extensions.geography,
         last_accuracy_m = p_accuracy_m,
         last_seen_at = now()
   where user_id = (select auth.uid()) and is_available and verification_status = 'verified';
  return found;
end;
$$;

-- Platform admin: verify / reject / suspend.
create function public.review_responder(p_user_id uuid, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then raise exception 'not_allowed' using errcode = '42501'; end if;
  if p_status not in ('verified', 'rejected', 'suspended', 'pending') then raise exception 'bad_status' using errcode = 'P0001'; end if;
  update public.responders
     set verification_status = p_status, reviewer_note = p_note,
         verified_at = case when p_status = 'verified' then now() else null end,
         is_available = case when p_status = 'verified' then is_available else false end
   where user_id = p_user_id;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
end;
$$;

do $$
declare f text;
begin
  foreach f in array array[
    'responder_apply(text, text, text, text, text, text, text)', 'responder_complete_guide()',
    'responder_set_available(boolean)', 'responder_heartbeat(double precision, double precision, real)',
    'review_responder(uuid, text, text)']
  loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
