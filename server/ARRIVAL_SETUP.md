# Entrance check-in and private table assistance

## Three different states

1. **Registration / signed-in check-in**: the existing Home button reads
   “Enter our wedding to check in”, then “Thanks for coming. You are checked in”
   when the server confirms this guest session. This is not evidence of venue
   arrival. Local names/IDs alone never confirm it.
2. **Admin approval**: still required for every feature beyond Home. Existing
   statuses are preserved; QR passes never approve guests or log them in.
3. **Entrance arrival**: a signed-in admin confirms the guest has physically
   arrived, using the QR scanner or protected manual guest search. This is a
   separate record; existing registration timestamps are not counted as arrivals.

## Admin workflow

### Home check-in screen (v242)

Home → **Enter our wedding to check in** opens the Guest Check-In dialog. The
button stays clickable after sign-in (its existing thank-you wording remains),
so returning guests do not register a second time just to open their pass.

- Signed-in entrance admins open the camera scanner immediately from that
  deliberate tap; the browser may ask for camera permission. Select **Scan
  Guest QR Code** to retry/start it. Nothing starts on ordinary page load.
- **Manual Check-In** stops the camera and opens protected guest search and
  seating controls. **Scan QR image** is available in scanner mode. Flashlight
  appears only if the camera reports torch support.
- **Show My Check-In QR Code** opens the signed-in approved guest's own stable
  QR, including after arrival. An admin login alone cannot choose another
  guest's personal pass. Guests never obtain guest search, counts or arrival
  confirmation permissions by opening the screen.
- Unverified/pending guests see sign-in/approval guidance, not a pass or guest
  list. Guest sign-in and entrance-admin sign-in remain distinct actions; no
  OTP is sent just by opening the screen.
- Closing, switching modes, navigating away, signing out or backgrounding
  stops camera tracks. Late permission grants are stopped; late pass responses
  from a closed/switched dialog are discarded. Dashboard and Home controls
  are restored to their original positions on close, without duplicate IDs or
  separate copies of private data. Unsaved seating drafts remain protected.
- Counts remain actual approved registered guest records, not the numbers in
  the design reference. The frame shows the actual camera feed; no reference
  venue photograph, mock guest or invented invitation total is published.

Open **Admin Dashboard → Entrance & Tables**. Search a registered guest by
name or phone. Save their confirmed **Table number/name** and **Location /
directions**. Party size remains separate. Assignments use their own revision
and transactional conflict checks; stale saves are rejected, not overwritten.
Failed-save drafts stay in memory, dirty forms survive polling, and sign-out
clears private guest data/drafts. Guest deletion does not reuse guest IDs;
orphan seating/pass/arrival records are excluded by live guest identity joins.

At the entrance:

- Approved, authenticated guests open Home → **Show my entrance QR**.
- Admin presses **Start QR scanner**, allows camera access, and scans that pass.
  A preview shows the guest's saved name and table. Verify the person, then press
  **Confirm entrance check-in**. Merely scanning/previewing records nothing.
- **Scan QR image** reads a JPEG/PNG/WebP pass locally (up to 8 MB / 24 MP).
  Camera and image decoding never upload frames or send them to third parties.
- If camera/image scanning is unavailable, search the registered guest and use
  **Confirm manual entrance check-in**. This never silently approves a guest.
- Repeat scans, lost-response retries, different devices and simultaneous
  confirmations all reuse one `guest_arrivals` primary-key record and timestamp.
- The camera is opt-in and stops on navigation, admin-tab changes, backgrounding,
  sign-out and page exit. Late permission grants are stopped too. Flashlight
  appears only on devices reporting torch support. A deliberate tap on Home's
  check-in screen (admin) or Start QR scanner is required before camera access.

Counts are actual approved registered guest records: Checked In, Not Yet Arrived,
Approved Guests. They are **not** total invitations or unregistered plus-ones.
No counts, table allocations, sample bookings or reference names are seeded.

## Guest experience and privacy

