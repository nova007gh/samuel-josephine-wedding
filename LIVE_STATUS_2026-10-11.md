# snybena.com live audit — 11 October 2026

## Guest competition toasts — v178

A lightweight `/api/competitions/notices` feed is now polled on all guest pages
every 15 seconds while the app is visible and entered, outside uploads. New
published games show a dismissible cream/gold toast with their title and a
Vote Now / View Competition button opening that specific game. Upcoming games
announce their start time and get a separate alert when voting opens. Active
games are also discovered by guests returning later. Per-guest/device local
storage remembers shown events (also checked across tabs). Drafts, duplicates
saved as drafts, paused and closed games do not appear in the feed; ordinary
edits do not regenerate the publication event. Publishing from draft uses a
new server-owned timestamp. No ballot, group IDs or hidden results are exposed.
Admin pages and invitation/check-in gates do not show these guest toasts.
Multiple announcements display one at a time, with dismissal or a 15-second
timeout (the toast remains while hovered/focused). This is in-app discovery,
not guaranteed background/closed-app push delivery. Existing verified guest
voting rules and OTP-provider limitations are unchanged.

Isolated API tests passed for published/scheduled notices, draft/paused/closed
privacy, audience-sensitive action labels, stable timestamps on edits and new
timestamps on republishing. Mocked browser tests passed for notices on Home,
safe plain-text titles, mobile fit, direct competition navigation, persistent
dedup, scheduled opening alerts, removal cleanup, upload pause and admin
suppression. No live competition, publication or vote was created for testing.
Deployed UI and Gift Page Message regressions passed; live notices returned 200.
At this release a real competition was already present (1 admin record), so it
was preserved rather than replaced with fixtures. Existing guest/media/gift
records and settings passed comparison against the pre-v178 SQLite snapshot;
all referenced memory files existed and database integrity remained `ok`.

## Wedding Games & Competitions — v177

Added reference-inspired cream/gold guest competition lists, contestant/team
photo cards, vote confirmation and live rankings, plus a Competitions dashboard
category and management views. Guests enter from Home or Share; the existing
seven navigation tabs and Gallery position remain unchanged. No sample games,
contestants or votes are seeded. Admin can create/edit, reorder contestants,
upload cover/contestant photos with percentage progress, save private drafts,
publish, schedule start/end dates, pause/resume/close, duplicate without votes,
delete with confirmation, share a guest link and export aggregate rankings as
CSV. Voter names and pending comments are admin-only; optional comments need
approval before they appear publicly. Guest result visibility and contestant
photo display are configurable. Polling runs every 15 seconds only in visible
competition views, pauses during uploads and preserves selections/drafts.

Voting uses new hashed, 90-day guest sessions in HttpOnly/SameSite=Strict cookies
(Secure on HTTPS), issued only by verified registration or OTP returning-guest
login. Existing local guest IDs/names alone cannot vote. Old signed-in browsers
must verify once again; real OTP provider delivery restrictions remain an
external limitation and were not resolved or retested. The couple must approve
guest registration before voting; attending-only and explicit selected approved
guest groups are enforced server-side. Single choice is the default. Multiple
choices means one selection per contestant per guest, not unlimited repeat
votes. Vote changes replace the ballot atomically when enabled. Retry requests
cannot inflate counts. Audience/mode are locked after votes; contestants with
votes cannot be removed. Start/end/pause/close checks happen on each vote.
Results use total selections and distinct guest voters; multi-choice percentages
are shares of selections. CSV formula-shaped values are escaped. Uploaded but
unused competition photos are retained; automated orphan cleanup is not added.

Isolated full-API tests (disposable database, no live credentials/data) passed for
CRUD, draft privacy, guest registration/login/logout cookies, approval/audience,
dates, limits/changes/concurrent retries, result privacy, comment moderation,
photos, CSV escaping, duplicate/delete and restart persistence. Mocked candidate
browser tests passed at 320/375/430/1024px for layout, filters, voting/retry,
editor/guest group/reordering, upload progress, management actions, navigation
preservation and admin route guard. These do not prove real OTP delivery or a
real multi-phone wedding vote flow. Test commands:

`node tests/competitions-api.cjs /opt/wedding-api /opt/wedding-api/server-competitions-candidate.js`

`node tests/competitions-ui.cjs /absolute/output/directory`

