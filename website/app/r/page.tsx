import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ReferralPage } from '@/components/ReferralPage';

export const metadata: Metadata = { title: 'Dəvət — Cheap Market AI' };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ReferralPage />
    </Suspense>
  );
}
