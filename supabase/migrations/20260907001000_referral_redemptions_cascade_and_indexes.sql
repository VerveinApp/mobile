-- Two fixes to referral_redemptions found in a later full-app audit:
--
-- 1. referrer_id/referred_id referenced auth.users(id) with no
--    ON DELETE CASCADE (unlike referral_codes.user_id, which already has
--    one) — Postgres's default ON DELETE NO ACTION means
--    auth.admin.deleteUser() rejects with a foreign-key violation for
--    anyone who has ever sent or redeemed a referral, which
--    delete-account's Edge Function only ever surfaces as a generic 500.
--    That's a real right-to-erasure gap: those accounts could never
--    actually be deleted through the app.
--
--    `code` also references referral_codes(code) with no cascade. If a
--    referrer deletes their account, referral_codes.user_id's own cascade
--    (already in place) removes their code row — which would then hit the
--    same foreign-key problem on any redemption row still pointing at that
--    code. SET NULL here (not CASCADE) so a redemption record survives its
--    own referrer's account deletion: the referred user's own row — their
--    redeemed_at/reward_granted_at history — shouldn't disappear just
--    because the other side of it deleted their account. The code string
--    itself is meaningless once redeemed, so losing it is fine; the NOT
--    NULL constraint has to go for SET NULL to be legal.
--
-- 2. code and referrer_id had no explicit index. Postgres does not
--    auto-index foreign-key columns (only primary keys and unique
--    constraints get one automatically) — referral_codes.code already has
--    one via its own UNIQUE constraint, but looking up redemptions BY code
--    or BY referrer did a sequential scan. Low urgency at this table's
--    current size, but worth closing now rather than after it grows.
--
-- DEPLOY (not done by this repo — needs your own Supabase login):
--   supabase link --project-ref <your-project-ref>
--   supabase db push
-- or paste this file's contents into the Supabase dashboard's SQL editor.
-- Uses Postgres's default constraint-naming convention
-- (<table>_<column>_fkey) since the original migration didn't name these
-- explicitly — safe to assume given create table's own inline `references`
-- syntax was never overridden with a `constraint <name>` clause.

alter table referral_redemptions
  drop constraint if exists referral_redemptions_referrer_id_fkey,
  add constraint referral_redemptions_referrer_id_fkey
    foreign key (referrer_id) references auth.users (id) on delete cascade;

alter table referral_redemptions
  drop constraint if exists referral_redemptions_referred_id_fkey,
  add constraint referral_redemptions_referred_id_fkey
    foreign key (referred_id) references auth.users (id) on delete cascade;

alter table referral_redemptions
  alter column code drop not null;

alter table referral_redemptions
  drop constraint if exists referral_redemptions_code_fkey,
  add constraint referral_redemptions_code_fkey
    foreign key (code) references referral_codes (code) on delete set null;

create index if not exists referral_redemptions_code_idx on referral_redemptions (code);
create index if not exists referral_redemptions_referrer_id_idx on referral_redemptions (referrer_id);
