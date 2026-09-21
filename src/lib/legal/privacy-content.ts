import type { LegalSection } from '@/components/legal/legal-document-screen';

import { CONTACT_EMAIL } from '@/lib/legal/terms-content';

/**
 * DRAFTED BY AI, NOT ATTORNEY-REVIEWED — see terms-content.ts's own header
 * comment for the same caveat. Includes real CCPA/CPRA (Section 8) and
 * GDPR (Section 9) rights sections, not just a generic "your choices" list —
 * VerveIn is distributed nationwide/globally via the App Store with no
 * geo-restriction, so California and EU users are a real, not hypothetical,
 * audience.
 *
 * Every claim below was checked against the actual implementation, not
 * assumed — in particular:
 *   - profile-sync.ts's own upsert() call is the exact, only list of fields
 *     that reach Supabase's `profiles` table.
 *   - weight-log.ts / sleep-log.ts / nutrition-log.ts / body-measurements.ts /
 *     condition-log.ts / progress-photos.ts / exercise-performance.ts /
 *     workout-log.ts / notes.ts all persist to on-device AsyncStorage only —
 *     none of them import supabase.ts.
 *   - health-kit.ts's own READ_TYPES/WRITE_TYPES constants are the exact
 *     HealthKit scope described here.
 *   - No analytics or crash-reporting SDK exists in this codebase as of this
 *     writing — if one is added later, this document needs a matching update.
 * If any of this ever changes, this file needs to change with it — it
 * describes the real app, not a generic template.
 */
export const PRIVACY_EFFECTIVE_DATE = 'September 10, 2026';

