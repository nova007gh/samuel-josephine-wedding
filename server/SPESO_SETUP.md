# Speso gift collection

> **Retired in v241 at the couple’s request.** This document is historical,
> not an activation checklist. The provider implementation and UI are removed;
> all former payment routes return HTTP 410. Existing records remain intact.
> Use `MANUAL_GIFTS.md` instead. Do not restore provider credentials or enable
> collections without new explicit authorization.

Reference: <https://docs.speso.co/api/collections>,
<https://docs.speso.co/api/webhooks>, <https://docs.speso.co/api/environments>.

## Safe default

`SPESO_MODE` defaults to `off`. Existing manual MoMo settings, gifts, guest OTP,
and gift-fund administration remain unchanged. No payment prompt can be sent
while collection is off. Never put keys in frontend files, commits, or chat.
Rotate credentials that have been exposed, including both live credentials
previously pasted into chat. This implementation does not use those values.

## Sandbox preview (admin only)

Install fresh secrets privately in `/opt/wedding-api/api.env` using a server
editor. Do not use `echo KEY=...` commands that retain secrets in shell history.
Keep the environment and any backups readable only by the service administrator.

```dotenv
SPESO_MODE=test
SPESO_TEST_API_KEY=<fresh test API key>
SPESO_TEST_WEBHOOK_SECRET=<fresh test signing secret>
SPESO_PUBLIC_ORIGIN=https://snybena.com
SPESO_MERCHANT_NAME=<confirmed Speso business display name>
```

Restart `wedding-api`. Configure the **test** callback URL in Speso Developer:

`https://snybena.com/api/payments/speso/test/webhook`

Collections also send this callback URL explicitly on each initiation.
If an IP whitelist is enabled, allow the API server's outbound IP according to
the Speso account configuration. Sign in as a wedding administrator and open
Gifts. Sandbox checkout is explicitly labeled and hidden from ordinary guests.
Successful sandbox payments appear only in admin Speso payment activity, never
in real gifts or push notifications. Use Speso's documented sandbox test
numbers/approval mechanism; do not assume arbitrary numbers are supported.

## Live activation requires separate authorization

Confirm the merchant account and settlement destination with the couple first.
Collections credit the **Speso payment wallet**, not the old displayed MoMo
recipient directly. Confirm account approval/KYC, payout arrangements, account
fees, supported networks and provider limits in the Speso dashboard. The app
supports GHS 50–20,000; provider/account limits may be lower. No fee percentage
is hardcoded or added to the requested gift amount.

After successful sandbox testing, install fresh live secrets privately:

```dotenv
SPESO_MODE=live
SPESO_LIVE_API_KEY=<fresh live API key>
SPESO_LIVE_WEBHOOK_SECRET=<fresh live signing secret>
SPESO_LIVE_CONFIRMED=true
SPESO_MERCHANT_NAME=<couple-approved Speso business display name>
```

Live callback: `https://snybena.com/api/payments/speso/live/webhook`.
Do not set live confirmation without the user's explicit account/activation
approval. Test keys cannot enable live collection, and live keys cannot enable
the sandbox. Switching modes does not migrate orders, funds or gifts.

## Payment integrity and recovery

- A random 256-bit client attempt secret survives reloads in the same tab's
  session storage. Only its hash is stored on the server. The same secret and
  unchanged payment details always reuse the existing order, never another
  collection POST. A per-phone pending lock also prevents parallel prompts
  from separate tabs/devices. New prompt requests are rate-limited.
- Each initiation explicitly names its expected test/live mode. If a tab's
  mode is stale after a server configuration change, initiation is rejected
  before creating an order or contacting Speso. Reload before proceeding.
- An initiation timeout is **unknown**, not failed. Recheck the original order.
  Do not automatically retry an upstream POST or tell the guest to pay again.
- Never collect or ask for a MoMo PIN in the wedding app. Guests approve the
  provider prompt on their phone. The payer number is not the recipient number.
- Callbacks require the correct environment's HMAC-SHA256 signing secret,
  exact raw JSON bytes and a timestamp within five minutes (including future
  skew). Unsigned callbacks are rejected even if Speso permits them.
- Both callbacks and guest/admin status checks independently GET the order
  from Speso. Completion must match order, provider reference, exact amount,
  GHS currency, payer phone and network. Browser input and redirects never mark
  orders paid. Speso uses `MTN`, `VOD` (Telecel), and `ATL` (AirtelTigo).
- One database transaction records a verified **live** gift exactly once and
  marks the order completed. Repeated callbacks and late failures cannot add
  duplicate gifts or downgrade completion. Existing manual confirmations are
  not retroactively labeled verified.
- Admin payment activity allows reconciliation of pending/unknown attempts.
  If the original tab/secret is lost, ask the couple to inspect that activity;
  do not bypass the per-phone lock. Unknown orders are not auto-expired since
  Speso's documentation does not promise a safe collection expiry window.
- Keep each mode's callback URL and signing secret distinct. Reconcile open
  orders before switching modes; callbacks for the inactive mode are rejected.
- Set `SPESO_MODE=off` and restart to stop new collection requests. Retain
  credentials privately and arrange reconciliation for any in-flight orders
  before disabling; the manual gift records are never erased.

## Checks

`node tests/speso-payments.test.cjs` runs pure validation/signature tests.
`tests/speso-payments-api.cjs` uses disposable SQLite and mocked provider HTTP.
`node tests/readonly-preview.cjs <output> --speso` exercises mocked checkout,
duplicates, lost responses, session recovery and mobile layouts. These tests
never send a real collection or spend provider credits. Real Speso sandbox and
explicitly authorized live handset tests are separate deployment gates.
