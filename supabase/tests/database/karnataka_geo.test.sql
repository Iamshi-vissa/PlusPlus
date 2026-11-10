-- Karnataka geography: boundary check, district/taluk lookup, read-only access.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);

select is((select count(*)::int from public.districts), 31, 'all 31 districts are loaded');
select ok((select count(*) from public.taluks) >= 175, 'taluks are loaded');
select is(
  (select count(*)::int from public.districts d where not exists (select 1 from public.taluks t where t.district_id = d.id)),
  0, 'every district has taluks');
select ok(
  (select round(extensions.st_area(geom) / 1e6) between 191000 and 192500 from public.karnataka_boundary),
  'state area is about 191,791 km²');

-- Inside Karnataka
select ok(public.is_in_karnataka(12.9716, 77.5946), 'Bengaluru is inside');
select ok(public.is_in_karnataka(12.2958, 76.6394), 'Mysuru is inside');
select ok(public.is_in_karnataka(15.3647, 75.1240), 'Hubballi is inside');
select ok(public.is_in_karnataka(12.8703, 74.8423), 'Mangaluru is inside');
select ok(public.is_in_karnataka(15.8497, 74.4977), 'Belagavi (near the Maharashtra border) is inside');
select ok(public.is_in_karnataka(17.9104, 77.5199), 'Bidar is inside');

-- Outside Karnataka
select ok(not public.is_in_karnataka(13.0827, 80.2707), 'Chennai is outside');
select ok(not public.is_in_karnataka(17.3850, 78.4867), 'Hyderabad is outside');
select ok(not public.is_in_karnataka(15.4909, 73.8278), 'Panaji, Goa is outside');
select ok(not public.is_in_karnataka(12.7409, 77.8253), 'Hosur (Tamil Nadu, next to Bengaluru) is outside');
select ok(not public.is_in_karnataka(12.4996, 74.9869), 'Kasaragod (Kerala) is outside');
select ok(not public.is_in_karnataka(91, 0), 'invalid coordinates are outside');

-- District / taluk lookup
select is((select district_name_en from public.locate_in_karnataka(12.9716, 77.5946)), 'Bengaluru Urban', 'Bengaluru → Bengaluru Urban');
select is((select district_name_kn from public.locate_in_karnataka(12.9716, 77.5946)), 'ಬೆಂಗಳೂರು ನಗರ', 'Kannada district name');
select is((select district_name_en from public.locate_in_karnataka(12.2958, 76.6394)), 'Mysuru', 'Mysuru → Mysuru');
select is((select district_name_en from public.locate_in_karnataka(15.2689, 76.3909)), 'Vijayanagara', 'Hosapete → Vijayanagara (new 2021 district)');
select is((select taluk_name_en from public.locate_in_karnataka(17.1700, 75.9600)), 'Indi', 'Indi town → Indi taluk (rebuilt)');
select is((select count(*)::int from public.locate_in_karnataka(13.0827, 80.2707)), 0, 'Chennai → no district');

-- Read-only reference data
set local role anon;
select ok((select count(*) from public.districts) = 31, 'anyone can read districts');
select throws_ok($$ delete from public.districts $$, '42501', null, 'nobody can change districts through the API');
reset role;

select * from finish();
rollback;
