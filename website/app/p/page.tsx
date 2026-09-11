import { Suspense } from 'react';
import type { Metadata } from 'next';
import { ProductPage } from '@/components/ProductPage';

export const metadata: Metadata = { title: 'Məhsul — Cheap Market AI' };

// The id lives in the query string (a static export cannot pre-render one
// page per product), so the reader waits on the client.
export default function Page() {
  return (
    <Suspense fallback={null}>
      <ProductPage />
    </Suspense>
  );
}
