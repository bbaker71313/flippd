import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Fira_Code } from 'next/font/google';
import { SpeedInsights } from '@vercel/speed-insights/next';
import './globals.css';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
});

const firaCode = Fira_Code({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://www.scanforprofit.com'),
  title: 'ScanForProfit — eBay Reseller Scanner. Profit in 8 Seconds.',
  description:
    'Scan any thrift store or garage sale item. Get a BUY, PASS, or HOT decision with real eBay sold-listing profit data in under 8 seconds. Free to start.',
  openGraph: {
    title: 'ScanForProfit — eBay Reseller Scanner. Profit in 8 Seconds.',
    description: 'Scan any item. Know your profit before you pay.',
    url: 'https://www.scanforprofit.com',
    type: 'website',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'ScanForProfit — scan an item, get a BUY decision with profit in 8 seconds',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ScanForProfit — eBay Reseller Scanner. Profit in 8 Seconds.',
    description: 'Scan any item. Know your profit before you pay.',
    images: ['/opengraph-image'],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plusJakartaSans.variable} ${firaCode.variable}`}>
      <body className="font-sans bg-sfp-background text-sfp-textPrimary antialiased">
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
