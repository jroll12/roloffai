// Fulfillment lives here, never on the success page.
// `onPaid` is the single place to decide what "paid" triggers (email, calendar link, CRM, etc).

export function createWebhookHandler(stripe, { webhookSecret, onPaid = defaultOnPaid, onFailed = defaultOnFailed, seen = new Set() } = {}) {
  if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET is required');

  return async function handle(rawBody, signature) {
    // Throws on a bad signature; the caller should answer 400.
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    // Stripe retries and can deliver an event more than once. NOTE: this Set is per-process.
    // Make onPaid itself idempotent (key on session/invoice id) or swap `seen` for a durable store.
    if (seen.has(event.id)) return { duplicate: true, type: event.type };
    seen.add(event.id);

    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object;
        // With delayed payment methods, "completed" can arrive while still unpaid.
        if (session.payment_status !== 'unpaid') await onPaid({ kind: 'checkout', id: session.id, object: session });
        break;
      }
      case 'checkout.session.async_payment_failed':
        await onFailed({ kind: 'checkout', id: event.data.object.id, object: event.data.object });
        break;
      case 'invoice.paid':
        await onPaid({ kind: 'invoice', id: event.data.object.id, object: event.data.object });
        break;
      case 'invoice.payment_failed':
        await onFailed({ kind: 'invoice', id: event.data.object.id, object: event.data.object });
        break;
      case 'charge.dispute.created':
        console.warn('DISPUTE opened', event.data.object.id, 'respond in the Dashboard before the evidence deadline');
        break;
      default:
        break;
    }
    return { duplicate: false, type: event.type };
  };
}

async function defaultOnPaid({ kind, id }) {
  console.log(`[paid] ${kind} ${id}`);
}
async function defaultOnFailed({ kind, id }) {
  console.warn(`[payment failed] ${kind} ${id}`);
}
