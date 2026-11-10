-- Phase 7: Emergency SOS — wave-based dispatch to volunteer responders.
-- Everything life-critical happens in the database so it is atomic and testable:
-- creation checks, candidate ranking, waves, radius widening, first-accept-wins, timeouts.
-- The 108 / 112 buttons are shown by the app on every SOS screen no matter what happens here.

-- ---------------------------------------------------------------------------
-- Configuration (one row). Every number in the dispatch algorithm lives here.
-- ---------------------------------------------------------------------------
create table public.dispatch_config (
  id smallint primary key default 1 check (id = 1),
  radius_steps_m int[] not null default '{2000,5000,8000}',
  min_responders int not null default 3,          -- widen the radius if fewer than this are found
  wave_size int not null default 3,
  wave_timeout_s int not null default 25,
  candidate_limit int not null default 20,
  stale_after_s int not null default 120,         -- ignore responders not seen for 2 minutes
  stale_penalty_from_s int not null default 60,
  stale_penalty_s int not null default 60,
  low_accept_rate numeric not null default 0.3,
  low_accept_min_alerts int not null default 5,
  low_accept_penalty_s int not null default 120,
  four_wheeler_bonus_s int not null default 30,   -- when the patient may need to lie down
  speed_mps numeric not null default 5.5,         -- ~20 km/h city driving, for the straight-line ETA
  road_factor numeric not null default 1.4,       -- roads are longer than straight lines
  sms_fallback_s int not null default 15,
  max_per_hour int not null default 3,
  trauma_preference_s int not null default 300    -- prefer a trauma centre if within 5 min of the best
);
insert into public.dispatch_config default values;
alter table public.dispatch_config enable row level security;
revoke all on public.dispatch_config from anon, authenticated;

-- People who abused SOS (fake alerts) can be paused.
alter table public.profiles add column sos_suspended_until timestamptz;
alter table public.profiles add column sos_warnings int not null default 0;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.sos_requests (
  id uuid primary key default gen_random_uuid(),
  raised_by uuid not null references auth.users (id) on delete cascade,
  location extensions.geography(Point, 4326) not null,
  accuracy_m real,
  injured_count int check (injured_count between 1 and 50),
  is_conscious boolean,                          -- null = not sure
  patient_can_sit boolean,                       -- false → prefer a 4-wheeler
  note text check (char_length(note) <= 500),
  status text not null default 'searching' check (status in
    ('searching', 'assigned', 'en_route_to_scene', 'picked_up', 'reached_hospital', 'closed', 'cancelled', 'no_responder')),
  assigned_responder uuid references auth.users (id),
  assigned_at timestamptz,
  destination_place_id uuid references public.places (id),
  search_radius_m int not null default 2000,
  wave int not null default 0,
  wave_deadline timestamptz,
  cancel_reason text check (char_length(cancel_reason) <= 200),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index sos_requests_raised_by_idx on public.sos_requests (raised_by, created_at desc);
create index sos_requests_searching_idx on public.sos_requests (wave_deadline) where status = 'searching';
create index sos_requests_assigned_idx on public.sos_requests (assigned_responder) where assigned_responder is not null;

create table public.sos_alerts (
  id bigint generated always as identity primary key,
  sos_id uuid not null references public.sos_requests (id) on delete cascade,
  responder_id uuid not null references auth.users (id) on delete cascade,
  wave int not null,
  distance_m int not null,
  eta_s int not null,
  score int not null,
  sent_at timestamptz not null default now(),
  seen_at timestamptz,
  -- 'reopened': was not needed earlier (expired / too late) but the assigned responder gave up, so may be asked again
  -- 'released': accepted, then gave up — never re-alerted for this SOS
  response text check (response in ('accepted', 'declined', 'expired', 'too_late', 'cancelled', 'reopened', 'released')),
  responded_at timestamptz,
  unique (sos_id, responder_id)
);
create index sos_alerts_responder_idx on public.sos_alerts (responder_id, sent_at desc);

-- Audit trail and the responder's location trail during the SOS (deleted after 90 days, phase 9).
create table public.sos_events (
  id bigint generated always as identity primary key,
  sos_id uuid not null references public.sos_requests (id) on delete cascade,
  kind text not null,                -- a status, or 'wave', 'widened', 'location', 'accepted', ...
  detail jsonb not null default '{}',
  location extensions.geography(Point, 4326),
  created_at timestamptz not null default now()
);
create index sos_events_sos_idx on public.sos_events (sos_id, created_at);

-- Live-location link for emergency contacts (no login; unguessable token; stops working when closed).
create table public.sos_share_links (
  token text primary key default encode(extensions.gen_random_bytes(18), 'hex'),
  sos_id uuid not null references public.sos_requests (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '6 hours'
);

create table public.sos_ratings (
  id bigint generated always as identity primary key,
  sos_id uuid not null references public.sos_requests (id) on delete cascade,
  by_user uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('raiser', 'responder')),
  stars int check (stars between 1 and 5),
  comment text check (char_length(comment) <= 500),
  report_problem boolean not null default false,
  created_at timestamptz not null default now(),
  unique (sos_id, by_user)
);

-- Push tokens for SOS alerts and reminders (Expo push).
create table public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text check (platform in ('android', 'ios', 'web')),
  updated_at timestamptz not null default now()
);

