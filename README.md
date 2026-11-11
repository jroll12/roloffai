# roloffai payments

Stripe Payments, Invoicing and Tax for roloffai.com (AI consulting: audits, 1:1 and group sessions).

## Flows

| Need | Endpoint | Notes |
| --- | --- | --- |
| Buyer pays online for a fixed offer | `POST /api/checkout` `{offerId, quantity}` | Returns a Stripe-hosted Checkout URL. Prices live in `src/catalog.js`, never from the client. |
| You bill a client after scoping | `POST /api/invoices` (Bearer `ADMIN_API_TOKEN`) | Creates customer, taxed invoice, finalizes and emails it. Net-14 by default. |
| Know when money lands | `POST /webhook` | Signature verified. Fulfillment goes in `onPaid` (`src/webhooks.js`). Required, not optional. |

## Setup

1. `cp .env.example .env` and fill in a **sandbox** restricted key (`rk_test_...`). No account yet? `stripe sandbox create`.
2. `npm install && npm test`
3. `stripe listen --forward-to localhost:3000/webhook` and put the printed `whsec_...` in `.env`.
4. `npm start`

## Tax: do this before going live

`automatic_tax` silently collects $0 where you have no **active registration**. Nothing errors.

```bash
npm run tax:check                      # settings + registrations
npm run tax:check -- --codes consulting # candidate product tax codes (confirm with your advisor)
npm run tax:check -- --country US --state TX --postal 78701 --city Austin --line1 "1 Main St"
```

If `taxability_reason` is `not_collecting`, setup is broken. The script never creates registrations; that is a legal decision for you and your tax advisor.

## Before live mode

- Replace placeholder prices in `src/catalog.js`.
- Re-create Tax settings and registrations in live mode (sandbox ones do not carry over).
- Implement `onPaid` and make it idempotent. The in-memory event dedupe is per-process only.
- Switch to a live restricted key. Rotate any key that was ever pasted into chat or committed.
