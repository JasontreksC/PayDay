# AGENTS.md

## Cursor Cloud specific instructions

PayDay is a single frontend app: React 19 + TypeScript + Vite (web app). There is no
custom backend in this repo — authentication is delegated to Supabase, and ledger transactions are
stored in Supabase (`transactions` table, protected by RLS). Standard scripts live in
`package.json` (`dev`, `build`, `lint`, `preview`).

There is no local Supabase CLI stack / `supabase/config.toml` — development runs against a hosted
Supabase project. All backend config (email provider, confirm-email, OTP length/template, Site URL)
lives in the Supabase dashboard, not in this repo.

### Running the app locally

The app is gated behind Supabase auth: without valid `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` env vars, `App.tsx` renders a "Supabase 환경 변수가 설정되지 않았습니다"
config-error screen instead of the login/ledger UI. To exercise anything beyond that screen you
need a hosted Supabase project and a `.env` file:

1. Create a project at https://supabase.com and run `supabase/schema.sql` once in its SQL editor
   (SQL Editor → New query → paste the whole file → Run).
2. In the dashboard, enable the Email auth provider and set Authentication → URL Configuration →
   Site URL / Redirect URLs to your app origin (`http://localhost:5173` for local dev).
3. Create `.env` in the repo root (gitignored):
   ```
   VITE_SUPABASE_URL=https://<project-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon or sb_publishable_ key from Project Settings → API>
   ```
4. `npm run dev` and open http://localhost:5173.

### Non-obvious caveats

- Vite only reads `.env` at process start. After creating/changing `.env`, restart `npm run dev`.
- The `.env.example` file lists `VITE_SUPABASE_PUBLISHABLE_KEY`, but the code
  (`src/lib/supabase.ts`) actually reads `VITE_SUPABASE_ANON_KEY`. Use `VITE_SUPABASE_ANON_KEY`.
- `supabase/schema.sql` is the single canonical script (tables, RLS, triggers, the monthly stats
  view, the memo-encryption vault columns, and the `delete_user` function). There is no
  `supabase/migrations/` folder and no separate `delete_user.sql`/`memo_crypto.sql` fragments —
  everything lives in `schema.sql`. It begins with a guarded reset block, so it is idempotent and
  can be re-run to rebuild the `public` schema from scratch.
- Email signup uses an 8-digit OTP entered in-app (`verifyOtp`, `type: 'signup'`), not a redirect
  link. The dashboard "Confirm signup" email template must include `{{ .Token }}` for the code to
  appear. Confirm-email must be enabled in the dashboard for the OTP step to run; otherwise signup
  returns a session immediately and the app skips straight to the ledger.
