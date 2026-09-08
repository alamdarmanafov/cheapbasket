import type { Metadata } from 'next';
import { AuthCallback } from '@/components/AuthCallback';

export const metadata: Metadata = {
  title: 'Giriş — Cheap Market AI',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <AuthCallback />;
}
