import type { LegalSection } from '@/components/legal/legal-document-screen';

import { CONTACT_EMAIL, MAILING_ADDRESS, OPERATOR_NAME } from '@/lib/legal/terms-content';

/**
 * DRAFTED BY AI, NOT ATTORNEY-REVIEWED — see terms-content.ts's own header
 * comment for the same caveat. Mirrored verbatim on vervein.app/privacy
 * (vervein-marketing-site/privacy.html) — change both together.
 *
 * Every claim below was checked against the actual implementation, not
 * assumed — in particular:
 *   - Server-side: auth (Supabase), `profiles` (profile-sync.ts's upsert is
 *     the exact field list), `referral_codes`/`referral_redemptions`,
 *     `push_tokens` (token + updated_at, the "recently opened" signal the
 *     re-engagement function reads) and `notification_state`.
 *   - weight-log.ts / sleep-log.ts / nutrition-log.ts / body-measurements.ts /
 *     condition-log.ts / progress-photos.ts / exercise-performance.ts /
 *     workout-log.ts / notes.ts / session-history.ts persist on-device only.
 *   - health-kit.ts's READ_TYPES/WRITE_TYPES are the exact HealthKit scope,
 *     and no HealthKit value is ever sent to the server.
 *   - Remote pushes: supabase/functions/redeem-referral and
 *     send-reengagement-pushes (via Expo's push service).
 *   - Crash reporting: lib/error-monitoring.ts (Sentry, active whenever a
 *     DSN is configured).
 * If any of this changes, this file (and the website copy) must change
 * with it — it describes the real app, not a generic template.
 *
 * Revision 2026-09-23 (full-app audit): the previous version called its
 * server list "complete" while omitting push tokens, activity timestamps,
 * referral records and sign-in logs; described notifications as local-only
 * after server-sent pushes shipped; said no crash reporting was used after
 * Sentry was added; and promised consent withdrawal the app didn't offer.
 * Also adds the consumer-health-data, Illinois biometric, Do Not Track and
 * GDPR controller/retention/transfer disclosures.
 */
export const PRIVACY_EFFECTIVE_DATE = 'September 24, 2026';

