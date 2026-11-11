import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCheckoutSession, ValidationError } from '../src/checkout.js';
import { fakeStripe } from './helpers.js';

const opts = { siteUrl: 'https://roloffai.com' };

test('builds a Checkout Session with tax on and no payment_method_types', async () => {
  const s = fakeStripe();
  await createCheckoutSession(s, { offerId: 'ai-audit' }, opts);
  const [, params] = s.calls[0];
  assert.equal(params.mode, 'payment');
  assert.deepEqual(params.automatic_tax, { enabled: true });
  assert.equal('payment_method_types' in params, false);
  assert.match(params.integration_identifier, /^roloffai-checkout-[a-z]{8}$/);
  assert.equal(params.line_items[0].price_data.tax_behavior, 'exclusive');
});

test('price comes from the server catalog, not the client', async () => {
  const s = fakeStripe();
  await createCheckoutSession(s, { offerId: 'strategy-session', quantity: 2, unitAmount: 1 }, opts);
  assert.equal(s.calls[0][1].line_items[0].price_data.unit_amount, 25000);
});

test('rejects unknown offers (incl. prototype keys) and bad quantities', async () => {
  const s = fakeStripe();
  await assert.rejects(createCheckoutSession(s, { offerId: 'nope' }, opts), ValidationError);
  await assert.rejects(createCheckoutSession(s, { offerId: 'constructor' }, opts), ValidationError);
  await assert.rejects(createCheckoutSession(s, { offerId: 'ai-audit', quantity: 2 }, opts), ValidationError);
  await assert.rejects(createCheckoutSession(s, { offerId: 'ai-audit', quantity: 1.5 }, opts), ValidationError);
  assert.equal(s.calls.length, 0);
});

test('applies the product tax code only when configured', async () => {
  const s = fakeStripe();
  await createCheckoutSession(s, { offerId: 'ai-audit' }, { ...opts, taxCode: 'txcd_test' });
  assert.equal(s.calls[0][1].line_items[0].price_data.product_data.tax_code, 'txcd_test');
});
