# Pilot launch checklist (Bengaluru first)

Phase 10 of the build plan is real-world work. The code is ready for a pilot **only after** the
items marked ⚠️ are done. Tick them off in order.

## 1. Accounts and keys (owner: you)

- [ ] ⚠️ **Hosted Supabase project** (region: Mumbai). Push migrations: `pnpm supabase link` →
      `pnpm supabase db push`. Do **not** load `supabase/seed` (sample data) there.
- [ ] ⚠️ **Phone OTP via MSG91**: DLT registration (principal entity + sender ID + the exact SMS
      texts in `supabase/functions/_shared/templates.ts`), then a Supabase "Send SMS" auth hook.
      Remove the test numbers from production auth settings.
- [ ] ⚠️ **Push notifications**: Expo/EAS project id in `app.json` (`extra.eas.projectId`), FCM for
      Android; deploy `send-notifications` with its secrets and schedule it every 10 s.
- [ ] **Google Maps** key (Android, restricted to the app's package + signing fingerprint) and
      server-side **Places / Routes** keys (Supabase secrets only).
- [ ] **Masked calling** (Exotel or similar) — until then the SOS screens say calls are not set up.
- [ ] **Problem matcher**: deploy `suggest-problems` and set `ANTHROPIC_API_KEY` as a Supabase secret
      (never in Vercel or the app). Have the doctor reviewing the problem list also try ~30 real
      descriptions in English and Kannada.
- [ ] Crash reporting (e.g. Sentry) wired into `src/components/CrashScreen.tsx`, with no personal data.

## 2. Reviews by experts (owner: you)

- [ ] ⚠️ **Doctor review** of the problem → speciality table and red-flag keywords
      (`supabase/migrations/20261114000000_doctors_booking.sql`, `src/features/doctors/redFlags.ts`).
- [ ] ⚠️ **Doctor / first-aid trainer review** of the responder guide (`guide.*` in `src/i18n`).
- [ ] ⚠️ **Lawyer review** of the Good Samaritan summary, privacy notice, consent wording and
      terms of use (DPDP Act 2023; KPME Act for clinics; liability for volunteer transport).
- [ ] Native Kannada speaker review of `src/i18n/kn.json` and the SMS templates.

## 3. Data

- [ ] ⚠️ Replace interim boundaries with **KGIS** data (licence) + **LGD** taluk list with Kannada
      names and post-2018 taluks (`scripts/geo/README.md`).
- [ ] Load real places: `pnpm import:osm`, then HFR (needs ABDM onboarding) / Google Places;
      spot-check emergency and 24×7 flags for every hospital in the pilot area.
- [ ] Set `taluks.is_urban` (5 km vs 20 km search radius).

## 4. Pilot operations (Bengaluru)

- [ ] Recruit and verify the first responders (aim for ≥ 3 within 2 km of each pilot zone at peak
      hours); brief them in person; give them the guide.
- [ ] Register and verify 10–20 clinics; check KPME certificates and doctor registrations.
- [ ] Decide who watches the admin panel during pilot hours and how they reach the police / 108
      if something goes wrong.
- [ ] Inform local police and 108 (GVK EMRI) about the pilot; plusplus adds to 108, never replaces it.
- [ ] Run a **drill** per zone: staged SOS, measure time to alert, accept, arrival.

## 5. Before every release

- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:db`, `pnpm test:integration` all pass.
- [ ] Test on a **low-end Android phone** (2–3 GB RAM, Android 10+) on a 3G-like connection:
      SOS countdown, 108/112 buttons offline, responder alert with the screen locked.
- [ ] Check that 108 / 112 buttons are on every SOS screen.

## 6. Expand district by district

- [ ] Coverage check: SOS points with no responder within 5 km (admin; H3 heatmap is a later task).
- [ ] Add districts one at a time once each has responders and verified hospitals.
