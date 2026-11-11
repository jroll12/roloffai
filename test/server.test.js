import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/server.js';
import { createStripeClient } from '../src/stripe.js';
import { fakeStripe } from './helpers.js';

const SECRET = 'whsec_testsecret';
const env = { STRIPE_WEBHOOK_SECRET: SECRET, SITE_URL: 'https://roloffai.com', ADMIN_API_TOKEN: 'adm-token' };
let server, base;

// Real Stripe client (for webhook signing helpers) with a dummy key; no network calls are made.
const real = createStripeClient('sk_test_dummy');
const stripe = Object.assign(fakeStripe(), { webhooks: real.webhooks });

before(async () => {
  server = createApp({ stripe, env }).listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

const post = (path, body, headers = {}) =>
  fetch(base + path, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });

test('/api/checkout returns the hosted URL', async () => {
  const r = await post('/api/checkout', { offerId: 'ai-audit' });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).url, 'https://checkout.stripe.test/cs_1');
});

test('/api/checkout 400s on bad input', async () => {
  assert.equal((await post('/api/checkout', { offerId: 'nope' })).status, 400);
});

test('/api/invoices requires the admin token', async () => {
  assert.equal((await post('/api/invoices', {})).status, 401);
  assert.equal((await post('/api/invoices', {}, { authorization: 'Bearer wrong-token' })).status, 401);
  assert.equal((await post('/api/invoices', {}, { authorization: 'Bearer adm-token' })).status, 400);
});

function signedEvent(id, type, object) {
  const payload = JSON.stringify({ id, object: 'event', type, data: { object } });
  const header = real.webhooks.generateTestHeaderString({ payload, secret: SECRET });
  return { payload, header };
}

test('webhook rejects a bad signature', async () => {
  const { payload } = signedEvent('evt_1', 'invoice.paid', { id: 'in_1' });
  assert.equal((await post('/webhook', payload, { 'stripe-signature': 't=1,v1=bad' })).status, 400);
});

test('webhook accepts a valid signature and dedupes retries', async () => {
  const { payload, header } = signedEvent('evt_2', 'checkout.session.completed', { id: 'cs_9', payment_status: 'paid' });
  assert.equal((await post('/webhook', payload, { 'stripe-signature': header })).status, 200);
  assert.equal((await post('/webhook', payload, { 'stripe-signature': header })).status, 200);
});