export const PRIVACY_INTRO =
  'This Privacy Policy explains what information VerveIn collects, how it’s used, and the choices you have. ' +
  'VerveIn is built around a simple principle: most of your fitness data stays on your device, and only what’s ' +
  'needed to sync your plan across devices is stored on our servers.';

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    heading: '1. Information Stored on Our Servers',
    body: [
      'When you create an account, we store the following on our servers (via our database provider, Supabase) ' +
        'so your plan can follow you across devices:',
      '- Your email address (used to verify your identity and sign you in).',
      '- Your name, if you provide one.',
      '- Your training profile: goal, experience level, available equipment, weekly schedule and commitment ' +
        'level, sex, height, weight, age, and any target weight or lift goals you set.',
      '- Whether you’ve consented to share health-related information, and when.',
      '- Any health conditions or movement restrictions you choose to enter, so the app can be informed by them.',
      '- Your referral code and whether you’ve redeemed one, so referral rewards can be granted correctly.',
      'This is the complete list — we do not store your workout history, sleep logs, nutrition logs, body ' +
        'measurement history, progress photos, exercise performance records, or notes on our servers. Those stay on ' +
        'your device (see the next section).',
    ],
  },
  {
    heading: '2. Information Stored Only on Your Device',
    body: [
      'The following never leaves your device unless you explicitly export it yourself (Settings → Export My Data):',
      '- Your logged workouts and exercise performance history.',
      '- Weight, sleep, and nutrition logs you enter.',
      '- Body measurements and progress photos.',
      '- Self-reported symptom tags and past check-ins.',
      '- Any personal notes you write in the App.',
      'Because this data is stored locally, reinstalling the App or switching devices without exporting first ' +
        'means this history will not carry over — this is a deliberate privacy trade-off, not a bug.',
    ],
  },
  {
    heading: '3. Apple Health (Optional)',
    body: [
      'If you choose to connect Apple Health, VerveIn reads step count, resting heart rate, sleep analysis, and ' +
        'active energy to inform your training plan’s readiness adjustments, and can write completed workouts back ' +
        'to Apple Health. This connection is off by default, entirely your choice, and can be disconnected at any ' +
        'time from Settings. Apple Health data is used only to power in-app features — it is never sold, never used ' +
        'for advertising, and never shared with anyone except as needed to provide the App’s own features to you.',
    ],
  },
  {
    heading: '4. Purchases',
    body: [
      'If you subscribe to VerveIn Plus, your payment is handled entirely by the Apple App Store or Google Play — ' +
        'VerveIn never sees or stores your payment card details. We use RevenueCat to manage subscription status, ' +
        'which receives your subscription/purchase information from the App Store or Play Store on our behalf.',
    ],
  },
  {
    heading: '5. Notifications',
    body: [
      'If you enable workout reminders or allow notifications, your device’s push notification token is used to ' +
        'deliver reminders and PR (personal-record) celebration notices. These are scheduled based on your own ' +
        'activity and are not shared with third parties beyond what’s needed to deliver them (Apple/Google’s own ' +
        'push notification services, via Expo’s notification infrastructure).',
    ],
  },
  {
    heading: '6. Who We Share Information With',
    body: [
      'We do not sell your information. We share the minimum necessary information with these service providers, ' +
        'each of whom processes it only to provide their part of the App:',
      '- Supabase — hosts our database and handles account authentication.',
      '- RevenueCat — manages subscription status and entitlements.',
      '- Apple / Google — process Sign in with Apple/Google, App Store/Play Store purchases, Apple Health (iOS), ' +
        'and push notification delivery.',
      'We do not currently use any analytics, advertising, or crash-reporting service. If that changes, we’ll ' +
        'update this policy first. In particular, we never use your health, fitness, or body data for advertising ' +
        'or marketing purposes, or share it with anyone for those purposes.',
    ],
  },
  {
    heading: '7. Your Choices',
    body: [
      '- Export My Data (Settings) — download everything stored on your device.',
      '- Import My Data (Settings) — restore from a previous export.',
      '- Delete My Data (Settings) — permanently erase your on-device history.',
      '- Delete Account (Settings) — permanently deletes your account and the server-side profile information ' +
        'described in Section 1. This cannot be undone.',
      '- Disconnect Apple Health, or turn off notifications, at any time in Settings.',
    ],
  },
  {
    heading: '8. California Privacy Rights (CCPA/CPRA)',
    body: [
      'If you are a California resident, you have the following rights under the California Consumer Privacy Act, ' +
        'as amended by the CPRA:',
      '- The right to know what personal information we collect, use, and disclose — Section 1 above is the ' +
        'complete list of what reaches our servers, and Section 2 lists what we deliberately keep off our servers ' +
        'entirely.',
      '- The right to delete your personal information — see Section 7, Delete My Data and Delete Account.',
      '- The right to correct inaccurate personal information — most of your profile is directly editable in the ' +
        'App; contact us for anything that isn’t.',
      '- The right to opt out of the sale or sharing of personal information. We do not sell or share your ' +
        'personal information for cross-context behavioral advertising, so there is nothing to opt out of.',
      '- The right to non-discrimination for exercising any of these rights.',
      `To exercise any of these rights, contact us at ${CONTACT_EMAIL}. We will verify your request using the ` +
        'email address associated with your account before acting on it.',
    ],
  },
  {
    heading: '9. European Economic Area & UK Privacy Rights (GDPR)',
    body: [
      'If you are located in the European Economic Area or the UK, we process your personal information under ' +
        'the following legal bases: performance of a contract (creating and running your account), your consent ' +
        '(health-related information and Apple Health, which are both opt-in), and our legitimate interest in ' +
        'operating and improving the App (e.g., keeping your training plan in sync across devices).',
      'You have the right to:',
      '- Access the personal information we hold about you.',
      '- Rectify inaccurate personal information.',
      '- Erase your personal information (see Section 7).',
      '- Restrict or object to our processing of your personal information.',
      '- Receive your personal information in a portable format (see Export My Data in Section 7).',
      '- Withdraw consent at any time where we rely on consent (for example, disconnecting Apple Health or ' +
        'clearing health conditions from your profile) — this does not affect the lawfulness of processing before ' +
        'you withdrew it.',
      '- Lodge a complaint with your local data protection supervisory authority.',
      `To exercise any of these rights, contact us at ${CONTACT_EMAIL}.`,
    ],
  },
  {
    heading: '10. International Data Transfers',
    body: [
      'VerveIn is operated from the United States. The service providers listed in Section 6 may store and ' +
        'process your information in the United States or other countries, which may have different data ' +
        'protection laws than the country you live in. Where required by law, we take steps to ensure your ' +
        'information receives an adequate level of protection wherever it is processed.',
    ],
  },
  {
    heading: '11. Nevada Privacy Rights',
    body: [
      'If you are a Nevada resident, Nevada law (NRS 603A) gives you the right to opt out of the sale of certain ' +
        'personal information to third parties who intend to license or sell it. We do not sell personal ' +
        `information as defined under that law, but if you would like to submit a request anyway, contact us at ` +
        `${CONTACT_EMAIL}.`,
    ],
  },
  {
    heading: '12. Data Retention',
    body: [
      'We keep your server-side profile information for as long as your account exists. On-device data is kept ' +
        'until you delete it, delete the App, or use Delete My Data. Deleting your account removes your server-side ' +
        'information; it does not automatically erase data already stored only on your device.',
    ],
  },
  {
    heading: '13. Children’s Privacy',
    body: [
      'VerveIn is not directed at children and is not intended for anyone under 16. We do not knowingly collect ' +
        'information from children under 16; if we learn that we have, we will delete it.',
    ],
  },
  {
    heading: '14. Security',
    body: [
      'We use reasonable technical and organizational measures to protect your information (including relying on ' +
        'Supabase’s own security practices and row-level access controls for server-side data), but no method of ' +
        'transmission or storage is completely secure, and we can’t guarantee absolute security.',
    ],
  },
  {
    heading: '15. Changes to This Policy',
    body: [
      'If we make a material change to this policy, we’ll update the effective date above and make reasonable ' +
        'efforts to let you know.',
    ],
  },
  {
    heading: '16. Contact',
    body: [
      `Questions about this policy, or want to exercise a right not listed above? Reach us at ${CONTACT_EMAIL}.`,
      '© 2026 Barkath Mohammed. All rights reserved.',
    ],
  },
];
