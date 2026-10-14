# Training Partner — 1.2 plan

Status: draft for review · 2026-10-10 · targets 1.2 (after 1.1 / build 23 ships)

Source note: "Training Partner Improvements: track each other's progress and consistency; any other factors instead of just a referral; view each other's training grid."

## 1. Where we are today (grounding)

- **Referral is the only "partner" feature.** `referral_codes` (one permanent 6-char code per user) + `referral_redemptions` (service-role only), redeemed via `supabase/functions/redeem-referral`: account must be under 7 days old, one redemption per account, 7 days of Plus for both sides, push to the referrer titled "New training partner!". Entry points: Settings and the post-session milestone link in `home/check-in.tsx` ("Bring a training partner along").
- **Workout history is on-device only.** `src/lib/session-history.ts` (`vervein.sessionHistory.v1`, AsyncStorage, up to 730 entries). Each entry has `date`, `completed` (true for done *or* partial), plus energy, soreness, notes, feedback, calories and check-in hour. None of it reaches the server. Privacy Policy §2/§3 promise this.
- **Consistency calendar.** `getRecentWeeks()` builds 4 Monday-aligned weeks (`MONTH_WEEK_COUNT = 4`, so it never reaches more than 27 days back). Progress renders it inside `PremiumGate feature="consistency"`, with completed, missed and upcoming cells plus a done/scheduled count per week.
- **Push works end to end on paper.** `push_tokens` (one row per device, released from other accounts on re-register), `_shared/expo-push.ts` (batching, dead-token pruning), `NOTIFICATION_ROUTES` allow-list in `notification-redirect.ts` (`/home/check-in`, `/referral`). The Expo APNs key now exists, but a real device has not yet confirmed delivery.
- **Account deletion** is `auth.admin.deleteUser`; every table cascades from `auth.users`.

## 2. Goals and non-goals

**Goals**
1. Two people who choose each other can see that the other is showing up: completed days on a 4-week grid, sessions this week, and the days they both trained.
2. A one-tap cheer, so support goes both ways.
3. Inviting works for anyone (existing users too), not only brand-new signups.
4. Upload as little as possible: dates of completed sessions, and only after a separate, explicit opt-in.

**Non-goals (1.2)**
- No missed days, schedules, streaks, rankings, leaderboards, side-by-side "who did more" comparisons, or "your partner is waiting" pressure. These are permanent no's, not deferrals.
- No exercises, weights, energy, soreness, symptoms, notes, calories, HealthKit data or check-in times leave the device.
- No discovery, search, public profiles, groups or chat. The only way to connect is an invite you hand someone.
- No change to the referral reward. The 7 days of Plus stays a bonus for new accounts only.
- No Plus gating of the partner feature (growth-first, per the 1000-subscriber plan).

## 3. User flows