-- RLS: nothing is readable directly except through the functions below,
-- apart from a person's own SOS rows and a responder's own alerts.
alter table public.sos_requests enable row level security;
alter table public.sos_alerts enable row level security;
alter table public.sos_events enable row level security;
alter table public.sos_share_links enable row level security;
alter table public.sos_ratings enable row level security;
alter table public.push_tokens enable row level security;
create policy "sos_requests: raiser reads own" on public.sos_requests for select to authenticated
  using (raised_by = (select auth.uid()) or public.is_platform_admin());
create policy "sos_alerts: responder reads own alerts" on public.sos_alerts for select to authenticated
  using (responder_id = (select auth.uid()) or public.is_platform_admin());
create policy "push_tokens: manage own" on public.push_tokens for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.sos_requests, public.sos_alerts, public.sos_events, public.sos_share_links,
  public.sos_ratings, public.push_tokens from anon, authenticated;
-- the raiser may read their own SOS rows, but not the precise columns of anyone else's
grant select (id, status, created_at, closed_at, wave, search_radius_m) on public.sos_requests to authenticated;
grant select (id, sos_id, wave, sent_at, response) on public.sos_alerts to authenticated;
grant select, insert, update, delete on public.push_tokens to authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create function public.sos_log(p_sos uuid, p_kind text, p_detail jsonb default '{}', p_loc extensions.geography default null)
returns void language sql security definer set search_path = ''
as $$ insert into public.sos_events (sos_id, kind, detail, location) values (p_sos, p_kind, p_detail, p_loc); $$;

create function public.sos_notify(p_user uuid, p_template text, p_sos uuid, p_payload jsonb default '{}', p_delay_s int default 0, p_channel text default 'push', p_phone text default null)
returns void language sql security definer set search_path = ''
as $$
  insert into public.notification_outbox (user_id, phone, channel, template, payload, ref_type, ref_id, send_after)
  values (p_user, p_phone, p_channel, p_template, p_payload || jsonb_build_object('sos_id', p_sos), 'sos', p_sos,
          now() + make_interval(secs => p_delay_s));
$$;

-- Ranked candidates for one SOS within a radius (stage 1: KNN; stage 2: ETA + penalties).
-- ETA is a straight-line estimate (distance × road factor ÷ speed) until a routing API key is set;
-- an Edge Function can later re-rank the same candidates with real road ETAs.
create function public.sos_candidates(p_sos uuid, p_radius_m int)
returns table (responder_id uuid, vehicle_type text, distance_m int, eta_s int, score int)
language sql
stable
security definer
set search_path = ''
as $$
  with s as (select * from public.sos_requests where id = p_sos),
  cfg as (select * from public.dispatch_config where id = 1),
  near as (
    select r.user_id, r.vehicle_type, r.last_seen_at, r.alerts_received, r.alerts_accepted,
           extensions.st_distance(r.last_location, s.location) as d
    from public.responders r cross join s cross join cfg
    where r.verification_status = 'verified'
      and r.is_available
      and r.last_location is not null
      and r.last_seen_at > now() - make_interval(secs => cfg.stale_after_s)
      and r.user_id <> s.raised_by
      and extensions.st_dwithin(r.last_location, s.location, p_radius_m)
      and not exists (select 1 from public.sos_alerts a where a.sos_id = s.id and a.responder_id = r.user_id
                      and a.response is distinct from 'reopened')
      -- not already helping someone else
      and not exists (select 1 from public.sos_requests o where o.assigned_responder = r.user_id
                      and o.status in ('assigned', 'en_route_to_scene', 'picked_up'))
    order by r.last_location operator(extensions.<->) s.location
    limit (select candidate_limit from cfg)
  ),
  scored as (
    select n.user_id, n.vehicle_type, n.d,
           round(n.d * cfg.road_factor / cfg.speed_mps)::int as eta,
           (round(n.d * cfg.road_factor / cfg.speed_mps)
            + case when n.last_seen_at < now() - make_interval(secs => cfg.stale_penalty_from_s) then cfg.stale_penalty_s else 0 end
            + case when n.alerts_received >= cfg.low_accept_min_alerts
                    and n.alerts_accepted::numeric / n.alerts_received < cfg.low_accept_rate then cfg.low_accept_penalty_s else 0 end
            - case when n.vehicle_type = 'four_wheeler'
                    and (s.is_conscious is false or s.patient_can_sit is false) then cfg.four_wheeler_bonus_s else 0 end
           )::int as score
    from near n cross join cfg cross join s
  )
  select user_id, vehicle_type, round(d)::int, eta, score
  from scored
  order by score, d, user_id;
