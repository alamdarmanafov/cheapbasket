import type { Metadata } from 'next';
import { DeleteAccount } from '@/components/DeleteAccount';

export const metadata: Metadata = {
  title: 'Hesabı sil — Cheap Market AI',
  description: 'Cheap Market AI hesabını və ona bağlı bütün məlumatları birdəfəlik sil.',
  robots: { index: true, follow: true },
};

export default function Page() {
  return <DeleteAccount />;
}