After admin entrance confirmation, the guest's Home card automatically shows
their saved table and location from a private, authenticated 15-second feed.
Explicit Jossy/Josephine/bride connections choose Jossy; explicit Sam/Samuel/
groom connections choose Sam. Unknown, mixed or negated connections use a
stable guest-ID-based fallback; it is not claimed to establish a relationship.
A small dismissible in-app notice is deferred during typing, dialogs, uploads,
Chat, Gifts and Broadcast. The assigned companion's artwork and text remain on
the Home card. “My entrance & table” in the companion dialog and personal
questions such as “Where is my table?” open that private card without adding
the request or assignment to public guide history/knowledge.

Unassigned guests are asked to see an usher. Missing directions are never
invented. Table details are returned only after entrance arrival and only for
the guest identified by the secure cookie—never a supplied ID/name/phone.
Pending guests cannot retrieve a pass or private arrival/seating feed, even if
an admin session is also present. Guests cannot call admin scan/confirmation or
seating-write endpoints. Revoked approval blocks access again.

The private feed is separate from `/api/guide`, generic settings, public cards
and shared guide conversations; there is no external AI service. QR passes are
random stable opaque values, not URLs, login credentials or phone/name payloads.
Only admins can resolve them. They are kept in page memory/canvas, not local
storage or service-worker cache. Users should not share pass screenshots.
Previously downloaded screenshots cannot be recalled; the admin must verify
the guest's identity at the entrance. Signing out removes private UI/QR data
and stale late responses are discarded. Signing out never deletes arrival.

## Persistent sessions

Verified and optional quick-entry sessions use persistent HTTP-only, secure
SameSite cookies with a rolling **400-day** limit (within browser cookie caps).
Active approval checks renew valid sessions at most daily without minting
another token. Existing valid sessions are extended on their next status check;
expired/revoked tokens are never revived. Browser-cleared/private storage or a
security expiration can still require sign-in; literal permanent browser login
cannot be guaranteed. Admin sessions retain their existing independent expiry.
Optional quick entry remains unverified for Chat/verified-only competitions.

A valid server session can restore the minimal local guest profile (ID/name)
and resume the app after storage loss without registering again. Signed-in
registration attempts return the current identity instead of inserting another
guest. Re-registering an existing OTP-verified phone preserves its original
registration timestamp. Neither path resets entrance arrival or seating.
Guest logout revokes that device's secure session. OTP remains enabled in
production, with its existing provider-delivery problems unchanged.

## Endpoints and rollout

- `GET /api/guest-arrival`: own approved guest's arrival and post-arrival table.
- `POST /api/guest-arrival/pass`: own stable entrance QR pass, same-origin.
- `GET /api/admin/arrivals`: protected list, seating, arrivals and genuine counts.
- `PATCH /api/admin/arrivals/:id/seating`: protected revision-checked assignment.
- `POST /api/admin/arrivals/resolve`: protected QR preview, no arrival write.
- `POST /api/admin/arrivals/confirm`: protected atomic QR/manual confirmation.

API responses are no-store. Admin writes use existing bearer validation plus
origin checks. Additive tables: `guest_seating`, `guest_arrivals`,
`guest_arrival_passes`; none are backfilled or populated on deployment.
Install the new `guest-arrival.js` and changed `server.js`, `guest-access.js`,
`guest-onboarding.js`, `competitions.js` in the flat API runtime. Snapshot fresh
database/configuration and confirm idle requests/workers before restarting.
No payment mode, credential or OTP-provider change is needed.

Locally bundled pinned QR libraries and licenses: `assets/vendor/README.md`.
Disposable real-API/browser checks:
`WEDDING_E2E_APPROVED_SUITE=arrivals node tests/isolated-e2e.cjs <output-dir>`.
Pure QR/relation checks: `node tests/guest-arrival.test.cjs`.
All test guest arrivals/tables are disposable. Do not test by checking real
guests in before the wedding. Physical-phone camera/torch and door rehearsal
remain necessary on the actual entrance devices.
