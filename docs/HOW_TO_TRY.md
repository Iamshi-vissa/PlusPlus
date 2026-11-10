# How to try every feature (local)

Everything below runs on your PC with the local backend. No real SMS is sent and all places,
clinics and doctors are **fictional sample data** (their names start with "Sample").

## 0. Start everything

1. Open **Docker Desktop** and wait for "Engine running".
2. In PowerShell, in the project folder:

```powershell
git pull
pnpm install
pnpm supabase start
pnpm supabase db reset
pnpm start --clear
```

3. `.env` must contain your PC's Wi-Fi address (for the phone) and the publishable key:

```
EXPO_PUBLIC_SUPABASE_URL=http://<your-PC-IP>:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH
```

**Test phone numbers** (code is always `123456`): `99999 00001`, `99999 00002`, `99999 00003`,
`99999 00004`, `99999 00005`. Use different numbers for different "people".
After `db reset`, sign in again.

**Database viewer:** http://127.0.0.1:54323 (Supabase Studio) → _SQL editor_ for the one-line
commands below.

## 1. Sign-in, profile, emergency contacts

Profile tab → Sign in → `99999 00001` → `123456`. Add your name, change language to ಕನ್ನಡ,
then _Manage emergency contacts_ and add one.

## 2. Find care (map, list, filters)

Find care tab → _Near me_ (allow location) or _Choose area_ → _Mysuru_ → _Whole Mysuru district_,
or _PIN code_ `560001`. Try the chips (Hospitals, Open now, Emergency…), type `dentl` (typo on
purpose), switch to _Map_ (phone only). Tap a place for hours, Call and Directions.
Sample places exist around Bengaluru, Mysuru, Hubballi, Mangaluru and Belagavi. If you are
elsewhere, use _Choose area_.

## 3. Find a doctor for my problem + booking

Home → _Find a doctor for my problem_.

- Type "chest pain" in the box → you get the **emergency screen** (108 / SOS), not doctors.
- Pick _Joint or knee pain_ → Next → _Weeks or more_ / _Moderate_ / _Adult_ → see the suggestion
  ("Specialist — it has lasted weeks") → _Find doctors_ → _Book_ → pick a time → _Confirm_.
- Appointments tab: your booking with your own words; try _Reschedule_ and _Cancel_.

Doctor search needs your location near the sample clinics (Bengaluru is best).

## 4. Register a clinic (clinic side)

Profile → _Register your clinic_ → fill in, use your location, add any photo → Submit.
Approve it in the admin panel (step 7), then Profile → _Manage my clinic_: add a doctor, verify
the doctor in the admin panel, create a timetable — it now shows up in doctor search.

## 5. Become a volunteer responder

Use a **second number** (e.g. sign in on the browser with `99999 00003`): Profile → _Responder
mode_ → _Become a volunteer responder_ → fill in, add 4 photos → read the first-aid guide.
Verify the responder in the admin panel, then press **Go available**.

## 6. Emergency SOS (needs two "people")

- **Responder:** browser (`pnpm start` → press `w`) signed in as `99999 00003`, verified and
  _Available_, with the browser allowed to use location.
- **Person in need:** your phone signed in as `99999 00001`, near the responder (same area).

On the phone press **SOS** → 5-second countdown (Cancel works) → the browser shows
"Emergency nearby!" within a few seconds → _Accept_ → the phone shows "Help is on the way:
<name> …" → on the browser tap _I'm on the way_ → _Picked up_ → _Reached hospital_.
Your emergency contact's SMS (with the live link) is queued; locally it is not sent.
If nobody is available you will see "No volunteer driver is available right now. Please call
108 or 112 now."

## 7. Admin panel

1. Make yourself an admin (Studio → SQL editor):
   ```sql
   insert into public.platform_admins (user_id)
   select id from auth.users where phone = '919999900001';
   ```
2. ```powershell
   cd admin
   copy .env.example .env.local
   notepad .env.local   # put the same URL and publishable key as the app
   pnpm install
   pnpm dev
   ```
3. Open http://localhost:3001 → sign in with `99999 00001` → verify clinics, responders and
   doctors (documents open in a private 5-minute link), see reports and live SOS.

## 8. Privacy

Profile → _Privacy and your data_ → _Download my data_ / _Delete my account_.

## Running the checks yourself

```powershell
pnpm test              # app tests
pnpm test:db           # database tests (security rules, booking, SOS…)
pnpm test:integration  # real sign-in, simultaneous booking, SOS end to end
```
