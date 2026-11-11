import { randomBytes } from 'node:crypto';
import { CATALOG, CURRENCY } from './catalog.js';

function randomLetters(n) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  return Array.from(randomBytes(n), (b) => alphabet[b % 26]).join('');
}

export class ValidationError extends Error {}

export async function createCheckoutSession(stripe, { offerId, quantity = 1 }, { siteUrl, taxCode, idempotencyKey } = {}) {
  const offer = Object.hasOwn(CATALOG, offerId) ? CATALOG[offerId] : undefined;
  if (!offer) throw new ValidationError(`Unknown offer: ${offerId}`);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > offer.maxQuantity) {
    throw new ValidationError(`quantity must be an integer from 1 to ${offer.maxQuantity}`);
  }
  if (!siteUrl) throw new Error('siteUrl is required');

  const params = {
    mode: 'payment',
    line_items: [
      {
        quantity,
        price_data: {
          currency: CURRENCY,
          unit_amount: offer.unitAmount,
          tax_behavior: 'exclusive',
          product_data: {
            name: offer.name,
            description: offer.description,
            ...(taxCode ? { tax_code: taxCode } : {}),
          },
        },
      },
    ],
    // Tax only collects where you have an ACTIVE registration. Run `npm run tax:check`.
    automatic_tax: { enabled: true },
    tax_id_collection: { enabled: true }, // lets business customers enter a VAT/GST ID
    customer_creation: 'always',
    invoice_creation: { enabled: true }, // gives business buyers a proper invoice, not just a receipt
    success_url: `${siteUrl}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/`,
    metadata: { offer_id: offerId },
    integration_identifier: `roloffai-checkout-${randomLetters(8)}`,
    // payment_method_types intentionally omitted: dynamic payment methods are managed in the Dashboard.
  };

  return stripe.checkout.sessions.create(params, idempotencyKey ? { idempotencyKey } : undefined);
}
