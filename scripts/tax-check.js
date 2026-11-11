// Read-only Stripe Tax verification. Never creates or changes registrations.
//   npm run tax:check                                   -> settings + registrations
//   npm run tax:check -- --country US --state CA --postal 94105 --city "San Francisco" --line1 "1 Market St"
//   npm run tax:check -- --codes consulting             -> search product tax codes to review with your advisor
import { parseArgs } from 'node:util';
import { createStripeClient } from '../src/stripe.js';

const { values: a } = parseArgs({
  options: {
    country: { type: 'string' }, state: { type: 'string' }, postal: { type: 'string' },
    city: { type: 'string' }, line1: { type: 'string' }, codes: { type: 'string' },
  },
});
const stripe = createStripeClient();

if (a.codes) {
  const needle = a.codes.toLowerCase();
  for await (const c of stripe.taxCodes.list({ limit: 100 })) {
    if (`${c.name} ${c.description}`.toLowerCase().includes(needle)) console.log(`${c.id}\t${c.name}`);
  }
  console.log('\nConfirm the code with your tax advisor. Docs: https://docs.stripe.com/tax/tax-codes');
  process.exit(0);
}

const settings = await stripe.tax.settings.retrieve();
console.log('Tax settings status:', settings.status, settings.status === 'pending' ? '(set a head office address first)' : '');

const regs = await stripe.tax.registrations.list({ status: 'all', limit: 100 });
const active = regs.data.filter((r) => r.status === 'active');
console.log(`Registrations: ${regs.data.length} total, ${active.length} active`);
for (const r of regs.data) console.log(` - ${r.country}${r.country_options?.[r.country.toLowerCase()]?.state ?? ''} ${r.status}`);
if (active.length === 0) console.log('WARNING: no active registration. automatic_tax will silently collect $0 tax.');

if (a.country) {
  const calc = await stripe.tax.calculations.create({
    currency: 'usd',
    line_items: [{ amount: 10000, reference: 'tax-check', tax_behavior: 'exclusive', ...(process.env.STRIPE_TAX_CODE_SERVICES ? { tax_code: process.env.STRIPE_TAX_CODE_SERVICES } : {}) }],
    customer_details: {
      address: { country: a.country, state: a.state, postal_code: a.postal, city: a.city, line1: a.line1 },
      address_source: 'billing',
    },
  });
  for (const b of calc.tax_breakdown) console.log(`Test calc: taxability_reason=${b.taxability_reason} tax=${b.amount}`);
  if (calc.tax_breakdown.some((b) => b.taxability_reason === 'not_collecting')) {
    console.log('BROKEN: not_collecting means no registration in that jurisdiction OR a Nontaxable product tax code.');
  }
}
