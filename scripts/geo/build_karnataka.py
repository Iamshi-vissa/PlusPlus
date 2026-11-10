#!/usr/bin/env python3
"""
Build Karnataka reference geography for plusplus (maintainers only; the app does not run this).

Outputs (both committed to the repo):
  supabase/migrations/20261112000001_karnataka_geo_data.sql  state, district and taluk boundaries
  src/lib/geo/karnataka-check.json                           small polygons for the phone's offline check

Needs: Python 3, psql, and a running local Supabase (`pnpm supabase start`), whose PostGIS does the
geometry work. Usage:
  python3 scripts/geo/build_karnataka.py --cache /path/to/download-folder

Source data and licence: see scripts/geo/README.md. Interim source until KGIS data is licensed.
"""
import argparse, hashlib, json, os, subprocess, sys, tempfile, urllib.request

BASE = 'https://raw.githubusercontent.com/datta07/INDIAN-SHAPEFILES/master/STATES/KARNATAKA/'
FILES = ['KARNATAKA_STATE.geojson', 'KARNATAKA_DISTRICTS.geojson', 'KARNATAKA_SUBDISTRICTS.geojson']
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MIGRATION = os.path.join(ROOT, 'supabase/migrations/20261112000001_karnataka_geo_data.sql')
APP_JSON = os.path.join(ROOT, 'src/lib/geo/karnataka-check.json')

SERVER_TOLERANCE_DEG = 0.0002   # ~22 m maximum shift
PHONE_BUFFER_M = 1500           # phone says "near border" within this distance of the border
PHONE_TOLERANCE_DEG = 0.005     # ~555 m shift, always smaller than the buffer

# District: (current English name, Kannada name, former names). Census 2011 name -> current.
DISTRICTS = {
    'Bagalkote': ('Bagalkote', 'ಬಾಗಲಕೋಟೆ', []),
    'Ballari': ('Ballari', 'ಬಳ್ಳಾರಿ', ['Bellary']),
    'Bangalore': ('Bengaluru Urban', 'ಬೆಂಗಳೂರು ನಗರ', ['Bangalore']),
    'Belagavi': ('Belagavi', 'ಬೆಳಗಾವಿ', ['Belgaum']),
    'Bengaluru Rural': ('Bengaluru Rural', 'ಬೆಂಗಳೂರು ಗ್ರಾಮಾಂತರ', ['Bangalore Rural']),
    'Bidar': ('Bidar', 'ಬೀದರ್', []),
    'Chamarajanagara': ('Chamarajanagara', 'ಚಾಮರಾಜನಗರ', ['Chamarajanagar']),
    'Chikkaballapura': ('Chikkaballapura', 'ಚಿಕ್ಕಬಳ್ಳಾಪುರ', []),
    'Chikkamagaluru': ('Chikkamagaluru', 'ಚಿಕ್ಕಮಗಳೂರು', ['Chikmagalur']),
    'Chitradurga': ('Chitradurga', 'ಚಿತ್ರದುರ್ಗ', []),
    'Dakshina Kannada': ('Dakshina Kannada', 'ದಕ್ಷಿಣ ಕನ್ನಡ', []),
    'Davanagere': ('Davanagere', 'ದಾವಣಗೆರೆ', []),
    'Dharwad': ('Dharwad', 'ಧಾರವಾಡ', []),
    'Gadag': ('Gadag', 'ಗದಗ', []),
    'Hassan': ('Hassan', 'ಹಾಸನ', []),
    'Haveri': ('Haveri', 'ಹಾವೇರಿ', []),
    'Kalaburagi': ('Kalaburagi', 'ಕಲಬುರಗಿ', ['Gulbarga']),
    'Kodagu': ('Kodagu', 'ಕೊಡಗು', ['Coorg']),
    'Kolar': ('Kolar', 'ಕೋಲಾರ', []),
    'Koppal': ('Koppal', 'ಕೊಪ್ಪಳ', []),
    'Mandya': ('Mandya', 'ಮಂಡ್ಯ', []),
    'Mysuru': ('Mysuru', 'ಮೈಸೂರು', ['Mysore']),
    'Raichur': ('Raichur', 'ರಾಯಚೂರು', []),
    'Ramanagara': ('Bengaluru South', 'ಬೆಂಗಳೂರು ದಕ್ಷಿಣ', ['Ramanagara']),
    'Shivamogga': ('Shivamogga', 'ಶಿವಮೊಗ್ಗ', ['Shimoga']),
    'Tumakuru': ('Tumakuru', 'ತುಮಕೂರು', ['Tumkur']),
    'Udupi': ('Udupi', 'ಉಡುಪಿ', []),
    'Uttara Kannada': ('Uttara Kannada', 'ಉತ್ತರ ಕನ್ನಡ', []),
    'Vijayapura': ('Vijayapura', 'ವಿಜಯಪುರ', ['Bijapur']),
    'Yadgir': ('Yadgir', 'ಯಾದಗಿರಿ', []),
    # Created in 2021 from Ballari (+ Harapanahalli from Davanagere); built from its taluks below.
    '(new) Vijayanagara': ('Vijayanagara', 'ವಿಜಯನಗರ', []),
}

