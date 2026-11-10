/**
 * Import Karnataka hospitals, clinics and pharmacies from OpenStreetMap (ODbL licence:
 * credit "© OpenStreetMap contributors" in the app's About screen).
 *
 *   pnpm import:osm                       # writes supabase/.temp/osm_places.sql
 *   psql "<db url>" -f supabase/.temp/osm_places.sql
 *
 * Re-running is safe: places are matched by OSM id, and duplicates of existing places
 * (within 75 m, similar name) are merged instead of added.
 */
import { mkdirSync, writeFileSync } from 'node:fs';

import { type OsmElement, osmToPlace } from './osm';

const OVERPASS = process.env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter';
const QUERY = `
[out:json][timeout:300];
area["ISO3166-2"="IN-KA"][admin_level=4]->.ka;
(
  nwr["amenity"~"^(hospital|clinic|doctors|dentist|pharmacy)$"](area.ka);
  nwr["healthcare"~"^(hospital|clinic|doctor|dentist|pharmacy|centre)$"](area.ka);
);
out center tags;`;

async function main() {
  console.log('Downloading from OpenStreetMap (can take a few minutes)…');
  const res = await fetch(OVERPASS, { method: 'POST', body: new URLSearchParams({ data: QUERY }) });
  if (!res.ok) throw new Error(`Overpass error ${res.status}`);
  const { elements } = (await res.json()) as { elements: OsmElement[] };
  const places = elements.map(osmToPlace).filter((p) => p !== null);
  const sql = places.map((p) => {
    const { sourceId, ...data } = p;
    const json = JSON.stringify(data).replace(/'/g, "''");
    return `select public.import_place('osm', '${sourceId}', '${json}'::jsonb);`;
  });
  mkdirSync('supabase/.temp', { recursive: true });
  writeFileSync('supabase/.temp/osm_places.sql', ['begin;', ...sql, 'commit;'].join('\n') + '\n');
  console.log(
    `${elements.length} OSM elements → ${places.length} places → supabase/.temp/osm_places.sql`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
