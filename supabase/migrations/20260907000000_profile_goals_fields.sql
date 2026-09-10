-- Adds the three fields the Goals feature introduced to UserProfile
-- (age, targetWeightKg, weeklyCalorieBurnGoal) — found missing from the
-- profiles table in a later full-app audit. Without these columns,
-- pushProfileToRemote/pullProfileFromRemote had nowhere to round-trip them,
-- so a user who set a target weight or weekly burn goal locally silently
-- lost both on sign-in from a new device or after a reinstall, even though
-- every other profile field (sex, height, weight, conditions, ...) already
-- synced correctly through this same mechanism.
--
-- DEPLOY (not done by this repo — needs your own Supabase login):
--   supabase link --project-ref <your-project-ref>
--   supabase db push
-- or paste this file's contents into the Supabase dashboard's SQL editor.
-- See 20260903010000_profile_sync.sql for the table this extends.

alter table profiles
  add column if not exists age text,
  add column if not exists target_weight_kg text,
  add column if not exists weekly_calorie_burn_goal text;
