# Admin approval gate

All guests must have a **server-authenticated, currently approved guest
record** before accessing features beyond the welcome/Home page. Existing
guest statuses are preserved; this release does not approve or reject anyone.
Admins review guests in **Admin Dashboard → Guests & RSVPs** or Approvals.
New registrations remain `pending` regardless of browser-submitted status.

## Experience

- Pending guests see Home plus **Waiting for admin approval**. Navigation,
  sharing, Chat, gifts/payments, vendors, programmes, guide companions, music,
  competitions, guest-book, RSVPs, reactions and push signup remain locked.
- Visible tabs show a disabled state; deep links and browser-history routing
  return to Home. The admin sign-in form and secure guest sign-out remain
  available. Approval status refreshes every 15 seconds while the tab is visible
  and can be checked manually. Approval unlocks without another login.
- Saved names/IDs/status in local storage never establish approval. Expired or
  missing guest cookies require verified sign-in. OTP remains enabled; opening
  Home or checking approval does not send a code.
- Failed approval checks keep features locked. Revoked/deleted approval locks
  the app again. Already accepted uploads are not cancelled by the UI.
- The Gallery navigation seal is larger and unboxed, keeping the gold pulse,
  accessible label, consistent label alignment and reduced-motion fallback.

## Server enforcement

`guest-access.js` installs middleware **before all feature routes**, including
competitions. Unknown future feature routes default to denied. Every protected
request checks current database status from a valid server cookie; no client
ID, name, phone, local status or request body can bypass it. Admin requests use
the existing bearer-session validator. Browser API calls attach the existing
admin token to feature requests so authenticated admins retain access.

Only onboarding/OTP/registration/login/logout, health, approval status and
limited Home settings are available before approval. The full settings feed
is not available to pending/anonymous guests. Existing admin endpoints retain
their individual `requireAdmin` guards. Speso's exact TEST/LIVE webhook POSTs
remain outside the guest gate and still require their existing raw-body HMAC,
freshness and authoritative settlement verification. No payment activation,
credential change or real-money test is part of this release.

Quick check-in, if explicitly enabled, gets a separate HTTP-only approval
cookie bound to its existing entry secret; this does **not** turn quick entry
into a phone-verified voting/Chat identity. Production OTP mode is unchanged.
Guest logout revokes that quick entry and the verified guest session.

## Notifications and data

An additive `push_access` mapping binds new/renewed push subscriptions to
their authenticated session, not a name. Push delivery checks both current
approval and session validity. Revoked, expired, signed-out and anonymous
subscriptions cannot receive updates. Old unbound subscriptions are retained
but paused until bound to an approved guest/admin. When access unlocks, the
browser rebinds an existing subscription only if notification permission is
already granted; it never prompts or creates a new subscription automatically.
Enable Notifications remains available to renew manually if needed.
No existing subscription rows, guests, gifts, uploads or settings are deleted.

Static frontend code and existing random `/uploads/` media URLs remain public
assets. This is a feature/API approval gate, **not confidential media storage**
or a recall of files already downloaded. Existing guest uploads are preserved.

## Deployment / verification

Install `server/guest-access.js`, and updated `server.js`, `competitions.js`,
`guest-onboarding.js` in the flat API directory. Snapshot live data/configuration
before deploying and avoid restarting during active requests/uploads or media
workers. The only new table is `push_access`; no approval backfill is performed.

Tests include `tests/guest-access.test.cjs`, the disposable real-API/browser
`WEDDING_E2E_APPROVAL_ONLY=1` suite and approved regression suites via
`WEDDING_E2E_APPROVED_SUITE=vendors|broadcast|bridal|program|engagement|community|voice`.
The disposable fixture adds one test-only OTP for a genuinely new registration;
no codes are sent, and no production test guests or gifts are created.
