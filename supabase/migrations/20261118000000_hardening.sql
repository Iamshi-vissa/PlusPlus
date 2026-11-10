-- Phase 9: privacy (DPDP Act) — data download, account deletion, retention; and an admin audit log.

-- Deleting an account must never be blocked by someone else's SOS that this person helped with.
alter table public.sos_requests drop constraint sos_requests_assigned_responder_fkey,
  add constraint sos_requests_assigned_responder_fkey foreign key (assigned_responder) references auth.users (id) on delete set null;

-- ---------------------------------------------------------------------------
-- Audit log of admin decisions (who verified / rejected / suspended whom, and when)
-- ---------------------------------------------------------------------------
create table public.admin_audit (
  id bigint generated always as identity primary key,
  actor uuid,                    -- the signed-in user who made the change (null = system)
  action text not null,
  target_type text not null,
  target_id text not null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.admin_audit enable row level security;
create policy "admin_audit: admins read" on public.admin_audit for select to authenticated using (public.is_platform_admin());
revoke all on public.admin_audit from anon, authenticated;
grant select on public.admin_audit to authenticated;

-- One small trigger per table (PL/pgSQL can't refer to a column another table doesn't have).
create function public.audit_responders() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.verification_status is distinct from old.verification_status then
    insert into public.admin_audit (actor, action, target_type, target_id, detail)
    values ((select auth.uid()), 'responder_' || new.verification_status, 'responder', new.user_id::text,
            jsonb_build_object('from', old.verification_status, 'note', new.reviewer_note));
  end if;
  return new;
end;
$$;
create function public.audit_clinic_applications() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status is distinct from old.status then
    insert into public.admin_audit (actor, action, target_type, target_id, detail)
    values ((select auth.uid()), 'clinic_' || new.status, 'clinic_application', new.id::text, jsonb_build_object('note', new.reviewer_note));
  end if;
  return new;
end;
$$;
create function public.audit_doctors() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.verified_at is distinct from old.verified_at then
    insert into public.admin_audit (actor, action, target_type, target_id)
    values ((select auth.uid()), case when new.verified_at is null then 'doctor_unverified' else 'doctor_verified' end, 'doctor', new.id::text);
  end if;
  return new;
end;
$$;
create function public.audit_profiles() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.sos_suspended_until is distinct from old.sos_suspended_until or new.sos_warnings <> old.sos_warnings then
    insert into public.admin_audit (actor, action, target_type, target_id, detail)
    values ((select auth.uid()), 'sos_abuse', 'user', new.id::text,
            jsonb_build_object('warnings', new.sos_warnings, 'suspended_until', new.sos_suspended_until));
  end if;
  return new;
end;
$$;
create trigger responders_audit after update on public.responders for each row execute function public.audit_responders();
create trigger clinic_applications_audit after update on public.clinic_applications for each row execute function public.audit_clinic_applications();
create trigger doctors_audit after update on public.doctors for each row execute function public.audit_doctors();
create trigger profiles_audit after update on public.profiles for each row execute function public.audit_profiles();
revoke execute on function public.audit_responders(), public.audit_clinic_applications(), public.audit_doctors(), public.audit_profiles()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- "Download my data"
-- ---------------------------------------------------------------------------
create function public.export_my_data() returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) - 'sos_warnings' from public.profiles p where p.id = (select auth.uid())),
    'emergency_contacts', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'phone', phone, 'relation', relation))
                                    from public.emergency_contacts where user_id = (select auth.uid())), '[]'),
    'appointments', coalesce((select jsonb_agg(jsonb_build_object('starts_at', a.starts_at, 'status', a.status, 'doctor', d.name,
                                'place', pl.name_en, 'problem_description', a.problem_description) order by a.starts_at)
                              from public.appointments a join public.doctors d on d.id = a.doctor_id join public.places pl on pl.id = a.place_id
                              where a.user_id = (select auth.uid())), '[]'),
    'reviews', coalesce((select jsonb_agg(jsonb_build_object('stars', stars, 'comment', comment, 'created_at', created_at))
                         from public.reviews where user_id = (select auth.uid())), '[]'),
    'sos_raised', coalesce((select jsonb_agg(jsonb_build_object('created_at', created_at, 'status', status,
                              'lat', extensions.st_y(location::extensions.geometry), 'lng', extensions.st_x(location::extensions.geometry),
                              'note', note))
                            from public.sos_requests where raised_by = (select auth.uid())), '[]'),
    'responder', (select jsonb_build_object('vehicle_type', vehicle_type, 'vehicle_number', vehicle_number,
                    'verification_status', verification_status, 'alerts_received', alerts_received,
                    'alerts_accepted', alerts_accepted, 'helped_count', helped_count)
                  from public.responders where user_id = (select auth.uid())),
    'reports', coalesce((select jsonb_agg(jsonb_build_object('subject_type', subject_type, 'reason', reason, 'details', details,
                           'status', status, 'created_at', created_at))
                         from public.reports where reporter = (select auth.uid())), '[]'));
