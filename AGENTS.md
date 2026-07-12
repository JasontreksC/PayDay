# AGENTS.md

## Cursor Cloud specific instructions

PayDay is a single frontend app: React 19 + TypeScript + Vite (Telegram Mini App). There is no
custom backend in this repo — authentication is delegated to Supabase, and ledger transactions are
stored in the browser's `localStorage`. Standard scripts live in `package.json` (`dev`, `build`,
`lint`, `preview`).

### Running the app locally

The app is gated behind Supabase auth: without valid `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` env vars, `App.tsx` renders a "Supabase 환경 변수가 설정되지 않았습니다"
config-error screen instead of the login/ledger UI. To exercise anything beyond that screen you
need a running Supabase instance and a `.env` file.

For local development we run Supabase via the CLI + Docker (the CLI binary and Docker are installed
during environment setup, not by the update script):

1. Start the Docker daemon if it isn't running: `sudo dockerd` (run it in a background/tmux session;
   there is no systemd here). Verify with `sudo docker info`.
2. Start Supabase from the repo root: `sudo supabase start` (migrations in `supabase/migrations/`
   are applied automatically on first start / on `sudo supabase db reset`).
3. Create `.env` in the repo root (gitignored) pointing at the local stack. Use the key the CLI
   prints under "Publishable" as the anon key — `@supabase/supabase-js` accepts the new
   `sb_publishable_...` key wherever an anon key is expected:
   ```
   VITE_SUPABASE_URL=http://127.0.0.1:54321
   VITE_SUPABASE_ANON_KEY=sb_publishable_...   # from `sudo supabase status`
   ```
4. `npm run dev` and open http://localhost:5173.

### Non-obvious caveats

- Vite only reads `.env` at process start. After creating/changing `.env`, restart `npm run dev`.
- Email confirmations are disabled in `supabase/config.toml` (`[auth.email] enable_confirmations
  = false`), so email signup returns a session immediately — no inbox step needed for local login.
  Sent emails (password reset, etc.) are still viewable in Mailpit at http://127.0.0.1:54324.
- The `.env.example` file lists `VITE_SUPABASE_PUBLISHABLE_KEY`, but the code
  (`src/lib/supabase.ts`) actually reads `VITE_SUPABASE_ANON_KEY`. Use `VITE_SUPABASE_ANON_KEY`.
- `supabase/schema.sql` + `supabase/delete_user.sql` are the canonical hosted-dashboard scripts;
  `supabase/migrations/` mirrors them so the local CLI stack provisions the same schema. Keep the
  two in sync if you change one.
- Alternatively, instead of local Supabase you can point `.env` at a hosted Supabase project and
  run its SQL from `supabase/schema.sql` then `supabase/delete_user.sql` (see `README.md`).