**Turn on sharing (once).** This is the consent screen, reached from any partner entry point the first time. It shows exactly what a partner sees (your display name and the days you completed a session) and what they never see (workouts, weights, energy, symptoms, health info, your schedule, the days you didn't train). The display-name field is prefilled from the profile first name and can be edited (1–30 chars). Buttons: "Turn on partner sharing" and "Not now". On accept, the app creates the `partner_profiles` row and uploads completed dates from the last 28 days (the consent copy says so; see open question 3).

**Invite.** `/partners` → "Invite a partner" → server creates a single-use invite code (8 chars, same no-lookalike alphabet as referral codes, expires in 7 days, max 3 open per user) → share sheet with: "Train with me on VerveIn. Open vervein.app/p/ABCD2345 or enter code ABCD2345 in Settings → Training Partners." The link is a universal link. If the app isn't installed, the web page shows the App Store button and the code to type.

**Accept.** Opening the link (or typing the code) goes to `/partners/accept?code=…`, which shows "Sam invited you to be training partners" plus the consent screen above if sharing is off. "Accept" calls `accept-partner-invite`. That function checks the code is live, it isn't your own, neither side has blocked the other, and both sides are under the partner cap. It then creates the partnership, deletes the invite and pushes to the inviter. If the accepting account is under 7 days old and has never redeemed a referral, the same call also runs the referral grant (see open question 2), so new users never need a second code.

**Leave.** On the partner card, "⋯" → "Leave partnership" → confirm → the row is deleted. The other person gets no notification. The card just disappears on their next refresh. Your uploaded days remain only while sharing is on, and nobody can see them without a partnership.

**Turn off sharing.** On `/partners`, "Turn off partner sharing" deletes `partner_profiles`. The cascade removes all your partnerships, open invites, uploaded days and cheers immediately. Blocks persist.

**Cheer.** A cheer can be sent only for a day the partner actually trained (today or yesterday). It celebrates something they did and can't be used as a "come on, train" nudge. Limit: one per partner per day. The button then reads "Cheered".

**Block / report.** "⋯" → "Block" ends the partnership and stops any future pairing in either direction. The blocked person sees the same thing as a leave. "Report" does the same as Block and also opens a prefilled email to the support address with the partnership id (no content to attach, since names and cheers are the only user content).

## 4. Data shared and stored

### What leaves the device
Only the **local calendar date (YYYY-MM-DD) of each day with `completed === true`** in the last 28 days. That covers done and partial, live and backfilled. Nothing else: no completion status, time of day, energy, calories, exercises or the "logged retroactively" flag.

Upload path: a new `src/lib/partner-sync.ts` reconciles the full set of completed dates in the 28-day window with `sync-partner-days` (an idempotent replace). It runs after `recordSessionCompletion`, `recordPastSessionCompletion`, `deleteSessionHistoryEntry` and `restoreSessionHistory`, and on app foreground, only when sharing is on and the signed-in user owns the local data (`account-switch.ts`). Because it reconciles instead of appending, offline days and deleted entries fix themselves on the next open. A test in `src/lib/__tests__/privacy-promises.test.ts` checks that the request body has only `{ days: string[], today: string }`.

### Schema sketch (one migration, e.g. `20261101000000_training_partners.sql`)

```sql
-- Opt-in record. Deleting it = "Turn off partner sharing": cascades to
-- days, partnerships, invites and cheers (not blocks).
create table partner_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(btrim(display_name)) between 1 and 30),
  notify_cheers boolean not null default true,
  notify_together boolean not null default true,
  sharing_consented_at timestamptz not null default now()
);

create table shared_training_days (
  user_id uuid not null references partner_profiles (user_id) on delete cascade,
  day date not null,                       -- uploader's local date, completed days only
  primary key (user_id, day)
);

create table partnerships (
  id uuid primary key default gen_random_uuid(),
  user_low  uuid not null references partner_profiles (user_id) on delete cascade,
  user_high uuid not null references partner_profiles (user_id) on delete cascade,
  created_at timestamptz not null default now(),
  last_together_push_on date,              -- caps "both showed up" to 1/day
  check (user_low < user_high),
  unique (user_low, user_high)
);
create index on partnerships (user_high);

create table partner_invites (
  code text primary key,
  inviter_id uuid not null references partner_profiles (user_id) on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days'
);

create table partner_cheers (
  partnership_id uuid not null references partnerships (id) on delete cascade,
  from_id uuid not null references auth.users (id) on delete cascade,
  to_id   uuid not null references auth.users (id) on delete cascade,
  for_day date not null,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id, for_day)
);

create table partner_blocks (            -- survives turning sharing off/on
  blocker_id uuid not null references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
```

### RLS: own rows only. Every cross-user read goes through one audited function.

| Table | Client policies (authenticated) | Writes that need service role |
|---|---|---|
| `partner_profiles` | select / insert / update / delete where `user_id = auth.uid()` | none |
| `shared_training_days` | select own | insert/delete via `sync-partner-days` |
| `partnerships` | select / delete where `auth.uid() in (user_low, user_high)` (delete = leave) | insert via `accept-partner-invite` |
| `partner_invites` | select / insert / delete own; before-insert trigger caps 3 unexpired | redeem/delete on accept |
| `partner_cheers` | select where `auth.uid() in (from_id, to_id)` | insert via `send-cheer` |
| `partner_blocks` | select / delete own | insert via `block_partner()` RPC |

- `get_partner_cards()`: `security definer`, `set search_path = ''`. For the caller's partnerships it returns `(partnership_id, display_name, days date[])`, limited to the last 28 days. It never returns the partner's `user_id`, notify settings or consent time. No policy lets one user select another user's row directly.
- `block_partner(partnership_id)`: `security definer`. It resolves the other member, inserts the block and deletes the partnership. The client never holds the partner's uuid.
- Explicit `grant`s for `authenticated` on every table (the lesson from `20260903000000_referral_codes_grants.sql`).

### Retention and deletion

| Data | Kept until |
|---|---|
| Display name, consent time, notify settings | Sharing turned off, Delete My Data, or account deleted |
| Shared training days | Rolling 28 days (daily `pg_cron` prune of `day < current_date - 28`), or sharing off |
| Partnerships | Either side leaves, blocks, turns sharing off or deletes their account |
| Invites | Accepted (deleted), expired (pruned daily), or sharing off |
| Cheers | 7 days (pruned daily), or partnership ends |
| Blocks | Account deletion (either side) |

- **Delete Account:** everything cascades from `auth.users`. No new code is needed beyond the migration.
- **Delete My Data:** add "turn off partner sharing" (delete `partner_profiles`) to `data-backup.ts`'s clear path, since that action already erases the synced profile.
- **Sign out:** server data stays, because it belongs to the account. This device's push token is already removed, so no partner pushes arrive there.

## 5. Privacy Policy, Terms and App Privacy label

Edit `src/lib/legal/privacy-content.ts` **and** `vervein-marketing-site/privacy.html` together, bump `PRIVACY_EFFECTIVE_DATE`, and update the header comment's server-side list.

- **§2 Server data:** add the bullet "Training partners, only if you turn on partner sharing: the display name you choose, the dates you completed a session in the last 28 days, your partnerships, open invites, blocks, cheers from the last 7 days, and your partner notification settings." Change "We do not store your workout history…" to add "…except, if you turn on partner sharing, the dates you trained (Section X)."
- **New section "Training Partners":** what a partner sees and never sees (mirrors the consent screen), that sharing is off by default and needs its own consent, and how to leave, block or turn it off, with immediate server deletion.
- **§6 Notifications:** add invite-accepted, cheer and "both showed up" pushes, each with its own toggle.
- **§8 Sharing:** add "Your training partners: only what the Training Partners section describes, only people you've accepted, only after you turn it on."
- **§9 Choices:** add Leave, Block, Turn off partner sharing.
- **§10 Consumer health data:** treat training dates as consumer health data to be safe. List them under What, under Where it lives (server only with partner-sharing consent) and under Sharing (with the partners you choose). The opt-in serves as the separate sharing consent that MHMDA-style laws require.
- **§15 Retention:** add the rows from the retention table above.
- **§19 says a material change gets an in-app notice before it takes effect.** A new category of server data counts. Ship a one-time "Privacy Policy updated" notice in 1.2, separate from the opt-in.
- **Terms:** in §9 (Content You Provide) and §14 (Acceptable Use), cover display names and partner conduct, and say we may remove names and block or end partnerships. Rename the referral push title "New training partner!" to "Someone joined with your invite" so it isn't confused with a real partnership.
- **App Store guideline 1.2 (user-generated content):** the display name is UGC. Cover it with a display-name word filter, Block, Report and the published contact address. Cheers are presets, with no free text.
- **App Privacy label (ASC):** add **Health & Fitness → Fitness**, linked to the user, not used for tracking, purpose App Functionality. Confirm **Name** is already declared (profile name), since the display name falls under it. Check that nothing else changes. Re-read the current label before editing, because S7 in the audit checklist was still open.
- **App Review:** two demo accounts, already partnered, with a few seeded days, plus a line in the review notes on where to find the feature.

## 6. UI surfaces

- **`/partners` (new stack screen).** Reached from a Settings "Training Partners" row (above "Invite a friend"), the Progress section and the post-session milestone link, which becomes "Train alongside someone. Invite a partner". Sections: partner cards, "Invite a partner", "What partners see" and "Turn off partner sharing".
- **Partner card.** Shows the display name and "3 sessions this week". When the count is 0, the line is **omitted** (never "0 sessions"). Below that sit a 4-week, 7-column grid and a "Together" line ("You both showed up Tue and Thu"), shown only when it's non-empty. Then the Cheer button (shown only when the partner trained today or yesterday) and the "⋯" menu (Leave, Block, Report).
- **Partner grid rules.** Completed days are filled dots. Every other cell, past or future, is the same neutral empty cell: no missed state, no upcoming state, no schedule overlay, no done/scheduled count and no legend entry for "missed". Days you both trained get a subtle shared ring. It reuses the Progress grid's cell geometry, but as a separate, simpler component, so the Plus calendar's states can't leak in.
- **Progress tab.** A free "TRAINING PARTNERS" section below the consistency calendar: one compact row per partner showing this week only, which taps through to `/partners`. If sharing is off, it shows a single invite row instead.
- **Check-in done state.** If a partner also trained today: "Sam showed up today too" with an inline Cheer.
- **Home.** No change in 1.2.
- **Notifications.** Add `/partners` to `NOTIFICATION_ROUTES`.

## 7. Notification copy (readiness, never debt)

| Trigger | Title | Body |
|---|---|---|
| Invite accepted (to inviter) | Training partners | You and {name} are training partners now. |
| Cheer received | {name} cheered your session | Nice work. {name} noticed. |
| Second partner finishes on a day the first already trained (to both, at most once per pair per day) | You both showed up | You and {name} both trained today. |

**Never sent:** "{name} just trained" on its own (reads as "and you didn't"), "{name} is waiting / don't let them down", anything about a partner's quiet days, weekly comparisons or counts, "{name} left", streaks of any kind. The existing re-engagement push never mentions partners.

Pushes go out immediately and iOS Focus handles quiet hours. No timezone is stored (see open question 6).

## 8. Edge cases

- **Partner deletes their account or turns sharing off.** The cascade removes the partnership. The other side's card silently disappears on the next `get_partner_cards()`. Cached cards are dropped when they are missing from a fresh response.
- **Both offline.** Reconcile-on-foreground uploads late. The "both showed up" push fires only if the uploaded `today` is within ±1 day of the server date and the day matches, so a day-late sync never sends a stale "today". Cards show the last fetched data with no "offline" message.
- **Time zones.** "Together" compares each person's own local date strings. That's simple and good enough. Different time zones can shift it by a day, and we accept that.
- **Abuse.** Invites are single-use and expire after 7 days. 8 chars from 31 symbols is about 40 bits. Accept attempts are limited to 10 failures per hour per account in the edge function, with at most 3 open invites, 1 cheer per partner per day and a display-name filter. Block works in both directions and survives sharing being turned off and on.
- **More than one partner.** Cap of 3 active partners per person (open question 1), enforced on both sides at accept. The UI is a list from day one.
- **Self-invite, already partners, expired or used code, or inviter turned sharing off.** These get specific, calm errors: "That's your own invite", "You're already training partners", "This invite is no longer active. Ask for a new one."
- **Shared device or account switch.** Sync runs only for the account that owns the local data (`account-switch.ts`). A stashed account never syncs.
- **Import My Data.** Restored completed days inside the 28-day window upload on the next reconcile.
- **Plus status.** It doesn't matter. Partners work the same on free and Plus.

## 9. Phased build plan (rough size)

| Phase | Work | Size |
|---|---|---|
| 0. Prereqs | Confirm remote push on a real device (referral + re-engagement) with the new APNs key. Answer the open questions. | 0.5 day |
| 1. Backend | Migration (6 tables, RLS, grants, triggers, `get_partner_cards`, `block_partner`, prune cron). Edge functions `accept-partner-invite`, `sync-partner-days`, `send-cheer`. Extract the referral grant into `_shared/` for reuse. Two-user RLS test script. | 2–3 days |
| 2. Client core | `lib/partners.ts`, `lib/partner-sync.ts` + hooks into session-history writes and foreground, consent/accept screen, `/partners`, invite share, typed-code entry, `vervein.app/p/<code>` universal link (`associatedDomains` + AASA file and fallback page on the marketing site, so this needs a new native build, which 1.2 needs anyway), Delete My Data wiring, privacy-promises test. | 3–4 days |
| 3. Surfaces + push | Partner grid component, Progress section, check-in "showed up too", cheer, "both showed up" push, notification toggles, `/partners` route. | 2 days |
| 4. Legal + release | Privacy Policy (app + site), Terms, in-app policy notice, App Privacy label, seeded demo accounts, review notes, device test of all three pushes. | 1 day |

Total is about 9–11 working days. Phases 1–2 can ship to TestFlight behind a flag before 3–4 land.

## 10. Open questions

1. **Partner cap:** 1 (simplest, most personal) or 3 (recommended)?
2. **Fold the referral into the partner invite?** Recommended: when an account under 7 days old accepts a partner invite, it also gets the 7-day Plus grant for both sides, and the standalone referral code stays for people who only want the bonus. The alternative is to keep the two fully separate.
3. **Backfill at opt-in:** share the last 28 days of completed dates right away (recommended, so the grid isn't empty on day one) or only days from opt-in onward?
4. **Free tier:** keep the partner section free (recommended). Note that your own simplified completed-days row would then be visible free, while the full calendar with schedule, missed days and trend stays Plus.
5. **Leaving:** recommended to notify no one. Do you want a quiet in-app line instead ("A partnership ended")?
6. **Quiet hours:** fine to rely on iOS Focus, or store a timezone to hold cheers until morning? That means more data, so the recommendation is no.
7. **Display name:** prefill the first name from the profile (recommended), or start blank?
8. **Universal links in 1.2,** or typed codes only first (saves about half a day plus the marketing-site AASA work)?
