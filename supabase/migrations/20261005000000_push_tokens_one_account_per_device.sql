-- A device's push token belongs to whichever account registered it last.
--
-- BUG FIX: push_tokens is keyed on (user_id, expo_push_token), so the same
-- phone could stay registered under two accounts. Sign-out removes this
-- device's row (src/lib/push-notifications.ts), but only when that delete
-- reaches the server: signing out offline, or a session the server revoked,
-- left the old account's row behind. Once someone else signed in on that
-- phone, the old account's re-engagement nudges and referral notices kept
-- arriving on it. The client can't clean that up itself (RLS only lets an
-- account delete its own rows), so registering a token here releases it
-- from every other account.
--
-- DEPLOY (not done by this repo — needs your own Supabase login):
--   supabase link --project-ref <your-project-ref>
--   supabase db push

-- The cleanup looks rows up by token alone; the primary key leads with
-- user_id, so it can't serve that.
create index if not exists push_tokens_expo_push_token_idx on push_tokens (expo_push_token);

create or replace function public.release_push_token_from_other_accounts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.push_tokens
  where expo_push_token = new.expo_push_token
    and user_id <> new.user_id;
  return new;
end;
$$;

-- Insert covers a first registration; update covers the upsert every cold
-- launch makes, which also clears rows left over from before this existed.
create trigger push_tokens_release_from_other_accounts
  after insert or update on push_tokens
  for each row
  execute function public.release_push_token_from_other_accounts();
