-- Referral system: one shareable code per user, plus a record of each
-- successful redemption. This is the app's first real Postgres table —
-- everything else in the app (profile, session history, workout log) lives
-- in AsyncStorage only, and the one existing Supabase feature
-- (delete-account) needed no table of its own.
--
-- DEPLOY (not done by this repo — needs your own Supabase login):
--   supabase link --project-ref <your-project-ref>
--   supabase db push
-- or paste this file's contents into the Supabase dashboard's SQL editor.

create table if not exists referral_codes (
  user_id uuid primary key references auth.users (id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

alter table referral_codes enable row level security;

-- The client generates a random code itself and inserts it (see
-- src/lib/referral.ts), retrying on the rare unique-constraint collision —
-- no edge function needed just to hand out a code. Select is scoped to only
-- your own row: a friend never learns a code by querying this table, only
-- through whatever the referrer actually shares (a copied string, a link).
create policy "select own referral code"
  on referral_codes for select
  using (auth.uid() = user_id);

create policy "insert own referral code"
  on referral_codes for insert
  with check (auth.uid() = user_id);

create table if not exists referral_redemptions (
  id uuid primary key default gen_random_uuid(),
  code text not null references referral_codes (code),
  referrer_id uuid not null references auth.users (id),
  referred_id uuid not null unique references auth.users (id),
  redeemed_at timestamptz not null default now(),
  reward_granted_at timestamptz
);

alter table referral_redemptions enable row level security;
-- Deliberately no policies — every read/write to this table goes through
-- the redeem-referral Edge Function (service role, bypasses RLS). Same
-- reasoning as delete-account's own comment: resolving a code to its owner
-- across two different users, rejecting self-referral, and enforcing one
-- redemption per account all need a privileged, server-verified check, not
-- a client-supplied claim.
