import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Cheap Market AI — Alış-verişə getməzdən əvvəl ən sərfəli marketi tap',
  description: 'Səbətini yarat, qiymətləri müqayisə et, bütün səbət üçün ən sərfəli marketi və ən yaxın filialı tap. Bakının böyük market şəbəkələri bir tətbiqdə.',
  metadataBase: new URL('https://cheapmarket.app'),
  openGraph: {
    title: 'Cheap Market AI — Səbətini yarat. Ən sərfəli marketi tap. Get və al.',
    description: 'AI alış-veriş köməkçisi: bütün səbət üçün ən sərfəli market və ən yaxın filial.',
    images: ['/og.png'],
    locale: 'az_AZ',
    type: 'website',
  },
  themeColor: '#E53935',
  icons: { icon: '/icon.png', apple: '/apple-touch-icon.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="az">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
