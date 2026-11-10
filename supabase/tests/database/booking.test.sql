-- Booking, cancellation, reviews, clinic onboarding and their access rules.
begin;
create extension if not exists pgtap with schema extensions;
select plan(37);

-- People: patient A, patient B, clinic admin C, platform admin P
insert into auth.users (id, phone, aud, role) values
  ('aaaaaaaa-0000-0000-0000-000000000001', '919811100001', 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-0000-0000-000000000002', '919811100002', 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-0000-0000-000000000003', '919811100003', 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-0000-0000-000000000004', '919811100004', 'authenticated', 'authenticated');
insert into public.platform_admins (user_id) values ('aaaaaaaa-0000-0000-0000-000000000004');

create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- ---------- Clinic onboarding ----------
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000003');
set local role authenticated;
select lives_ok($$
  insert into public.clinic_applications (id, name, type, address, phone, location, registration_no)
  values ('cccccccc-0000-0000-0000-000000000001', 'Test Family Clinic', 'clinic', '1 MG Road, Bengaluru', '+918012345678',
          extensions.st_setsrid(extensions.st_point(77.60, 12.975), 4326)::extensions.geography, 'KPME-123')
$$, 'a clinic can apply');
select throws_ok($$
  insert into public.clinic_applications (name, type, address, phone, location, registration_no)
  values ('Second', 'clinic', 'x', '+918012345678', extensions.st_setsrid(extensions.st_point(77.60, 12.975), 4326)::extensions.geography, 'KPME-9')
$$, 'P0001', 'application_pending', 'only one pending application at a time');
select throws_ok($$ select public.review_clinic_application('cccccccc-0000-0000-0000-000000000001', true) $$,
  '42501', 'not_allowed', 'applicants cannot approve themselves');
reset role;

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000004');
set local role authenticated;
select ok(public.review_clinic_application('cccccccc-0000-0000-0000-000000000001', true, 'Checked KPME') is not null, 'platform admin approves');
reset role;

select is((select is_registered from public.places where name_en = 'Test Family Clinic'), true, 'approved clinic is registered');

-- ---------- Clinic admin adds a doctor ----------
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000003');
set local role authenticated;
select throws_ok($$
  insert into public.doctors (place_id, name, gender, specialities, qualifications, fee, verified_at, rating_sum)
  select id, 'Dr. Cheat', 'male', '{gp}', 'MBBS', 300, now(), 999 from public.places where name_en = 'Test Family Clinic'
$$, '42501', null, 'clinic admins cannot write verification or rating fields');
select lives_ok($$
  insert into public.doctors (place_id, name, gender, specialities, qualifications, years_experience, languages, fee, nmc_registration_no)
  select id, 'Dr. Test', 'female', '{gp}', 'MBBS', 10, '{kn,en}', 300, 'KMC-1'
  from public.places where name_en = 'Test Family Clinic'
$$, 'clinic admin adds a doctor');
select throws_ok($$
  insert into public.doctors (place_id, name, specialities, qualifications, fee)
  select id, 'Dr. Typo', '{cardiologyy}', 'MBBS', 300 from public.places where name_en = 'Test Family Clinic'
$$, 'P0001', 'unknown_speciality', 'specialities must be known codes');
reset role;
update public.doctors set id = 'dddddddd-0000-0000-0000-000000000001' where name = 'Dr. Test';
select is((select verified_at from public.doctors where id = 'dddddddd-0000-0000-0000-000000000001'), null, 'new doctors start unverified');

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000003');
set local role authenticated;
select is(public.generate_slots('dddddddd-0000-0000-0000-000000000001', (now() at time zone 'Asia/Kolkata')::date + 1, 2,
  '{"mon":[["09:00","10:00"]],"tue":[["09:00","10:00"]],"wed":[["09:00","10:00"]],"thu":[["09:00","10:00"]],"fri":[["09:00","10:00"]],"sat":[["09:00","10:00"]],"sun":[["09:00","10:00"]]}', 15),
  8, 'timetable → 4 slots a day for 2 days');
reset role;

-- Unverified doctors cannot be booked and are not listed publicly
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
set local role authenticated;
select is((select count(*)::int from public.doctors where id = 'dddddddd-0000-0000-0000-000000000001'), 0, 'unverified doctor is hidden from patients');
select throws_ok($$ select public.book_appointment((select id from public.slots where doctor_id = 'dddddddd-0000-0000-0000-000000000001' order by starts_at limit 1)) $$,
  'P0001', 'slot_taken', 'unverified doctor cannot be booked');
reset role;

update public.doctors set verified_at = now() where id = 'dddddddd-0000-0000-0000-000000000001';
-- a slot far enough ahead for the 2-hour cancel cut-off, and one starting soon
insert into public.slots (id, doctor_id, starts_at, ends_at) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'dddddddd-0000-0000-0000-000000000001', now() + interval '3 days', now() + interval '3 days 15 minutes'),
  ('eeeeeeee-0000-0000-0000-000000000002', 'dddddddd-0000-0000-0000-000000000001', now() + interval '30 minutes', now() + interval '45 minutes'),
  ('eeeeeeee-0000-0000-0000-000000000003', 'dddddddd-0000-0000-0000-000000000001', now() + interval '4 days', now() + interval '4 days 15 minutes');

