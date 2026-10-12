# Launch day: VerveIn 1.1

Everything here happens after Apple approves 1.1 (build 23). Release is set to
manual, so nothing is public until step 1.

## 1. Release the app

App Store Connect → VerveIn → iOS App 1.1 → **Release This Version**.
The listing usually appears within an hour (up to 24 h). Check:

```sh
curl -s -o /dev/null -w '%{http_code}\n' https://apps.apple.com/us/app/vervein/id6804788807   # 404 until live, then 200
```

## 2. Ship the over-the-air update (rendering fix + pre-launch fixes)

Build 23 listens on the `production` channel with runtime version `1.1`
(`runtimeVersion.policy: appVersion`), so a JS-only update published there
reaches every 1.1 install. Don't bump `version` in app.json before this, or
the update won't match the build.

1. Merge PR #12 (crisp rendering), then PR #13 (pre-launch fixes; retarget
   it to `main` once #12 is merged). Wait for CI.
2. From an up-to-date `main`:

   ```sh
   git checkout main && git pull
   npx eas-cli update --channel production --environment production --platform ios \
     --message "Crisp rendering on large iPhones + pre-launch fixes"
   ```

   `--environment` is required on Expo SDK 55+. A local dry run of the same
   bundle (`npx expo export --platform ios`) built cleanly on 2026-10-10.
3. Verify on your phone (TestFlight build 23, or the App Store build once
   live): open VerveIn, fully close it, open it again. expo-updates downloads
   on one launch and applies on the next. Check onboarding step 6 (day circles
   should be smooth) and that a rest timer keeps counting with the phone
   locked.
4. If anything is wrong: `npx eas-cli update:roll-back-to-embedded --channel production --platform ios --runtime-version 1.1`
   puts every install back on the code built into build 23.

## 3. Switch the website to the App Store

Follow `~/vervein-marketing-site/LAUNCH.md`. Short version, from that folder,
right after Release (it waits for the listing, flips the switch, deploys):

```sh
cd ~/vervein-marketing-site && \
until curl -sf -o /dev/null https://apps.apple.com/us/app/vervein/id6804788807; do sleep 120; done && \
sed -i '' \
  -e '/^<html /s|data-app-live="false"|data-app-live="true"|' \
  -e 's|^<!-- <meta name="apple-itunes-app" content="app-id=6804788807" /> -->$|<meta name="apple-itunes-app" content="app-id=6804788807" />|' \
  index.html privacy.html terms.html support.html 404.html && \
npx wrangler deploy
```

## 4. Announce

Copy is in `docs/launch-copy.md`. Only post once the App Store link opens.

- Posts (Instagram/LinkedIn, X/Threads, TikTok/Reels caption).
- Personal text to friends, family and gym people asking for an honest rating.
  Never tie a rating to the referral code or anything else in return.
- Website waitlist: it had 0 signups on 2026-10-11, so there's no email to
  send. If anyone signs up before launch, they get exactly one email (the site
  promised that), it needs a postal address (CAN-SPAM), and the list is
  deleted afterwards (the privacy policy promises that). Check the count with
  `npx wrangler kv key list --namespace-id aec8f18e7e57461b9a2e3d37d8ed808a --remote`
  from the site folder.

## 5. First days

- Watch Sentry for new crashes, and App Store Connect → Ratings and Reviews.
- Push notifications: the APNs key is set up and the sign-in hook ships in the
  update, but a real end-to-end push hasn't been seen yet. Sign in on your
  phone with notifications allowed, then send one test push.

## Known, not fixed for launch

- Sign in with Apple tokens aren't revoked on Delete Account (Apple expects
  this). Needs a Sign in with Apple key from the developer account and a
  server function.
- Shared-device edge cases when switching accounts; sessions that run past
  midnight; backfilling past days for weight/sleep/nutrition/measurements/
  photos; Strength Progress only listing a lift whose latest session was a PR;
  Import My Data on a new phone not showing older history on Progress.
- Product call pending: Summary's Training Load card is Plus-locked while
  Progress's Training Load section is free.
- The App Store description and review notes say sessions adjust to soreness,
  sleep and Apple Health; those adjustments are Plus. Make that explicit in
  the description at the next metadata change.
