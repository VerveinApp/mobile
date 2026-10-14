# VerveIn launch copy

App Store link: https://apps.apple.com/us/app/vervein/id6804788807
(Manual release: the link won't resolve until you click Release, so don't post or send anything below until it does.)

---

## 1. App Store "What's New" (1.1)

1.1 is VerveIn's first public App Store version. Everything before it was TestFlight, and the site still says "In TestFlight beta". So this is written as a first-release note.

```
VerveIn's first release on the App Store.
A quick check-in builds today's workout around your energy and your time.
Low day, lighter session. Great day, add a finisher.
No streaks, nothing to make up. The check-in and daily plan are free.
```

App Store Connect usually doesn't show a What's New field on an app's first version. If the field isn't there, put this in **Promotional Text** instead. That field allows up to 170 characters, sits above the description, and can be changed any time without review:

```
Tell VerveIn your energy and the time you have. It builds today's workout around the answer. No streaks, nothing to make up. The check-in and daily plan are free.
```

---

## 2. Launch posts

### Main post (Instagram / LinkedIn), 113 words

```
VerveIn is now on the App Store.

Most workout plans assume every day is your best day. VerveIn asks how your energy is and how much time you have, then builds today's session around the answer: the full plan on a good day, a lighter one on a low day, a finisher set if you're feeling great. It works with a full gym, a home setup or just bodyweight.

After each workout, one tap tells it how that felt, and future sessions adjust.

There are no streaks and nothing to make up. A day off reads as recovery, not as falling behind.

The check-in and daily plan are free. iPhone, US App Store.
```

Ending: on Instagram, add "Link in bio." On LinkedIn, paste the App Store link.
Image: one of the App Store promo cards, or the "Same you, different day" pair from the site (Monday at Good energy vs. Wednesday at Low, both real engine output).

### X / Threads (274 characters; 247 on X, which counts the link as 23)

```
VerveIn is on the App Store. Tell it your energy and the time you have, and it builds today's workout around the answer. Lighter on low days. No streaks, nothing to make up. The check-in and daily plan are free. iPhone, US.
https://apps.apple.com/us/app/vervein/id6804788807
```

### TikTok / Reels caption (147 characters, 4 hashtags)

```
Same person, two days, two different workouts. VerveIn plans for the energy you actually have. #workoutapp #strengthtraining #fitnessapp #iphoneapp
```

Video idea: screen-record two check-ins on the same profile, one at Good and one at Low, and show how the plan changes (fewer sets, shorter session, and the "why today looks like this" line).

---

## 3. Personal text (friends / family / gym people), 53 words

```
Hey! The fitness app I've been building, VerveIn, is finally on the App Store. You tell it how your energy is and it builds that day's workout around it. If you have an iPhone, could you download it, try a check-in, and leave an honest rating? Honest helps me more than nice.
https://apps.apple.com/us/app/vervein/id6804788807
```

It's on the US App Store only, so skip anyone on Android or using a non-US Apple ID.

---

## 4. Waitlist email (plain text), ~120-word body

**Subject:** VerveIn is on the App Store

```
Hi,

VerveIn is out on the App Store today:
https://apps.apple.com/us/app/vervein/id6804788807

Each day starts with a quick check-in: how's your energy, and how much time do you have? VerveIn builds that day's workout around your answer, with the full plan on a good day and a lighter one on a low day. It works with a full gym, a home setup or just bodyweight.

There are no streaks and nothing to make up. A day off counts as recovery.

The check-in and daily plan are free. VerveIn Plus adds progress charts, Apple Health readiness and coaching notes for $7.99/month (3-day free trial) or $49.99/year.

It's iPhone-only and on the US App Store for now.

This is the one email we promised. Thanks for waiting.

Fuzayl
VerveIn

>>> FILL IN: postal mailing address <<<
```

- The site promised "one email when it's on the App Store … one email, nothing else", so this email ends the list. Don't add anyone from it to future marketing.
- US anti-spam law (CAN-SPAM) requires a physical postal address in a commercial email. That's what the FILL IN line is for. The legal docs' MAILING_ADDRESS is also still blank.
- Change the sign-off if you'd rather send it from a different name.

---

## How the claims were checked (and where the brief was wrong)

- **What the free check-in actually asks:** energy (Empty / Low / Okay / Good / Great) and the time you have. A finisher set is offered on Great days. The brief said the free loop adapts to "soreness/sleep and optional Apple Health". That's wrong:
  - Tagging soreness, poor sleep and similar symptoms on a low-energy day is Plus (Symptom tagging).
  - Using resting heart rate and sleep from Apple Health to trim a session is Plus (Apple Health readiness).

  None of the free-tier copy above claims either one. Sources: src/lib/plus-features.ts; src/app/home/check-in.tsx, where the health modifier only applies when the user has Plus.
- **"Future sessions adjust":** after each session you rate it on a five-step scale from "Way too easy" to "Way too hard". That rating feeds personal calibration and isn't gated.
- **Equipment:** onboarding offers Full gym, Home gym and Bodyweight only (src/app/onboarding/step-4.tsx).
- **No streaks, missed days read as recovery:** this matches the README's standing rule and the site's "Skipped, read as recovered" line.
- **Plus contents and pricing:** matches the paywall and the review notes. The 3-day trial is on the monthly plan only, and only for eligible Apple IDs.
- **Ratings ask:** don't tie a ratings request to anything in return, such as the referral code that gives a free week of Plus. Apple treats that as an incentivized review. If you want to share the referral code, send it as its own message: Settings > VerveIn Plus > Bring a Training Partner, and only accounts less than a week old can redeem one.
