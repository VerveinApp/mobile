-- Replaces the Goals feature's weekly-calorie-burn goal with a target-lift
-- goal (an exercise name + a target weight, compared against
-- exercise-performance.ts's own real logged estimated-1RM history) — the
-- old goal mostly just re-measured session completion dressed up in kcal,
-- and didn't fit a strength-programming app's own identity. Adds the two
-- new columns; deliberately does NOT drop weekly_calorie_burn_goal (added by
-- 20260907000000_profile_goals_fields.sql) — dropping a live column is a
-- separate, harder-to-reverse decision than adding one, and the app no
-- longer reads or writes it either way, so it's just an inert leftover.
--
-- DEPLOY (not done by this repo — needs your own Supabase login):
--   supabase link --project-ref <your-project-ref>
--   supabase db push
-- or paste this file's contents into the Supabase dashboard's SQL editor.
-- See 20260903010000_profile_sync.sql for the table this extends.

alter table profiles
  add column if not exists target_lift_exercise text,
  add column if not exists target_lift_weight_kg text;