`node tests/gifts-design.cjs /absolute/output/directory --competitions`

Post-deploy live checks found a pre-existing restart bug: the startup compression
sweep recompressed a large `.web.mp4` output, adding another `.web` suffix and
updating its URL/size. A guard now excludes generated `.web.mp4` outputs from
future passes. The existing memory ID/caption/status and resulting file were
retained; no original record was deleted. A focused queue test verifies generated
outputs never queue while original large videos still queue once. Pre-release
snapshot had 7 guests, 1 RSVP, 30 memories, 0 guestbook entries, 1 gift and 1 fund;
these differ from earlier audit counts and were treated as existing user data.

Final deployed browser competition tests and existing Gift Page Message,
admin Gifts layout and dashboard/upload regressions passed. Live public health,
competition list/session endpoints returned 200; unauthenticated competition
management and photo upload returned 401. A real admin read verified the new
competition list was empty. Snapshot comparison verified guests, RSVPs,
guestbook, gifts, gift funds and all 35 settings unchanged. All 30 memory records
and referenced files were retained, with only the described background video
compression changing URL/size; ffprobe confirmed the new H.264 stream and valid
duration. SQLite integrity remained `ok`. The full isolated API suite was run
again using the final deployed backend. No live competition or vote was created.

## Editable Gift Page Message — v176

Admin Dashboard → Gifts & MoMo now contains a Gift Page Message form for the
two paragraphs beneath Gifts. Each supports 1,000 characters and line breaks;
the second can be blank. Default text remains in place until an admin saves.
Use Default Text fills the editor without publishing. Save uses the existing
authenticated settings route, persists in SQLite, renders as plain text and
updates open guest pages via settings polling. Failed saves retain drafts;
polling does not overwrite unsaved edits. Existing recipient details and gift
records were not changed.

Isolated database-copy tests passed for authenticated edits, unauthenticated
401, public settings values, SQLite persistence and oversized-message 400.
Deployed UI tests with mocked persistence passed for custom messages, line
breaks, safe plain text, optional paragraphs, polling, draft/retry protection,
defaults and the admin guard. Guest Gifts mobile checks and dashboard/upload
regressions also passed. No test message was saved to the live database.
Run `node tests/gifts-design.cjs /absolute/output/directory --gift-message`.

## Admin Gifts layout repair — v175

A shared `.admin-only` menu style forced Manage Gift Funds and MoMo Settings
into horizontal flex rows. These two sections now use scoped, full-width grid
panels with stacked headings, descriptions and controls. Fund text has room to
wrap naturally; Edit/Remove buttons stay together. MoMo fields use full-width,
16px inputs, with a clearly placed Save action. The duplicate MoMo heading and
empty fund-editor box were removed. Cancelling or saving clears the editor DOM.
Guests still cannot see either admin panel, and `.hidden` remains respected.

The layout regression test reproduced the old failure, then passed at 320, 375,
430, 656 and 1024 pixels after deployment. Add/edit/cancel controls, guest hiding
and reaching Save above the bottom navigation passed with mocked admin data and
no live writes. Guest Gifts and dashboard/upload regression suites also passed.
Run `node tests/gifts-design.cjs /absolute/output/directory --admin-gifts`.

## Gift Page Photo naming and shortcut — v174

The photo control is now named **Gift Page Photo**, with an **UPLOAD / CHANGE
PHOTO** button. Admin Dashboard → Gifts & MoMo → Gift Page Photo opens its
photo-settings card; it is also available under Photos & Music. It continues
using the persisted `photo:gifts-hero` setting and admin-only upload endpoint.
No current photo or Home image was replaced by this UI change.

Mobile UI tests confirmed the shortcut, file picker, upload percentage, updated
Gifts hero and unchanged Home image with a mocked upload. Existing API permission
and persistence behaviour is unchanged. Successful real uploads save automatically.

## Dashboard sections and Our Story progress — v173

The dashboard now has nine accessible icon tabs: Overview, Guests & RSVPs,
Guest Content, Photos & Music, Wedding Details, Our Story, Announcements,
Gifts & MoMo, and Access & Security. Editors remain mounted so tab changes
preserve unsaved fields. Arrow/Home/End navigation and remembered section
selection are supported. Existing admin routes and live badges remain intact.

