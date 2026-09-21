import { LegalDocumentScreen } from '@/components/legal/legal-document-screen';
import { PRIVACY_EFFECTIVE_DATE, PRIVACY_INTRO, PRIVACY_SECTIONS } from '@/lib/legal/privacy-content';

export default function PrivacyScreen() {
  return (
    <LegalDocumentScreen
      title="Privacy Policy"
      effectiveDate={PRIVACY_EFFECTIVE_DATE}
      intro={PRIVACY_INTRO}
      sections={PRIVACY_SECTIONS}
    />
  );
}
