import type { Metadata } from 'next';
import { LegalPage } from '@/components/LegalPage';
import { LEGAL } from '@/components/legal';

export const metadata: Metadata = {
  title: `${LEGAL.az.refunds.title} — Cheap Market AI`,
  description: LEGAL.az.refunds.intro.slice(0, 160),
};

export default function Page() {
  return <LegalPage slug="refunds" />;
}
