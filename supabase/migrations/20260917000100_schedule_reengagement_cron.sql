-- Schedules the daily inactivity scan (see
-- supabase/functions/send-reengagement-pushes/index.ts) via pg_cron calling
-- the deployed Edge Function over HTTP through pg_net — Supabase's own
-- documented pattern for a scheduled job that needs to run real application
-- logic (Postgres alone can query push_tokens, but can't POST to Expo's
-- push API from inside a SQL function).
--
-- No Authorization header, and the function must be deployed with
-- --no-verify-jwt (see that file's own DEPLOY block): this avoids needing a
-- Vault-stored service-role key just to authorize a scheduled call to a
-- function that takes no per-caller input and only ever does the same
-- full-table scan regardless of who calls it. The only real cost of
-- skipping verification is that anyone who guessed the function's URL could
-- also trigger a scan — harmless here since the function is idempotent
-- within its own cooldown window (see RENOTIFY_COOLDOWN_DAYS), not because
-- the URL is meant to be secret.
--
-- DEPLOY (not done by this repo — needs your own Supabase login, AND the
-- function itself must already be deployed — see its own DEPLOY block —
-- before this schedule has anything to call):
--   supabase link --project-ref <your-project-ref>
--   supabase db push
-- or paste this file's contents into the Supabase dashboard's SQL editor,
-- AFTER send-reengagement-pushes has been deployed.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

select cron.schedule(
  'send-reengagement-pushes-daily',
  '0 15 * * *', -- 15:00 UTC daily — mid-afternoon US time, evening EU time
  $$
  select net.http_post(
    url := 'https://bviqknpdxqfsfofpybgp.supabase.co/functions/v1/send-reengagement-pushes',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);
