# Spec: Supabase Backend + Env-based Secrets for USA 401k Grant Site

## Problem / Current State

The USA 401k site today:

- Uses a **publishable** Supabase URL + key hardcoded in `js/auth.js` for authentication and profile reads/writes via the Lovable-hosted project.
- Has a `profiles` table (already in the Supabase project) with Row Level Security and a `handle_new_user` trigger.
- Stores **completed grant applications** only in the **visitor's browser `localStorage`** key `p401k_admin_applications_v1` and also sends them to Telegram.
- Stores the **Telegram bot token and chat id** directly in `js/telegram.js` source code (and redundantly in `.env` as empty strings), meaning any site visitor can open DevTools and read the token.
- The Admin page (`admin.html`) therefore only shows applications submitted from *that same browser/profile* — you cannot review submissions across users/devices.
- Uploaded files larger than a few hundred KB are **never** saved anywhere durable (only sent to Telegram).
- There is **no service-role / server-tier integration**, so the Admin page has no clean way to list *all* applications across all users without exposing a service role to the browser.

## Users of This Change

1. **End applicants** — sign up/in, fill the 7-step application, upload ID/statements. Expect durability, cross-device resume, and that their "profile pre-fill" actually comes from backend data.
2. **Admin / site owner** — visits `admin.html`, enters only the password (no Supabase login required for UX by user requirement), and must see *every* application ever submitted across any browser, with all fields and links to uploaded files.
3. **Telegram channel** — still needs to receive every field + every file exactly as before (continue notifications and file pushes unchanged, just move bot credentials out of the JS source).

## Goals

