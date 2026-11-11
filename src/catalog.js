// Server-side catalog. Clients send an offer id, never a price.
//
// PLACEHOLDER PRICES: replace every unitAmount (in cents) before going live.
export const CURRENCY = 'usd';

export const CATALOG = {
  'ai-audit': {
    name: 'AI Readiness Audit',
    description: 'Fixed-scope audit of where AI fits in your business, with a prioritized roadmap.',
    unitAmount: 150000, // PLACEHOLDER $1,500.00
    maxQuantity: 1,
  },
  'strategy-session': {
    name: 'AI Strategy Session (1:1)',
    description: 'Customized working session for an individual.',
    unitAmount: 25000, // PLACEHOLDER $250.00 per session
    maxQuantity: 10,
  },
  'group-workshop': {
    name: 'AI Group Workshop',
    description: 'Customized session for a team or group.',
    unitAmount: 100000, // PLACEHOLDER $1,000.00 per session
    maxQuantity: 5,
  },
};
