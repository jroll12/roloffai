import { timingSafeEqual } from 'node:crypto';
import express from 'express';
import { createStripeClient } from './stripe.js';
import { createCheckoutSession, ValidationError } from './checkout.js';
import { createAndSendInvoice } from './invoices.js';
import { createWebhookHandler } from './webhooks.js';

export function createApp({ stripe, env = process.env } = {}) {
  const app = express();
  const taxCode = env.STRIPE_TAX_CODE_SERVICES || undefined;
  const handleWebhook = createWebhookHandler(stripe, { webhookSecret: env.STRIPE_WEBHOOK_SECRET });

  // Webhook needs the RAW body for signature verification, so mount it before express.json().
  app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
      await handleWebhook(req.body, req.get('stripe-signature'));
      res.sendStatus(200);
    } catch (err) {
      if (err?.type === 'StripeSignatureVerificationError') return res.status(400).send('Bad signature');
      console.error('webhook handler error', err);
      res.sendStatus(500); // non-2xx makes Stripe retry
    }
  });

  app.use(express.json({ limit: '10kb' }));

  app.post('/api/checkout', async (req, res, next) => {
    try {
      const { offerId, quantity } = req.body ?? {};
      const session = await createCheckoutSession(stripe, { offerId, quantity }, { siteUrl: env.SITE_URL, taxCode });
      res.json({ url: session.url });
    } catch (err) {
      next(err);
    }
  });

  const requireAdmin = (req, res, next) => {
    const expected = Buffer.from(env.ADMIN_API_TOKEN ?? '');
    const given = Buffer.from((req.get('authorization') ?? '').replace(/^Bearer /, ''));
    if (expected.length === 0 || expected.length !== given.length || !timingSafeEqual(expected, given)) {
      return res.sendStatus(401);
    }
    next();
  };

  app.post('/api/invoices', requireAdmin, async (req, res, next) => {
    try {
      const invoice = await createAndSendInvoice(stripe, req.body, { taxCode, idempotencyKey: req.get('idempotency-key') });
      res.json({ id: invoice.id, status: invoice.status, hostedInvoiceUrl: invoice.hosted_invoice_url });
    } catch (err) {
      next(err);
    }
  });

  app.use((err, _req, res, _next) => {
    if (err instanceof ValidationError) return res.status(400).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Internal error' });
  });

  return app;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const app = createApp({ stripe: createStripeClient() });
  const port = Number(process.env.PORT ?? 3000);
  app.listen(port, () => console.log(`listening on :${port}`));
}
