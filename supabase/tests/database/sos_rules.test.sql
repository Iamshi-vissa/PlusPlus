-- More SOS rules: 4-wheeler preference, rate limit, cancel, responder giving up, no-show pause, ratings.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

create function pg_temp.near_mysuru(d double precision) returns extensions.geography language sql as $$
  select extensions.st_setsrid(extensions.st_point(76.6394, 12.2958 + d / 111320.0), 4326)::extensions.geography;
$$;
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
delete from public.sos_requests;
update public.responders set is_available = false;

insert into auth.users (id, phone, phone_confirmed_at, aud, role) values
  ('00000000-0000-0000-0000-0000000000f1', '919855500001', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000f2', '919855500002', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000f3', '919855500003', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000f4', '919855500004', now(), 'authenticated', 'authenticated');
-- 3-wheeler at 500 m (ETA ~127 s) and 4-wheeler at 600 m (ETA ~153 s)
insert into public.responders (user_id, vehicle_type, vehicle_number, licence_number, licence_doc_path, rc_doc_path,
  vehicle_photo_path, selfie_path, verification_status, guide_completed_at, is_available, last_location, last_seen_at)
values
  ('00000000-0000-0000-0000-0000000000f2', 'three_wheeler', 'KA09AB2002', 'KA092023000222', 'x', 'x', 'x', 'x', 'verified', now(), true, pg_temp.near_mysuru(500), now()),
  ('00000000-0000-0000-0000-0000000000f3', 'four_wheeler',  'KA09AB2003', 'KA092023000333', 'x', 'x', 'x', 'x', 'verified', now(), true, pg_temp.near_mysuru(600), now());

-- Patient can sit → nearest first (3-wheeler)
select pg_temp.login('00000000-0000-0000-0000-0000000000f1');
set local role authenticated;
create temp table s1 as select public.sos_create(12.2958, 76.6394, 10, 1, true, true) id;
reset role;
select is((select responder_id from public.sos_candidates((select id from s1), 2000) limit 1), null, 'both already alerted in wave 1 (only 2 in range)');
select is((select responder_id from public.sos_alerts where sos_id = (select id from s1) order by score limit 1),
          '00000000-0000-0000-0000-0000000000f2'::uuid, 'conscious patient who can sit: nearest (3-wheeler) ranks first');

-- Cancel tells alerted responders
select pg_temp.login('00000000-0000-0000-0000-0000000000f1');
set local role authenticated;
select lives_ok($$ select public.sos_cancel((select id from s1), 'false alarm') $$, 'raiser cancels');
reset role;
select is((select count(*)::int from public.notification_outbox where ref_id = (select id from s1) and template = 'sos_cancelled'), 2, 'alerted responders are told it was cancelled');
select is((select count(*)::int from public.notification_outbox where ref_id = (select id from s1) and template = 'sos_alert_sms' and status = 'queued'), 0, 'pending SMS alerts are cancelled');

-- Unconscious → the 4-wheeler gets the 30 s bonus and ranks first
select pg_temp.login('00000000-0000-0000-0000-0000000000f1');
set local role authenticated;
create temp table s2 as select public.sos_create(12.2958, 76.6394, 10, 1, false, false) id;
reset role;
select is((select responder_id from public.sos_alerts where sos_id = (select id from s2) order by score limit 1),
          '00000000-0000-0000-0000-0000000000f3'::uuid, 'unconscious patient: 4-wheeler (can lie down) ranks first');

-- Responder gives up → back to searching, others alerted, no-show counted
select pg_temp.login('00000000-0000-0000-0000-0000000000f3');
set local role authenticated;
select is(public.sos_accept((select id from s2)), true, '4-wheeler accepts');
select lives_ok($$ select public.sos_release((select id from s2)) $$, 'then has to give up');
reset role;
select is((select status from public.sos_requests where id = (select id from s2)), 'searching', 'SOS goes back to searching');
select is((select response from public.sos_alerts where sos_id = (select id from s2) and responder_id = '00000000-0000-0000-0000-0000000000f2'), null,
  'the 3-wheeler who was told "too late" is asked again');
select is((select no_shows from public.responders where user_id = '00000000-0000-0000-0000-0000000000f3'), 1, 'no-show counted');
update public.responders set no_shows = 2 where user_id = '00000000-0000-0000-0000-0000000000f2';
select pg_temp.login('00000000-0000-0000-0000-0000000000f2');
set local role authenticated;
select is(public.sos_accept((select id from s2)), true, '3-wheeler (already alerted) accepts');
select lives_ok($$ select public.sos_release((select id from s2)) $$, 'and gives up too');
reset role;
select is((select verification_status from public.responders where user_id = '00000000-0000-0000-0000-0000000000f2'), 'suspended',
  'repeated no-shows after accepting → responder paused');

-- Rate limit: max 3 SOS per hour (s1, s2 so far)
select pg_temp.login('00000000-0000-0000-0000-0000000000f1');
set local role authenticated;
select public.sos_cancel((select id from s2));
select public.sos_cancel(public.sos_create(12.2958, 76.6394));
select throws_ok($$ select public.sos_create(12.2958, 76.6394) $$, 'P0001', 'rate_limited', 'a 4th SOS within an hour is refused');
reset role;

select * from finish();
rollback;
