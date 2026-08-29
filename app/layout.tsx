import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Civitek — Qualidade em campo',
  description:
    'Ocorrências do canteiro transformadas em ação, evidência e aprendizado.',
  openGraph: {
    title: 'Civitek — Qualidade em campo',
    description:
      'Ocorrências do canteiro transformadas em ação, evidência e aprendizado.',
    images: [
      {
        url: '/og-civitek.png',
        width: 1736,
        height: 905,
        alt: 'Relatos de campo conectados ao acompanhamento de qualidade da obra.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/og-civitek.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
