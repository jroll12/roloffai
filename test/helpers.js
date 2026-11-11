// Fake Stripe client recording calls; no network.
export function fakeStripe() {
  const calls = [];
  const rec = (name, ret) => async (...args) => { calls.push([name, ...args]); return typeof ret === 'function' ? ret(...args) : ret; };
  return {
    calls,
    checkout: { sessions: { create: rec('checkout.create', { id: 'cs_1', url: 'https://checkout.stripe.test/cs_1' }) } },
    customers: { create: rec('customers.create', { id: 'cus_1' }) },
    invoices: {
      create: rec('invoices.create', { id: 'in_1' }),
      finalizeInvoice: rec('invoices.finalize', { id: 'in_1' }),
      sendInvoice: rec('invoices.send', { id: 'in_1', status: 'open', hosted_invoice_url: 'https://invoice.stripe.test/in_1' }),
      del: rec('invoices.del', {}),
    },
    invoiceItems: { create: rec('invoiceItems.create', { id: 'ii_1' }) },
  };
}
