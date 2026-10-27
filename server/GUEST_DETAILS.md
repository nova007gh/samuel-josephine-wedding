# Admin detailed guest list (v247)

Open **Admin → Detailed Guest List**. Search names, phone numbers, email or
connection; filter approved/pending registrations. Select a name to see contact
details, registration RSVP/party size, arrival, saved table/directions and assigned
team profiles. Two separate activity views have their own load-more pagination:

- **Verified account activity**: authenticated RSVPs, guestbook posts/replies,
  photo/video/voice/music memories, manual gift reports, saved Wedding Chat
  messages/uploads/reactions, competition votes and comments.
- **Possible legacy matches**: older unowned records matching a saved contact or
  a unique exact normalized name. They are explicitly **not verified ownership**.
  Ambiguous names are excluded. Known ownership belonging to another account
  cannot be suggested. Existing content/RSVP/gift editors retain unmatched data.

Only activity saved in this app is available: no external SMS/email inbox or
external transactions are read. Anonymous historic likes have no author to
recover. Reaction timestamps not stored historically are labelled not recorded.
Guestbook replies displayed within a parent conversation do not imply ownership
of every reply; newly submitted replies have their own account attribution.

New `guest_activity_owners(kind,recordId,guestId)` records come exclusively from
the resolved HTTP-only guest session, **never** body guestId/name/phone/email.
RSVP/post/reply/upload ownership is committed in the same SQLite transaction as
the content; gifts record ownership inside the existing idempotent transaction.
Admin submissions are not attributed to a guest cookie. Existing authenticated
manual-gift receipt ownership is reused without rewriting historic records.
The established gift retry-key namespace stays unchanged; new admin gift reports
carry an internal `@admin` attribution marker so an incidental guest cookie cannot
link them via the historical receipt fallback.
No historical mass-name backfill or automatic ownership reassignment occurs.
Deleted records simply disappear through content joins; retained ownership keys
are not reassigned to new guests with the same display name.

APIs `GET /api/admin/guest-details` and `GET /api/admin/guest-details/:id` require
the existing real admin bearer session and send `Cache-Control: no-store`.
List parameters: `q`, `status` (empty/approved/pending), zero-based `page`.
Detail parameters: `mode` (linked/possible), zero-based `page`. Both page sizes
are 30 with `total`/`hasMore`; no silent first-page-only truncation. Detail responses
exclude OTPs, account/session tokens, private settings and QR pass codes.
Frontend dossier data stays in DOM/page memory only; navigation, auth loss,
cross-tab storage changes and page exit clear it and invalidate late responses.
Media links accept local upload filenames only; stored text is rendered as text.

Arrival totals remain available **only on Admin → Entrance & Tables**, the QR
scanner dashboard. The count block is no longer moved into the Home check-in
dialog, even for admins. Guest arrival APIs return only the signed-in guest’s
own arrival and post-arrival seat, never aggregate counts. Counting/confirmation
and duplicate-safe arrival storage are unchanged. Registration is not arrival.
The public header badge was a saved photo-like counter, not an entrance count;
it is now hidden without deleting likes or changing the heart action.

Home’s team-profile entry now uses the same icon/text/chevron grid structure as
the neighbouring menu cards, fixing the narrow one-column text in the screenshot.
Menu icons stay unboxed and the S&J seal/heartbeat and Home check-in copy remain.

Gifts stay manual-only to the saved couple MoMo destination. A gift report is
not verified payment; only existing completed live historical payment records
can carry historical verification. Retired payment routes stay HTTP 410.