# Census 2011 taluk name -> (current English name, district key above or None to keep).
TALUKS = {
    'Bagalkot': ('Bagalkote', None), 'Bellary': ('Ballari', None),
    'Hadagalli': ('Hoovina Hadagali', '(new) Vijayanagara'),
    'Hagaribommanahalli': ('Hagaribommanahalli', '(new) Vijayanagara'),
    'Hospet': ('Hosapete', '(new) Vijayanagara'), 'Kudligi': ('Kudligi', '(new) Vijayanagara'),
    'Harapanahalli': ('Harapanahalli', '(new) Vijayanagara'),
    'Bangalore East': ('Bengaluru East', None), 'Bangalore North': ('Bengaluru North', None),
    'Bangalore South': ('Bengaluru South', None), 'Athni': ('Athani', None),
    'Belgaum': ('Belagavi', None), 'Parasgad': ('Savadatti', None), 'Raybag': ('Raibag', None),
    'Sampgaon': ('Bailhongal', None), 'Dod Ballapur': ('Doddaballapura', None),
    'Homnabad': ('Humnabad', None), 'Chamarajanagar': ('Chamarajanagara', None),
    'Kollegal': ('Kollegala', None), 'Chikmagalur': ('Chikkamagaluru', None),
    'Sidlaghatta': ('Shidlaghatta', None), 'Bantval': ('Bantwal', None),
    'Beltangadi': ('Belthangady', None), 'Mangalore': ('Mangaluru', None), 'Sulya': ('Sullia', None),
    'Hubli': ('Hubballi', None), 'Kalghatgi': ('Kalaghatagi', None),
    'Hole Narsipur': ('Holenarasipura', None), 'Byadgi': ('Byadagi', None),
    'Ranibennur': ('Ranebennur', None), 'Gulbarga': ('Kalaburagi', None),
    # Source error: this shape covers both Afzalpur and Aland taluks.
    'Afzalpur': ('Afzalpur / Aland', None),
    'Somvarpet': ('Somwarpet', None), 'Gangawati': ('Gangavathi', None), 'Yelbarga': ('Yelburga', None),
    'Krishnarajpet': ('Krishnarajapete', None), 'Shrirangapattana': ('Srirangapatna', None),
    'Heggadadevankote': ('Heggadadevanakote', None), 'Mysore': ('Mysuru', None),
    'Tirumakudal - Narsipur': ('Tirumakudalu Narasipura', None), 'Sindhnur': ('Sindhanur', None),
    'Shimoga': ('Shivamogga', None), 'Sorab': ('Soraba', None),
    'Chiknayakanhalli': ('Chikkanayakanahalli', None), 'Tumkur': ('Tumakuru', None),
    'Karkal': ('Karkala', None), 'Supa': ('Joida', None), 'Bijapur': ('Vijayapura', None),
    'Shahpur': ('Shahapur', None),
}


def psql(sql: str, capture=False) -> str:
    env = dict(os.environ, PGPASSWORD=os.environ.get('PGPASSWORD', 'postgres'))
    cmd = ['psql', '-h', '127.0.0.1', '-p', '54322', '-U', 'postgres', '-d', 'postgres',
           '-v', 'ON_ERROR_STOP=1', '-q', '-At']
    with tempfile.NamedTemporaryFile('w', suffix='.sql', delete=False, encoding='utf-8') as f:
        f.write(sql)
    try:
        out = subprocess.run(cmd + ['-f', f.name], env=env, check=True, capture_output=capture, text=True)
        return out.stdout if capture else ''
    finally:
        os.unlink(f.name)


