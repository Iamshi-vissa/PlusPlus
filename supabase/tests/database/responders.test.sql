begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, phone, aud, role) values
  ('bbbbbbbb-0000-0000-0000-000000000001', '919822200001', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '919822200002', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-0000-0000-000000000009', '919822200009', 'authenticated', 'authenticated');
insert into public.platform_admins values ('bbbbbbbb-0000-0000-0000-000000000009');
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000001');
set local role authenticated;
select throws_ok($$ select public.responder_apply('three_wheeler', 'KA 01 AB 1234', 'KA0120230001234',
  'someone-else/licence.jpg', 'x/rc.jpg', 'x/v.jpg', 'x/s.jpg') $$, 'P0001', 'bad_document', 'documents must be your own uploads');
select lives_ok($$ select public.responder_apply('three_wheeler', 'ka-01-ab-1234', 'KA0120230001234',
  'bbbbbbbb-0000-0000-0000-000000000001/licence.jpg', 'bbbbbbbb-0000-0000-0000-000000000001/rc.jpg',
  'bbbbbbbb-0000-0000-0000-000000000001/vehicle.jpg', 'bbbbbbbb-0000-0000-0000-000000000001/selfie.jpg') $$, 'driver applies');
select is((select vehicle_number from public.responders), 'KA01AB1234', 'vehicle number normalised');
select is((select verification_status from public.responders), 'pending', 'starts pending');
select throws_ok($$ select public.responder_set_available(true) $$, 'P0001', 'not_verified', 'cannot go live before verification');
select throws_ok($$ update public.responders set verification_status = 'verified' $$, '42501', null, 'cannot verify yourself');
select throws_ok($$ select public.review_responder('bbbbbbbb-0000-0000-0000-000000000001', 'verified') $$, '42501', 'not_allowed', 'only admins review');
reset role;

select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000009');
set local role authenticated;
select lives_ok($$ select public.review_responder('bbbbbbbb-0000-0000-0000-000000000001', 'verified', 'Licence and RC match') $$, 'admin verifies');
reset role;

select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000001');
set local role authenticated;
select throws_ok($$ select public.responder_set_available(true) $$, 'P0001', 'guide_not_read', 'must read the first-aid guide first');
select lives_ok($$ select public.responder_complete_guide() $$, 'reads the guide');
select lives_ok($$ select public.responder_set_available(true) $$, 'goes available');
select is(public.responder_heartbeat(12.97, 77.59, 250), false, 'inaccurate fixes (> 100 m) are refused');
select is(public.responder_heartbeat(12.97, 77.59, 20), true, 'good fix is stored');
select ok((select last_seen_at is not null and last_location is not null from public.responders), 'location and time saved');
select lives_ok($$ select public.responder_set_available(false) $$, 'goes unavailable');
select is((select last_location from public.responders), null, 'location is cleared when unavailable');
reset role;

-- Another user cannot see the responder or their location
select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000002');
set local role authenticated;
select is((select count(*)::int from public.responders), 0, 'nobody else can see responders or their locations');
reset role;

select * from finish();
rollback;
