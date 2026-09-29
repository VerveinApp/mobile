-- Makes push_tokens.updated_at actually mean "this device opened the app
-- recently" — the signal send-reengagement-pushes relies on to decide who's
-- inactive (see that function's own header comment).
--
-- BUG FIX: it never did. src/lib/push-notifications.ts re-upserts the token
-- on every cold launch, but:
--   1. the upsert never sent updated_at, and nothing else ever set it after
--      the initial insert's default now(); and
--   2. an upsert that hits an existing (user_id, expo_push_token) row runs
--      INSERT ... ON CONFLICT DO UPDATE, which needs UPDATE privilege plus a
--      matching RLS policy — 20260916000000_push_tokens.sql granted neither,
--      so every re-registration after the first failed silently.
-- Net effect: three days after a device first registered, every user looked
-- inactive forever, and the daily scan sent "Your training is waiting" to
-- daily users once per cooldown window.
--
-- The trigger sets updated_at server-side on every update, so the activity
-- signal doesn't depend on each client remembering to send it.
--
-- DEPLOY (not done by this repo — needs your own Supabase login):
--   supabase link --project-ref <your-project-ref>
--   supabase db push

grant update on push_tokens to authenticated;

create policy "update own push tokens"
  on push_tokens for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.touch_push_token_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger push_tokens_touch_updated_at
  before update on push_tokens
  for each row
  execute function public.touch_push_token_updated_at();
