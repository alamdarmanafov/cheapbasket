import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';
import { LEGAL } from '@/components/legal';

export const metadata: Metadata = {
  title: `${LEGAL.az.privacy.title} — Cheap Market AI`,
  description: LEGAL.az.privacy.intro.slice(0, 160),
};

export default function Page() {
  return <LegalPage slug="privacy" />;
}
