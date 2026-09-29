-- Tracks when each user was last sent a re-engagement push (see
-- supabase/functions/send-reengagement-pushes/index.ts), so the daily
-- inactivity scan doesn't nudge the same quiet user every single day —
-- once sent, they're left alone for that function's own cooldown window
-- before being eligible again.
--
-- A dedicated table rather than a column on profiles: this is bookkeeping
-- for the notification system, not part of a user's actual fitness profile,
-- and profiles only has a row for someone who's completed onboarding (this
-- needs to work for any account with a push token, full profile or not).
--
-- DEPLOY (not done by this repo — needs your own Supabase login):
--   supabase link --project-ref <your-project-ref>
--   supabase db push
-- or paste this file's contents into the Supabase dashboard's SQL editor.

create table if not exists notification_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_reengagement_sent_at timestamptz
);

alter table notification_state enable row level security;
-- Deliberately no policies — only send-reengagement-pushes (service role,
-- bypasses RLS) ever reads or writes this. A user has no legitimate reason
-- to see or change when they were last nudged, same reasoning as
-- referral_redemptions' own comment for why that table has none either.
