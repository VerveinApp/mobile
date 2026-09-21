import type { LegalSection } from '@/components/legal/legal-document-screen';

/**
 * DRAFTED BY AI, NOT ATTORNEY-REVIEWED. This is a real, considered draft
 * grounded in what VerveIn actually does (checked against the real source —
 * social-auth.ts, health-kit.ts, purchases.ts, referral system, data-backup.ts
 * — not generic boilerplate), but it is not a substitute for a lawyer's
 * review before real App Store/Play Store submission. Governing law is set
 * to Illinois (the developer's own state, confirmed 2026-09-10) and
 * CONTACT_EMAIL is the real vervein.app support address.
 *
 * Includes an arbitration + class-action-waiver clause (Section 20) with a
 * genuine 30-day opt-out — narrower than a typical competitor's version (no
 * specific arbitration venue commitment beyond AAA's own standard rules),
 * added deliberately after the user weighed the tradeoff, not boilerplate
 * copied in unprompted. Sections 5, 10, and 13 (How Recommendations Are
 * Generated, Data Loss, Service Dependencies) exist because of specific,
 * researched liability theories currently used against fitness apps —
 * misrepresentation of algorithmic "personalization" as expert review, and
 * inadequate warning that health conditions entered in the App don't yet
 * change what it recommends (the in-app copy on the Health Conditions
 * screen already says this; these Terms now say it too, in the same words).
 * Section 4 (Assumption of Risk) was added later, alongside the user
 * launching without an LLC yet and wanting the Terms doing real work in
 * the meantime — itemized injury risk + explicit voluntary assumption,
 * standard practice for a fitness app specifically, not previously more
 * than an implicit "at your own risk" phrase inside Limitation of Liability.
 * Section 24 (EEA/UK/Swiss Consumer Rights) was added after noticing the
 * Privacy Policy already had a real GDPR section (its own Section 9) while
 * these Terms had a California consumer notice (Section 23) but no EU
 * counterpart at all — same "no geo-restriction, so this audience is real"
 * reasoning the Privacy Policy's own header comment already states. Covers
 * the 14-day right-of-withdrawal waiver a subscription needs to actually be
 * enforceable against an EEA consumer, and a savings clause acknowledging
 * the arbitration/Illinois-law provisions can't override a resident's own
 * mandatory consumer protections — rather than silently overreaching into
 * rights those provisions can't actually take away.
 * A lawyer should still review all of this before real submission.
 */
export const CONTACT_EMAIL = 'fuzayl@vervein.app';
export const TERMS_EFFECTIVE_DATE = 'September 10, 2026';

export const TERMS_INTRO =
  'These Terms of Service ("Terms") govern your use of VerveIn (the "App"), an adaptive strength-training app. ' +
  'By creating an account or using the App, you agree to these Terms. If you do not agree, do not use the App.';

