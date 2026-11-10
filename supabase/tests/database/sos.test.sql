-- SOS dispatch: ranking, waves, radius widening, first-accept-wins, privacy, statuses, limits.
begin;
create extension if not exists pgtap with schema extensions;
select plan(42);

-- Point P = MG Road, Bengaluru. Helper: a point d metres north of P.
create function pg_temp.north(d double precision) returns extensions.geography language sql as $$
  select extensions.st_setsrid(extensions.st_point(77.5946, 12.9716 + d / 111320.0), 4326)::extensions.geography;
$$;
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- People: raiser U, second raiser V, unverified-phone W, responders R1..R7
insert into auth.users (id, phone, phone_confirmed_at, aud, role) values
  ('00000000-0000-0000-0000-0000000000c1', '919833300001', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c2', '919833300002', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c3', '919833300003', null,  'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d1', '919844400001', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d2', '919844400002', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d3', '919844400003', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d4', '919844400004', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d5', '919844400005', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d6', '919844400006', now(), 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d7', '919844400007', now(), 'authenticated', 'authenticated');
update public.profiles set full_name = 'Asha Rao' where id = '00000000-0000-0000-0000-0000000000c1';
update public.profiles set full_name = 'Ravi Kumar' where id = '00000000-0000-0000-0000-0000000000d3';
insert into public.emergency_contacts (user_id, name, phone) values ('00000000-0000-0000-0000-0000000000c1', 'Amma', '+919845000001');

-- Clear other data that could interfere (all rolled back)
delete from public.sos_requests;
update public.responders set is_available = false;

insert into public.responders (user_id, vehicle_type, vehicle_number, licence_number, licence_doc_path, rc_doc_path,
  vehicle_photo_path, selfie_path, verification_status, guide_completed_at, is_available, last_location, last_seen_at,
  alerts_received, alerts_accepted)
select id::uuid, vt, 'KA01AB' || n, 'KA0120230000' || n, 'x', 'x', 'x', 'x', 'verified', now(), true, pg_temp.north(d), seen, rec, acc
from (values
  ('00000000-0000-0000-0000-0000000000d1', 'three_wheeler', 1001,  300.0, now(), 0, 0),
  ('00000000-0000-0000-0000-0000000000d2', 'four_wheeler',  1002,  800.0, now(), 0, 0),
  ('00000000-0000-0000-0000-0000000000d3', 'three_wheeler', 1003, 1500.0, now(), 0, 0),
  ('00000000-0000-0000-0000-0000000000d4', 'three_wheeler', 1004, 1900.0, now() - interval '90 seconds', 0, 0),  -- slightly stale
  ('00000000-0000-0000-0000-0000000000d5', 'three_wheeler', 1005, 3500.0, now(), 0, 0),
  ('00000000-0000-0000-0000-0000000000d6', 'four_wheeler',  1006, 6000.0, now(), 0, 0),
  ('00000000-0000-0000-0000-0000000000d7', 'three_wheeler', 1007, 1000.0, now(), 10, 1)                          -- rarely accepts
) as t(id, vt, n, d, seen, rec, acc);
-- A stale responder (not seen for 5 minutes) must never be alerted
insert into auth.users (id, phone, phone_confirmed_at, aud, role) values ('00000000-0000-0000-0000-0000000000d9', '919844400009', now(), 'authenticated', 'authenticated');
insert into public.responders (user_id, vehicle_type, vehicle_number, licence_number, licence_doc_path, rc_doc_path, vehicle_photo_path, selfie_path,
  verification_status, guide_completed_at, is_available, last_location, last_seen_at)
values ('00000000-0000-0000-0000-0000000000d9', 'three_wheeler', 'KA01AB1009', 'KA012023000999', 'x', 'x', 'x', 'x', 'verified', now(), true,
        pg_temp.north(100), now() - interval '5 minutes');

-- An emergency hospital 2 km away
delete from public.reviews; delete from public.appointments; delete from public.places;
insert into public.places (id, name_en, type, location, is_24x7, has_emergency, trauma_care, phone) values
  ('00000000-0000-0000-0000-0000000000e1', 'Test Trauma Hospital', 'hospital', pg_temp.north(-2000), true, true, true, '+918000000001');

