export const softwareAppSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'ScanForProfit',
  applicationCategory: 'BusinessApplication',
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
      name: 'How accurate are the profit estimates?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: "ScanForProfit pulls from real eBay sold listings — not asking prices. You see the comps. You make the call.",
      },
    },
    {
      '@type': 'Question',
      name: 'Does this work for all categories?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Electronics, clothing, home goods, collectibles, books, sports equipment, toys. If it sells on eBay, it works.',
      },
    },
    {
      '@type': 'Question',
      name: "What if I'm not tech-savvy?",
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Point. Tap. Done. If you can take a photo with your phone, you can use ScanForProfit.',
      },
    },
    {
      '@type': 'Question',
      name: 'Can I export my data?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Yes. CSV export anytime. Stack tier includes API access. Your inventory is yours.',
      },
    },
    {
      '@type': 'Question',
      name: 'What happens after my trial?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'You drop to Scout tier automatically — 25 scans/month, 10 items, free forever. No charge, no card required.',
      },
    },
  ],
} as const;