export const TERMS_SECTIONS: LegalSection[] = [
  {
    heading: '1. Who We Are',
    body: [
      'VerveIn is developed and operated by an individual developer, not a registered company, at this time. ' +
        `You can reach us at ${CONTACT_EMAIL}.`,
    ],
  },
  {
    heading: '2. Eligibility',
    body: [
      'You must be at least 16 years old to use VerveIn. By using the App, you confirm that you meet this ' +
        'requirement. VerveIn is not directed at children and we do not knowingly collect information from anyone under 16.',
    ],
  },
  {
    heading: '3. Not Medical Advice',
    body: [
      'VerveIn is a fitness and training tool, not a medical device, and it does not provide medical advice, ' +
        'diagnosis, or treatment. The App adjusts your training plan based on information you provide (including any ' +
        'health conditions or symptoms you choose to share) and, if you connect it, data from Apple Health — but this ' +
        'adjustment is a general wellness feature, not a clinical recommendation, and the App does not verify or ' +
        'validate exercise selection against specific medical conditions.',
      'Talk to a qualified healthcare provider before starting any new exercise program, especially if you have an ' +
        'existing health condition, are pregnant, or are recovering from an injury. Stop exercising and seek medical ' +
        'attention if you experience pain, dizziness, shortness of breath, or any other concerning symptom. You are ' +
        'solely responsible for deciding whether an exercise is appropriate for you.',
    ],
  },
  {
    heading: '4. Assumption of Risk',
    body: [
      'Exercise carries inherent risks, including but not limited to muscle strain, sprains, joint injury, ' +
        'fractures, cardiovascular events, and in rare cases death. These risks exist whether or not you use ' +
        'VerveIn, and using the App does not create, increase, or represent an assessment of them for you ' +
        'specifically. By using the App, you knowingly and voluntarily assume all risk of injury or harm connected ' +
        'with your training, whether or not it follows a plan the App generated.',
      'Unlike a personal trainer, VerveIn cannot see you, correct your form in real time, or account for something ' +
        'you didn’t disclose in a check-in. You are responsible for exercising within your own ability, using ' +
        'proper form, and stopping if something feels wrong — see the section above for when to stop and seek ' +
        'medical attention.',
    ],
  },
  {
    heading: '5. How Recommendations Are Generated',
    body: [
      'VerveIn is an "adaptive" fitness engine — that word describes how the App works, not a promise of human or ' +
        'clinical review. Your plan is generated and adjusted entirely by software, based on what you enter (your ' +
        'goal, experience, equipment, schedule, energy check-ins, and any health conditions or symptoms you choose ' +
        'to share) and, if you connect it, data from Apple Health. No certified trainer, coach, or medical ' +
        'professional reviews your plan or your data before it’s shown to you.',
      'Health conditions and movement restrictions you enter are currently recorded for your own reference only — ' +
        'as the App itself tells you when you enter them, VerveIn does not yet have a validated way to safely adjust ' +
        'exercise selection for specific conditions, so entering one does not currently change what exercises you’re ' +
        'shown. Do not rely on the App to account for a health condition unless and until it tells you otherwise.',
      'Recommendations are only as accurate as the data behind them — both what you enter yourself and, if ' +
        'connected, what your device or wearable reports to Apple Health. VerveIn does not independently verify ' +
        'either, and is not responsible for a recommendation that was wrong because the underlying data was ' +
        'incomplete, inaccurate, or outdated.',
    ],
  },
  {
    heading: '6. Your Account',
    body: [
      'You can create an account with an email address (verified by a one-time code) or by signing in with Apple ' +
        'or Google. You are responsible for keeping your sign-in method secure and for all activity under your account.',
      'You are responsible for the accuracy of the information you provide (including your goals, physical stats, ' +
        'and any health information you choose to share) — the App’s training recommendations are only as good as ' +
        'what you tell it.',
    ],
  },
  {
    heading: '7. License and Ownership',
    body: [
      'Subject to your compliance with these Terms, VerveIn grants you a limited, non-exclusive, non-transferable, ' +
        'revocable license to install and use the App on your own devices, for your own personal, non-commercial ' +
        'use. This license is solely for accessing and using the App as intended — it doesn’t give you any right to ' +
        'copy, modify, distribute, sell, reverse-engineer, or create derivative works from the App itself.',
      'The App, including its design, engine, and all content we provide within it (excluding Your Content, see ' +
        'the next section), is owned by VerveIn or its licensors. Nothing in these Terms transfers any of that ' +
        'ownership to you.',
      '© 2026 Barkath Mohammed. All rights reserved.',
    ],
  },
  {
    heading: '8. VerveIn Plus (Subscriptions)',
    body: [
      'Certain features are available only through VerveIn Plus, a paid subscription billed and managed through ' +
        'the Apple App Store or Google Play, not directly by us.',
      '- Subscriptions renew automatically unless canceled at least 24 hours before the end of the current period.',
      '- You can cancel anytime in your Apple ID or Google Play account settings — canceling in the App only opens ' +
        'those settings, it does not itself stop billing.',
      '- If a free trial is offered, any unused portion is forfeited when you purchase a subscription, where ' +
        'applicable.',
      '- Refunds are handled by Apple or Google under their own policies, not by us directly.',
      '- We may change what’s included in VerveIn Plus over time; we’ll make reasonable efforts to communicate ' +
        'material changes in advance.',
      'VerveIn’s referral program may grant temporary promotional access to VerveIn Plus to both a referrer and a ' +
        'new user under conditions described in the App. We can change, limit, or end this program at any time, and ' +
        'may deny or reverse rewards obtained through abuse of the system (for example, self-referral or fraudulent ' +
        'accounts).',
    ],
  },
  {
    heading: '9. Content You Provide',
    body: [
      'Some features let you add your own content — progress photos, notes, logged workouts, and similar entries ' +
        '("Your Content"). You own Your Content. By adding it, you give us the limited permission needed to store it ' +
        'and show it back to you within the App. We do not use Your Content for any other purpose, and most of it ' +
        '(including progress photos) never leaves your device — see our Privacy Policy for exactly what does and ' +
        'doesn’t sync to our servers.',
      'You are responsible for Your Content and confirm you have the right to store it. Do not add content that is ' +
        'unlawful or that you do not have the right to share.',
    ],
  },
  {
    heading: '10. Data Loss',
    body: [
      'By design, most of your data — logged workouts, exercise performance history, weight/sleep/nutrition logs, ' +
        'body measurements, progress photos, symptom check-ins, and notes — is stored only on your device, not on ' +
        'our servers. This is a deliberate privacy choice, not an oversight, but it means that if you lose your ' +
        'device, replace it, factory-reset it, or delete the App without first using Export My Data (Settings), ' +
        'this information is permanently gone. We have no server-side copy to restore it from, and we are not ' +
        'responsible for that loss.',
      'If this data matters to you, use Export My Data periodically, especially before getting a new device or ' +
        'deleting the App.',
    ],
  },
  {
    heading: '11. Apple Health',
    body: [
      'If you choose to connect Apple Health, VerveIn reads a limited set of health data (steps, resting heart ' +
        'rate, sleep, and active energy) to inform your training plan, and can write completed workouts back to ' +
        'Apple Health. This connection is entirely optional, can be disconnected at any time in Settings, and this ' +
        'data is never sold or used for advertising.',
    ],
  },
  {
    heading: '12. Third-Party Platforms',
    body: [
      'If you access VerveIn through an app distributed via the Apple App Store, Apple Inc. is a third-party ' +
        'beneficiary of these Terms and may enforce them against you. Apple is not a party to these Terms and has ' +
        'no obligation to provide support or maintenance for the App. In the event of any failure of the App to ' +
        'conform to any applicable warranty, you may notify Apple, and Apple will refund the purchase price (if ' +
        'any) for the App to you — to the maximum extent permitted by law, Apple has no other warranty obligation ' +
        'with respect to the App. Apple is not responsible for addressing any claims by you relating to the App, ' +
        'including product liability claims, claims that the App fails to conform to legal or regulatory ' +
        'requirements, or claims arising under consumer protection law.',
    ],
  },
  {
    heading: '13. Service Dependencies and Availability',
    body: [
      'The App depends on third-party services we don’t control and aren’t responsible for: Supabase (accounts ' +
        'and cross-device sync), RevenueCat (subscription management), and Apple and Google (sign-in, App Store/ ' +
        'Play Store purchases, Apple Health, and push notifications). If any of these services are unavailable, ' +
        'degraded, or change how they work, parts of the App may not function correctly, and we are not responsible ' +
        'for outages, errors, or changes caused by them.',
    ],
  },
  {
    heading: '14. Acceptable Use',
    body: [
      'Don’t use VerveIn to: violate any law; attempt to access another user’s account or data; reverse-engineer, ' +
        'scrape, or interfere with the App or its infrastructure; or circumvent the subscription or referral system ' +
        'described above.',
    ],
  },
  {
    heading: '15. Disclaimers',
    body: [
      'VerveIn is provided "as is" and "as available," without warranties of any kind, express or implied, ' +
        'including warranties of merchantability, fitness for a particular purpose, and non-infringement. We do not ' +
        'guarantee the App will be uninterrupted, error-free, or that any specific fitness outcome will result from ' +
        'using it.',
    ],
  },
  {
    heading: '16. Limitation of Liability',
    body: [
      'To the fullest extent permitted by law, VerveIn and its developer will not be liable for any indirect, ' +
        'incidental, special, consequential, or punitive damages, or any loss of data, arising from your use of the ' +
        'App, including any injury sustained while exercising. Your use of the App, and any exercise you perform ' +
        'based on it, is at your own risk.',
      'To the extent VerveIn is found liable for any reason despite the above, our total liability to you for all ' +
        'claims arising from or related to the App or these Terms will not exceed the amount you paid us in the ' +
        'twelve (12) months before the claim arose, or $50 if you haven’t paid us anything.',
    ],
  },
  {
    heading: '17. Indemnification',
    body: [
      'You agree to indemnify and hold VerveIn and its developer harmless from any claims, losses, liabilities, ' +
        'and expenses (including reasonable attorneys’ fees) arising from: your use of the App; your violation of ' +
        'these Terms; or your violation of any right of another person or entity, including through Your Content.',
    ],
  },
  {
    heading: '18. Termination',
    body: [
      'You can stop using VerveIn and delete your account at any time from Settings. We may suspend or terminate ' +
        'access to the App if you violate these Terms. We may also modify, suspend, or discontinue the App, or any ' +
        'feature of it, at any time, with or without notice.',
    ],
  },
  {
    heading: '19. Changes to These Terms',
    body: [
      'We may update these Terms as the App changes. If we make a material change, we’ll update the effective ' +
        'date above and make reasonable efforts to let you know. Continuing to use the App after a change means you ' +
        'accept the updated Terms.',
    ],
  },
  {
    heading: '20. Dispute Resolution; Arbitration Agreement',
    body: [
      'PLEASE READ THIS SECTION CAREFULLY — IT AFFECTS YOUR LEGAL RIGHTS, INCLUDING YOUR RIGHT TO GO TO COURT.',
      'You and VerveIn agree that any dispute, claim, or controversy arising out of or relating to these Terms or ' +
        'your use of the App will be resolved by binding individual arbitration, administered by the American ' +
        'Arbitration Association under its Consumer Arbitration Rules, rather than in court — except that either of ' +
        'us may bring an individual claim in small claims court instead, if it qualifies.',
      'You and VerveIn each waive the right to a jury trial and the right to participate in a class action, ' +
        'consolidated proceeding, or representative action. The arbitrator may not combine more than one person’s ' +
        'claims into a single proceeding.',
      `You can opt out of this arbitration agreement entirely. To do so, email ${CONTACT_EMAIL} within 30 days of ` +
        'first accepting these Terms, with the subject line "Arbitration Opt-Out" and your account email address. ' +
        'If you opt out, disputes between us will instead be resolved in the courts named in the Governing Law ' +
        'section below.',
      'If this arbitration agreement is found unenforceable as to a particular dispute, that dispute may be brought ' +
        'in the courts named in the Governing Law section instead.',
    ],
  },
  {
    heading: '21. Governing Law',
    body: [
      'These Terms are governed by the laws of the State of Illinois, USA, without regard to its conflict-of-law ' +
        'principles. Any dispute arising from these Terms or your use of the App that is not subject to arbitration ' +
        '(or where you’ve opted out of arbitration) will be resolved in the state or federal courts located in ' +
        'Illinois, and you consent to their jurisdiction.',
    ],
  },
  {
    heading: '22. General',
    body: [
      'You may not assign or transfer these Terms without our prior written consent; we may assign these Terms ' +
        'without your consent to a successor of our business. If any provision of these Terms is found ' +
        'unenforceable, the rest of these Terms will remain in effect. Our failure to enforce any right or ' +
        'provision of these Terms is not a waiver of that right or provision.',
    ],
  },
  {
    heading: '23. California Consumer Notice',
    body: [
      'Under California Civil Code Section 1789.3, California residents are entitled to the following consumer ' +
        `rights notice: current pricing for VerveIn Plus is available on its App Store or Play Store listing. If ` +
        `you have a complaint regarding the App, you may contact us at ${CONTACT_EMAIL}, or the Complaint ` +
        'Assistance Unit of the Division of Consumer Services of the California Department of Consumer Affairs in ' +
        'writing at 1625 North Market Blvd., Suite N-112, Sacramento, CA 95834, or by phone at (800) 952-5210.',
    ],
  },
  {
    heading: '24. European Economic Area, UK, and Swiss Consumer Rights',
    body: [
      'If you are a consumer habitually resident in the EEA, the UK, or Switzerland, the following applies to you ' +
        'in addition to the rest of these Terms.',
      '- Right of withdrawal: you would ordinarily have 14 days to withdraw from a distance contract like this one ' +
        'without giving a reason. Because VerveIn Plus provides immediate access to digital content and services ' +
        'once you subscribe, by completing a purchase you expressly request that we begin providing it immediately ' +
        'and you acknowledge that you lose your right of withdrawal once that access begins.',
      '- Mandatory consumer protections: nothing in Section 20 (Dispute Resolution; Arbitration Agreement) or ' +
        'Section 21 (Governing Law) is intended to deprive you of the protection of any mandatory provisions of the ' +
        'law of your country of residence that cannot be excluded by agreement. If any part of the arbitration ' +
        'agreement or the choice of Illinois law would have that effect for you, that part does not apply to you, ' +
        'and the affected dispute may instead be brought before the competent courts of your country of residence.',
      '- Online dispute resolution: the European Commission provides an online dispute resolution platform at ' +
        'https://ec.europa.eu/consumers/odr, which you’re free to use to lodge a complaint. We are not obligated to ' +
        'participate in proceedings there, but you’re welcome to reach us directly first at ' +
        `${CONTACT_EMAIL} — most things are faster to resolve that way.`,
    ],
  },
  {
    heading: '25. Contact',
    body: [`Questions about these Terms? Reach us at ${CONTACT_EMAIL}.`],
  },
];
