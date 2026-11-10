# plusplus

A healthcare and emergency-help app for **Karnataka, India**.

1. **Find care nearby** — hospitals, clinics and medical stores around you or in any area you choose.
2. **Find the right doctor and book** — pick your problem, get the best-matched doctors near you, and book at registered clinics and hospitals.
3. **Emergency SOS** — alert nearby volunteer auto-rickshaw and car drivers who can take an injured person to the nearest hospital.

> plusplus **adds to** emergency services; it does not replace them. In an emergency, call **108** (ambulance) or **112** (national emergency number).

## Status

Phases 1–9 of the build plan are built and tested; phase 10 (pilot launch) is a checklist in [docs/LAUNCH_CHECKLIST.md](docs/LAUNCH_CHECKLIST.md). To try every feature locally, follow [docs/HOW_TO_TRY.md](docs/HOW_TO_TRY.md).

What's built:

- App shell with four tabs: Home, Find care, Appointments, Profile
- Home screen with the SOS button and one-tap **Call 108** / **Call 112** buttons
- English and Kannada, switchable from the Profile tab (saved to your account when signed in)
- Sign in with your mobile number and a one-time SMS code
- Profile (name, language) and up to 5 emergency contacts
- Database security rules (Row Level Security) so nobody can read another person's data, with tests
- Karnataka map data: state border, 31 districts and their taluks, with an "inside Karnataka?" check that works offline on the phone
- **Find care:** hospitals, clinics and medical stores near you, in a district/taluk, or by PIN code; filters (open now, 24×7, emergency, government/private), typo-tolerant search by name or speciality, list and map views, details with call and directions
- **Find a doctor for my problem:** common problems, body areas or your own words; quick follow-up questions; red-flag check that sends emergencies to 108 / SOS first; General / Specialist / Not sure with a suggestion and reason; ranked doctors with "Best match" and a "why" line
- **Appointments:** book (two people can never get the same slot), cancel and reschedule up to the clinic's cut-off, reminders queued, reviews only after a completed visit
- **Clinics:** register with a registration certificate (verified by plusplus), add doctors and timetables, see bookings with the patient's own description, mark visits completed or no-show
- **Volunteer responders:** sign up with vehicle and licence details and photos (private), read the first-aid and safe-transport guide, get verified, go Available / Unavailable; location shared every ~30 s while available and never shown to the public
- **Emergency SOS:** 5-second countdown with Cancel; nearby verified drivers alerted in waves of 3 (2 → 5 → 8 km); first to accept is assigned; live "who is coming and how far"; nearest emergency hospital chosen; emergency contacts get an SMS with a live-location link; 108 / 112 on every SOS screen
- **Admin panel** (`admin/`, web): verify clinics, responders and doctors (with private documents), handle reports, warn / pause people who send fake SOS alerts, watch live SOS
- **Privacy and safety nets:** download or delete your data, SOS location trails deleted after 90 days, admin audit log, offline banner (108 / 112 still work), crash screen that keeps 108 / 112, report wrong information
- Home screen "Your area" card: uses your location to show your taluk and district, or that plusplus is only available in Karnataka

The full design and build plan are in [PROJECT.md](PROJECT.md).

## Tech stack

- **App:** React Native + Expo (TypeScript, expo-router)
- **Backend:** Supabase (Postgres + PostGIS, Auth, Realtime, Edge Functions)
- **Languages:** i18next (English, Kannada)
- **Tests and lint:** Jest + React Native Testing Library, ESLint, Prettier

## Getting started

You need Node.js 20+ and [pnpm](https://pnpm.io).

```bash
pnpm install
cp .env.example .env   # then fill in the values
pnpm start             # Expo dev server; scan the QR code with Expo Go, or press "a" for an Android emulator
```

### Commands

| Command          | What it does                         |
| ---------------- | ------------------------------------ |
| `pnpm start`     | Start the Expo dev server            |
| `pnpm android`   | Run on an Android emulator or device |
| `pnpm test`      | Run the tests                        |
| `pnpm lint`      | ESLint + Prettier check              |
| `pnpm typecheck` | TypeScript check                     |
| `pnpm format`    | Format the code with Prettier        |

### Local backend (for sign-in)

Needs [Docker](https://www.docker.com/products/docker-desktop/) running.

```bash
pnpm supabase start      # starts a local Supabase and prints its URL and keys
```

Put the printed `API_URL` and `ANON_KEY` into `.env` as `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`, then restart `pnpm start`. To test on a phone, use your computer's Wi-Fi IP address instead of `127.0.0.1`.

Sign in with **99999 00001** or **99999 00002** and the code **123456** (local test numbers; no SMS is sent).

```bash
pnpm test:db             # database security tests
pnpm test:integration    # app ↔ database tests
```

Without Supabase keys the app still runs; the Profile tab just says sign-in isn't set up.

### Admin panel

```bash
cd admin
cp .env.example .env.local   # same URL and key as the app
pnpm install
pnpm dev                     # http://localhost:3001
```

Make yourself an admin first (see "Operations" in [PROJECT.md](PROJECT.md)).

## Project layout

```
app/        Screens (expo-router)
src/        Components, features, i18n, helpers and pure business logic
supabase/   Migrations, seed data and Edge Functions
admin/      Admin web panel (Next.js)
tests/      Tests
```

## Data sources

Karnataka boundaries: Census 2011 via [INDIAN-SHAPEFILES](https://github.com/datta07/INDIAN-SHAPEFILES) (MIT), adjusted for current districts. Interim; see [scripts/geo/README.md](scripts/geo/README.md).

## Licence

[MIT](LICENSE)