-- ---------- Creation checks ----------
select pg_temp.login('00000000-0000-0000-0000-0000000000c3');
set local role authenticated;
select throws_ok($$ select public.sos_create(12.9716, 77.5946) $$, 'P0001', 'phone_not_verified', 'needs a verified phone number');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000000c1');
set local role authenticated;
select throws_ok($$ select public.sos_create(13.0827, 80.2707) $$, 'P0001', 'outside_karnataka', 'refused outside Karnataka (app still shows 108/112)');
create temp table t_sos as select public.sos_create(12.9716, 77.5946, 10, 2, true, true, 'Bike accident near the signal') as id;
select ok((select id from t_sos) is not null, 'SOS created');
select is(public.sos_create(12.9716, 77.5946), (select id from t_sos), 'tapping SOS again returns the same active SOS');
reset role;

-- ---------- Wave 1 ----------
select is((select status from public.sos_requests where id = (select id from t_sos)), 'searching', 'status: searching');
select is((select search_radius_m from public.sos_requests where id = (select id from t_sos)), 2000, 'first search within 2 km (5 found, no need to widen)');
select is((select count(*)::int from public.sos_alerts where sos_id = (select id from t_sos)), 3, 'first wave alerts 3 responders');
select set_eq(
  $$ select responder_id from public.sos_alerts where sos_id = (select id from t_sos) and wave = 1 $$,
  $$ values ('00000000-0000-0000-0000-0000000000d1'::uuid), ('00000000-0000-0000-0000-0000000000d2'::uuid), ('00000000-0000-0000-0000-0000000000d7'::uuid) $$,
  'wave 1 = 3 lowest scores (R7''s low-acceptance penalty still beats R3 at 1.5 km)');
select ok(not exists (select 1 from public.sos_alerts where responder_id = '00000000-0000-0000-0000-0000000000d9'), 'stale responders are never alerted');
select is((select count(*)::int from public.notification_outbox where ref_id = (select id from t_sos) and template = 'sos_alert'), 3, 'push queued for each');
select is((select count(*)::int from public.notification_outbox where ref_id = (select id from t_sos) and template = 'sos_alert_sms'
           and send_after > now() + interval '10 seconds'), 3, 'SMS fallback queued 15 s later');
select is((select count(*)::int from public.notification_outbox where ref_id = (select id from t_sos) and template = 'sos_contact_sms' and phone = '+919845000001'), 1,
  'emergency contact gets an SMS with a live link');
select ok(public.sos_shared_location((select payload->>'token' from public.notification_outbox where ref_id = (select id from t_sos) and template = 'sos_contact_sms')) is not null,
  'live link works while the SOS is active');

-- ---------- Privacy before accepting ----------
select pg_temp.login('00000000-0000-0000-0000-0000000000d5');
set local role authenticated;
select is(public.sos_for_responder((select id from t_sos)), null, 'a responder who was not alerted sees nothing');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
set local role authenticated;
select is((public.sos_for_responder((select id from t_sos))) -> 'pickup', 'null'::jsonb, 'alerted responder sees no exact pickup point before accepting');
select is(((public.sos_for_responder((select id from t_sos))) ->> 'injured_count')::int, 2, 'but does see what they need to decide');
select lives_ok($$ select public.sos_alert_seen((select id from t_sos)) $$, 'app shows the alert');
reset role;
select is((select status from public.notification_outbox where ref_id = (select id from t_sos) and template = 'sos_alert_sms'
           and user_id = '00000000-0000-0000-0000-0000000000d1'), 'cancelled', 'SMS fallback cancelled once the app showed the alert');
select pg_temp.login('00000000-0000-0000-0000-0000000000c1');
set local role authenticated;
select is((public.sos_status((select id from t_sos))) -> 'responder', 'null'::jsonb, 'raiser sees no responder yet');
select is(((public.sos_status((select id from t_sos))) ->> 'alerted')::int, 3, 'raiser sees how many were alerted');
reset role;

-- ---------- Nobody answers → wave 2 widens to 5 km ----------
update public.sos_requests set wave_deadline = now() - interval '1 second' where id = (select id from t_sos);
select is(public.sos_tick(), 1, 'timer runs the overdue SOS');
select is((select search_radius_m from public.sos_requests where id = (select id from t_sos)), 5000, 'only 2 left within 2 km → widened to 5 km');
select set_eq(
  $$ select responder_id from public.sos_alerts where sos_id = (select id from t_sos) and wave = 2 $$,
  $$ values ('00000000-0000-0000-0000-0000000000d3'::uuid), ('00000000-0000-0000-0000-0000000000d4'::uuid), ('00000000-0000-0000-0000-0000000000d5'::uuid) $$,
  'wave 2 = the next 3, never re-alerting wave 1');