def q(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument('--cache', required=True, help='folder for the downloaded source files')
    args = ap.parse_args()
    os.makedirs(args.cache, exist_ok=True)

    sha = {}
    for name in FILES:
        path = os.path.join(args.cache, name)
        if not os.path.exists(path):
            print('downloading', name)
            urllib.request.urlretrieve(BASE + name, path)
        sha[name] = hashlib.sha256(open(path, 'rb').read()).hexdigest()

    # 1. Stage raw features.
    stage = ['drop schema if exists geo_src cascade; create schema geo_src;',
             'create table geo_src.raw(kind text, props jsonb, geom extensions.geometry);']
    for name, kind in zip(FILES, ['state', 'district', 'taluk']):
        for ft in json.load(open(os.path.join(args.cache, name), encoding='utf-8'))['features']:
            stage.append(
                f"insert into geo_src.raw values ('{kind}', {q(json.dumps(ft['properties']))}, "
                f"extensions.st_setsrid(extensions.st_geomfromgeojson({q(json.dumps(ft['geometry']))}), 4326));")
    psql('\n'.join(stage))

    # 2. Clean, rename and rebuild in PostGIS.
    district_rows = ',\n'.join(
        f"({q(k)}, {q(v[0])}, {q(v[1])}, {q('{' + ','.join(v[2]) + '}')}::text[])" for k, v in DISTRICTS.items())
    taluk_rows = ',\n'.join(
        f"({q(k)}, {q(v[0])}, {('NULL' if v[1] is None else q(v[1]))})" for k, v in TALUKS.items())
    psql(f"""
set search_path = geo_src, public, extensions;
create table dmap(src text, name_en text, name_kn text, former text[]);
insert into dmap values {district_rows};
create table tmap(src text, name_en text, district_src text);
insert into tmap values {taluk_rows};

create table taluk as
select coalesce(m.name_en, r.props->>'sdtname') name_en,
       case when m.name_en is not null and m.name_en <> r.props->>'sdtname' then array[r.props->>'sdtname'] else '{{}}' end former,
       coalesce(m.district_src, r.props->>'dtname') district_src,
       nullif(r.props->>'sdtcode11', '') census_code,
       st_multi(st_collectionextract(st_makevalid(r.geom), 3)) geom
from raw r left join tmap m on m.src = r.props->>'sdtname'
where r.kind = 'taluk';

-- Indi taluk (Vijayapura) is missing from the source: rebuild it from the uncovered part of the district.
insert into taluk
select 'Indi', '{{}}', 'Vijayapura', null,
       st_multi(st_collectionextract(st_makevalid(st_difference(d.geom, (select st_union(geom) from taluk where district_src = 'Vijayapura'))), 3))
from raw d where d.kind = 'district' and d.props->>'dtname' = 'Vijayapura';
-- drop slivers left over from the difference
update taluk set geom = (select st_multi(st_union(g.geom)) from st_dump(taluk.geom) g where st_area(g.geom::geography) > 1e6)
where name_en = 'Indi';

create table district as
select m.name_en, m.name_kn, m.former, st_multi(st_union(t.geom)) geom
from taluk t join dmap m on m.src = t.district_src group by m.name_en, m.name_kn, m.former;

create table state as select st_multi(st_union(geom)) geom from district;
""")

    # 3. Checks before writing anything.
    checks = psql("""
set search_path = geo_src, public, extensions;
select json_build_object(
  'districts', (select count(*) from district),
  'taluks', (select count(*) from taluk),
  'unmapped_districts', (select count(*) from taluk t where not exists (select 1 from dmap m where m.src = t.district_src)),
  'state_km2', (select round(st_area(geom::geography)/1e6) from state),
  'raw_state_km2', (select round(st_area(geom::geography)/1e6) from raw where kind = 'state'),
  'all_valid', (select bool_and(st_isvalid(geom)) from taluk));
""", capture=True)
    stats = json.loads(checks.strip().splitlines()[-1])
    print('checks:', stats)
    assert stats['districts'] == 31, 'expected 31 districts'
    assert stats['unmapped_districts'] == 0
    assert abs(stats['state_km2'] - stats['raw_state_km2']) < 50, 'state outline changed'

    # 4. Export the migration (data only; tables are created by the previous migration).
    rows = psql(f"""
set search_path = geo_src, public, extensions;
select json_build_object(
  'state', (select st_asgeojson(st_multi(st_simplifypreservetopology(geom, {SERVER_TOLERANCE_DEG})), 5) from state),
  'districts', (select json_agg(json_build_object('name_en', name_en, 'name_kn', name_kn, 'former', former,
       'geom', st_asgeojson(st_multi(st_simplifypreservetopology(geom, {SERVER_TOLERANCE_DEG})), 5)) order by name_en) from district),
  'taluks', (select json_agg(json_build_object('name_en', t.name_en, 'district', m.name_en, 'former', t.former,
       'census_code', t.census_code,
       'geom', st_asgeojson(st_multi(st_simplifypreservetopology(t.geom, {SERVER_TOLERANCE_DEG})), 5)) order by m.name_en, t.name_en)
     from taluk t join dmap m on m.src = t.district_src),
  'phone_inner', (select st_asgeojson(st_multi(st_simplifypreservetopology(st_buffer(geom::geography, -{PHONE_BUFFER_M})::geometry, {PHONE_TOLERANCE_DEG})), 4) from state),
  'phone_outer', (select st_asgeojson(st_multi(st_simplifypreservetopology(st_buffer(geom::geography, {PHONE_BUFFER_M})::geometry, {PHONE_TOLERANCE_DEG})), 4) from state));
""", capture=True)
    data = json.loads(rows.strip().splitlines()[-1])

    source = ('Census 2011 boundaries via github.com/datta07/INDIAN-SHAPEFILES (MIT); '
              'Vijayanagara and Indi rebuilt; interim until KGIS data is licensed')
    out = [
        '-- GENERATED by scripts/geo/build_karnataka.py. Do not edit by hand; re-run the script.',
        f'-- Source: {source}.',
        '-- Source files (sha256): ' + ', '.join(f'{k} {v[:16]}' for k, v in sha.items()),
        f'-- Simplified to ~{round(SERVER_TOLERANCE_DEG * 111000)} m. Kannada taluk names are not filled in yet.',
        '',
        'insert into public.karnataka_boundary (id, geom, source) values (1, '
        f"extensions.st_geomfromgeojson({q(data['state'])})::extensions.geography, {q(source)});",
        '',
    ]
    for i, d in enumerate(data['districts'], start=1):
        out.append(
            'insert into public.districts (id, name_en, name_kn, former_names, geom) values '
            f"({i}, {q(d['name_en'])}, {q(d['name_kn'])}, {q('{' + ','.join(json.dumps(x) for x in d['former']) + '}')}, "
            f"extensions.st_geomfromgeojson({q(d['geom'])})::extensions.geography);")
    out.append('')
    for i, t in enumerate(data['taluks'], start=1):
        census = 'null' if t['census_code'] is None else q(t['census_code'])
        out.append(
            'insert into public.taluks (id, district_id, name_en, former_names, census2011_code, geom) values '
            f"({i}, (select id from public.districts where name_en = {q(t['district'])}), {q(t['name_en'])}, "
            f"{q('{' + ','.join(json.dumps(x) for x in t['former']) + '}')}, {census}, "
            f"extensions.st_geomfromgeojson({q(t['geom'])})::extensions.geography);")
    with open(MIGRATION, 'w', encoding='utf-8', newline='\n') as f:
        f.write('\n'.join(out) + '\n')

    phone = {
        'about': 'GENERATED by scripts/geo/build_karnataka.py. Karnataka outline shrunk (inner) and grown (outer) '
                 f'by {PHONE_BUFFER_M} m, for an offline check on the phone. The server makes the final decision.',
        'bufferM': PHONE_BUFFER_M,
        'inner': json.loads(data['phone_inner'])['coordinates'],
        'outer': json.loads(data['phone_outer'])['coordinates'],
    }
    with open(APP_JSON, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(phone, f, separators=(',', ':'))

    psql('drop schema geo_src cascade;')
    print('wrote', os.path.relpath(MIGRATION, ROOT), f'({os.path.getsize(MIGRATION) // 1024} KB)')
    print('wrote', os.path.relpath(APP_JSON, ROOT), f'({os.path.getsize(APP_JSON) // 1024} KB)')


if __name__ == '__main__':
    sys.exit(main())
