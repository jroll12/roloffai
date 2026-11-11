import { CURRENCY } from './catalog.js';
import { ValidationError } from './checkout.js';

const REQUIRED_ADDRESS = ['line1', 'city', 'postal_code', 'country'];

export function validateInvoiceRequest(body) {
  const { customer, items, daysUntilDue = 14 } = body ?? {};
  if (!customer?.email || !customer?.name) throw new ValidationError('customer.name and customer.email are required');
  // Automatic tax needs a resolvable customer location. US/CA/IN need a full address.
  for (const f of REQUIRED_ADDRESS) {
    if (!customer.address?.[f]) throw new ValidationError(`customer.address.${f} is required for tax calculation`);
  }
  if (!Array.isArray(items) || items.length === 0) throw new ValidationError('items must be a non-empty array');
  for (const it of items) {
    if (!it.description || typeof it.description !== 'string') throw new ValidationError('each item needs a description');
    if (!Number.isInteger(it.amount) || it.amount <= 0) throw new ValidationError('item.amount must be a positive integer in cents');
  }
  if (!Number.isInteger(daysUntilDue) || daysUntilDue < 1 || daysUntilDue > 90) {
    throw new ValidationError('daysUntilDue must be an integer from 1 to 90');
  }
  return { customer, items, daysUntilDue };
}

// Creates a customer, a draft invoice with automatic tax, adds line items, finalizes and emails it.
export async function createAndSendInvoice(stripe, body, { taxCode, idempotencyKey } = {}) {
  const { customer, items, daysUntilDue } = validateInvoiceRequest(body);
  const opt = (suffix) => (idempotencyKey ? { idempotencyKey: `${idempotencyKey}:${suffix}` } : undefined);

  const cust = await stripe.customers.create(
    { email: customer.email, name: customer.name, address: customer.address },
    opt('customer'),
  );

  const invoice = await stripe.invoices.create(
    {
      customer: cust.id,
      collection_method: 'send_invoice',
      days_until_due: daysUntilDue,
      auto_advance: false, // we finalize explicitly below
      pending_invoice_items_behavior: 'exclude',
      automatic_tax: { enabled: true },
    },
    opt('invoice'),
  );

  try {
    for (const [i, it] of items.entries()) {
      await stripe.invoiceItems.create(
        {
          customer: cust.id,
          invoice: invoice.id,
          currency: CURRENCY,
          amount: it.amount,
          description: it.description,
          tax_behavior: 'exclusive',
          ...(taxCode ? { tax_code: taxCode } : {}),
        },
        opt(`item-${i}`),
      );
    }
    const finalized = await stripe.invoices.finalizeInvoice(invoice.id);
    return await stripe.invoices.sendInvoice(finalized.id);
  } catch (err) {
    // Don't leave a dangling draft behind.
    await stripe.invoices.del(invoice.id).catch(() => {});
    throw err;
  }
}
