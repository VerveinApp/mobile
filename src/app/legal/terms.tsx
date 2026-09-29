import { LegalDocumentScreen } from '@/components/legal/legal-document-screen';
import { TERMS_EFFECTIVE_DATE, TERMS_INTRO, TERMS_SECTIONS } from '@/lib/legal/terms-content';

export default function TermsScreen() {
  return (
    <LegalDocumentScreen
      title="Terms of Service"
      effectiveDate={TERMS_EFFECTIVE_DATE}
      intro={TERMS_INTRO}
      sections={TERMS_SECTIONS}
    />
  );
}