-- ---------- Booking ----------
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
set local role authenticated;
select lives_ok($$ select public.book_appointment('eeeeeeee-0000-0000-0000-000000000001', 'fever_cold', 'Fever for 2 days', 'general', 'few_days', 'mild', 'adult') $$,
  'patient A books a slot');
select lives_ok($$ select public.book_appointment('eeeeeeee-0000-0000-0000-000000000002') $$, 'patient A books a slot starting soon');
reset role;

select is((select status from public.slots where id = 'eeeeeeee-0000-0000-0000-000000000001'), 'booked', 'slot is now booked');
select is((select count(*)::int from public.notification_outbox where ref_type = 'appointment' and user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 2,
  '24 h + 1 h reminders for the slot in 3 days; none for the one in 30 minutes (both times already passed)');

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000002');
set local role authenticated;
select throws_ok($$ select public.book_appointment('eeeeeeee-0000-0000-0000-000000000001') $$, 'P0001', 'slot_taken',
  'patient B cannot take the same slot');
select is((select count(*)::int from public.appointments), 0, 'patient B cannot see patient A''s appointments');
select throws_ok($$ select public.cancel_appointment((select id from public.appointments limit 1)) $$, 'P0001', 'not_found',
  'patient B cannot even find A''s appointment to cancel');
select is((select count(*)::int from public.clinic_appointments((select id from public.places where name_en = 'Test Family Clinic'))), 0,
  'patient B gets nothing from the clinic view');
reset role;

-- Clinic sees its bookings with the patient's own words
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000003');
set local role authenticated;
select is((select problem_description from public.clinic_appointments((select id from public.places where name_en = 'Test Family Clinic')) order by starts_at desc limit 1),
  'Fever for 2 days', 'the clinic (doctor) sees the patient''s description');
reset role;

-- ---------- Cancel and reschedule ----------
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
set local role authenticated;
select throws_ok($$ select public.cancel_appointment((select id from public.appointments where slot_id = 'eeeeeeee-0000-0000-0000-000000000002')) $$,
  'P0001', 'past_cutoff', 'patients cannot cancel inside the 2-hour cut-off');
select lives_ok($$ select public.reschedule_appointment((select id from public.appointments where slot_id = 'eeeeeeee-0000-0000-0000-000000000001'), 'eeeeeeee-0000-0000-0000-000000000003') $$,
  'reschedule to another slot');
reset role;
select is((select status from public.slots where id = 'eeeeeeee-0000-0000-0000-000000000001'), 'open', 'old slot is free again');
select is((select status from public.slots where id = 'eeeeeeee-0000-0000-0000-000000000003'), 'booked', 'new slot is booked');
select is((select problem_description from public.appointments where slot_id = 'eeeeeeee-0000-0000-0000-000000000003'), 'Fever for 2 days', 'description carries over');
select is((select count(*)::int from public.notification_outbox where ref_type = 'appointment' and status = 'cancelled' and user_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 2, 'old reminders cancelled');

-- Clinic can cancel any time before the visit
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000003');
set local role authenticated;
select lives_ok($$ select public.cancel_appointment((select id from public.appointments where slot_id = 'eeeeeeee-0000-0000-0000-000000000002')) $$,
  'clinic can cancel inside the cut-off');
select throws_ok($$ select public.mark_appointment((select id from public.appointments where slot_id = 'eeeeeeee-0000-0000-0000-000000000003'), 'completed') $$,
  'P0001', 'not_started', 'cannot complete a visit before it starts');
reset role;

-- ---------- Reviews ----------
update public.appointments set starts_at = now() - interval '1 hour' where slot_id = 'eeeeeeee-0000-0000-0000-000000000003';
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
set local role authenticated;
select throws_ok($$ select public.submit_review((select id from public.appointments where slot_id = 'eeeeeeee-0000-0000-0000-000000000003'), 5) $$,
  'P0001', 'not_completed', 'no review before the visit is completed');
reset role;
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000003');
set local role authenticated;
select lives_ok($$ select public.mark_appointment((select id from public.appointments where slot_id = 'eeeeeeee-0000-0000-0000-000000000003'), 'completed') $$,
  'clinic marks the visit completed');
reset role;
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
set local role authenticated;
select lives_ok($$ select public.submit_review((select id from public.appointments where slot_id = 'eeeeeeee-0000-0000-0000-000000000003'), 4, 'Kind and clear') $$,
  'patient reviews after a completed visit');
select throws_ok($$ select public.submit_review((select id from public.appointments where slot_id = 'eeeeeeee-0000-0000-0000-000000000003'), 5) $$,
  '23505', null, 'only one review per appointment');
reset role;
select is((select rating_count from public.doctors where id = 'dddddddd-0000-0000-0000-000000000001'), 1, 'doctor rating updated');

set local role anon;
select throws_ok($$ select user_id from public.reviews $$, '42501', null, 'nobody can see who wrote a review');
select ok(exists (select 1 from public.find_doctors(12.975, 77.60, '{gp}', 5000) where doctor_id = 'dddddddd-0000-0000-0000-000000000001'),
  'doctor finder (signed out) lists the verified doctor');
select ok(not exists (select 1 from public.find_doctors(12.975, 77.60, '{gp}', 5000, p_max_fee => 100) where doctor_id = 'dddddddd-0000-0000-0000-000000000001'),
  'fee filter applies before ranking');
reset role;

select * from finish();
rollback;
