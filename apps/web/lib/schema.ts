export const softwareAppSchema = {
  '@context': 'https://schema.org',
  '@type': ['SoftwareApplication', 'MobileApplication'],
  name: 'ScanForProfit',
  url: 'https://www.scanforprofit.com',
  applicationCategory: 'BusinessApplication',
  applicationSubCategory: 'FinanceApplication',
  operatingSystem: 'Android, iOS',
  description:
    'AI-powered thrift store scanner for eBay resellers. Point your camera, get BUY/PASS/HOT decisions in 8 seconds with real profit math.',
  offers: [
    { '@type': 'Offer', name: 'Scout', price: '0', priceCurrency: 'USD' },
    {
      '@type': 'Offer',
      name: 'Hustle',
      price: '19',
      priceCurrency: 'USD',
      billingDuration: 'P1M',
    },
    {
      '@type': 'Offer',
      name: 'Stack',
      price: '49',
      priceCurrency: 'USD',
      billingDuration: 'P1M',
    },
  ],
} as const;

export const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What if the scan gets the price wrong?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "ScanForProfit pulls from recent eBay sold listings — the same data professional resellers use. It can't predict the future, but it gives you a data-backed number in 8 seconds instead of a guess in 5 minutes. You still make the call.",
      },
    },
    {
      '@type': 'Question',
      name: "I already have eBay's app. Why pay for this?",
      acceptedAnswer: {
        '@type': 'Answer',
        text: "eBay's app searches for you. ScanForProfit decides for you. It calculates profit after fees, ranks items by margin, writes your listing copy, and tracks what you actually made. Those are four things eBay's app doesn't do.",
      },
    },
    {
      '@type': 'Question',
      name: 'Does it work for the random stuff I find — not just electronics?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. ScanForProfit is built for the long tail of reselling: housewares, tools, vintage items, clothing, toys, collectibles. If it has a sold history on eBay, you get a number. If it does not, you get a signal that the market is thin.',
      },
    },
    {
      '@type': 'Question',
      name: "I'm not technical. How hard is this to set up?",
      acceptedAnswer: {
        '@type': 'Answer',
        text: "Download the app. Tap the scan button. Point your camera. That's it. If you can use eBay's app, you can use ScanForProfit.",
      },
    },
    {
      '@type': 'Question',
      name: 'If I cancel, do I lose my inventory history?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No. You can export your full inventory at any time — before or after cancelling. Your data is yours.',
      },
    },
  ],
} as const;