select is((select count(*)::int from public.sos_alerts where sos_id = (select id from t_sos) and wave = 1 and response = 'expired'), 3, 'wave 1 alerts expired');

-- ---------- Wave 3 widens to 8 km ----------
update public.sos_requests set wave_deadline = now() - interval '1 second' where id = (select id from t_sos);
select sos_tick();
select is((select search_radius_m from public.sos_requests where id = (select id from t_sos)), 8000, 'widened to 8 km');
select is((select count(*)::int from public.sos_alerts where sos_id = (select id from t_sos) and wave = 3), 1, 'wave 3 alerts the last responder in range');

-- ---------- First accept wins ----------
select pg_temp.login('00000000-0000-0000-0000-0000000000d3');
set local role authenticated;
select is(public.sos_accept((select id from t_sos)), true, 'R3 (wave 2, late but still searching) accepts and is assigned');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000000d6');
set local role authenticated;
select is(public.sos_accept((select id from t_sos)), false, 'R6 accepting a moment later gets "too late"');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000000d9');
set local role authenticated;
select throws_ok($$ select public.sos_accept((select id from t_sos)) $$, '42501', 'not_alerted', 'responders who were never alerted cannot accept');
reset role;
select is((select assigned_responder from public.sos_requests where id = (select id from t_sos)), '00000000-0000-0000-0000-0000000000d3'::uuid, 'exactly one responder assigned');
select is((select count(*)::int from public.notification_outbox where ref_id = (select id from t_sos) and template = 'sos_filled'), 1,
  'others still deciding are told "Help is on the way"');
select is((select destination_place_id from public.sos_requests where id = (select id from t_sos)), '00000000-0000-0000-0000-0000000000e1'::uuid,
  'nearest emergency hospital chosen');

-- ---------- What each side sees now ----------
select pg_temp.login('00000000-0000-0000-0000-0000000000c1');
set local role authenticated;
select is((public.sos_status((select id from t_sos))) #>> '{responder,name}', 'Ravi', 'raiser sees the responder''s first name');
select ok((public.sos_status((select id from t_sos))) #> '{responder,lat}' is not null, 'raiser sees the responder''s live location');
select throws_ok($$ select public.sos_set_status((select id from t_sos), 'picked_up') $$, 'P0001', 'bad_transition', 'raiser cannot mark picked up');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000000d3');
set local role authenticated;
select ok((public.sos_for_responder((select id from t_sos))) #> '{pickup,lat}' is not null, 'assigned responder now sees the exact pickup point');
select is((public.sos_for_responder((select id from t_sos))) #>> '{pickup,note}', 'Bike accident near the signal', 'and the note');
select lives_ok($$ select public.sos_set_status((select id from t_sos), 'en_route_to_scene');
                   select public.sos_set_status((select id from t_sos), 'picked_up');
                   select public.sos_set_status((select id from t_sos), 'reached_hospital') $$, 'responder: on the way → picked up → reached hospital');
reset role;
select is((select helped_count from public.responders where user_id = '00000000-0000-0000-0000-0000000000d3'), 1, 'responder''s help counted');

select pg_temp.login('00000000-0000-0000-0000-0000000000c1');
set local role authenticated;
select lives_ok($$ select public.sos_set_status((select id from t_sos), 'closed') $$, 'raiser closes the SOS');
reset role;
select is(public.sos_shared_location((select payload->>'token' from public.notification_outbox where ref_id = (select id from t_sos) and template = 'sos_contact_sms')), null,
  'live link stops working once closed');

-- ---------- No responder anywhere ----------
update public.responders set is_available = false;
select pg_temp.login('00000000-0000-0000-0000-0000000000c2');
set local role authenticated;
create temp table t_sos2 as select public.sos_create(17.9104, 77.5199) as id;   -- Bidar
reset role;
select is((select status from public.sos_requests where id = (select id from t_sos2)), 'no_responder', 'no responders within 8 km → no_responder (108/112 stay on screen)');

select * from finish();
rollback;