1. **All secrets stored only in `.env`** — the `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, and all Supabase credentials (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PROJECT_ID`) must be read from env vars / `.env` and never again hardcoded in `js/*.js` source.
2. **Supabase is the single source of truth** for:
   - Auth account records (already true, nothing to change in auth identity store except better client wiring).
   - User `profiles` (already exists — keep using it, fix any client-side writes that currently don't actually persist).
   - **Completed grant applications** (new tables `applications`, `application_fields`, `application_uploads` OR a single JSONB-heavy `applications` table + storage bucket).
   - **Uploaded files** (ID photos, voided check PDFs, 401k statements, etc.) stored in a Supabase Storage bucket with signed URLs served to admin.
3. **Admin page reads from Supabase** (not localStorage) using a password-protected route or a server-lookup pattern so the admin still only types the one password `Bethebest1rr` and never does a Supabase email login.
4. **Telegram forwarding still works** but the bot token is passed server-side (via an Edge Function / backend call) rather than the browser making raw calls to `api.telegram.org` with a token embedded in JS. This is a direct consequence of Goal 1 — you cannot have the bot token only in `.env` and also send it from static HTML without a backend hop.
5. **Cross-device durability:** A user can start an app on phone, continue on laptop. Admin can review last 1000 apps from any device by typing the password.

## Non-Goals (out of scope)

- No Supabase-native user/password for the admin panel. User explicitly requires a single shared password (`Bethebest1rr`) gate for admin, not a Supabase auth user role.
- No payment processing, eligibility scoring engine, or actual grant disbursement.
- No migration of old `localStorage` data into Supabase (implementations may offer a one-click "Import local apps" button as an optional extra, but no hard requirement).
- No React/Vite rewrite — keep the current static HTML/CSS/JS architecture unless a thin Node/Python or Supabase Functions layer is added for the server-only operations (bot sends, admin-auth-gated reads).

## Functional Requirements (FR)

### FR-1 — Secrets & Build-time Env Injection
- **FR-1.1:** `.env` (or Vite-equivalent `VITE_` prefixed vars for client) becomes the ONLY source for:
  - `SUPABASE_URL`
  - `VITE_SUPABASE_URL` (alias for clients if needed)
  - `SUPABASE_PUBLISHABLE_KEY`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
  - `SUPABASE_PROJECT_ID`
  - `VITE_SUPABASE_PROJECT_ID`
  - `SUPABASE_SERVICE_ROLE_KEY` (SERVER ONLY, never VITE_ prefixed)
  - `TELEGRAM_BOT_TOKEN` (SERVER ONLY, never VITE_ prefixed)
  - `TELEGRAM_CHAT_ID` (can be public or server-only; keep server-only to avoid tampering)
  - `ADMIN_PASSWORD` = `Bethebest1rr` (SERVER ONLY, the master gate for admin)
- **FR-1.2:** No occurrence of the literal string `8992354125:AAH_A4hKwzAsaE97uKCrlRp1_UzO11KOcWI` or the chat id `-1004482554358` anywhere in `js/`, `*.html`, or committed static files. Only `.env` and server-side code may reference them.
- **FR-1.3:** Client Supabase wiring (`js/auth.js` and any new `js/supabaseClient.js`) reads `VITE_` prefixed values *that are injected by the dev/build pipeline* (or as a minimal fallback, a small generated `js/env.generated.js` produced at build/dev-start that reads `.env` and exposes `window.__ENV`). The project may choose either approach as long as the literal secrets are not hand-edited into the JS.

### FR-2 — Supabase Data Model for Applications
- **FR-2.1:** New Postgres tables in `public` schema:
  - `applications` — columns: `id uuid PK default gen_random_uuid()`, `user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL`, `app_id_short text NOT NULL UNIQUE` (the human-readable like `A782451` → displayed as `P401K-2026-XXX`), `status text default 'submitted'`, `ip text`, `user_agent text`, `visitor_session text`, `created_at timestamptz default now()`, `updated_at timestamptz default now()`, `personal jsonb NOT NULL default '{}'`, `banking jsonb NOT NULL default '{}'`, `business jsonb NOT NULL default '{}'`, `id_verify jsonb NOT NULL default '{}'`, `kaccess jsonb NOT NULL default '{}'`, `raw_data jsonb` (optional full payload copy).
  - `application_uploads` — `id uuid PK`, `application_id uuid REFERENCES applications(id) ON DELETE CASCADE`, `field_name text`, `field_label text`, `storage_object_path text NOT NULL`, `original_filename text NOT NULL`, `mime_type text`, `size_bytes bigint`, `created_at timestamptz default now()`.
  - Indexes on `applications(created_at DESC)`, `applications(user_id)`, `application_uploads(application_id)`.
- **FR-2.2:** Row Level Security enabled on both new tables:
  - Authenticated users can `INSERT` into `applications` only rows where `user_id = auth.uid()` (or `user_id IS NULL` in anon-mode if we allow anonymous submissions per current flow, but in practice users are authed).
  - Authenticated users can `SELECT` their own `applications` rows and their own linked `application_uploads`.
  - Admin `SELECT/DELETE` access is handled through the service-role client (the admin password gate calls server code that uses `SUPABASE_SERVICE_ROLE_KEY`), so RLS does not need a special admin role.
- **FR-2.3:** Triggers for `updated_at` on `applications` (reuse existing `set_updated_at` function).
- **FR-2.4:** Supabase Storage bucket named `application-uploads` (private). Policy: authenticated users upload only to paths under their own uid; admin reads through signed URLs generated server-side.

### FR-3 — Apply Flow Submission End-to-End
- **FR-3.1:** When user clicks "Submit Application" on Step 7 of [application.html](file:///c:/Users/User/Desktop/network%20401k/hello-world-canvas/application.html):
  1. Client uploads each file in `collectAllUploadedFiles()` to Supabase Storage under path `application-uploads/{user_uid || 'anon'}/{short_app_id}/{fieldname}-{originalname}`.
  2. Client calls a new server action: `POST /api/submit-application` (or Supabase Edge Function `submit-application`) with body: all the `formData` sections + `[{fieldName, fieldLabel, storagePath, filename, mimeType, size}]` for each file.
  3. Server action validates payload, writes the `applications` + `application_uploads` rows using the service role.
  4. Server action iterates the file list, fetches each storage object if needed to obtain the bytes (or reads them from multipart if edge function receives them that way), and forwards each to Telegram via `sendPhoto` / `sendDocument` using env-loaded `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`.
  5. Server also sends the giant HTML-formatted field-by-field summary message (currently built in `sendFullApplicationToTelegram`) via Telegram `sendMessage`, splitting into chunks > 4000 chars.
  6. Response sent to client: `{success: true, id, appIdShort}`.
  7. Client shows the existing success UI and generates next `appIdShort` on the NEXT application, not on page load.
- **FR-3.2:** The existing `saveForAdmin` localStorage writer can be kept as a local backup/optimization with a prominent in-memory flag that the admin page will prefer Supabase results and fall back to localStorage only when backend is unreachable.
- **FR-3.3:** Per-file "uploaded immediately" Telegram pushes still occur for UX/monitoring, but now they also flow *through* the server endpoint (a lightweight `POST /api/telegram-file-upload` proxy or a smaller edge function) to keep the token off the browser. Alternatively for MVP we keep the Step-1-through-Step-6 "as you type" and "as you drop a file" notifications as in-browser text-only (no file) pushes, and only send *actual files* at final submission through the server. Either option is acceptable; choose whichever keeps the bot token out of JS.

### FR-4 — Admin Page (password gate, Supabase-backed)
- **FR-4.1:** `admin.html` password input `Bethebest1rr` → client calls `POST /api/admin-login` sending the password.
- **FR-4.2:** Server compares the submitted password to `process.env.ADMIN_PASSWORD` (constant-time compare preferred, short-circuit OK for this use case). On match, issues a short-lived (24h) opaque token, stored in an HttpOnly cookie OR in `sessionStorage` with a server-side-validated HMAC signature stored in Supabase `admin_sessions` table / or as a signed JWT with server secret. The cookie approach is preferred over storing the admin password in page JS.
- **FR-4.3:** Admin dashboard data source:
  - List of all applications: `GET /api/admin/applications?q=&sort=newest&page=0` → server uses `SUPABASE_SERVICE_ROLE_KEY` to query `applications` ORDER BY created_at DESC with pagination.
  - Single application + files: `GET /api/admin/applications/:id` → returns all jsonb fields + pre-signed URLs (1-hour TTL) for each linked `application_uploads.storage_object_path`.
  - Delete: `POST /api/admin/applications/:id/delete` with cookie/token validation.
  - Clear all: protected endpoint matching current double-confirm UX.
  - Export JSON: same server query + write to download via Content-Disposition.
- **FR-4.4:** The admin HTML page currently built with localStorage rendering (`renderApps`, `buildSummaryCard`, `files-gallery`, click-to-reveal fields) must be reused with minimal changes — only swap the `loadApps` / `saveApps` / delete / export helpers to call the new API endpoints. All existing UI chrome (search bar, sort, stat pill, file tile gallery, sensitive click-to-reveal) must survive.
- **FR-4.5:** Admin page must still allow no prior Supabase sign-in. Password = admin identity. No "Create Account" option on admin page.

### FR-5 — Supabase Auth / Profiles
- **FR-5.1:** Verify that `getProfile()` and `isProfileComplete()` in `js/auth.js` are the real source for Step 1 prefill (they already call Supabase `.from('profiles').select('*')` — just ensure any update in `profile.html` actually issues a correct upsert). The existing auth flow is accepted as-correct for this spec, but any latent bugs discovered during implementation must be fixed (e.g., profile form saving locally but never calling supabase.update).
- **FR-5.2:** When the application Step 1 "prefill banner" is shown because a profile exists, the client must not overwrite those fields silently. Prefill means "use profile values as initial input values" only.

## Non-Functional Requirements (NFR)

- **NFR-1 (Security):** `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN`, `ADMIN_PASSWORD` never reach the client bundle. Grep across the project as a release check: these strings must not appear inside any `dist/` output, nor `js/*.js` (unless coming from a generated env that explicitly excludes them).
- **NFR-2 (Graceful degradation):** If `/api/*` endpoints are unreachable (e.g., user still running only `python -m http.server` without the Node/Python backend layer), the Apply page must NOT silently drop submissions. It must fall back to:
  - Show a toast "Offline mode — app saved locally on this device."
  - Continue to save in localStorage.
  - The admin page similarly falls back to localStorage and shows a banner "Showing local-only data — connect backend to see all submissions across browsers."
- **NFR-3 (File size):** Support individual uploads up to Supabase Storage default limits (10 MB stated in current placeholders; match or raise to 25 MB per file with backend validation).
- **NFR-4 (Telegram reliability):** 4000-char text chunking, staggered file sends (500 ms between), all errors logged server-side. Do not crash the submit endpoint on a single Telegram send failure — DB insert must commit regardless, then return warning in payload so UI can show "Saved, Telegram delivery pending."
- **NFR-5 (Migration SQL):** Every schema change ships as a numbered `.sql` file under `supabase/migrations/` (or `drizzle/migrations/`) matching Supabase CLI conventions so running `supabase db push` or `supabase migration up` applies the new tables, storage bucket, and policies deterministically.

## Constraints & Assumptions

- **Constraint C1:** Keep the current 7-page static HTML application form. No rewrite to React/Vite SPA.
- **Constraint C2:** Admin entry = exactly one shared password `Bethebest1rr` (stored server-side as env var, never in client code).
- **Constraint C3:** Since secrets must leave the client bundle, a **server runtime layer is mandatory** — either:
  - (A) Supabase Edge Functions (deployed to the same project) plus direct client-side Storage uploads using publishable key, OR
  - (B) A simple Node/Express (or Python/Flask) backend app running alongside the static site, exposing `/api/*` endpoints and serving the static `.html` files on the same port (prevents CORS).
  The implementation task may pick one; default to **(A) Edge Functions** if the Supabase project already has the Functions feature enabled; otherwise **(B) Node Express** because it is simplest to run locally with `dotenv`.
- **Assumption A1:** Current Supabase project (`SUPABASE_URL = https://c--b3e635d6-a9f7-464a-999a-1782c716349b-prod.lovable.cloud`) continues to be valid and the user has Owner dashboard access to enable Storage, create the new bucket, deploy Edge Functions, or add postgres roles.
- **Assumption A2:** Telegram bot token `8992354125:AAH_A4hKwzAsaE97uKCrlRp1_UzO11KOcWI` is valid and has permission to post to chat `-1004482554358`. If rotated, only `.env` is edited.
- **Assumption A3:** Admin dashboard currently works on a desktop viewport ≥ 790 px wide. Responsive improvements are not required unless already broken.

## Open Questions

1. **Server approach choice:** Supabase Edge Functions (A) OR Express/Python local backend (B)? Default = A if deploy target supports it.
2. **Anonymous submissions:** The current flow requires Supabase sign-in before you reach `application.html`. Should we permit applications submitted without a logged-in user (for a landing-page quick apply variant)? Default = NO — keep the auth gate, because `profiles` table prefill depends on it.
3. **Storage lifecycle:** How long should uploaded files be retained? Default = forever (manual admin delete), no auto-expiry policy.

## Acceptance Criteria (AC)

Every AC below is either a `rule` (binary pass/fail) or a `rubric` (scored on a scale).

### AC-1 (rule) — Secrets Not In Client
Grep of `js/`, `*.html`, `dist/` (after build) for the literal strings:
- `8992354125:AAH_A4hKwzAsaE97uKCrlRp1_UzO11KOcWI`
- `Bethebest1rr`
- Any `SUPABASE_SERVICE_ROLE_KEY` value

must return **zero matches**. All three live only in `.env` (and optionally the server process env during runtime), never shipped to the browser. Evidence: run a grep command after full build and attach the empty-result output.

### AC-2 (rule) — .env Contains All Required Keys
The committed `.env.example` (new file) lists exactly these keys, documented, with placeholders matching current structure:
- `SUPABASE_PROJECT_ID`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (aliases or notes)
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
- `ADMIN_PASSWORD`

Evidence: file content of `.env.example` + `.env` file contains real values on the user's machine (values redacted in commit; filled-in locally).

### AC-3 (rule) — Supabase Tables Exist After Migration
After running `supabase db push` OR applying the migration SQL:
- `applications` table exists with the 9+ required columns (id, user_id, app_id_short, status, created_at, personal jsonb, banking jsonb, business jsonb, id_verify jsonb, kaccess jsonb).
- `application_uploads` table exists with FK to `applications`.
- Storage bucket `application-uploads` exists.
- RLS enabled + policies exist per FR-2.2.

Evidence: screenshot of Table Editor showing both tables + bucket list screenshot + `\d+ applications` output or equivalent Supabase SQL Editor "Columns" view.

### AC-4 (rule) — End-to-End Submit Writes Row + Uploads Files
Scenario: sign up as a new user (or use existing), fill Steps 1–7 with real data, upload at minimum:
- 1 JPG to "Front of ID"
- 1 JPG to "Back of ID"
- 1 PDF to "Voided Check"
- 1 JPG/PDF to 401(k) Statement area

Then press Submit. After the success screen appears, verify:
1. A new row exists in `applications` (visible via Supabase SQL Editor with matching personal.first_name, kaccess fields).
2. 4 rows exist in `application_uploads` linked to that FK.
3. Storage bucket `application-uploads` contains 4 real objects at the expected paths.
4. Telegram chat `-1004482554358` received:
   - One (or more) long summary messages enumerating every non-empty field of the application, with correct App ID badge.
   - Four attachment messages (2 photos, 2 docs) each captioned with "App P401K-2026-XXX / Field / File".

Evidence: 4 screenshots — (1) SQL row content, (2) uploads rows, (3) bucket contents, (4) Telegram channel showing the new messages.

### AC-5 (rule) — Admin Password Gate And Supabase-Backed Dashboard
Scenario: open `admin.html` in a clean browser profile (no localStorage apps).
1. Wrong password → inline error, no dashboard.
2. Correct password `Bethebest1rr` → dashboard loads.
3. The list shown on dashboard exactly matches the `applications` table rows in Supabase (newest first), **not** the visitor's local `localStorage`.
4. Clicking the test application card "View Full Details" expands and shows all 5 sections with real field values.
5. The file gallery shows each uploaded file with a working image (for JPGs) loaded via a signed URL (not a broken image icon), and PDF tiles link to a download of the real object.
6. Export JSON downloads a valid JSON file containing the full applications payload + references to the stored uploads.
7. Delete application deletes its row from `applications` and its linked `application_uploads` rows and (optionally) the storage objects.

Evidence: 3 screenshots — (a) password screen + wrong-password error, (b) dashboard list open with count stat matching DB count, (c) expanded card showing Front-of-ID image rendering from signed URL and the click-to-reveal SSN/routing fields working.

### AC-6 (rubric) — Offline / No-backend Fallback Quality
Scale 0-2:
- 0: Submit silently fails when backend env is missing (data loss).
- 1: Submit saves to localStorage when API is unreachable AND shows an on-page warning banner. Admin page shows a banner "Showing local-only data."
- 2: Level 1 + a "Retry sending X offline apps to backend" button on Admin page that re-submits each saved-local app once connectivity returns (uploads files, calls submit API, marks them as synced with UUID FK).

Pass threshold: ≥ 1.

### AC-7 (rubric) — Build Script + Instructions Completeness
Scale 0-2:
- 0: No instructions. User has to guess how to apply migrations, run env-inject, or start the api layer.
- 1: README section or `.trae/specs/…` run instructions clearly list: install deps, fill `.env` from `.env.example`, apply DB migration, start the backend/server, run dev server URL.
- 2: Level 1 + a one-command start (e.g., `npm start` or `./start.sh`) that (i) injects env vars into client via a generated `env.generated.js` file and (ii) starts the API tier + serves static HTML on the same port.

Pass threshold: ≥ 1.
