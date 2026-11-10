-- Phase 8: admin panel support. Every function checks is_platform_admin() first.
-- The first admin is added by hand (see PROJECT.md "Operations"):
--   insert into public.platform_admins (user_id) select id from auth.users where phone = '91XXXXXXXXXX';

-- Problem reports from anyone (fake SOS, rude responder, wrong clinic details, ...).
create table public.reports (
  id bigint generated always as identity primary key,
  reporter uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subject_type text not null check (subject_type in ('sos', 'responder', 'clinic', 'doctor', 'place', 'user', 'other')),
  subject_id text,
  reason text not null check (reason in ('fake_sos', 'no_show', 'unsafe', 'rude', 'wrong_info', 'fraud', 'other')),
  details text check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  admin_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
alter table public.reports enable row level security;
create policy "reports: file own" on public.reports for insert to authenticated with check (reporter = (select auth.uid()) and status = 'open');
create policy "reports: read own" on public.reports for select to authenticated using (reporter = (select auth.uid()) or public.is_platform_admin());
revoke all on public.reports from anon, authenticated;
grant select, insert (subject_type, subject_id, reason, details) on public.reports to authenticated;

-- Max 10 reports a day per person (stops report spam).
create function public.reports_rate_limit() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.reports where reporter = new.reporter and created_at > now() - interval '1 day') >= 10 then
    raise exception 'too_many_reports' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger reports_rate_limit before insert on public.reports for each row execute function public.reports_rate_limit();

create function public.assert_admin() returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_platform_admin() then raise exception 'not_allowed' using errcode = '42501'; end if;
end;
$$;

create function public.admin_dashboard() returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  return jsonb_build_object(
    'clinics_pending', (select count(*) from public.clinic_applications where status = 'pending'),
    'responders_pending', (select count(*) from public.responders where verification_status = 'pending'),
    'doctors_unverified', (select count(*) from public.doctors where verified_at is null and is_active),
    'reports_open', (select count(*) from public.reports where status = 'open')
                  + (select count(*) from public.sos_ratings where report_problem),
    'sos_active', (select count(*) from public.sos_requests where status in ('searching', 'assigned', 'en_route_to_scene', 'picked_up')),
    'sos_today', (select count(*) from public.sos_requests where created_at > now() - interval '1 day'),
    'sos_no_responder_today', (select count(*) from public.sos_requests where status = 'no_responder' and created_at > now() - interval '1 day'),
    'responders_available', (select count(*) from public.responders where is_available and verification_status = 'verified'
                              and last_seen_at > now() - interval '2 minutes'));
end;
$$;

create function public.admin_responders(p_status text default 'pending')
returns table (user_id uuid, full_name text, phone text, vehicle_type text, vehicle_number text, licence_number text,
               licence_doc_path text, rc_doc_path text, vehicle_photo_path text, selfie_path text,
               verification_status text, reviewer_note text, created_at timestamptz,
               alerts_received int, alerts_accepted int, no_shows int, helped_count int)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  return query
    select r.user_id, p.full_name, p.phone, r.vehicle_type, r.vehicle_number, r.licence_number,
           r.licence_doc_path, r.rc_doc_path, r.vehicle_photo_path, r.selfie_path,
           r.verification_status, r.reviewer_note, r.created_at,
           r.alerts_received, r.alerts_accepted, r.no_shows, r.helped_count
    from public.responders r left join public.profiles p on p.id = r.user_id
    where p_status is null or r.verification_status = p_status
    order by r.created_at;
end;
$$;

