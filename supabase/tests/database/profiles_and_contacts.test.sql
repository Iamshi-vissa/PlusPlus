-- RLS tests for profiles and emergency contacts. Run with: pnpm supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(22);

-- Two users, created the way Supabase Auth creates them (phone without '+').
insert into auth.users (id, phone, aud, role)
values
  ('11111111-1111-1111-1111-111111111111', '919876543210', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', '918765432109', 'authenticated', 'authenticated');

-- Sign-up trigger
select is(
  (select phone from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  '+919876543210',
  'a profile is created at sign-up with the phone in +91 format'
);

-- Helper: act as a signed-in user
create function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- ---------- anonymous (not signed in) ----------
set local role anon;
select throws_ok('select * from public.profiles', '42501', null, 'anon cannot read profiles');
select throws_ok('select * from public.emergency_contacts', '42501', null, 'anon cannot read contacts');
reset role;

-- ---------- user A ----------
select pg_temp.login('11111111-1111-1111-1111-111111111111');
set local role authenticated;

select results_eq(
  'select id from public.profiles',
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid) $$,
  'A sees only their own profile'
);

select lives_ok(
  $$ update public.profiles set full_name = 'Asha', language = 'kn' $$,
  'A can update their own name and language'
);
select is((select language from public.profiles), 'kn', 'language was saved');

update public.profiles set full_name = 'hacked' where id = '22222222-2222-2222-2222-222222222222';
select throws_ok(
  $$ update public.profiles set phone = '+910000000000' $$,
  '42501', null, 'A cannot change the phone number directly'
);
select throws_ok(
  $$ insert into public.profiles (id) values (gen_random_uuid()) $$,
  '42501', null, 'A cannot create extra profiles'
);
select throws_ok(
  $$ delete from public.profiles $$,
  '42501', null, 'A cannot delete profiles directly'
);
select throws_ok(
  $$ update public.profiles set language = 'fr' $$,
  '23514', null, 'only en / kn are allowed'
);

select lives_ok(
  $$ insert into public.emergency_contacts (name, phone, relation) values ('Amma', '+919900000001', 'mother') $$,
  'A can add a contact (user_id defaults to A)'
);
select throws_ok(
  $$ insert into public.emergency_contacts (user_id, name, phone)
     values ('22222222-2222-2222-2222-222222222222', 'Sneaky', '+919900000009') $$,
  '42501', null, 'A cannot add a contact for B'
);
select throws_ok(
  $$ insert into public.emergency_contacts (name, phone) values ('Bad', '9900000001') $$,
  '23514', null, 'phone numbers must be +91 mobiles'
);
select throws_ok(
  $$ insert into public.emergency_contacts (name, phone) values ('Again', '+919900000001') $$,
  '23505', null, 'the same number cannot be added twice'
);

insert into public.emergency_contacts (name, phone) values
  ('Two', '+919900000002'), ('Three', '+919900000003'), ('Four', '+919900000004'), ('Five', '+919900000005');
select is((select count(*)::int from public.emergency_contacts), 5, 'A has 5 contacts');
select throws_ok(
  $$ insert into public.emergency_contacts (name, phone) values ('Six', '+919900000006') $$,
  'P0001', 'emergency_contacts_limit', 'a 6th contact is refused'
);

-- ---------- user B ----------
reset role;
select pg_temp.login('22222222-2222-2222-2222-222222222222');
set local role authenticated;

select is((select full_name from public.profiles), null, 'B''s profile was not changed by A');
select is((select count(*)::int from public.emergency_contacts), 0, 'B cannot see A''s contacts');

update public.emergency_contacts set name = 'hacked';
delete from public.emergency_contacts;
reset role;
select is(
  (select count(*)::int from public.emergency_contacts where user_id = '11111111-1111-1111-1111-111111111111'),
  5,
  'B could not delete A''s contacts'
);
select is(
  (select count(*)::int from public.emergency_contacts where name = 'hacked'),
  0,
  'B could not edit A''s contacts'
);

-- Phone change in Auth flows into the profile
update auth.users set phone = '919000000000' where id = '22222222-2222-2222-2222-222222222222';
select is(
  (select phone from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  '+919000000000',
  'a phone change in Auth is copied to the profile'
);

-- Deleting the account removes everything
delete from auth.users where id = '11111111-1111-1111-1111-111111111111';
select is(
  (select count(*)::int from public.emergency_contacts where user_id = '11111111-1111-1111-1111-111111111111'),
  0,
  'deleting an account deletes its contacts'
);

select * from finish();
rollback;
