-- Places: search, open-now, access. Uses its own test rows (not the demo seed).
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

-- start from an empty directory (all rolled back at the end)
delete from public.sos_requests; delete from public.reviews; delete from public.appointments; delete from public.places;
insert into public.places (id, name_en, type, ownership, location, opening_hours, is_24x7, has_emergency, trauma_care, specialities, pincode)
values
  ('00000000-0000-0000-0000-0000000000a1', 'Test Trauma Hospital', 'hospital', 'government',
   extensions.st_setsrid(extensions.st_point(77.5946, 12.9716), 4326)::extensions.geography, null, true, true, true, '{emergency,ortho}', '560001'),
  ('00000000-0000-0000-0000-0000000000a2', 'Smile Dental Clinic', 'clinic', 'private',
   extensions.st_setsrid(extensions.st_point(77.6100, 12.9800), 4326)::extensions.geography,
   '{"mon":[["09:00","13:00"]],"tue":[["09:00","13:00"]],"wed":[["09:00","13:00"]],"thu":[["09:00","13:00"]],"fri":[["09:00","13:00"]],"sat":[],"sun":[]}', false, false, false, '{dental}', '560025'),
  ('00000000-0000-0000-0000-0000000000a3', 'Night Owl Medicals', 'medical_store', 'private',
   extensions.st_setsrid(extensions.st_point(77.5800, 12.9600), 4326)::extensions.geography,
   '{"mon":[["20:00","02:00"]],"tue":[["20:00","02:00"]],"wed":[["20:00","02:00"]],"thu":[["20:00","02:00"]],"fri":[["20:00","02:00"]],"sat":[["20:00","02:00"]],"sun":[["20:00","02:00"]]}', false, false, false, '{}', '560002'),
  ('00000000-0000-0000-0000-0000000000a4', 'Mysuru Child Clinic', 'clinic', 'private',
   extensions.st_setsrid(extensions.st_point(76.6394, 12.2958), 4326)::extensions.geography, null, false, false, false, '{paeds}', '570001');

-- Area filled in automatically
select is((select d.name_en from public.places p join public.districts d on d.id = p.district_id where p.id = '00000000-0000-0000-0000-0000000000a1'),
          'Bengaluru Urban', 'district is filled in from the location');
select throws_ok(
  $$ insert into public.places (name_en, type, location) values ('Chennai Clinic', 'clinic', extensions.st_setsrid(extensions.st_point(80.27, 13.08), 4326)::extensions.geography) $$,
  'P0001', 'place_outside_karnataka', 'places outside Karnataka are refused');

-- Open now (IST). Monday 10:00 IST = 04:30 UTC.
select is(public.is_open_at((select opening_hours from public.places where id = '00000000-0000-0000-0000-0000000000a2'), false, '2026-11-09 04:30+00'), true, 'clinic open Monday 10:00');
select is(public.is_open_at((select opening_hours from public.places where id = '00000000-0000-0000-0000-0000000000a2'), false, '2026-11-09 09:30+00'), false, 'clinic closed Monday 15:00');
select is(public.is_open_at((select opening_hours from public.places where id = '00000000-0000-0000-0000-0000000000a2'), false, '2026-11-08 04:30+00'), false, 'clinic closed Sunday');
select is(public.is_open_at((select opening_hours from public.places where id = '00000000-0000-0000-0000-0000000000a3'), false, '2026-11-09 19:30+00'), true, 'night store open Tue 01:00 (Monday''s shift)');
select is(public.is_open_at((select opening_hours from public.places where id = '00000000-0000-0000-0000-0000000000a3'), false, '2026-11-09 23:30+00'), false, 'night store closed Tue 05:00');
select is(public.is_open_at(null, true), true, '24x7 is always open');
select is(public.is_open_at(null, false), null, 'no hours = unknown');

-- Search near a point
select is((select count(*)::int from public.search_places(12.9716, 77.5946, 5000)), 3, '3 places within 5 km of MG Road');
select is((select name_en from public.search_places(12.9716, 77.5946, 5000) limit 1), 'Test Trauma Hospital', 'nearest first');
select ok((select distance_m < 1 from public.search_places(12.9716, 77.5946, 5000) limit 1), 'distance is returned');
select is((select count(*)::int from public.search_places(12.9716, 77.5946, 5000, p_types => '{medical_store}')), 1, 'filter by type');
select is((select count(*)::int from public.search_places(12.9716, 77.5946, 5000, p_emergency => true)), 1, 'filter: emergency');
select is((select count(*)::int from public.search_places(12.9716, 77.5946, 5000, p_24x7 => true)), 1, 'filter: 24x7');
select is((select count(*)::int from public.search_places(12.9716, 77.5946, 5000, p_ownership => 'government')), 1, 'filter: government');

-- Text search
select is((select name_en from public.search_places(12.9716, 77.5946, 5000, p_query => 'dental')), 'Smile Dental Clinic', 'speciality word "dental"');
select is((select name_en from public.search_places(12.9716, 77.5946, 5000, p_query => 'smile dentl')), 'Smile Dental Clinic', 'typo-tolerant name search');
select is((select name_en from public.search_places(12.9716, 77.5946, 5000, p_query => 'orthopaedic')), 'Test Trauma Hospital', '"orthopaedic" finds ortho speciality');
select is((select name_en from public.search_places(12.9716, 77.5946, 5000, p_query => 'dentl')), 'Smile Dental Clinic', 'misspelt word "dentl" still finds the dental clinic');
select is((select name_en from public.search_places(12.9716, 77.5946, 5000, p_query => 'orthopedic')), 'Test Trauma Hospital', 'US spelling "orthopedic" works');

-- Area / PIN search
select is((select name_en from public.search_places(p_pincode => '570001')), 'Mysuru Child Clinic', 'search by PIN code');
select is((select count(*)::int from public.search_places(p_district_id => (select id from public.districts where name_en = 'Mysuru'))), 1, 'search by district');

-- Access: anyone reads, nobody but admins writes
set local role anon;
select throws_ok($$ delete from public.places $$, '42501', null, 'anon cannot change places');
reset role;

select * from finish();
rollback;
