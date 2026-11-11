import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAndSendInvoice } from '../src/invoices.js';
import { ValidationError } from '../src/checkout.js';
import { fakeStripe } from './helpers.js';

const body = {
  customer: { name: 'Acme', email: 'ap@acme.test', address: { line1: '1 Main', city: 'Austin', state: 'TX', postal_code: '78701', country: 'US' } },
  items: [{ description: 'Audit, phase 1', amount: 50000 }],
};

test('creates, taxes, finalizes and sends in order', async () => {
  const s = fakeStripe();
  const inv = await createAndSendInvoice(s, body);
  assert.deepEqual(s.calls.map((c) => c[0]), ['customers.create', 'invoices.create', 'invoiceItems.create', 'invoices.finalize', 'invoices.send']);
  assert.deepEqual(s.calls[1][1].automatic_tax, { enabled: true });
  assert.equal(s.calls[1][1].collection_method, 'send_invoice');
  assert.equal(inv.status, 'open');
});

test('requires a full address because tax needs a location', async () => {
  const s = fakeStripe();
  const bad = structuredClone(body);
  delete bad.customer.address.postal_code;
  await assert.rejects(createAndSendInvoice(s, bad), ValidationError);
  assert.equal(s.calls.length, 0);
});

test('rejects non-integer or non-positive amounts', async () => {
  for (const amount of [0, -5, 10.5, '100']) {
    await assert.rejects(createAndSendInvoice(fakeStripe(), { ...body, items: [{ description: 'x', amount }] }), ValidationError);
  }
});

test('deletes the draft if adding an item fails', async () => {
  const s = fakeStripe();
  s.invoiceItems.create = async () => { throw new Error('boom'); };
  await assert.rejects(createAndSendInvoice(s, body), /boom/);
  assert.ok(s.calls.some((c) => c[0] === 'invoices.del' && c[1] === 'in_1'));
});

test('derives per-call idempotency keys from the request key', async () => {
  const s = fakeStripe();
  await createAndSendInvoice(s, body, { idempotencyKey: 'req-1' });
  assert.equal(s.calls[0][2].idempotencyKey, 'req-1:customer');
});