$$;

-- Send the next wave. Widens the radius (2 → 5 → 8 km) when too few responders are found.
-- If nobody is left within the largest radius and nobody is still deciding, the SOS becomes 'no_responder'.
create function public.sos_dispatch_wave(p_sos uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.sos_requests;
  cfg public.dispatch_config;
  radius int;
  steps int[];
  available int;
  sent int := 0;
  c record;
begin
  select * into s from public.sos_requests where id = p_sos for update;
  if not found or s.status <> 'searching' then return 0; end if;
  select * into cfg from public.dispatch_config where id = 1;
  steps := cfg.radius_steps_m;
  radius := s.search_radius_m;

  loop
    select count(*) into available from public.sos_candidates(p_sos, radius);
    exit when available >= cfg.min_responders;
    exit when radius >= steps[array_length(steps, 1)];
    radius := (select min(x) from unnest(steps) x where x > radius);
    perform public.sos_log(p_sos, 'widened', jsonb_build_object('radius_m', radius));
  end loop;

  for c in select * from public.sos_candidates(p_sos, radius) limit cfg.wave_size loop
    insert into public.sos_alerts (sos_id, responder_id, wave, distance_m, eta_s, score)
    values (p_sos, c.responder_id, s.wave + 1, c.distance_m, c.eta_s, c.score)
    on conflict (sos_id, responder_id) do update set   -- re-asking someone after a 'reopened'
      wave = excluded.wave, distance_m = excluded.distance_m, eta_s = excluded.eta_s, score = excluded.score,
      sent_at = now(), seen_at = null, response = null, responded_at = null;
    update public.responders set alerts_received = alerts_received + 1 where user_id = c.responder_id;
    perform public.sos_notify(c.responder_id, 'sos_alert', p_sos, jsonb_build_object('distance_m', c.distance_m, 'eta_s', c.eta_s));
    -- SMS fallback; cancelled when the responder's app shows the alert
    perform public.sos_notify(c.responder_id, 'sos_alert_sms', p_sos, jsonb_build_object('distance_m', c.distance_m), cfg.sms_fallback_s, 'sms');
    sent := sent + 1;
  end loop;

  if sent > 0 then
    update public.sos_requests set wave = wave + 1, search_radius_m = radius,
           wave_deadline = now() + make_interval(secs => cfg.wave_timeout_s)
     where id = p_sos;
    perform public.sos_log(p_sos, 'wave', jsonb_build_object('wave', s.wave + 1, 'alerted', sent, 'radius_m', radius));
  elsif not exists (select 1 from public.sos_alerts where sos_id = p_sos and response is null) then
    update public.sos_requests set status = 'no_responder', search_radius_m = radius, wave_deadline = null where id = p_sos;
    perform public.sos_log(p_sos, 'no_responder', jsonb_build_object('radius_m', radius));
    perform public.sos_notify(s.raised_by, 'sos_no_responder', p_sos);
  else
    -- nobody new to alert, but someone may still accept: wait one more timeout
    update public.sos_requests set search_radius_m = radius,
           wave_deadline = now() + make_interval(secs => cfg.wave_timeout_s)
     where id = p_sos;
  end if;
  return sent;
end;
$$;

-- Runs every few seconds (pg_cron): expire unanswered alerts and send the next wave.
create function public.sos_tick()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  due uuid;
  n int := 0;
begin
  for due in
    select id from public.sos_requests
    where status = 'searching' and wave_deadline is not null and wave_deadline <= now()
    order by created_at
    for update skip locked
  loop
    update public.sos_alerts set response = 'expired', responded_at = now() where sos_id = due and response is null;
    perform public.sos_dispatch_wave(due);
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- Best emergency hospitals near a point: emergency care AND (24x7 or open now); 10 nearest,
-- re-ranked by ETA; a trauma centre wins if within 5 minutes of the best.
create function public.sos_hospitals(p_lat double precision, p_lng double precision)
returns table (place_id uuid, name_en text, name_kn text, phone text, lat double precision, lng double precision,
               distance_m int, eta_s int, trauma_care boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with pt as (select extensions.st_setsrid(extensions.st_point(p_lng, p_lat), 4326)::extensions.geography g),
  cfg as (select * from public.dispatch_config where id = 1),
  near as (
    select p.*, extensions.st_distance(p.location, pt.g) d
    from public.places p cross join pt
    where p.has_emergency and (p.is_24x7 or public.is_open_at(p.opening_hours, p.is_24x7) is true)
    order by p.location operator(extensions.<->) pt.g
    limit 10
  ),
  ranked as (
    select n.*, round(n.d * cfg.road_factor / cfg.speed_mps)::int eta,
           min(round(n.d * cfg.road_factor / cfg.speed_mps)) over () best
    from near n cross join cfg
  )
  select r.id, r.name_en, r.name_kn, r.phone, extensions.st_y(r.location::extensions.geometry),
         extensions.st_x(r.location::extensions.geometry), round(r.d)::int, r.eta, r.trauma_care
  from ranked r cross join cfg
  order by (case when r.trauma_care and r.eta - r.best <= cfg.trauma_preference_s then 0 else 1 end), r.eta
  limit 3;
$$;

-- ---------------------------------------------------------------------------
-- Raiser: create, update details, cancel, close
-- ---------------------------------------------------------------------------
create function public.sos_create(
  p_lat double precision, p_lng double precision, p_accuracy_m real default null,
  p_injured_count int default null, p_is_conscious boolean default null,
  p_patient_can_sit boolean default null, p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  cfg public.dispatch_config;
  existing uuid;
  new_id uuid;
  link text;
  raiser_name text;
  c record;
begin
  if uid is null then raise exception 'not_signed_in' using errcode = '42501'; end if;
  if not exists (select 1 from auth.users where id = uid and phone_confirmed_at is not null) then
    raise exception 'phone_not_verified' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.profiles where id = uid and sos_suspended_until > now()) then
    raise exception 'sos_suspended' using errcode = 'P0001';
  end if;
  -- one active SOS at a time: tapping again returns the same one
  select id into existing from public.sos_requests
  where raised_by = uid and status in ('searching', 'assigned', 'en_route_to_scene', 'picked_up')
  order by created_at desc limit 1;
  if existing is not null then return existing; end if;

  select * into cfg from public.dispatch_config where id = 1;
  if (select count(*) from public.sos_requests where raised_by = uid and created_at > now() - interval '1 hour') >= cfg.max_per_hour then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  if not public.is_in_karnataka(p_lat, p_lng) then
    raise exception 'outside_karnataka' using errcode = 'P0001';
  end if;

  insert into public.sos_requests (raised_by, location, accuracy_m, injured_count, is_conscious, patient_can_sit, note, search_radius_m)
  values (uid, extensions.st_setsrid(extensions.st_point(p_lng, p_lat), 4326)::extensions.geography, p_accuracy_m,
          p_injured_count, p_is_conscious, p_patient_can_sit, nullif(btrim(p_note), ''), cfg.radius_steps_m[1])
  returning id into new_id;
  perform public.sos_log(new_id, 'searching', '{}', extensions.st_setsrid(extensions.st_point(p_lng, p_lat), 4326)::extensions.geography);

  -- Emergency contacts get an SMS with a live-location link straight away.
  insert into public.sos_share_links (sos_id) values (new_id) returning token into link;
  select coalesce(nullif(btrim(full_name), ''), 'Someone') into raiser_name from public.profiles where id = uid;
  for c in select name, phone from public.emergency_contacts where user_id = uid loop
    perform public.sos_notify(null, 'sos_contact_sms', new_id,
      jsonb_build_object('contact_name', c.name, 'raiser_name', coalesce(raiser_name, 'Someone'), 'token', link), 0, 'sms', c.phone);
  end loop;

  perform public.sos_dispatch_wave(new_id);
  return new_id;
end;
$$;

-- Add or change details after raising (affects later waves).
create function public.sos_update_details(p_sos uuid, p_injured_count int default null, p_is_conscious boolean default null,
                                         p_patient_can_sit boolean default null, p_note text default null)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.sos_requests set
    injured_count = coalesce(p_injured_count, injured_count),
    is_conscious = coalesce(p_is_conscious, is_conscious),
    patient_can_sit = coalesce(p_patient_can_sit, patient_can_sit),
    note = coalesce(nullif(btrim(p_note), ''), note)
  where id = p_sos and raised_by = (select auth.uid()) and status in ('searching', 'assigned', 'en_route_to_scene');
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
end;
$$;

create function public.sos_cancel(p_sos uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  s public.sos_requests;
  a record;
begin
  select * into s from public.sos_requests where id = p_sos and raised_by = (select auth.uid()) for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if s.status not in ('searching', 'assigned', 'en_route_to_scene', 'no_responder') then
    raise exception 'not_active' using errcode = 'P0001';
  end if;
  update public.sos_requests set status = 'cancelled', cancel_reason = p_reason, closed_at = now(), wave_deadline = null where id = p_sos;
  update public.sos_alerts set response = 'cancelled', responded_at = now() where sos_id = p_sos and response is null;
  update public.notification_outbox set status = 'cancelled' where ref_type = 'sos' and ref_id = p_sos and status = 'queued';
  for a in select responder_id from public.sos_alerts where sos_id = p_sos loop
    perform public.sos_notify(a.responder_id, 'sos_cancelled', p_sos);
  end loop;
  perform public.sos_log(p_sos, 'cancelled', jsonb_build_object('reason', p_reason));
end;
$$;

-- ---------------------------------------------------------------------------
-- Responder: see alert, accept (first wins), decline, update status, give up
-- ---------------------------------------------------------------------------
create function public.sos_alert_seen(p_sos uuid)
returns void language sql security definer set search_path = ''
as $$
  update public.sos_alerts set seen_at = coalesce(seen_at, now())
  where sos_id = p_sos and responder_id = (select auth.uid());
  -- the app got it: no need for the SMS fallback
  update public.notification_outbox set status = 'cancelled'
  where ref_type = 'sos' and ref_id = p_sos and user_id = (select auth.uid()) and template = 'sos_alert_sms' and status = 'queued';
$$;

create function public.sos_accept(p_sos uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  won uuid;
  s public.sos_requests;
  hospital uuid;
  a record;
begin
  if not exists (select 1 from public.sos_alerts where sos_id = p_sos and responder_id = uid) then
    raise exception 'not_alerted' using errcode = '42501';
  end if;
  if not exists (select 1 from public.responders where user_id = uid and verification_status = 'verified') then
    raise exception 'not_verified' using errcode = '42501';
  end if;

  -- First accept wins: only one UPDATE can find assigned_responder still empty.
  update public.sos_requests set assigned_responder = uid, status = 'assigned', assigned_at = now(), wave_deadline = null
  where id = p_sos and assigned_responder is null and status = 'searching'
  returning id into won;

  if won is null then
    update public.sos_alerts set response = 'too_late', responded_at = now()
    where sos_id = p_sos and responder_id = uid and (response is null or response in ('expired', 'reopened'));
    return false;
  end if;

  select * into s from public.sos_requests where id = p_sos;
  update public.sos_alerts set response = 'accepted', responded_at = now() where sos_id = p_sos and responder_id = uid;
  update public.responders set alerts_accepted = alerts_accepted + 1 where user_id = uid;
  -- everyone else: "Help is on the way — thank you"
  for a in select responder_id from public.sos_alerts where sos_id = p_sos and responder_id <> uid and response is null loop
    perform public.sos_notify(a.responder_id, 'sos_filled', p_sos);
  end loop;
  update public.sos_alerts set response = 'too_late', responded_at = now()
  where sos_id = p_sos and responder_id <> uid and response is null;
  update public.notification_outbox set status = 'cancelled'
  where ref_type = 'sos' and ref_id = p_sos and template in ('sos_alert', 'sos_alert_sms') and status = 'queued';

  select place_id into hospital from public.sos_hospitals(extensions.st_y(s.location::extensions.geometry), extensions.st_x(s.location::extensions.geometry)) limit 1;
  update public.sos_requests set destination_place_id = hospital where id = p_sos;

  perform public.sos_notify(s.raised_by, 'sos_assigned', p_sos);
  perform public.sos_log(p_sos, 'assigned', jsonb_build_object('responder', uid, 'hospital', hospital));
  return true;
end;
$$;

create function public.sos_decline(p_sos uuid)
returns void language sql security definer set search_path = ''
as $$
  update public.sos_alerts set response = 'declined', responded_at = now()
  where sos_id = p_sos and responder_id = (select auth.uid()) and response is null;
  update public.notification_outbox set status = 'cancelled'
  where ref_type = 'sos' and ref_id = p_sos and user_id = (select auth.uid()) and status = 'queued';
$$;

-- Status changes. Responder: assigned → en_route_to_scene → picked_up → reached_hospital.
-- Raiser or responder: → closed (after reaching hospital, or "I'm safe now").
create function public.sos_set_status(p_sos uuid, p_status text, p_place_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  s public.sos_requests;
  allowed boolean;
begin
  select * into s from public.sos_requests where id = p_sos for update;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  allowed := case
    when uid = s.assigned_responder then
      (s.status, p_status) in (('assigned', 'en_route_to_scene'), ('en_route_to_scene', 'picked_up'), ('assigned', 'picked_up'),
                               ('picked_up', 'reached_hospital'), ('reached_hospital', 'closed'))
    when uid = s.raised_by then
      p_status = 'closed' and s.status in ('assigned', 'en_route_to_scene', 'picked_up', 'reached_hospital', 'no_responder')
    else false
  end;
  if not allowed then raise exception 'bad_transition' using errcode = 'P0001'; end if;

  update public.sos_requests set status = p_status,
         destination_place_id = coalesce(p_place_id, destination_place_id),
         closed_at = case when p_status = 'closed' then now() else closed_at end
   where id = p_sos;
  if p_status in ('reached_hospital', 'closed') and s.assigned_responder is not null and s.status <> 'reached_hospital' and p_status = 'reached_hospital' then
    update public.responders set helped_count = helped_count + 1 where user_id = s.assigned_responder;
  end if;
  perform public.sos_log(p_sos, p_status, jsonb_build_object('by', case when uid = s.raised_by then 'raiser' else 'responder' end));
  if uid = s.assigned_responder then perform public.sos_notify(s.raised_by, 'sos_status', p_sos, jsonb_build_object('status', p_status)); end if;
end;
$$;

-- Responder can't continue (vehicle trouble etc.): put the SOS back to searching and alert others.
create function public.sos_release(p_sos uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  s public.sos_requests;
begin
  select * into s from public.sos_requests where id = p_sos and assigned_responder = uid for update;
  if not found or s.status not in ('assigned', 'en_route_to_scene') then raise exception 'not_assigned' using errcode = 'P0001'; end if;
  update public.sos_requests set status = 'searching', assigned_responder = null, assigned_at = null, destination_place_id = null
   where id = p_sos;
  update public.sos_alerts set response = 'released', responded_at = now() where sos_id = p_sos and responder_id = uid;
  -- people who weren't needed before can be asked again (not those who declined)
  update public.sos_alerts set response = 'reopened' where sos_id = p_sos and response in ('expired', 'too_late');
  update public.responders set no_shows = no_shows + 1,
         -- repeated no-shows after accepting → paused
         is_available = case when no_shows + 1 >= 3 then false else is_available end,
         verification_status = case when no_shows + 1 >= 3 then 'suspended' else verification_status end
   where user_id = uid;
  perform public.sos_log(p_sos, 'released', jsonb_build_object('responder', uid));
  perform public.sos_notify(s.raised_by, 'sos_status', p_sos, jsonb_build_object('status', 'searching'));
  perform public.sos_dispatch_wave(p_sos);
end;
$$;

-- During an active SOS the responder's position also goes into the SOS trail.
create or replace function public.responder_heartbeat(p_lat double precision, p_lng double precision, p_accuracy_m real)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  pt extensions.geography;
  active uuid;
begin
  if p_accuracy_m is null or p_accuracy_m > 100 or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    return false;
  end if;
  pt := extensions.st_setsrid(extensions.st_point(p_lng, p_lat), 4326)::extensions.geography;
  update public.responders set last_location = pt, last_accuracy_m = p_accuracy_m, last_seen_at = now()
   where user_id = (select auth.uid()) and is_available and verification_status = 'verified';
  if not found then return false; end if;
  select id into active from public.sos_requests
  where assigned_responder = (select auth.uid()) and status in ('assigned', 'en_route_to_scene', 'picked_up') limit 1;
  if active is not null then perform public.sos_log(active, 'location', jsonb_build_object('accuracy_m', p_accuracy_m), pt); end if;
  return true;
end;
$$;

-- ---------------------------------------------------------------------------
-- What each side may see
-- ---------------------------------------------------------------------------
-- The person who raised the SOS: progress, and the responder (name, vehicle, live location, ETA) only while active.
create function public.sos_status(p_sos uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', s.id, 'status', s.status, 'wave', s.wave, 'radius_m', s.search_radius_m, 'created_at', s.created_at,
    'alerted', (select count(*) from public.sos_alerts a where a.sos_id = s.id),
    'deciding', (select count(*) from public.sos_alerts a where a.sos_id = s.id and a.response is null),
    'lat', extensions.st_y(s.location::extensions.geometry), 'lng', extensions.st_x(s.location::extensions.geometry),
    'responder', case when s.status in ('assigned', 'en_route_to_scene', 'picked_up', 'reached_hospital') then (
      select jsonb_build_object(
        'name', coalesce(nullif(split_part(btrim(p.full_name), ' ', 1), ''), 'Responder'),
        'vehicle_type', r.vehicle_type, 'vehicle_number', r.vehicle_number,
        'lat', case when s.status <> 'reached_hospital' then extensions.st_y(r.last_location::extensions.geometry) end,
        'lng', case when s.status <> 'reached_hospital' then extensions.st_x(r.last_location::extensions.geometry) end,
        'last_seen_at', r.last_seen_at,
        'distance_m', round(extensions.st_distance(r.last_location, s.location)),
        'eta_s', round(extensions.st_distance(r.last_location, s.location) * cfg.road_factor / cfg.speed_mps))
      from public.responders r left join public.profiles p on p.id = r.user_id cross join public.dispatch_config cfg
      where r.user_id = s.assigned_responder) end,
    'hospital', (select jsonb_build_object('name', pl.name_en, 'phone', pl.phone,
                   'lat', extensions.st_y(pl.location::extensions.geometry), 'lng', extensions.st_x(pl.location::extensions.geometry))
                 from public.places pl where pl.id = s.destination_place_id))
  from public.sos_requests s
  where s.id = p_sos and s.raised_by = (select auth.uid());
$$;

-- A responder who was alerted: enough to decide (distance, ETA, injured count, conscious).
-- The exact pickup point, note and raiser's first name only after they are assigned.
create function public.sos_for_responder(p_sos uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', s.id, 'status', s.status, 'my_response', a.response, 'assigned_to_me', s.assigned_responder = a.responder_id,
    'distance_m', a.distance_m, 'eta_s', a.eta_s, 'sent_at', a.sent_at,
    'decide_by', a.sent_at + make_interval(secs => cfg.wave_timeout_s),
    'injured_count', s.injured_count, 'is_conscious', s.is_conscious, 'patient_can_sit', s.patient_can_sit,
    'pickup', case when s.assigned_responder = a.responder_id then jsonb_build_object(
        'lat', extensions.st_y(s.location::extensions.geometry), 'lng', extensions.st_x(s.location::extensions.geometry),
        'note', s.note,
        'raiser_name', (select coalesce(nullif(split_part(btrim(full_name), ' ', 1), ''), null) from public.profiles where id = s.raised_by)) end,
    'hospitals', case when s.assigned_responder = a.responder_id then (
        select coalesce(jsonb_agg(to_jsonb(h)), '[]'::jsonb)
        from public.sos_hospitals(extensions.st_y(s.location::extensions.geometry), extensions.st_x(s.location::extensions.geometry)) h) end,
    'destination_place_id', case when s.assigned_responder = a.responder_id then s.destination_place_id end)
  from public.sos_alerts a
  join public.sos_requests s on s.id = a.sos_id
  cross join public.dispatch_config cfg
  where a.sos_id = p_sos and a.responder_id = (select auth.uid());
$$;

-- Alerts waiting for this responder (the app polls this while available; push is the fast path).
create function public.my_pending_alerts()
returns table (sos_id uuid, sent_at timestamptz, distance_m int, eta_s int)
language sql stable security definer set search_path = ''
as $$
  select a.sos_id, a.sent_at, a.distance_m, a.eta_s
  from public.sos_alerts a join public.sos_requests s on s.id = a.sos_id
  where a.responder_id = (select auth.uid()) and a.response is null and s.status = 'searching'
  order by a.sent_at desc;
$$;

create function public.my_active_sos_as_responder()
returns uuid language sql stable security definer set search_path = ''
as $$
  select id from public.sos_requests
  where assigned_responder = (select auth.uid()) and status in ('assigned', 'en_route_to_scene', 'picked_up', 'reached_hospital')
  order by assigned_at desc limit 1;
$$;

-- Live link for emergency contacts. No login; works only while the SOS is active and the link is fresh.
create function public.sos_shared_location(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'status', s.status, 'updated_at', now(),
    'lat', extensions.st_y(s.location::extensions.geometry), 'lng', extensions.st_x(s.location::extensions.geometry),
    'hospital', (select pl.name_en from public.places pl where pl.id = s.destination_place_id))
  from public.sos_share_links l join public.sos_requests s on s.id = l.sos_id
  where l.token = p_token and l.expires_at > now()
    and s.status in ('searching', 'assigned', 'en_route_to_scene', 'picked_up', 'reached_hospital');
$$;

create function public.sos_rate(p_sos uuid, p_stars int, p_comment text default null, p_report boolean default false)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  s public.sos_requests;
  role text;
begin
  select * into s from public.sos_requests where id = p_sos;
  role := case when s.raised_by = (select auth.uid()) then 'raiser'
               when s.assigned_responder = (select auth.uid()) then 'responder' end;
  if role is null then raise exception 'not_allowed' using errcode = '42501'; end if;
  if s.status not in ('closed', 'reached_hospital', 'cancelled', 'no_responder') then raise exception 'still_active' using errcode = 'P0001'; end if;
  insert into public.sos_ratings (sos_id, by_user, role, stars, comment, report_problem)
  values (p_sos, (select auth.uid()), role, p_stars, nullif(btrim(p_comment), ''), coalesce(p_report, false))
  on conflict (sos_id, by_user) do update set stars = excluded.stars, comment = excluded.comment, report_problem = excluded.report_problem;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
do $$
declare f text;
begin
  -- internal only
  foreach f in array array['sos_log(uuid, text, jsonb, extensions.geography)',
    'sos_notify(uuid, text, uuid, jsonb, integer, text, text)', 'sos_candidates(uuid, integer)',
    'sos_dispatch_wave(uuid)', 'sos_tick()'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
  end loop;
  -- signed-in users
  foreach f in array array['sos_create(double precision, double precision, real, integer, boolean, boolean, text)',
    'sos_update_details(uuid, integer, boolean, boolean, text)', 'sos_cancel(uuid, text)', 'sos_alert_seen(uuid)',
    'sos_accept(uuid)', 'sos_decline(uuid)', 'sos_set_status(uuid, text, uuid)', 'sos_release(uuid)',
    'sos_status(uuid)', 'sos_for_responder(uuid)', 'my_pending_alerts()', 'my_active_sos_as_responder()',
    'sos_rate(uuid, integer, text, boolean)', 'sos_hospitals(double precision, double precision)'] loop
    execute format('revoke execute on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  -- the live link works without login (unguessable token)
  revoke execute on function public.sos_shared_location(text) from public;
  grant execute on function public.sos_shared_location(text) to anon, authenticated;
end $$;

-- ---------------------------------------------------------------------------
-- Timers: run sos_tick() every 5 seconds (pg_cron). Skipped where pg_cron isn't available;
-- the app also nudges dispatch (see sos_nudge) so a missing scheduler never stalls an SOS.
-- ---------------------------------------------------------------------------
create function public.sos_nudge(p_sos uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.sos_requests where id = p_sos and raised_by = (select auth.uid())
             and status = 'searching' and wave_deadline <= now()) then
    perform public.sos_tick();
  end if;
end;
$$;
revoke execute on function public.sos_nudge(uuid) from public, anon;
grant execute on function public.sos_nudge(uuid) to authenticated;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('plusplus-sos-tick', '5 seconds', 'select public.sos_tick()');
exception when others then
  raise notice 'pg_cron not available (%); rely on sos_nudge and an external scheduler', sqlerrm;
end $$;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.sos_alerts;
  end if;
end $$;
