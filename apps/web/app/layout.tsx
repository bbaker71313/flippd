import type { Metadata } from 'next';
import { Syne, IBM_Plex_Mono } from 'next/font/google';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';

const syne = Syne({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-syne',
  display: 'swap',
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ScanForProfit — Know in 8 seconds',
  description:
    'Scan any item at a thrift store or garage sale. Get a BUY, PASS, or HOT decision with profit number. Early access now open.',
  openGraph: {
    title: 'ScanForProfit — Know in 8 seconds',
    description: 'Scan any item. Know your profit before you pay.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${syne.variable} ${ibmPlexMono.variable}`}>
      <body className="font-sans bg-sfp-background text-sfp-textPrimary antialiased">
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