Our Story's S&J album uploads display file count and real transfer percentage
with a native progress bar. At 100% the message says sent/saving until the API
confirms publication. Picker/clear/remove controls lock during a batch; failed
files remain staged, and error status is retained for retry.

Checks: HTML has nine correctly nested dashboard panels and no duplicate IDs;
all nine live browser tab selections, keyboard navigation and unsaved-text
preservation passed. A mocked two-file batch confirmed 42% display, 100% saving
state, control locking, partial failure retention and unlocked retry controls.
No test photos or records were published on the live server. API progress and
dashboard regression tests are `node tests/api-data.test.cjs` and
`node tests/admin-dashboard.test.cjs`.

Follow-up checks: all nine dashboard categories fit at 320, 375 and 430 pixels
without horizontal overflow. An isolated Chrome profile with mocked admin
responses/uploads confirmed that switching categories or navigating to Our
Story and back retains 37% progress and both selected files; duplicate submit
is blocked, and completion restores the controls. This is a UI regression test,
not a real upload or authentication test; no live records or login state changed.
Run `node tests/gifts-design.cjs /absolute/output/directory --dashboard`.

## Gifts hero-photo control — v172

Admin Dashboard → Site Settings → **Gifts — Top-right Photo** → **CHANGE**
lets the admin upload a JPEG, PNG or WebP. The setting `photo:gifts-hero`
persists in SQLite, updates the hero immediately for the uploader, and is
picked up by other open guest pages through the existing 15-second settings
sync. It does not change the Home photo or the floral overlay. Uploads show
progress and reject unsupported formats. The endpoint requires admin auth.

An isolated database-copy test passed upload, replacement, persisted setting,
public settings visibility, unauthenticated rejection, and Home-photo isolation.
The existing live photo was not replaced by a test image.

## Later frontend design update — v171

Gifts now uses the supplied reference's cream/gold treatment: script title,
couple-photo/floral hero, illustrated gift cards, provider badges, copyable
read-only destination fields, confirmation accordion and dated gift entries.
The existing couple photo and enabled funds are retained; no reference sample
gifts, removed funds or recipient details were inserted. Seven-tab navigation
is retained. Payment wording remains instructions, not verified payment processing.

Mobile layout/interaction checks at 320, 375 and 430 pixels passed. A mocked
confirmation-form request checks exact cents without creating a live gift.
Run `node tests/gifts-design.cjs /absolute/output/directory` on macOS with Chrome
for the isolated-profile mobile smoke test and screenshot.

## Current status

The live nginx and wedding-api services are active. CPU load was 0.01–0.02;
available RAM approximately 592 MiB; disk use 7.5/20 GB (41%). SQLite integrity
check returned `ok`. All 33 media records reference existing files.

Live counts at final verification: 6 guests (5 attending, 1 not attending),
1 RSVP, 33 approved memories/media records, 0 guestbook entries, 1 reported
gift, 1 gift option. These are current counts, not the older October 7 totals.
No unfamiliar existing records were removed or restored.

Latest daily database snapshot inspected: `wedding-2026-10-11.db`.
Backups remain local to the VPS; off-site recovery is not configured.

## Why uploads and navigation felt slow

- Full-size camera photos and phone videos were transferred without client-side
  size reduction. Video transcoding occurs after upload, so it only improves
  subsequent playback. At 1 Mbps uplink, a 100 MB video takes roughly 13 minutes
  even without protocol overhead. Upload limits are 256 MiB and 15 minutes.
- Hidden views preloaded video/audio. One entry-page browser observation
  transferred about 19 MB, competing with uploads on mobile connections.
- Upload UI had no percentage progress.
- Feeds polled every 15 seconds and rebuilt cards even when data was unchanged.
  Slow requests could overlap; background tabs continued polling.
- Script references used v161 while other assets/cache versions were newer.
- Earlier browser tunnel/time-out errors were recorded. They do not prove a
  server outage; the current VPS API checks were fast and successful.

## Deployed fixes (asset/cache release v169)

- JPEG/WebP uploads above 1 MiB are resized to at most 2048 pixels on the longest
  edge and recompressed before transfer, only if smaller. PNG/unsupported
  formats are retained. Failed optimisation falls back to the original file.
- Multipart uploads use XMLHttpRequest for actual transfer progress. UI
  distinguishes bytes sent from saving the submission. Oversize files are
  rejected before transfer with a readable message.
