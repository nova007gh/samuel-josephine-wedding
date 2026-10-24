# Direct cash gifts — v241

Guests use **Gifts** to copy the admin-published MoMo number and account name,
then send directly through their own provider’s app or official menu. The
wedding app does not initiate a debit, collect a PIN, query a provider, accept
payment callbacks, or automatically verify a transfer.

The saved destination was preserved, not independently account-verified:
**+233594204990 — Samuel & Josephine**. The couple must confirm ownership and
the account name shown by MoMo before collecting gifts. Only an authenticated
admin can change these details.

Only enabled `cash` is returned by `/api/gift-funds` and accepted for new
reports. Historical NOVA1/other funds and all existing gift/payment rows are
retained. They are not new guest checkout options. The optional `/api/gifts`
form records a **guest report**, not receipt of money. New reports always
return `paymentVerified:false`; the public wall excludes phone, email and
transaction references. Previously authoritative live settlements retain their
historical verified status without making any external request.

The browser supplies a per-attempt request key. Concurrent/retried identical
reports reuse one gift ID; changed details with the same key return 409.
Approval, admin authentication and rate limits remain in place. A new additive
`manual_gift_receipts` table stores retry receipts; no old tables are dropped.

Former `/api/gift-payments`, `/api/admin/gift-payments`, and `/api/payments`
paths return HTTP 410 before parsing bodies. Provider modules and the browser
script are removed from runtime and precache. Old browser tabs cannot create
or settle provider orders. Previously downloaded assets cannot be recalled.
Payment environment entries are removed from the live configuration, but
provider-side key revocation still requires the account owner. Private
pre-change backups retain the old configuration for recovery and must remain
root-only; do not paste them into logs or source control.

## Remaining launch prerequisites (not software-complete claims)

- Confirm the recipient account with the couple; do not send a paid test
  without explicit permission.
- Resolve SMS delivery/sender-account issues; OTP remains enabled. No sender
  swap or paid SMS test is authorized by this release.
- Enter confirmed seating and rehearse QR scanning on the actual entrance
  phones. Synthetic camera tests do not establish physical-device support.
- Supply the livestream viewing URL, schedule and embedding permission, then
  rehearse operator/audio/video setup.
- Test microphone, share sheet, push delivery and keyboard on real phones.
- Supply remaining approved portraits/vendor/entertainment content as needed.
- Supply an off-site backup destination/access and rehearse a restore.

Do not fabricate content, attendance, table assignments or delivery results
to close these items. No live payment-provider activation/webhook rehearsal is
needed under the manual-only design.
