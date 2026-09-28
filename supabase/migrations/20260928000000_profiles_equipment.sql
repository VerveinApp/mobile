-- The equipment someone has for a home gym or minimal setup
-- (lib/owned-equipment.ts's ids, comma-separated like `days` — the same
-- zero-transformation round trip). Without it, a reinstall or new device
-- restored everything but this list, and plans fell back to the setup's
-- default kit until it was answered again. Already covered by the Privacy
-- Policy's "available equipment" in the synced training profile.
--
-- Safe to deploy before or after the app update that writes it:
-- lib/profile-sync.ts retries a push without this column when it isn't
-- there yet, so nothing else stops syncing in between.
--
-- DEPLOY: supabase db push (or paste into the Supabase SQL editor).

alter table profiles add column if not exists equipment text;
