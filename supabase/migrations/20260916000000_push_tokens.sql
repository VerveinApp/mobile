-- Remote push notification tokens — one row per device, not folded into
-- profiles (a single-row-per-account table): the same account can be signed
-- in on more than one device, and each needs its own Expo push token kept
-- or removed independently of the others.
--
-- This table only stores tokens. It does not send anything by itself —
-- actually sending a remote push still needs its own trigger (a scheduled
-- Edge Function, a database webhook, etc.) posting to Expo's push API
-- (https://exp.host/--/api/v2/push/send) with the tokens read from here.
-- That trigger doesn't exist yet; this migration is the registration side
-- only, so a real notification has somewhere to be sent to once a specific
-- send-worthy event is decided on.
--
-- DEPLOY (not done by this repo — needs your own Supabase login):
--   supabase link --project-ref <your-project-ref>
--   supabase db push
-- or paste this file's contents into the Supabase dashboard's SQL editor.

create table if not exists push_tokens (
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Expo's own token format (ExponentPushToken[...]), not a raw APNs/FCM
  -- token — this app sends through Expo's push service, never talks to
  -- APNs/FCM directly. Primary key together with user_id so re-registering
  -- the same token (e.g. every cold launch) is a plain upsert, not a
  -- growing pile of duplicate rows for one device.
  expo_push_token text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, expo_push_token)
);

alter table push_tokens enable row level security;

-- Same three-policy shape as profiles: a user can only ever see or touch
-- their own tokens. No update policy — a token either exists as-is or gets
-- replaced via upsert (insert), there's nothing to partially update.
create policy "select own push tokens"
  on push_tokens for select
  using (auth.uid() = user_id);

create policy "insert own push tokens"
  on push_tokens for insert
  with check (auth.uid() = user_id);

create policy "delete own push tokens"
  on push_tokens for delete
  using (auth.uid() = user_id);

grant select, insert, delete on push_tokens to authenticated;
