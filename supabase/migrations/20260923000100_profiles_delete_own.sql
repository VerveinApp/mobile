-- Lets a signed-in user delete their own synced profile row — used by
-- Settings' "Delete My Data" (see src/lib/profile-sync.ts's
-- deleteRemoteProfile).
--
-- BUG FIX: Delete My Data promised to permanently clear your profile, but
-- only ever cleared this device — the synced copy in `profiles` (sex,
-- height, weight, age, health conditions, movement restrictions) stayed on
-- the server until the whole account was deleted. 20260903010000_profile_sync.sql
-- deliberately granted only select/insert/update, so the client had no way
-- to remove it even if it tried.
--
-- DEPLOY (not done by this repo — needs your own Supabase login):
--   supabase link --project-ref <your-project-ref>
--   supabase db push

grant delete on profiles to authenticated;

create policy "delete own profile"
  on profiles for delete
  using (auth.uid() = user_id);