- Polls cannot overlap, pause in hidden tabs/during uploads, and only deliver
  changed data to renderers. Existing feed content is retained on errors.
- Gallery/feed/playlist media use `preload="none"` rather than loading media in
  hidden sections. Background music no longer preloads the entire song.
- All JavaScript/CSS asset versions and service-worker cache version match.
- Gift controls are wired before asynchronous initialisation and for admins
  who sign in after page load.
- Gift descriptions map correctly; submissions validate enabled funds from
  SQLite, including custom IDs. An empty fund list remains empty after restart.
- MoMo destination settings persist in SQLite and are publicly readable, but
  writable only through the authenticated admin endpoint. Guest-facing fields
  are always read-only; administration uses the separate settings editor.
- Removed the unverified payment USSD sequence. The site provides manual
  provider payment instructions and records self-reported confirmations;
  it neither transfers money nor verifies settlement.

## Checks completed

- Local JS syntax checks, diff whitespace checks, and regression tests:
  `node tests/api-data.test.cjs`.
- Public home/health/media endpoints returned 200. Unauthenticated admin guest
  and MoMo endpoints returned 401. Push VAPID configuration endpoint returned
  200 (this does not prove notification delivery).
- VPS-local public/admin read endpoints responded in approximately 7–49 ms.
  HTTPS checks from the VPS had approximately 50–120 ms time to first byte.
  These measurements are not representative of every guest's network.
- Browser guest routes: Home, Story, Events, Gallery, Memories, Gifts, Share,
  RSVP, Guestbook. All displayed the requested view. Seven-tab order retained
  with Gallery fourth.
- Browser admin sign-in and routes: dashboard, combined guests/RSVPs, media,
  voice/video messages, approvals, RSVP responses, security, and Gifts.
  Admin fund editor opened after signing in; MoMo editor loaded. Content cards
  matched the live data (32 general media, 1 voice, 0 video-message records).
- Guest/RSVP create/edit/delete and gift-option create/disable/delete tested
  using uniquely marked temporary records, then cleaned up.
- Public RSVP submission; guestbook pending/approved visibility, like/reply;
  public photo submission and approval/unapproval tested and cleaned up.
- Authenticated multipart upload completed in 46 ms on localhost for a tiny
  test image. A real browser multipart test compressed a generated JPEG from
  5,202,875 to 2,315,988 bytes and completed in 5.6 seconds, with percentage
  updates. Only the audit's own files/records were deleted afterwards.
- MoMo same-value save/public synchronisation passed without changing the
  recipient. An isolated API restart against a database copy confirmed saved
  MoMo settings override environment defaults, and deleted funds stay empty.
  The live service was not restarted again for this persistence test.
- No browser console errors during the guest/admin sweep.
- After initial feeds settled, a live admin media card remained the same DOM
  node across 86 seconds of polling. This confirms unchanged feeds no longer
  continuously replace cards during playback.
- An isolated database-copy test submitted a custom gift option and verified
  its exact integer-cent amount and exclusion of phone/email/transaction reference
  from the public feed. No real gift or financial transaction was created.

## Remaining limitations / required checks

- **Confirm the real MoMo recipient number and account name in admin before
  collecting money.** Current values were preserved, not independently verified
  with the account holder. Historical QA edits make this check essential.
- Large videos still require enough upload bandwidth. There is no resumable
  upload, adaptive streaming or client-side video encoding. Interrupted uploads
  must be retried. The small browser photo test is not a slow-mobile-video test.
- Camera/microphone recording, playback on physical Android/iPhone devices,
  actual push delivery and real payments were not fully end-to-end tested.
- International OTP/SMS/call delivery historically had Twilio account/provider
  restrictions. No real OTP messages/calls were triggered during this audit;
  current delivery must be confirmed after account restrictions are resolved.
- Off-site backups need a configured destination and credentials.
- Public pending-content edit/delete routes currently rely on possession of
  UUIDs rather than authenticated ownership; stronger ownership enforcement
  remains a security-hardening item. Do not equate a 401 admin check with a
  complete security assessment.

Earlier claims that every feature was fully verified or that the live tree was
clean/synchronised at commit 06afee2 were stale. This report supersedes those
claims for the checks listed above; it does not claim full production readiness.