create function public.admin_clinic_applications(p_status text default 'pending')
returns table (id uuid, name text, type text, address text, phone text, registration_no text, hfr_facility_id text,
               document_path text, status text, reviewer_note text, created_at timestamptz,
               applicant_name text, applicant_phone text, lat double precision, lng double precision, district text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  return query
    select a.id, a.name, a.type, a.address, a.phone, a.registration_no, a.hfr_facility_id, a.document_path, a.status,
           a.reviewer_note, a.created_at, p.full_name, p.phone,
           extensions.st_y(a.location::extensions.geometry), extensions.st_x(a.location::extensions.geometry),
           (select l.district_name_en from public.locate_in_karnataka(extensions.st_y(a.location::extensions.geometry),
                                                                      extensions.st_x(a.location::extensions.geometry)) l)
    from public.clinic_applications a left join public.profiles p on p.id = a.user_id
    where p_status is null or a.status = p_status
    order by a.created_at;
end;
$$;

create function public.admin_unverified_doctors()
returns table (id uuid, name text, specialities text[], qualifications text, years_experience int, fee int,
               nmc_registration_no text, place_name text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  return query
    select d.id, d.name, d.specialities, d.qualifications, d.years_experience, d.fee, d.nmc_registration_no, p.name_en, d.created_at
    from public.doctors d join public.places p on p.id = d.place_id
    where d.verified_at is null and d.is_active
    order by d.created_at;
end;
$$;

create function public.admin_verify_doctor(p_id uuid, p_verified boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  update public.doctors set verified_at = case when p_verified then now() else null end,
                            is_active = case when p_verified then true else false end
  where id = p_id;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
end;
$$;

create function public.admin_reports()
returns table (kind text, id text, created_at timestamptz, subject_type text, subject_id text, reason text, details text,
               status text, reporter_name text, reporter_phone text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  return query
    select 'report', r.id::text, r.created_at, r.subject_type, r.subject_id, r.reason, r.details, r.status, p.full_name, p.phone
    from public.reports r left join public.profiles p on p.id = r.reporter
    union all
    select 'sos_rating', sr.id::text, sr.created_at, 'sos', sr.sos_id::text,
           case when sr.role = 'raiser' then 'problem_with_responder' else 'problem_with_sos' end,
           sr.comment, 'open', p.full_name, p.phone
    from public.sos_ratings sr left join public.profiles p on p.id = sr.by_user
    where sr.report_problem
    order by 3 desc
    limit 200;
end;
$$;

create function public.admin_resolve_report(p_id bigint, p_status text, p_note text default null) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  if p_status not in ('resolved', 'dismissed') then raise exception 'bad_status' using errcode = 'P0001'; end if;
  update public.reports set status = p_status, admin_note = p_note, resolved_at = now() where id = p_id;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
end;
$$;

-- Fake alerts: first a warning, then suspension (PROJECT.md "Safety and abuse prevention").
create function public.admin_flag_fake_sos(p_user uuid, p_note text default null) returns text
language plpgsql security definer set search_path = '' as $$
declare
  w int;
begin
  perform public.assert_admin();
  update public.profiles set sos_warnings = sos_warnings + 1,
         sos_suspended_until = case when sos_warnings + 1 >= 2 then now() + interval '90 days' else sos_suspended_until end
   where id = p_user
  returning sos_warnings into w;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  insert into public.reports (reporter, subject_type, subject_id, reason, details, status, admin_note, resolved_at)
  values ((select auth.uid()), 'user', p_user::text, 'fake_sos', null, 'resolved', p_note, now());
  return case when w >= 2 then 'suspended' else 'warned' end;
end;
$$;

create function public.admin_lift_sos_suspension(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  update public.profiles set sos_suspended_until = null where id = p_user;
end;
$$;

create function public.admin_active_sos()
returns table (id uuid, status text, created_at timestamptz, wave int, radius_m int, alerted bigint,
               raiser_name text, responder_name text, responder_vehicle text, district text)
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.assert_admin();
  return query
    select s.id, s.status, s.created_at, s.wave, s.search_radius_m,
           (select count(*) from public.sos_alerts a where a.sos_id = s.id),
           pr.full_name, rp.full_name, r.vehicle_number,
           (select l.district_name_en from public.locate_in_karnataka(extensions.st_y(s.location::extensions.geometry),
                                                                      extensions.st_x(s.location::extensions.geometry)) l)
    from public.sos_requests s
    left join public.profiles pr on pr.id = s.raised_by
    left join public.responders r on r.user_id = s.assigned_responder
    left join public.profiles rp on rp.id = s.assigned_responder
    where s.status in ('searching', 'assigned', 'en_route_to_scene', 'picked_up', 'reached_hospital', 'no_responder')
      and s.created_at > now() - interval '1 day'
    order by s.created_at desc;
end;
$$;

do $$
declare f text;
begin
  revoke execute on function public.assert_admin() from public, anon, authenticated;
  foreach f in array array['admin_dashboard()', 'admin_responders(text)', 'admin_clinic_applications(text)',
    'admin_unverified_doctors()', 'admin_verify_doctor(uuid, boolean)', 'admin_reports()',
    'admin_resolve_report(bigint, text, text)', 'admin_flag_fake_sos(uuid, text)',
    'admin_lift_sos_suspension(uuid)', 'admin_active_sos()'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
