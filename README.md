# Lighter

Mobile-first weight-loss PWA (Vite + React + Supabase, hosted on Vercel).

Every push to `main` deploys to https://lighter-sigma.vercel.app automatically.

## Push reminders

Opt-in in the app under Settings → Reminders. A Supabase `pg_cron` job runs `push_tick()` every 5 minutes and posts due reminders to `/api/push`, which sends them with `web-push`. Needs the Vercel env vars `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` (never commit them). The cron secret lives only in Supabase Vault.
