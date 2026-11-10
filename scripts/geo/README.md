# Karnataka geography data

`build_karnataka.py` turns open boundary files into:

- `supabase/migrations/20261112000001_karnataka_geo_data.sql` — state outline, 31 districts and their taluks (simplified to ~20 m) for the database.
- `src/lib/geo/karnataka-check.json` — a 36 KB outline for the phone's offline "inside Karnataka?" check.

Both are committed, so nobody needs to run the script to use the app. Re-run it only to change the data.

## Current source (interim)

|            |                                                                                                                        |
| ---------- | ---------------------------------------------------------------------------------------------------------------------- |
| Data       | Census 2011 state, district and sub-district (taluk) boundaries                                                        |
| From       | [github.com/datta07/INDIAN-SHAPEFILES](https://github.com/datta07/INDIAN-SHAPEFILES) `STATES/KARNATAKA/` (MIT licence) |
| Downloaded | 2026-11-10                                                                                                             |

### Fixes applied by the script

- **Vijayanagara** (31st district, 2021) built from Hosapete, Kudligi, Hagaribommanahalli, Hoovina Hadagali and Harapanahalli taluks.
- **Indi** taluk (missing from the source) rebuilt from the uncovered part of Vijayapura district.
- **Ramanagara** district named **Bengaluru South** (renamed by the state government), with "Ramanagara" kept as a former name.
- Old spellings updated (Bangalore → Bengaluru, Gulbarga → Kalaburagi, Shimoga → Shivamogga, …); old names kept in `former_names` so search still finds them.
- Invalid shapes repaired.

### Known gaps — fix before launch

1. **Taluks created after 2011 are missing** (about 60, e.g. Kushalnagar, Ponnampet, Kampli, Kurugodu, Kotturu). Their area is inside the older parent taluk.
2. **Afzalpur and Aland** are one shape in the source, named "Afzalpur / Aland".
3. **Kannada taluk names** are not filled in (`taluks.name_kn` is empty; the app shows English).
4. `lgd_code` and `is_urban` are empty.

The fix for all four is the official data: **KGIS (Karnataka GIS, KSRSAC)** boundaries plus the
**Local Government Directory (LGD)** list of districts and sub-districts (has Kannada names and codes).
Check the KGIS licence, add a loader for it here, and re-run.

The state outer boundary is not affected by these gaps; the state area matches the official 191,791 km².

## Re-running

```bash
pnpm supabase start
python3 scripts/geo/build_karnataka.py --cache ~/plusplus-geo-cache
pnpm supabase db reset && pnpm test:db
```