export const PRIVACY_INTRO =
  'This Privacy Policy explains what information VerveIn collects, how it’s used, and the choices you have. ' +
  'VerveIn is built around a simple principle: most of your fitness data stays on your device, and only what’s ' +
  'needed to run your account and keep your plan in sync across devices is stored on our servers.';

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    heading: '1. Who We Are',
    body: [
      `VerveIn is operated by ${OPERATOR_NAME}, an individual developer based in Illinois, USA ("we", "us"). For any ` +
        `privacy question, or to exercise any right described below, contact us at ${CONTACT_EMAIL}.` +
        (MAILING_ADDRESS ? ` Mailing address: ${MAILING_ADDRESS}.` : ''),
    ],
  },
  {
    heading: '2. Information Stored on Our Servers',
    body: [
      'We store the following on our servers (via our database and authentication provider, Supabase):',
      '- Your account: your email address, and if you use Sign in with Apple or Google, the account identifier ' +
        'that service provides (for Apple, this may be a private relay address if you choose to hide your email). ' +
        'Our authentication provider also keeps sign-in records such as timestamps and IP addresses.',
      '- Your training profile: your name, goal, experience level, available equipment, weekly schedule, ' +
        'commitment level, and any target weight or target lift you set.',
      '- Health-related information you choose to share, only after you consent: sex, height, weight, age, and ' +
        'any health conditions or movement restrictions you enter — plus whether and when you consented.',
      '- Referral records: your referral code and, if you share or redeem one, who referred whom, when, and ' +
        'whether the reward was granted.',
      '- Notification records: if you allow notifications, each of your devices’ push notification tokens and ' +
        'when each last registered (which is how we can tell the App was opened recently), and when we last sent ' +
        'you a re-engagement notification.',
      'We do not store your workout history, exercise performance, sleep or nutrition logs, body measurement ' +
        'history, progress photos, check-ins and symptom tags, or notes on our servers (see the next section).',
      'Separately, if you join the launch list on our website (vervein.app), the email address you enter and the ' +
        'date you added it are stored by our website host, Cloudflare. We use it only to email you when VerveIn is ' +
        'available on the App Store, and we delete it if you ask.',
    ],
  },
  {
    heading: '3. Information That Stays on Your Device',
    body: [
      'We never receive the following. It’s kept in the App’s own storage on your device — and in your device ' +
        'backups (such as iCloud Backup) if you have those turned on — unless you export it yourself (Settings → ' +
        'Export My Data):',
      '- Your logged workouts and exercise performance history.',
      '- Weight, sleep, and nutrition logs you enter.',
      '- Body measurements and progress photos.',
      '- Your energy check-ins and any symptoms you tag.',
      '- Any personal notes you write in the App.',
      'Because this data lives only on your device, reinstalling the App or switching devices without exporting ' +
        'first means this history will not carry over — this is a deliberate privacy trade-off, not a bug. If ' +
        'someone else signs in to VerveIn on your device, your on-device data is set aside for your account and ' +
        'never shown to theirs.',
    ],
  },
  {
    heading: '4. Apple Health (Optional)',
    body: [
      'If you choose to connect Apple Health, VerveIn reads step count, resting heart rate, sleep analysis, and ' +
        'active energy, and can write completed workouts back to Apple Health. This is off by default, entirely your ' +
        'choice, and can be disconnected at any time in Settings (and managed in the Health app).',
      'Apple Health data is processed on your device to adjust your training plan. It is never sent to our ' +
        'servers, never sold, never used for advertising or marketing, and never shared with anyone else.',
    ],
  },
  {
    heading: '5. Purchases',
    body: [
      'If you subscribe to VerveIn Plus, your payment is handled entirely by the Apple App Store — we never see or ' +
        'store your payment card details. We use RevenueCat to manage subscription status. RevenueCat receives your ' +
        'account identifier (so your subscription follows your account), your purchase history from the App Store, ' +
        'and basic technical information such as your device model, OS and app version, and the App Store country.',
    ],
  },
  {
    heading: '6. Notifications',
    body: [
      'Workout reminders are scheduled on your device, based on your own training days.',
      'If you allow notifications, we store your device’s push token (Section 2) and may send you: a notice when ' +
        'someone joins VerveIn with your referral code, and an occasional re-engagement notification after several ' +
        'days without opening the App — never more than once a week. These are delivered through Expo’s push ' +
        'notification service and Apple’s push service.',
      'Signing out removes this device’s token from our servers. You can turn notifications off at any time in ' +
        'iOS Settings.',
    ],
  },
  {
    heading: '7. Crash Reports and App Updates',
    body: [
      'We use Sentry to receive crash and error reports so we can fix problems. A report includes the error ' +
        'itself, the part of the App involved, and technical details such as your device model and OS and app ' +
        'versions. We don’t put your health information into crash reports.',
      'App updates may be delivered over the air through Expo’s update service, which receives basic technical ' +
        'information (such as your platform and app version) to deliver the right update.',
    ],
  },
  {
    heading: '8. Who We Share Information With',
    body: [
      'We do not sell your personal information, and we do not share it for cross-context behavioral advertising. ' +
        'We don’t use any analytics or advertising service. We share only what’s needed with these service ' +
        'providers, each of which processes it on our behalf to provide their part of the App:',
      '- Supabase — database hosting and account authentication.',
      '- RevenueCat — subscription status and entitlements.',
      '- Expo — push notification delivery and over-the-air app updates.',
      '- Sentry — crash and error reports.',
      '- Cloudflare — hosting for our website, vervein.app, including the launch-list email addresses.',
      '- Apple and Google — Sign in with Apple/Google, App Store purchases, Apple Health (on your device), and ' +
        'push notification delivery.',
      'We may also disclose information if required to by law, or to protect the rights, safety, or security of ' +
        'our users or others. We never use your health, fitness, or body information for advertising or marketing, ' +
        'or share it with anyone for those purposes.',
    ],
  },
  {
    heading: '9. Your Choices',
    body: [
      '- Export My Data (Settings) — save everything stored on your device.',
      '- Import My Data (Settings) — restore from a previous export.',
      '- Delete My Data (Settings) — permanently erase your on-device history and your synced profile.',
      '- Stop sharing health info (Settings → Body & Biometrics) — withdraw your consent and clear your sex, height, ' +
        'weight, age, health conditions, and movement restrictions from your device and our servers.',
      '- Delete Account (Settings) — permanently delete your account and everything we store about it on our ' +
        'servers (Section 2). This cannot be undone. Deleting your account doesn’t cancel a VerveIn Plus ' +
        'subscription — manage that in your Apple ID settings.',
      '- Disconnect Apple Health, or turn off notifications, at any time.',
    ],
  },
  {
    heading: '10. Consumer Health Data',
    body: [
      'Some information VerveIn handles is “consumer health data” under laws such as Washington’s My Health My ' +
        'Data Act, Nevada’s consumer health data law, and Connecticut’s data privacy law. This section is our ' +
        'consumer health data privacy policy.',
      '- What: health conditions, movement restrictions, symptoms you tag, sex, height, weight, and age; Apple ' +
        'Health readings (steps, resting heart rate, sleep, active energy); and body measurements, progress ' +
        'photos, and sleep and nutrition logs.',
      '- Why: only to personalize and adjust your training plan and show you your own progress.',
      '- Where it comes from: you, and Apple Health if you connect it.',
      '- Where it lives: health conditions, movement restrictions, sex, height, weight, and age are stored with ' +
        'your account only after you consent. Everything else on this list stays on your device and is never ' +
        'received by us.',
      '- Sharing: only with the service providers in Section 8 that store or process it on our behalf (in ' +
        'practice, our database provider). We never sell consumer health data, and never use it for advertising.',
      '- Your rights: you can confirm whether we have your consumer health data, get a copy, have it deleted, and ' +
        'withdraw your consent at any time — in the App (Section 9) or by emailing us. We respond within 45 days. ' +
        'If we decline a request, you can appeal by replying to our response; if we deny the appeal, you can ' +
        'contact your state attorney general.',
    ],
  },
  {
    heading: '11. California Privacy Rights (CCPA/CPRA)',
    body: [
      'If you are a California resident, you have the following rights under the California Consumer Privacy Act, ' +
        'as amended by the CPRA:',
      '- The right to know what personal information we collect, use, and disclose — Section 2 lists what reaches ' +
        'our servers, and Section 3 what deliberately never does.',
      '- The right to delete your personal information — see Section 9.',
      '- The right to correct inaccurate personal information — most of your profile is directly editable in the ' +
        'App; contact us for anything that isn’t.',
      '- The right to opt out of the sale or sharing of personal information. We do not sell or share your ' +
        'personal information for cross-context behavioral advertising, so there is nothing to opt out of.',
      '- Sensitive personal information: the health information we process is used only to provide the App’s ' +
        'features you ask for, so there is no additional use to limit.',
      '- The right to non-discrimination for exercising any of these rights.',
      `To exercise any of these rights, contact us at ${CONTACT_EMAIL}. We will verify your request using the ` +
        'email address associated with your account before acting on it.',
      'Do Not Track and Global Privacy Control: VerveIn doesn’t track you across other apps or websites and ' +
        'doesn’t sell or share data for advertising, so these signals don’t change how we handle your information.',
    ],
  },
  {
    heading: '12. European Economic Area & UK Privacy Rights (GDPR)',
    body: [
      `If you are located in the European Economic Area or the UK, the controller of your personal information is ` +
        `${OPERATOR_NAME} (contact: ${CONTACT_EMAIL}). We process it on these legal bases: performance of a ` +
        'contract (creating and running your account and subscription); your explicit consent for health-related ' +
        'information and Apple Health, which are both opt-in; and our legitimate interest in keeping the App ' +
        'secure and working (for example, crash reports and keeping your plan in sync across devices).',
      'Your training plan is generated by automated processing of what you tell the App; this doesn’t produce ' +
        'legal or similarly significant effects, and you can always change or ignore the plan.',
      'You have the right to:',
      '- Access the personal information we hold about you.',
      '- Rectify inaccurate personal information.',
      '- Erase your personal information (see Section 9).',
      '- Restrict or object to our processing of your personal information.',
      '- Receive your personal information in a portable format (see Export My Data in Section 9).',
      '- Withdraw consent at any time where we rely on consent (for example, Stop sharing health info or ' +
        'disconnecting Apple Health) — this does not affect the lawfulness of processing before you withdrew it.',
      '- Lodge a complaint with your local data protection supervisory authority.',
      `To exercise any of these rights, contact us at ${CONTACT_EMAIL}.`,
    ],
  },
  {
    heading: '13. International Data Transfers',
    body: [
      'VerveIn is operated from the United States, and our service providers may store and process your ' +
        'information in the United States or other countries, which may have different data protection laws than ' +
        'the country you live in. Where the law requires it, transfers out of the EEA or UK rely on the European ' +
        'Commission’s Standard Contractual Clauses or another approved safeguard.',
    ],
  },
  {
    heading: '14. Nevada Privacy Rights',
    body: [
      'If you are a Nevada resident, Nevada law (NRS 603A) gives you the right to opt out of the sale of certain ' +
        'personal information to third parties who intend to license or sell it. We do not sell personal ' +
        `information as defined under that law, but if you would like to submit a request anyway, contact us at ` +
        `${CONTACT_EMAIL}.`,
    ],
  },
  {
    heading: '15. Data Retention',
    body: [
      '- Your synced profile: until you delete it (Delete My Data), withdraw health consent (which clears the ' +
        'health fields), or delete your account.',
      '- Push notification tokens: until you sign out on that device, delete your account, or the device stops ' +
        'accepting notifications.',
      '- Referral records: for as long as your account exists.',
      '- Launch-list email addresses: until we’ve emailed you that VerveIn is available, or sooner if you ask us ' +
        'to delete yours.',
      '- Sign-in records: kept by our authentication provider under its own retention schedule.',
      '- Our database provider keeps routine backups for a limited period, so deleted information can remain in ' +
        'those backups until they expire.',
      '- RevenueCat keeps purchase records as needed for billing, tax, and legal purposes. Ask us and we’ll ' +
        'request deletion of your RevenueCat record.',
      '- On-device data stays until you delete it, delete the App, or use Delete My Data. Deleting your account ' +
        'also clears it from the device you delete from.',
    ],
  },
  {
    heading: '16. Biometric Information',
    body: [
      'VerveIn does not collect biometric identifiers or biometric information. App Lock uses Face ID or Touch ID ' +
        'through iOS — the App only ever receives a yes/no result, never your face or fingerprint data. Progress ' +
        'photos stay on your device and are never analyzed for facial geometry.',
    ],
  },
  {
    heading: '17. Children’s Privacy',
    body: [
      'VerveIn is not directed at children and is not intended for anyone under 16. We do not knowingly collect ' +
        'information from children under 16; if we learn that we have, we will delete it. Users under 18 need a ' +
        'parent or guardian’s involvement (see our Terms of Service).',
    ],
  },
  {
    heading: '18. Security',
    body: [
      'We use reasonable technical and organizational measures to protect your information: data is encrypted in ' +
        'transit, your sign-in session is stored encrypted on your device, and server-side data is protected by ' +
        'access controls that let each account reach only its own records. No method of transmission or storage ' +
        'is completely secure, so we can’t guarantee absolute security; if a breach affecting your information ' +
        'occurs, we’ll notify you as the law requires.',
    ],
  },
  {
    heading: '19. Changes to This Policy',
    body: [
      'If we change this policy, we’ll post the new version with a new effective date. For a material change, ' +
        'we’ll also let you know in the App before it takes effect.',
    ],
  },
  {
    heading: '20. Contact',
    body: [
      `Questions about this policy, or want to exercise a right not listed above? Reach us at ${CONTACT_EMAIL}.`,
      `© 2026 ${OPERATOR_NAME}. All rights reserved.`,
    ],
  },
];