$$;

-- ---------------------------------------------------------------------------
-- "Delete my account" — removes the person and everything that belongs to them.
-- Refused during an active SOS (as raiser or as the assigned responder) for safety.
-- Uploaded documents are queued for removal from storage by a worker.
-- ---------------------------------------------------------------------------
create table public.storage_deletions (
  id bigint generated always as identity primary key,
  bucket text not null,
  path text not null,
  queued_at timestamptz not null default now()
);
alter table public.storage_deletions enable row level security;
revoke all on public.storage_deletions from anon, authenticated;

create function public.delete_my_account() returns void language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  if exists (select 1 from public.sos_requests where (raised_by = uid or assigned_responder = uid)
             and status in ('searching', 'assigned', 'en_route_to_scene', 'picked_up')) then
    raise exception 'active_sos' using errcode = 'P0001';
  end if;
  insert into public.storage_deletions (bucket, path)
  select 'responder-docs', p from public.responders r,
    unnest(array[r.licence_doc_path, r.rc_doc_path, r.vehicle_photo_path, r.selfie_path]) p
  where r.user_id = uid
  union all
  select 'clinic-docs', document_path from public.clinic_applications where user_id = uid and document_path is not null;
  -- appointments keep the clinic's record of the visit only as an anonymous row is not needed: remove them
  delete from public.reviews where user_id = uid;
  delete from public.appointments where user_id = uid;
  delete from auth.users where id = uid;   -- cascades to profile, contacts, SOS, responder, tokens, reports
end;
$$;

-- ---------------------------------------------------------------------------
-- Retention (runs daily): location trails 90 days, then anonymised statistics only.
-- ---------------------------------------------------------------------------
create function public.purge_old_data() returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  trails int; anonymised int; links int; outbox int;
begin
  delete from public.sos_events where location is not null and created_at < now() - interval '90 days';
  get diagnostics trails = row_count;
  -- keep the SOS for statistics, but blur the point to ~1 km and drop the free-text note
  update public.sos_requests
     set location = extensions.st_setsrid(extensions.st_point(
           round(extensions.st_x(location::extensions.geometry)::numeric, 2)::double precision,
           round(extensions.st_y(location::extensions.geometry)::numeric, 2)::double precision), 4326)::extensions.geography,
         note = null, accuracy_m = null, cancel_reason = null
   where created_at < now() - interval '90 days' and (note is not null or accuracy_m is not null
         or extensions.st_x(location::extensions.geometry) <> round(extensions.st_x(location::extensions.geometry)::numeric, 2));
  get diagnostics anonymised = row_count;
  delete from public.sos_share_links where expires_at < now() - interval '1 day';
  get diagnostics links = row_count;
  delete from public.notification_outbox where created_at < now() - interval '30 days';
  get diagnostics outbox = row_count;
  return jsonb_build_object('location_points_deleted', trails, 'sos_anonymised', anonymised, 'links_deleted', links, 'outbox_deleted', outbox);
end;
$$;

do $$
begin
  revoke execute on function public.purge_old_data() from public, anon, authenticated;
  revoke execute on function public.export_my_data() from public, anon;
  grant execute on function public.export_my_data() to authenticated;
  revoke execute on function public.delete_my_account() from public, anon;
  grant execute on function public.delete_my_account() to authenticated;
end $$;

do $$
begin
  perform cron.schedule('plusplus-purge-old-data', '17 3 * * *', 'select public.purge_old_data()');  -- 03:17 UTC daily
exception when others then
  raise notice 'pg_cron not available (%); schedule purge_old_data() elsewhere', sqlerrm;
end $$;
