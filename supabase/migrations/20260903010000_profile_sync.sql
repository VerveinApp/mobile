-- Cross-device profile sync: mirrors the durable local profile
-- (lib/user-profile.ts's UserProfile, saved once onboarding completes and
-- updated from Settings after) to a real table, one row per account.
--
-- Without this, sign-in only ever proved identity — a returning user on a
-- new device or after a reinstall had no local profile and no way to get
-- one back, so auth/verify.tsx's own "no local profile" branch routed them
-- through the entire onboarding questionnaire again even though their
-- account was real. This table plus lib/profile-sync.ts closes that: every
-- local save best-effort pushes here too, and verify.tsx checks here before
-- falling back to onboarding.
--
-- DEPLOY (not done by this repo — needs your own Supabase login):
--   supabase link --project-ref <your-project-ref>
--   supabase db push
-- or paste this file's contents into the Supabase dashboard's SQL editor.

create table if not exists profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text,
  goal text,
  experience text,
  environment text,
  duration text,
  commitment_level text,
  -- Comma-separated lowercase weekday names, same encoding as the local
  -- UserProfile.days field — kept identical rather than normalized into a
  -- real array column so pushProfileToRemote/pullProfileFromRemote can
  -- round-trip this field with zero transformation.
  days text,
  health_consent text,
  health_consented_at timestamptz,
  sex text,
  height_cm text,
  weight_kg text,
  conditions text[],
  movement_restrictions text[],
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;

-- Same three-policy shape as any single-owner table in this app: a user can
-- only ever see or touch their own row. Unlike referral_codes (insert-once),
-- this profile changes over time from Settings, so update is real here too.
create policy "select own profile"
  on profiles for select
  using (auth.uid() = user_id);

create policy "insert own profile"
  on profiles for insert
  with check (auth.uid() = user_id);

create policy "update own profile"
  on profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update on profiles to authenticated;
