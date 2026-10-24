# snybena.com live audit — 11 October 2026

## Larger floating Gallery seal — v231

Enlarged the unboxed Gallery seal to a responsive 60–72px square, retaining
its gold pulse, label alignment and reduced-motion fallback. The navigation
bar allows its upper edge/glow to float above the bar rather than clipping it.
Five tabs still fit without horizontal scrolling at all seven tested widths.
No approval, API, payment, OTP or content changes. Candidate read-only browser
checks passed six widths, Home photo and approval lockdown. The broader
isolated rerun passed all seven navigation/reduced-motion checks, then timed
out during later unchanged feature checks; no complete broad-rerun pass is
claimed for this cosmetic release.

## Welcome-only until admin approval / unboxed seal — v230 (24 October)

Added a fail-closed server approval gate before all guest feature routes,
including competitions, uploads and payments. New and existing pending guests
can see Home/welcome and a Waiting for admin approval card, but cannot use
navigation, media uploads, Chat, guide, gifts, voting, reactions, RSVPs,
guest-book, vendor/programme/broadcast pages or notifications. Deep links and
history cannot bypass the gate. Approved guests unlock automatically via
visible-tab 15-second status checks; revocation and failed checks lock access.
Missing/expired sessions show verified-sign-in guidance. Local names, IDs or
forged approved status never grant access. All existing guest statuses remain
unchanged; no automatic approval or rejection is performed.

Home settings are explicitly minimised before approval. Admin login and
secure guest logout remain accessible; authenticated admin feature requests
use existing bearer-session validation. Exact Speso TEST/LIVE webhook POSTs
retain their original signature/settlement gates and are not blocked by guest
approval. OTP stays enabled; no message sends, provider collection, live-mode
activation or credential changes are part of this release.

An additive `push_access` table binds notifications to authenticated sessions.
Delivery checks current approval and session validity; legacy anonymous
subscriptions are kept but paused until safely rebound. Only existing
subscriptions with already-granted permission are rebound automatically;
there are no new permission prompts or automatic new subscriptions. Quick
entry, if separately enabled, gets a distinct HTTP-only approval cookie and
remains unverified for phone-verified features. Guest logout revokes it.
Static frontend assets and existing uploaded-media URLs remain public, not
confidential storage; previously downloaded content is not recalled.

The Gallery navigation seal is enlarged to 44–56px, its box/border/background
removed, gold neon pulse retained and labels aligned. Five-tab navigation,
Home design, reduced-motion behaviour and configured photos are preserved.

Passed pure suites and real disposable API/browser approval tests: genuinely
new OTP registration remains pending despite forged status; anonymous/pending
read/write route matrix rejects access before upload/payment handlers; admin
approval/unlock/revocation, offline fail-closed, stale response after logout,
real pending-account admin login and callback signature boundary passed.
Approved Chat, media upload/moderation, guest-book/reactions, RSVP, manual gift
submission and idempotent competition voting passed. Seven-width navigation
and larger unboxed seal/reduced motion passed. Separate approved suites passed
Vendors, Broadcast, Bridal Train, reception/engagement editors, Chat/Entertainment
and synthetic microphone permission/recording/upload recovery. All use
disposable fixtures, never production test registrations/gifts. Test runner
cleanup now closes inherited Chrome stdio handles to avoid post-pass hangs.
Candidate runtime: `/root/wedding-v230-candidate`. See `server/APPROVAL_SETUP.md`.

Deployed `634d4b1` after private frontend/API/config snapshot and online SQLite
backup at `/root/wedding-pre-v230`. All three prior API file hashes matched;
deployment checked zero active API requests and zero media workers, installed
the four API files atomically and verified healthy restart, then fast-forwarded
the frontend. Private environment bytes are unchanged, OTP remains enabled and
Speso remains TEST. The new push table is additive; no existing approval or
other wedding row is backfilled or rewritten.

Live GET-only browser checks passed welcome-only routing/taps, expired/missing
session guidance, reachable admin sign-in, configured Home photo decode,
six responsive widths, larger unboxed pulsing seal and zero OTP sends. All
65 cached public resources, security/API cache headers, health and anonymous
feature API rejection passed. All **125 baseline rows** across 13 audited
wedding/chat/payment tables are unchanged, including guest statuses; SQLite
integrity `ok`. No production registrations, votes, uploads or gifts were
created by verification. Existing SMS-provider failures, physical-phone
capture checks, actual livestream rehearsal and automatic Speso callback
delivery remain separate pending prerequisites, not claimed as solved.

## Reference-style admin-editable Vendors — v229

Added **Events → Our Vendors** and **Admin Dashboard → Vendors**, preserving
the original Home, five bottom tabs, compact Chat and companions. The cream/
gold reference is implemented as a responsive banner, category icon tabs,
search, featured filter and photo-card grid with optional Call/WhatsApp links.
No reference-image vendors, stock photos, contacts or unconfirmed bookings
are published; the default banner uses the current saved couple photo and
the default vendor list is empty.

Admin can edit page wording, banner/description/focus, category names/icons/
order, card names/labels/descriptions/photos/numbers, featured/publication
flags and card order/removal. Hidden drafts stay outside public API/settings
and the guide. New cards start hidden. Uploaded media URLs are public random
URLs, not confidential storage. Removing cards/photos does not delete shared
files. No schema migration or initial settings write occurs on deployment.

The separate Vendors API uses existing server admin sessions and write-origin
checks; all content is validated, photos are bounded/signature-checked, and
revision-based atomic saves reject stale edits. Failed saves retain drafts;
the editor blocks duplicate submission and clears private state on sign-out.
Only explicit saving changes Vendors content; OTP/payment settings and all
other wedding content are untouched. See `server/VENDORS_SETUP.md`.

Passed all pure suites and disposable real API/browser Vendors tests: admin
and write-origin guards, complete editor, category creation/icons, banner/card
uploads and signature rejection, duplicate submit, hidden-draft exclusion
from public API/settings, failed-save draft retention, stale-edit conflicts,
search/category/featured filters, safe contact links, reorder/removal without
shared-photo deletion, sign-out cleanup and unchanged unrelated settings.
Guest page and editor fit 320, 375, 430, 844 and 1024px. A transient local
disk-full error prevented screenshots on two reruns; the final complete run
passed and saved screenshots. Separate seven-width navigation regression
passed, including reduced-motion and header Home. Candidate runtime:
`/root/wedding-v229-candidate`; all fixture edits used disposable data only.

Deployed `feb5223` after a fresh private frontend/API/online SQLite snapshot
at `/root/wedding-pre-v229`. Pinned API baseline matched, with zero established
API connections and zero API children before atomic module/bootstrap install
and healthy service restart. Frontend followed by fast-forward deployment.
No environment, schema, OTP or payment-mode changes. Live GET-only Vendors
checks passed configured couple-photo decoding, published-only public data,
category icons, editor registration, five-tab Events highlighting and five
responsive widths. Public audit passed all 63 precached resources, health,
security/API no-store, OTP enabled and Speso TEST. All **109 baseline rows**
across 13 wedding/chat/payment tables are unchanged; SQLite integrity `ok`.
There is no production Vendors settings row or sample vendor fixture; admin
must add and explicitly publish confirmed vendors.

## Private Sam/Jossy admin alerts and glass guide — v228 (19 October)

Added a separate `GET /api/admin/companion-alerts` feed protected by the
existing server requireAdmin/session guard. No schema, credential, OTP,
payment-mode or public guide knowledge changes. Explicit saved connections to
Sam/Samuel/groom or Jossy/Josephine/bride select the companion. Unknown,
ambiguous, both-sided and negated connections are skipped; school names alone
do not establish a side.

The read-only feed returns bounded recent (24-hour) guest entries, Chat,
grouped competition voting, media/guestbook/RSVP/gift submissions. Guest-ID
links are used where available. Legacy name-only submissions require an exact
unique normalised guest-name match, and the UI explicitly labels these as
**not verified ownership**. No message text, ballot choices, phone/email,
payment amounts or credentials are selected/returned. Gift notices describe
records/submissions, not paid or settled gifts. Ambiguous names are skipped.

Admins receive staggered Sam/Jossy recent-activity greetings, then grouped,
deduplicated in-app alerts with a Review activity route to the appropriate
admin page/section. Polling is 15 seconds while visible, signed in and not
uploading; display defers during typing, dialogs and other activity toasts.
Private queued/seen data remains only in page memory and is cleared on
sign-out; epoch checks discard late responses after logout/mute. The on/off
preference alone is stored. Mute/status live under the guide's Privacy &
activity suggestions → Admin-only alerts. No SMS/email/background push or
external AI was added. The public/local guide cannot query this private feed.

The shared guide is now a small glass-style non-modal panel (up to 360×420px,
58dvh on small screens) above the bottom navigation, with translucent
background/blur and opaque readable text. It no longer dims or makes the
whole page inert; actual bottom-tab clicks work while the panel stays open.
Internal scrolling keeps its composer visible, with native buttons/focus and
Escape inside the panel. Original Home, compact Chat, five tabs and companion
animations remain unchanged.

Passed pure suites, standalone disposable SQLite/HTTP privacy/auth tests,
and actual isolated API/browser admin tests: guests make zero private-feed
requests; missing/guest/expired credentials are rejected; side routing,
dedupe, escaped names, real review routes, upload deferral, mute, sign-out,
late-response rejection and no private local persistence passed. Toasts fit
320×568, 390×844, 844×390 and 1024×768. Guide checks passed six sizes, small
translucent/non-modal geometry, actual background navigation, source photos,
questions/follow-ups, launcher lifecycle and reduced-motion. API candidate:
`/root/wedding-v228-candidate`; no production submissions used for these tests.
Deployed `93c3bf3` after private frontend/API/online database snapshot
`/root/wedding-pre-v228`. API bootstrap matched the pinned prior hash; the
module/bootstrap were installed atomically after zero established port-3100
connections and zero API child processes, followed by a healthy service
restart. Frontend deployment followed. No environment or schema changed.
Live checks passed compact glass/non-modal geometry, real guide sources and
follow-ups, no guest private-feed requests, all 60 cached public assets and
security headers, health, OTP enabled and Speso TEST. The private feed returns
401/no activity data without admin authentication. All 107 baseline rows
across 13 audited wedding/chat/payment tables are unchanged; SQLite integrity
`ok`. The larger snapshot count includes concurrent guest activity preserved
before deployment, not test submissions.

## Broad regression audit and transport/edge hardening — v227 (19 October)

Preserved the original Home, five-tab hierarchy, compact Chat, Sam/Jossy
companions, content, OTP policy and Speso TEST mode. No backend JS, schema,
credential or provider changes. Candidate `api-data.js?v=227` and worker cache
`sj-wedding-v227-transport-security` include these targeted fixes:

- Keep request deadlines active through JSON response-body consumption, not
  merely response headers. A stalled body now releases busy UI/feed state.
- Reject malformed/null successful responses instead of treating an unknown
  save result as success. Explain that guests should check submissions before
  retrying; never automatically repeat a write or claim it was saved.
- Do not start an upload if its deadline expired during image preparation;
  preserve upload-counter cleanup and existing one-hour/1 GiB limits.
- Add nginx nosniff, SAMEORIGIN framing and strict-origin-when-cross-origin
  referrer headers, repeated in Cache-Control locations to preserve nginx
  inheritance. API responses/errors receive no-store. Outbound Vimeo/YouTube
  embeds, guest capture and native sharing are not restricted by a new CSP.
- As this nginx is the public edge, replace rather than append client-supplied
  X-Forwarded-For before Express trusts it; spoofed chains cannot choose the
  rate-limit identity. Preserve existing TLS, routing, cache periods, upload
  MIME mappings, streaming buffers/timeouts and API service configuration.

Passed all pure suites plus disposable browser/API checks for core gallery
uploads, actual synthetic-mic MediaRecorder capture/recovery, admin sign-in,
OTP-session voting, competitions/moderation/privacy/race guards, countdowns,
Chat/Entertainment, Broadcast, reception/engagement programmes and Bridal
Train uploads/order/conflict handling. Share/Gifts mocks, guide lifecycle,
refresh/offline/current-photo recovery and five-width shell/polling checks
passed. Live read-only OTP UI passed without sending any code. Speso isolated
API tests passed with a completely mocked provider and no real collections.

Large-upload replay through disposable nginx/API accepted 257 MiB and exactly
1 GiB, rejected/cleaned over 1 GiB, and remained responsive across 198 health
checks (maximum 67ms; peak API RSS 106.7 MiB). No live rows/files involved.
Isolated real nginx confirmed forged forwarding headers are discarded and
security/cache headers are present; staged full TLS config passed nginx -t.

Corrected the legacy quick-entry test fixture to explicitly disable OTP only
in its disposable API; the default fixture and live app retain OTP. Improved
temporary Chrome-profile cleanup so late helper-file writes do not overwrite
test results. Staged test runner: `/root/wedding-audit-v227`.

Remaining real-world prerequisites are unchanged: physical-phone capture and
native-share/keyboard checks, actual livestream/operator rehearsal, handset OTP
delivery, credential rotation and automatic Speso signed callback delivery.
No live money tests or payment activation are authorized or performed.
Deployed `bd23c83` after frontend/nginx/online database snapshot
`/root/wedding-pre-v227`. The live nginx change was additive against a pinned
snapshot hash, preserving the actual site's existing cache durations rather
than overwriting its configuration from the repository. Full nginx -t passed
and nginx reloaded gracefully; the API service was not restarted.
Post-deploy GET-only audit passed all 59 precached assets, headers on each,
API no-store, uploaded photo MIME, health, private-setting exclusions, live OTP
on and Speso TEST. Live browser guide, seven-width navigation and initial/
reloaded current-Home-photo checks passed. All 105 baseline rows across 13
audited wedding/chat/payment tables are unchanged; SQLite integrity `ok`.

## Companion lifecycle verification and fixes — v226 (19 October)

Reproduced a lost-click bug with real browser pointer down/up events during
centre travel: cancelling on pointer-down moved the button before pointer-up.
Primary pointer-down on a travelling companion now opens the same guide before
cancelling travel, preserving reliable touch/mouse activation. Existing native
keyboard activation remains intact. Secondary clicks do not open the dialog.

Fixed queued dialog-close events stealing a newly chosen focus target or
clearing hearts after the guide had already reopened. Fallback focus restoration
now runs only if focus is still in the closed dialog or on the document body.
Added regression checks for both delayed-close scenarios.

Centre choreography now stops on wheel/scroll, native history and the existing
`wedding:view` routing event (including programmatic navigation). It never
starts on Live Broadcast, protecting embedded players whose playback state
cannot be read across origins. Preserved Chat/Gifts exclusions, upload and
media guards. Travel starts from the current edge-float transform rather than
snapping down first. Browsers without Web Animations keep working launchers
and skip centre travel safely.

Expanded disposable browser checks passed real in-flight clicking, routing,
scrolling, uploads beginning mid-flight, live-player view exclusion, background
pause/cleanup, reduced-motion changes during travel, immediate float/login
reset, welcome/regular waves, centre/red-heart/return geometry and conversation
regressions. Existing pure suites and seven-width navigation checks passed.
Fixed an unhandled read-only preview streaming-timeout error using pipeline
cleanup; the proxy remains GET-only. No wedding content, authentication,
payments, credentials or backend code changed.
Deployed `395e856` after private snapshot `/root/wedding-pre-v226`. Resumed
full guide/lifecycle checks passed after the harness restart; completed pure
and seven-width navigation results were retained. Live read-only guide checks
passed and public HTML/script/worker hashes match the verified v226 files.
All 105 baseline rows across 13 wedding/chat/payment tables remain unchanged;
SQLite integrity `ok`. No backend restart or production submissions required.

## Floating companions, early waves and centre kiss — v225 (18 October)

Sam and Jossy float gently 18px along their existing right/left app edges as
soon as the app is visible after refresh or sign-in. A class-only gate observer
resets the page-session welcome sequence on gate → app transitions without
reading identity or sending OTP: Jossy waves after one minute, Sam after two,
then the previous alternating ten-minute waves continue. Busy/hidden wave
slots are skipped. The observer does not touch forms, guest data or routing.

After three idle minutes, and then no more often than every eight minutes
(maximum three meetings per app-entry session), the original launcher buttons
glide to the centre of the app frame, lean together in a stylised kiss pose,
emit 14 soft red hearts and return to their respective edges over 7.2 seconds.
Existing supplied portraits are animated, not regenerated faces/mouths.
Buttons remain keyboard-accessible and open the same guide. Decorative
hearts are aria-hidden, clipped to the app width and pointer-transparent.

Meetings avoid Chat, Gifts, sign-in, typing, uploads, recording, playing media,
open dialogs and activity notifications. Pointer/keyboard input, focused
controls, viewport/orientation changes, logout, hidden pages and reduced-motion
cancel travel/heart effects and clean up timers/animations. A temporary
250ms guard catches uploads/playback starting during travel. Reduced-motion
also disables edge floating; no guest content or server code was changed.

Passed all pure suites and responsive guide checks at six sizes. Fixture-only
clock/gate tests verified immediate float, one/two-minute waves, ten/twenty-
minute waves, centre arrival/14 red hearts, interaction cancellation, natural
return/cleanup, login sequence reset, reduced-motion, original suggestions and
private conversation regressions. Centre choreography fit 320×568 and 844×390
viewports with no overlap of bottom navigation. No real login/OTP or production
submission was used for these fixture checks.
Deployed `c9f9094` after private frontend/online database snapshot
`/root/wedding-pre-v225`. Live read-only browser checks passed immediate edge
float, golden glow, named/decoded launchers, click hearts, real guide answers
and shared-source navigation. Timed choreography was exercised with fixture
clocks, not by altering live wedding settings. All 105 baseline rows across
13 audited wedding/chat/payment tables are unchanged; SQLite integrity `ok`.
No backend restart, credentials, OTP, payments or production writes required.

## Sam & Jossy golden companions — v224 (18 October)

Named the shared in-house guide **Sam & Jossy** and its edge launchers Sam
(right) and Jossy (left). Added a soft looping golden glow and eight decorative
golden hearts on opening either launcher, rendered inside the dialog top layer
and removed after 1.45 seconds. Existing conversation, privacy and local
retrieval remain unchanged; no external AI/image service was introduced.

A 2.2-second raised-hand SVG cue and gentle illustration tilt alternate at
10-minute page-session boundaries: Jossy at minute 10, Sam at minute 20, then
repeat. These are decorative hand overlays, not regenerated/rigged portraits.
Hidden/busy slots are skipped without catch-up bursts. Waves avoid inputs,
uploads, recording views, active media, modal dialogs and other activity toasts.
Hidden-page glow is paused; reduced-motion disables pulse, waves and hearts.

Dismissible published-content suggestions run no more often than every eight
minutes while idle/visible, at most three per page visit, with a device opt-out
under Privacy & activity suggestions. They avoid Chat and all wave blockers,
expire after 14 seconds and use only allowlisted published cards/activity
sources and local photos. Existing timed reminders remain separately opt-in;
no SMS, email or background push was added. Only preferences are persisted,
not questions or conversations.

All pure suites and six-size responsive guide checks passed. Fixture-controlled
clock tests verified 10/20-minute alternation, upload/input suppression,
suggestion source/navigation placement, speaker rotation, cap/opt-out,
modal-top-layer heart count, focus and reduced-motion. Original Home, five
tabs, guide sources, guest/chat/payment data and backend remain untouched.
Deployed `cedaa64` after private snapshot `/root/wedding-pre-v224`. Live browser
checks passed names, golden-pulse CSS, eight click hearts, real guide answers,
source navigation and shared conversation. All 105 baseline rows across 13
audited wedding/chat/payment tables remain unchanged; SQLite integrity `ok`.
No production submissions, credential edits or backend restart were performed.

## Jossy left-hand guide icon — v223 (18 October)

Added the user-supplied Jossy illustration as a second guide launcher on the
left edge, retaining Sam on the right. Background transparency was prepared
locally from the supplied JPEG (edge-connected background only), resized to a
240px PNG (`assets/guide-launcher-jossy.png`), and mirrored in CSS so Jossy
peeks inward from the left edge. No outside image/AI service was used.

Both 64×102px controls open the same existing S&J Guide dialog and in-memory
conversation; no second assistant, model, identity or polling loop is created.
Focus returns to the launcher used, with native keyboard/button semantics and
accessible labels. Both move above the Chat composer, clear the bottom bar,
respect locked/gate screens and align with phone/tablet/desktop app frames.
Original Home, five bottom tabs, community content and guide knowledge remain
unchanged. No backend change/restart, database migration or environment edit.

Passed pure suites and fixture-only responsive guide checks at 320×568,
375×667, 390×844, 495×770, 844×390 and 1024×768, including both decoded assets,
edge alignment, hit targets, composer clearance, Jossy’s keyboard activation,
launcher-specific focus return, shared conversation, local/private questions,
source links and optional reminders. Cache/CSS/guide script use v223.
Private pre-deploy frontend/online database snapshot: `/root/wedding-pre-v223`.
Deployed `47efccc`; live checks decoded both illustrations, opened the shared
guide through Jossy, followed a real source link and continued through Sam.
Public asset bytes/cache and the five-tab hierarchy passed. All 105 baseline
rows across 13 audited wedding/chat/payment tables are unchanged; SQLite
integrity `ok`. No production submissions or API restart were required.

## Five-tab navigation / Events entertainment hub — v222 (18 October)

Per user request, removed Home, Live Broadcast, Entertainment and Wedding
Chat buttons from the bottom bar, preserving all four pages and their data.
The five remaining tabs are Our Story, Events, Gallery, Bridal Train and
Gifts, keeping the smaller pulsing Gallery seal centred. The five-column
bar retains its 76px clearance and compact icon/button styling; no swipe is
needed. Home remains the opening page and is accessible through the header
logo. Events retains its existing Live Broadcast link and now has an
Entertainment card. Entertainment has a prominent Wedding Chat card.

Chat’s back arrow returns to Entertainment; Entertainment’s returns to
Events. Live, Entertainment and Chat highlight the Events parent tab.
Existing hashes/deep routes and native history remain valid. No page content,
chat identity/approval/upload behaviour, Entertainment configuration or payment
flow is removed or changed. The guide’s public navigation/Chat instructions
were updated in its shared knowledge module to describe the new hierarchy.

Passed five-tab fit/alignment/centred-seal/touch/routing/reduced-motion tests
at 320/360/375/390/430/476/1024px, actual nested links and back arrows, native
Back Chat → Entertainment → Events, header Home, all pure suites, isolated
verified Chat/Entertainment browser integration, Share/Gallery regressions,
read-only Broadcast checks, guide illustration/search/privacy/reminder tests,
community compact-layout checks and targeted 375px shell/polling stability.
Tests expecting a dedicated Live tab now exercise its Events link instead;
same-page scroll stability is distinct from tapping the Events parent tab.

Private pre-deploy frontend/shared-API-knowledge/online database snapshot:
`/root/wedding-pre-v222`. Asset/cache version 222 updates navigation and guide
instructions together. No environment or credential changes or production
test submissions.

Deployed code `1c232d0`. Guide instruction update was gated on the snapshot
module hash and an idle API connection check. Live browser navigation passed
all seven widths, including actual Events → Entertainment → Chat links,
explicit back arrows, native history, Home header and reduced motion. Public
assets/cache and guide API confirm the v222 five-tab hierarchy. All 105
baseline rows across the 13 audited wedding/chat/payment tables remain
unchanged; SQLite integrity `ok`. No content was deleted or migrated.

## Right-edge illustrated guide icon — v221 (18 October)

Replaced the sparkle/text launcher with the user-supplied Sam illustration,
using the matching local transparent-background PNG, resized to a lightweight
240px-high asset (`assets/guide-launcher.png`). The full illustration is shown
without a background block or face-only crop, with a small Guide badge. Its
64×102px button hugs the app’s right edge, clears the bottom bar and moves
above the Chat composer. Alignment follows both the 520px tablet and 480px
desktop app frames. Existing guide dialog art/content, Home, all nine tabs,
knowledge/search, settings and guest content remain unchanged.

Accessible launcher label, native-button keyboard support, focus return and
minimum touch target are retained. No decorative animation added. Passed all
eleven pure suites and extended read-only browser checks at 320×568, 375×667,
390×844, 495×770, 844×390 and 1024×768: image decoding, right-edge alignment,
actual hit testing, composer/navigation clearance, dialog/source routing and
existing guide privacy/follow-up/reminder regressions. No API changes/restart,
production submissions, OTPs or payment actions. Pre-deploy frontend/online
SQLite snapshot: `/root/wedding-pre-v221`; cache is v221-guide-icon.

## More useful guide / published activity discovery — v220 (18 October)

User requested continued improvement after the initial guide showed an empty
activity area. Root cause: saved Event times are ranges/open-ended strings
(`07:00 AM - 11:00 AM`, `2:00 PM - 08:15 PM`, `08:15 PM Till…`), while the
first parser only accepted a standalone clock. The new parser recognises
those explicit start clocks, validates calendar/clock bounds, preserves Ghana
GMT and never invents an end time. Individual reception/engagement programme
rows now have their own search/source cards and, only with their programme’s
explicit saved date, scheduled reminder entries. Saved hosts/MCs have a
separate source card. Read-only real-HTTP/SQLite checking discovered 15 actual
future entries instead of zero and correctly retrieved Dinner and the MCs.

Guide opens with a real saved wedding overview, human-readable date, next
published scheduled start and photo activity previews/full-programme link.
Disclosures/reminder controls remain accessible in a compact expandable panel.
The introduction is shorter; answering moves directly to the newest result.
Past questions collapse, with at most six turns kept in page memory only.
New conversation clears questions/context/draft; no conversation persistence,
logging, private-data ingestion, external service or generative model added.

Local matching now handles synonyms, conservative one-edit/transposition
typos, document-frequency weighting, focused individual programme entries,
app troubleshooting and limited source-ID follow-ups (e.g. dinner → “What
time is it?”). OTP-delivery help no longer incorrectly triggers the private
code guard; requests to reveal codes still do. Today/now/next questions use
published timestamps in Ghana GMT and never claim actual progress from a
schedule. Entertainment’s empty separate lineup is distinguished from
performances already named in the published reception programme.

Refresh only recomputes answer cards when public content changes and never
submits a typed draft, duplicates a turn or discards the draft. Sources remain
linked to real app routes. Original Home, compact Chat and all nine tabs are
unchanged; reminder opt-in, media/upload safeguards and payment boundaries
remain in place. No saved schedule, wedding setting or guest content is edited.

Passed all eleven pure suites, enhanced range/date/unknown/privacy/search/
typo/context/temporal tests, responsive fixture browser checks at 320×568,
375×667, 390×844, 495×770, 844×390 and 1024×768, decoded real wedding photos,
bounded conversation/clear/draft-refresh tests, opt-in deduplicated reminders,
and existing navigation/community/compact-chat width regressions. Public
guide-source testing uses read-only SQLite and no production submissions.

Deployed code `64c8c36` after private frontend/API/online database snapshot
`/root/wedding-pre-v220`. API shared-module replacement was gated on matching
snapshot hashes and no established port-3100 connections. Live checks passed
v220 assets/cache, 15 upcoming published schedule entries, real-photo decoding,
Events navigation, specific dinner retrieval and its contextual follow-up.
No production submissions, OTPs, payments or reminder sends were triggered.
Preservation audit: 23 guests, 1 RSVP, 20 memories, 0 guestbook, 4 gifts, 2 funds,
39 settings, 2 competitions, 1 vote, 3 payment attempts, 2 chat messages,
6 reactions and 2 chat uploads; every baseline row unchanged, none missing,
SQLite integrity `ok`. No environment, credentials or saved content changed.

## In-house S&J Guide — v219 (18 October)

User selected a lightweight in-house knowledge guide on the existing 1 CPU /
0.94 GiB server, rather than a generative model or outside AI API. Floating
S&J Guide opens a cream/gold native dialog using the supplied couple
illustration, source-linked answers, suggested questions, public-photo cards
and optional activity reminders. Original Home, compact Chat and all nine
bottom destinations remain intact; no tenth tab was added.

`GET /api/guide` reads an explicit settings allowlist only: published wedding
facts/story/timeline, events/programmes, saved Bridal Train, Entertainment and
Broadcast. It reads no guest/contact/session/OTP/chat/payment tables and writes
nothing. Questions are searched on the device with deterministic keyword/text
matching; they are not submitted or stored. No model, third-party AI, crawling,
new dependency, credentials, database migration or training process is used.
The UI clearly says this is a local knowledge guide, not generative AI; it
offers closest sources and honest unknown/private-data fallbacks, not a claim
to answer every possible question. Public changes refresh on open/request and
every minute while visible and relevant. Failed refreshes label stale results.

Activity cards use existing published local wedding/performer/broadcast
photos, not remote link scraping. Missing photos are omitted. Reminders are
off by default, opt-in per device, only while the app is open/visible, and
bounded/deduplicated locally. They reference published Ghana-GMT event times,
absolute performer dates or a host-marked live broadcast. Reminders explicitly
do not establish real activity progress and do not send email/SMS/web push.
Existing announcement/competition systems remain unchanged. Uploads, recording
pages, focused inputs and existing activity toasts suppress guide reminders.

Passed eleven pure suites, local-search/private allowlist tests, real HTTP
Express testing against read-only production SQLite, and fixture-only browser
tests at 320×568, 375×667, 390×844, 495×770, 844×390 and 1024×768. Browser
checks cover decoded real published photos, dialog fit/focus, source routing,
escaped text, private-answer fallback, no question requests, stale-state
warning, opt-in reminders/photo decoding and non-repetition. Navigation and
community-reference/compact-chat regressions also passed all existing widths.
Resize tests do not claim physical-phone keyboard or camera validation.

Private pre-deploy frontend/API/online database snapshot:
`/root/wedding-pre-v219`. Flat API deployment includes the identical shared
`wedding-guide-knowledge.js` alongside `wedding-guide.js` and the one-line
`server.js` registration. Operational notes: `server/GUIDE_SETUP.md`.

Deployed code `a830885`; API restart was gated on zero established port-3100
connections and a byte-identical pre-deploy API source check. Public live
endpoint, v219 assets/cache, supplied illustration and nine-tab navigation
passed. A fresh disposable live browser profile fetched real guide knowledge,
decoded the published couple photo, opened its Events source and confirmed
reminders were off; no submissions or OTP requests were made.
Post-deploy snapshot comparison: 23 guests, 1 RSVP, 20 memories, 0 guestbook,
4 gifts, 2 funds, 39 settings, 2 competitions, 1 vote, 3 payment attempts,
2 chat messages, 6 reactions and 2 chat uploads; every baseline row unchanged,
none missing, SQLite integrity `ok`. No configuration/credential changes.

## More conversation space / compact controls — v218 (18 October)

User reported the Chat header used too much vertical space and requested a
smaller/higher title, larger couple photo and compact app-like icons. Chat
header is now 118–126px on normal phone sizes, with a wider 42% landscape
photo area (full configured image retained), smaller title and quieter floral
decoration. Short/landscape viewports use a 78px header. Category strips use
17–18px glyphs with 44–48px-high buttons; Announcements has the compact visual
caption Updates while retaining its accessible Announcements label/filter.
Composer glyphs are 18px, with clear button hit areas. Feed spacing and media
heights are constrained so a pinned attachment cannot dominate the room.

Bottom navigation is now 76px plus safe area, with 56px buttons, 64px Gallery
button, 18–21px icons and retained pulsing 28–34px seal. All nine destinations
remain visible; Share/Memories remain Gallery-only. Chat layout derives its
available height from the shared navigation variable, including the desktop
frame offset, instead of keeping the old hardcoded 86px clearance.

Read-only compact-layout checks passed 320×568, 360×640, 375×667, 390×844,
430×932, 495×770, 495×400, 844×390 and 1024×768. The empty guest-view fixture
has 402px of feed space at the user's reported 495×770 size; populated
disposable guest chat also retains more than 300px, can scroll to the complete
last message and does not overlap the composer/navigation. Small viewports
simulate available space, not a physical-phone keyboard/camera test.

Passed isolated community send/retry/moderation/reaction/search/attachment and
Entertainment regression, all ten pure suites, Share checks, all nine tabs'
width/alignment/routing/reduced-motion tests, and shell finite-bottom checks
at 320/375/430/768/1024px. The broad shell run reached its time budget after
the first four widths; a targeted 1024px rerun completed the remaining checks,
including actual refresh-cycle scroll stability for Bridal Train/Broadcast.

No server/API/database/environment changes or production test submissions.
Frontend and online SQLite snapshot: `/root/wedding-pre-v218`. Asset/cache
version 218 updates layout and compact category labels together.

## Chat / Entertainment reference styling — v217 (18 October)

User requested both pages closely match the supplied visual references.
Scoped `community-reference.css` adds cream/ivory surfaces, original SVG
rose/olive-leaf bouquets, a circular Chat portrait, photo-led Entertainment
header and script heading, icon category strips, serif names, white/gold
bubbles, compact counted reactions, performer photo badges/social icons,
detail chevrons and a connected performance timeline. Current configured
wedding photos are retained in full rather than replacing them with the
reference's people. Existing nine bottom destinations and smaller Gallery
seal remain unchanged; no fake phone status bar is drawn.

Chat now fills the available viewport with an internally scrolling feed and
the compact composer above navigation. Its search, message emoji chooser,
reaction chooser, general/media attachment pickers and camera capture input
are wired to existing functionality. Microphone still opens the existing
voice-memory recorder; it does not claim inline voice sending. Performer
chevrons expand real saved date/duration details. No server/API/schema,
credentials, OTP or payment changes; no example messages/roles/online counts,
performers, social profiles or schedule times were inserted.

Passed updated isolated browser community regression (real disposable API,
including search/emojis/reactions/attachments/moderation/editor/conflicts),
all ten pure suites and nine-tab navigation/reduced-motion checks. Added
GET-only live-content styling preview at 320/360/375/390/430/476/1024px:
configured photos decoded, seven icon filters per page, no stale header gap,
no clipped category labels and composer visible above the bottom bar. The
preview mocks only empty chat/presence responses locally and makes no writes.
Desktop frame and safe-area layout included; physical camera capture remains
a device test, not something desktop automation verifies.

Frontend/online SQLite snapshot: `/root/wedding-pre-v217`. Cache/asset version
217 refreshes the new CSS, bouquet SVG and interaction markup together.
Post-deploy HTTPS checks passed the v217 assets/control markup and all nine
tabs. Every snapshot row remained unchanged, including the user's existing
1 chat message, 6 chat reactions and 2 chat uploads. Existing wedding content,
gifts, settings, votes and payment attempts were unchanged; SQLite integrity
remained ok. No test content was submitted to production.

## Wedding Chat and Entertainment — v216 (18 October)

Deployed `143df90`: added Chat and Entertainment bottom destinations while
retaining Home, Story, Events, Bridal Train, Gallery, Live and Gifts. Sharing
destinations remain Gallery-only, not bottom tabs. All nine tabs fit at
320/360/375/390/430/476/1024px; Gallery retains its smaller pulsing seal.
New pages use the site's configured couple photo and cream/gold styling.
No sample messages, online counts, performers, portraits or times were seeded.

Chat reads/writes require the existing server-verified guest cookie or valid
admin authentication. Local profile IDs/names cannot impersonate a guest or
host. Guest messages default to pending approval (explicit conservative
default communicated before implementation); sender sees own pending items,
other guests see approved only. Hosts publish announcements and can approve,
hide, pin/unpin and remove. Unique identity/message/emoji reactions use
idempotent desired-state requests. Message send IDs survive local draft and
lost-response retries. Active count means distinct verified guests with a
heartbeat in the last 45 seconds, not registrations or an invented count.

Chat supports byte-checked JPEG/PNG/WebP, MP4/WebM, PDF, MP3/WAV attachments
up to 25 MB, with per-identity upload/send limits. Unchanged cards/media remain
in place during polling. Voice recording opens the existing voice-memory
page; Polls opens existing games/competitions, not a second voting backend.
Initial chat feed is bounded to 150 messages. Random public upload URLs are
not a private/confidential file store. See `server/COMMUNITY_SETUP.md`.

Entertainment has category filters, real social links and a local-time
performance schedule, plus Admin Dashboard → Entertainment for confirmed
names, descriptions, uploaded photos, dates, ordering and publication.
Empty lineups/categories are explained honestly. Revision conflicts,
failed saves and background refresh retain admin drafts. No lineup is
published until confirmed data is saved by an admin.

Passed all ten existing pure unit suites, isolated real-HTTP/SQLite community
API tests (auth/origin/moderation/idempotency/upload bytes/ownership/limits,
reactions/presence/validation/conflicts/restart preservation), isolated browser
Chat/Entertainment tests, full isolated recording/upload/competition regression,
Share actions and responsive navigation/reduced-motion checks. Physical-phone
camera/microphone/files and native share behavior are not covered by desktop
automation. No real OTP, payment or production chat submission was sent.

Pre-release snapshot: `/root/wedding-pre-v216` (frontend, API sources, online
SQLite backup). Post-deploy audit found every baseline row unchanged and all
baseline media files present: 23 guests, 1 RSVP, 20 memories, 0 guestbook,
4 gifts, 2 funds, 39 settings, 2 competitions, 1 vote and 3 existing payment
attempts. Community message/upload tables are empty, integrity is ok.
Public entertainment responds 200; unverified chat and protected writes 401.
OTP remains active and Speso remains TEST. No live payment activation.

## Sharing removed from bottom menu — v215 (18 October)

At the user's request, removed the Memories and Share bottom navigation
buttons. Both sharing destinations remain accessible through Gallery's
Share Memories and Share Moments cards. Seven remaining tabs retain their
order, pulsing Gallery seal and no-swipe layout; columns now fill the bar.
No saved content, API, settings or payment configuration changed.
Read-only navigation checks passed at 320/360/375/390/430/476/1024px,
including routing, visible labels and reduced-motion support. Gallery
sharing/back links and existing mocked Share actions passed. Worker tests
passed; CSS and cache versions bumped to v215.

## Gallery sharing navigation — v214 (18 October)

Added Share Memories and Share Moments entry cards to Gallery. Moved the
Share Memories shortcut out of the Share Moments menu and made both sharing
pages' back links return to Gallery. Removed only the Bridal Train and Live
Broadcast shortcuts from Share Moments; their dedicated bottom tabs remain.
All nine bottom tabs, gallery uploads, recording controls and other menu
actions are retained. No API, database, payment or environment changes.

Read-only preview checks passed Gallery sharing routes/back links, removed
shortcuts, retained dedicated tabs and Gallery widths 320/375/430/1024.
Existing Share guest/admin layouts and mocked action tests passed, alongside
the service-worker suite. Cache updated to v214 for refreshed HTML.

## Sandbox callback URL saved; provider delivery still pending (17 October)

User confirmed Speso saved the dedicated test callback URL. Ran one further
GHS 50 sandbox-only collection through the app to test automatic delivery.
Speso reported completed, but the app row remained processing before any app
status poll. No new public callback requests reached nginx; the only three
callback log entries were our earlier simulated signature checks (node agent).
No simulated callback was sent during this second test. This does not establish
whether sandbox webhook dispatch is unsupported, delayed or failing at Speso.
Ask Speso API Support whether test collections send signed webhooks
automatically or require a manual simulation/replay mechanism.

Reconciled the second order with authenticated provider GET, now completed.
There are two completed TEST attempts, zero live gift-payment records, and all
four existing gifts remain. SQLite integrity ok; mode remains test. Second
attempt recovery metadata is root-only
`/root/wedding-speso-webhook-check.json`; reuse its order instead of initiating
another prompt. Live activation remains blocked on callback verification and
fresh privately installed live credentials. No real money was collected.

## Actual Speso sandbox collection verified — v213 (17 October)

After the user installed test credentials and restarted the service, verified
active test mode for Emdulab Enterprise, successful read-only Speso `/fees`
authentication (HTTP 200/success), and 401 for unauthenticated sandbox
initiation. No live credentials were used. Credentials were again exposed in
a user screenshot; recommended rotating them plus the exposed SMS/email
credentials. No secret values were printed, copied into code or committed.

Added/deployed `1b65527`: each initiation must explicitly match the server's
test/live mode, preventing stale sandbox tabs from issuing live requests after
a configuration change. Missing/mismatched mode rejects before provider calls.
Disposable API, mocked browser, unit/signature and worker tests pass.
Pre-test snapshot: `/root/wedding-pre-v213`.

Ran one authorized GHS 50 MTN sandbox collection through the real wedding API
using the user's Ghana test number. Speso returned processing, then the app's
authenticated GET reconciliation confirmed completed/GHS/50 and matching
order/reference/network/payer. A repeat initiation reused the same order.
Exactly one completed TEST order exists; no gift or real-money collection was
created. Recovery secret/reference retained in root-only
`/root/wedding-speso-sandbox-check.json`; reuse rather than start another order.

Public HTTPS callback checks accept a valid simulated signature (200), reject
invalid signatures (401) and expired callbacks (401). These three callbacks
were simulated by our script, NOT delivered by Speso. Automatic provider
webhook delivery has not been observed and remains an activation check; the
actual sandbox settlement was independently verified by provider status GET.

Preservation audit retains every baseline record and media file unchanged:
4 gifts, 2 funds, 19 media records/files, 1 RSVP, 0 guestbook entries, 39 settings,
2 competitions and 1 vote. One concurrent guest was added (21 -> 22); no
baseline guest changed or disappeared. SQLite integrity ok, OTP active,
services active. Mode remains TEST; live collection is NOT activated. Fresh
live credentials, callback setup/delivery verification and any explicitly
authorized real-money handset test remain pending.

## Cash Gifts alongside NOVA1 + fresh gift choices — v212 (17 October)

At the user's request to add a gift option and continue, added enabled
`cash` / Cash Gifts with description “Send in your cherished wedding gifts.”
through the authenticated admin API. Existing `nov19897979` / NOVA1, its
description/order/enabled state and all four existing gifts were preserved.
Fresh pre-change frontend/database snapshot: `/root/wedding-pre-v212`.
No test gift, upload, SMS or payment collection was created.

Gifts now refreshes funds and recipient details on entry from every route,
coalescing overlapping fund/view requests while retaining donor and admin
editor drafts. Valid selections remain selected. Changed fund/amount/provider
or recipient resets obsolete payment guidance, including the stale “No gift
options” warning. Payment instructions validate that the selected fund still
exists. Two options use two equal-width columns instead of leaving a blank
third slot. Speso remains OFF; no credentials installed or live activation.

Candidate guest checks pass at 320/375/430px with both real enabled options.
Mocked tests pass for stale-empty-state recovery, a single concurrent refresh,
draft retention, pesewas, duplicate-submit/failure recovery and MTN logo.
Mocked Speso off/test/live-fixture/reload checks also pass at four widths.
Worker/syntax checks pass. Actual Speso sandbox testing still awaits fresh
privately installed credentials; Emdulab Enterprise merchant is confirmed.
Deployed `4215710`; guest regression checks pass live. Audit preserves 21
guests, 1 RSVP, 19 media records, 0 guestbook entries, all 4 gifts, 39 settings,
2 competitions and 1 vote. NOVA1 is unchanged; Cash Gifts is the only added
fund. SQLite integrity ok, zero Speso attempts, guest OTP active, Speso off.

## Speso installed with collection OFF — v210/v211 (17 October)

The user explicitly confirmed Emdulab Enterprise as the receiving Speso
business. Deployed `a2146a5` frontend/API and set only the confirmed merchant
name plus `SPESO_MODE=off`. No pasted keys were installed, no live confirmation
flag was set, and no real provider requests were made. Fresh rotated test
credentials and an actual Speso sandbox test remain required before activation.
Private predeployment API/environment/frontend/database snapshot:
`/root/wedding-pre-v210`. Live API source matched the previous repository
version before replacement; no concurrent API edits were overwritten.

Live checks pass: merchant/off configuration, collection POST blocked with
503 before creating an order, admin payment activity guarded by 401, guest OTP
still active, API/nginx active. Preservation audit retains 21 guests, 1 RSVP,
all 19 media records/files, 0 guestbook entries, 3 gifts, all 39 settings and
both competitions. SQLite integrity ok. The predeployment gift-fund count was
already zero; it was preserved, not deleted by the integration.

v211 adds an explicit empty gift-options message rather than a blank area and
tests the existing safe no-fund confirmation guard. Does not recreate funds or
edit the confirmed manual MoMo recipient. Candidate guest layout and no-fund
submission checks pass at 320/375/430px with no live writes. Worker checks pass.
Deployed `71fe9c7`; the same checks pass live. Fresh v211 preservation audit
passes with all predeployment records/settings intact and zero Speso attempts.

## Speso collection candidate — v210 (17 October; NOT deployed/activated)

Prepared `server/speso-payments.js`, optional `speso-gifts.js` checkout and
`server/SPESO_SETUP.md` from the Collections/webhook documentation. Default
mode is off; ordinary guests cannot initiate sandbox orders. Test completion
never creates gifts or notifications. Live mode needs separate credentials,
explicit live confirmation and an approved merchant name. Collection funds
credit the Speso wallet, not the existing manual MoMo recipient.

The user pasted live and test credentials into chat. None were committed,
installed in production or used by these tests. Rotation, secure installation,
receiving-account/settlement confirmation, actual Speso sandbox testing and
live activation remain pending. Production remains v209; guest OTP unchanged.

Attempts use hashed 256-bit owner/idempotency secrets, a per-phone pending lock,
and recover unknown results with GET instead of another upstream collection
POST. Signed raw callbacks enforce environment/timestamp, then independently
GET Speso status and match reference, exact amount, GHS, network and payer.
Verified live gifts are inserted exactly once in a transaction. Sandbox orders
remain isolated; public feeds never expose payer phones or payment secrets.
Admin payment activity provides reconciliation controls.

Validation/signature unit tests and eight existing unit suites pass. Disposable
SQLite/HTTP tests pass for mode/auth guards, duplicate/concurrent requests,
pending locks, signature replay/tamper rejection, mismatched settlement data,
exactly-once recording, timeout/restart recovery and existing-record retention.
Mocked browser tests pass at 320/375/430/1024px for manual fallback, guest sandbox
hiding, admin sandbox preview, pesewas, lost-response/reload recovery and status
handling. Full disposable browser/API regressions pass for page actions, voice
recording recovery, countdowns, competition uploads/voting/moderation and guards.
No real collection requests, guest records or provider credits were used.

## Gifts logo and page fixes — v209 (17 October)

Replaced the improvised blue MTN text with a bundled current black MTN
wordmark on yellow (public-domain text/geometric source credited in SVG).
Provider choices use aligned logo/label rows with no narrow-phone clipping.
MoMo recipient fields stack on phones at readable 16px; copy controls are
taller. Reduced left floral overlap, wrapped long gift labels/names, linked
confirmation labels to controls and added accessible submission status.

Custom gift amounts retain pesewas and submit integer cents; selecting Other
starts with a clean input rather than displaying a stale amount. Confirmation
and MoMo-settings saves ignore duplicate events while busy; confirmation
requires an existing fund and preserves entered details after failures.
No payment processing was added and no recipient/settings/content were edited.
The saved recipient +233241234567 remains unconfirmed by the user.

Candidate guest checks pass at 320/375/430px, admin panels at
320/375/430/656/1024px. Mocked regression tests cover the bundled logo,
75.50 GHS -> 7550 cents, provider retention, duplicate events, failed-save
recovery and field labels. Fund editor/cancel and guest hiding also pass.
Worker regression and JS syntax checks pass; snapshot `/root/wedding-pre-v209`.
Worker and changed asset versions advanced to v209; OTP settings unchanged.

Deployed `2be239e`; live guest layout and mocked confirmation regressions pass.
Audit retains the fresh snapshot's 21 guests, 1 RSVP, all 19 media records/files,
0 guestbook entries, 3 gifts, 1 fund, 39 settings and 2 competitions unchanged.
SQLite integrity ok; API/nginx active. No live gifts, uploads or payments were
created by these tests. Counts reflect live content at this release, not seeds.

## Guest OTP activated (17 October)

After the user confirmed receiving the authorized Ghana OTP-style SMS and
explicitly requested activation, set `GUEST_OTP_REQUIRED=true` in the private
service environment and restarted `wedding-api`. Sender remains SAMANDJOSSY.
Private pre-change backup: `/root/wedding-otp-activation-1792233051183/`.
No credentials were added to the repository and no extra SMS tests were sent.

Live checks pass: `/api/onboarding` reports OTP required; quick entry rejects
with 409 before writes; unauthenticated admin access remains 401; SQLite
integrity is ok. Read-only browser test confirms OTP-mode guidance and reachable
submit at 320/375/430px portrait and 844px landscape. No test guest created.
Existing OTP mode also restores its original required detail fields; saved
same-device entries are not forcibly signed out. Ghana delivery was confirmed
by the user; US SMS delivery remains unresolved (Twilio error 30034).

Added a read-only OTP-mode test branch and bounded browser app-readiness wait.
These are test-only changes; no frontend design or runtime code changed.

## Restore previous Home — v207 (16 October)

At the user's request, reverted the v206 Home redesign and its associated
test changes. Restored the v205 Home markup and styles, keeping the Share
visibility fix and smaller Gallery seal. Worker cache advanced to v207 so
existing installations receive the rollback. No backend or content changes.

## Keep Share and all bottom tabs visible — v205 (16 October)

Fixed the reported hidden Share button by removing the bottom bar's fixed
44px/64px minimum-column widths and sideways scrolling. All nine destinations
now fit inside the available width; Gallery remains fifth with a modestly
wider relative column, not a fixed oversized slot. Labels have their own
two-line area and responsive font sizing, so longer names can wrap rather
than force buttons out of view. Tall 64px targets remain (74px for Gallery);
narrow-phone button widths adapt, remaining above the 24px target minimum.

Reduced the seal from 52px to a responsive 28–38px width / 36px height and
kept its gentle pulse/reduced-motion fallback. Bar clearance is now 86px plus
safe area instead of 96px. No backend, routing, content or OTP changes.
Updated navigation checks require every tab to be visible simultaneously,
including Home and Share, with no horizontal scroll extent or clipped labels.

Candidate checks pass at 320/360/375/390/430/476/1024px for all nine tabs
simultaneously visible, no sideways-scroll extent, wrapped/non-clipped labels,
aligned label rows, reduced animated seal, active routing and reduced motion.
320px and wider screenshots reviewed. Share guest/admin controls and check-in
regression previews pass; worker tests pass. Snapshot `/root/wedding-pre-v205`.

Deployed `23a7a9d`; all seven-width visibility/navigation tests also pass live.
Audit retains 19 guests, 1 RSVP, all 25 media records/files, 0 guestbook
entries, 3 gifts, 1 fund, both competitions and 1 vote unchanged. The strict
snapshot audit flagged a concurrent `liveBroadcast.posterUrl` change; separate
read-only comparison confirms all other settings unchanged and that change
was left untouched. SQLite integrity `ok`; API/nginx active. No content writes
or backend changes were performed by this release.

## Larger centre Gallery seal — v204 (16 October)

At the user's request, Gallery now has a wider 64px-minimum centre slot and
an 84px-tall button, with the real S&J seal increased from 30x28 to 52x52px.
A slow three-second golden glow/scale pulse affects the seal only, not the
button layout; reduced-motion keeps the seal static with a light halo.
Neighbouring buttons retain their matching style and 44px minimum targets,
and all nine labels stay aligned. The 96px safe-area-aware bar reserves space
for the raised centre button without clipping its seal or covering page ends.
Gallery stays fifth; narrow-phone sideways navigation remains available.
No routing, backend, content or OTP changes. Cache bumped to v204.

Candidate navigation suite passes at 320/375/430/476/1024px for larger centre
dimensions, 52px animated seal, label alignment, neighbouring button styles,
all nine routes/selected visibility and reduced-motion. Screenshots reviewed;
Share guest/admin and check-in regression previews pass, as does worker
caching. Fresh predeployment snapshot: `/root/wedding-pre-v204`.

Deployed `75f907e`; live navigation checks pass at all five widths. Audit
retains 18 guests, 1 RSVP, 25 media records/files, 0 guestbook entries,
3 gifts, 1 fund, 39 settings and both competitions unchanged. SQLite integrity
`ok`; API/nginx active, with no live content writes by this release.

## Uniform bottom navigation buttons — v203 (16 October)

All nine bottom-bar destinations now share the same 64px button height,
rounded gold-bordered cream card, padding, label baseline, centred icon row
and soft gold pulse. Active pages consistently use the filled gold treatment.
Gallery stays in the fifth/centre slot with its real S&J seal fitted into
the same icon row (no separate oversized pulse or label offset). Removed
special Bridal Train/Live-only treatment; higher-specificity shared rules
also prevent their page styles from changing button margins or dimensions.
Added uniform 2px gaps/outer inset and 80px safe-area-aware bar clearance.
Minimum 44px targets and narrow-screen sideways swipe remain; all pulses
disable under reduced-motion. No routes, guest content or backend changed.
Selected-tab reveal now runs after the document reset and uses only an
instant local strip scroll, avoiding competing smooth-scroll animations.

New read-only navigation suite passes at 320/375/430/476/1024px: equal card
dimensions/styles, aligned icon centres and text baselines across Home/Bridal
Train/Live pages, all nine routes/active indicators, selected-tab visibility,
minimum touch sizes, shared pulse and reduced-motion disabling. Screenshots
reviewed. Share guest/admin/controls and check-in regression previews pass;
worker and logout/push unit tests pass. Snapshot `/root/wedding-pre-v203`.

Deployed `7709edd`; the same navigation suite passes live at all five widths.
Preservation audit retains 18 guests, 1 RSVP, 25 media records/files,
0 guestbook entries, 3 gifts, 1 fund, 39 settings and both competitions
unchanged. SQLite integrity `ok`; API/nginx active; no live content writes.

## Guest check-in cleanup and validation recovery — v202 (16 October)

Reviewed the reported check-in screenshot and rebuilt its scoped presentation:
readable 16px form controls (avoids iOS focus zoom), consistent 44–50px touch
targets, wider phone entry on narrow phones, balanced spacing, shorter copy,
clearer attendance choices and extra-guest counts/bounds. Gate/card entrance
transforms are removed on this screen, and the card stays scrollable in small
portrait/landscape viewports with safe-area padding and reachable submit.

Returning-device guidance now uses a neutral status notice near the top,
not the red validation alert; the link accurately says “another device” when
no guest is saved. Actual errors clear when editing and invalid fields expose
ARIA state/description, open their parent optional section, and receive focus.
Only name/phone are required in quick mode, including when Other is selected.
OTP-required mode still restores its required contact/connection fields.

Form validation now waits for the public mode before checking optional versus
required fields (novalidate avoids hidden native-required-field dead ends).
Client phone validation matches the 9–15 international-digit server format,
including normalization of 00 prefixes; malformed optional email can be fixed
or removed. Pending config/save operations show busy feedback and have a
20-second recovery bound. Failure/timeout keeps field values and the hashed-
secret idempotency retry key; successful entry still waits for server save.
No OTP, admin/voting policy, backend or stored content changes.

Expanded disposable browser tests pass: empty name/invalid phone, collapsed
invalid optional email, Other in both OTP modes, config outage recovery,
00-prefixed international phones, synthetic save timeout with retained retry
key, actual save retry/duplicate guard, no OTP request, attendance/party bounds,
saved reload continuity, verified-voting isolation and neutral device guidance.
GET-only real-data preview checks pass for 320x568/375x667/430x1100/844x390,
16px inputs, reachable submit, hidden OTP and no JS exceptions. Worker and
logout/push regressions pass. Predeployment snapshot: `/root/wedding-pre-v202`.

Deployed `c53ff88`; read-only live check-in checks pass in small portrait and
landscape layouts, including neutral returning-device help and unchanged
OTP-off mode. Audit retained 18 guests, 1 RSVP, all 25 media records/files,
0 guestbook entries, 3 gifts, 1 fund, 39 settings and both competitions
unchanged; SQLite integrity `ok`, API/nginx active. No live test check-ins,
uploads, message delivery or content changes were performed.

## Floral polish and direct Bridal Train / Live tabs — v201 (16 October)

At the user's request, expanded navigation from seven to nine destinations:
Home, Our Story, Events, Bridal Train, Gallery, Live, Memories, Gifts, Share.
Gallery retains the fifth/centre slot. Bridal Train and Live now select their
own tabs rather than Story/Events. New buttons use a slow gold halo pulse,
without transforms/layout motion; reduced-motion disables the animation.
Minimum 44px-wide targets; the bar alone swipes horizontally below 396px,
and selecting a clipped destination brings it into view without scrolling
the page. Safe-area padding/content clearance updated for the taller bar.
Selected navigation exposes aria-current; repeated active-tab taps preserve
page position. Invalid routes cannot hide all views. Dynamic broadcast hero
home/menu controls now handle clicks through the rendered host.

Shared `app-polish.css` adds bounded floral corner artwork, cream/gold
finishing, resilient form/media widths and consistent serif guest headings,
without overwriting page content or the Bridal Train/Live reference layouts.
No backend, settings, guest, vote, upload or OTP-mode changes.

Initial 375px diagnostics across 17 guest/sign-in pages found finite page
bottoms and no reproducible continuous scroll. No intentional auto-scrolling
has been added; navigation strip visibility uses only the strip's scrollTo,
never scrollIntoView that could move the document. A new read-only shell
suite checks all page bottoms, routes, touch widths and polling stability.

Unit checks pass for worker caching, logout/push controls, Bridal Train and
broadcast validation/calendar, and thirteen-section admin navigation. Mocked
dashboard checks pass at 320/375/430px including retained upload controls;
Share suite passes guest/admin layouts, all nine routes, calendar/reminders,
notification/install states, music upload failure handling and sign-out.
Full disposable browser/API regression passes for Home/Share/Story routing,
synthetic microphone recording and denied/late permission cleanup, retained
failed uploads/duplicate guard, competition editing/photos/countdowns,
verified OTP sessions/ballots, moderation/privacy, browser ballots, polling
selection preservation, pause and deleted-game recovery. Physical-phone
microphones and real OTP delivery are not exercised by these tests.
The read-only shell suite passes all 17 guest/sign-in pages at 320/375/430/
768/1024px: finite bottoms, no document horizontal overflow, nine routes,
minimum touch sizes and selected-tab visibility. Bridal Train and Live
preserve height/scroll position and issue no scroll commands across actual
15-second polling cycles; tapping the active tab does not jump. Gold pulse,
reduced-motion and both dynamic broadcast hero buttons pass. The reported
continuous scrolling was not reproduced; physical-device follow-up may be
needed if it persists. Preview screenshots reviewed with current real photos.

Deployed `667abc5`. Read-only live Bridal Train and Live Broadcast checks
pass at 320/375/430/1024px, including nine-tab navigation and real photos.
Fresh deployment snapshot `/root/wedding-pre-v201/wedding-deploy.db` retains
16 guests, 1 RSVP, all 25 current media records/files, 0 guestbook entries,
3 gifts, 1 fund, all 39 settings and both competitions unchanged; SQLite
integrity `ok`. API/nginx active; no live saves/uploads/messages or backend
configuration changes were made by this release.

## Bridal Train reference composition — v200 (16 October)

Guest Bridal Train now follows the supplied reference layout: full-width real
couple photo hero with S&J/menu overlay, script heading/heart divider, gold
pill group headings with dedicated gold-leaf ornaments, five-across portrait
cards (nine bridesmaids flow 5+4, ten groomsmen 5+5), centered names/roles and
heart details, plus a floral script “Together in Love” footer. Short final
rows center and expand slightly while preserving equal portrait heights.
Saved titles/subtitles/footer, group counts, names, roles and photos remain
data-driven; no settings are overwritten. Missing portraits remain honest
initials/“Portrait coming soon” placeholders, not reference/mock-up faces.

Scoped `bridal-train-reference.css` changes the guest view only; editor CRUD,
draft uploads, revision conflicts, full-size originals/lightbox retries,
seven main tabs and central Gallery are preserved. Hero home/menu actions
use delegated navigation for dynamically rendered controls. Group jumps,
photo hint and Back to Our Story remain below the reference composition.
Cache bumped to v200-bridal-reference; new CSS and gold sprig precached.

Disposable browser suite passes: reference 5+4 card rows and equal image
heights at 320/375/430/1024px, hero menu/home, editor add/remove/reorder,
draft portrait upload/save/view/retry, duplicate guard, failure retention,
conflicts/reload and sign-out cleanup. Schema/default and service-worker
tests pass. GET-only candidate previews using public live data pass Bridal
Train and Live Broadcast regressions; no live saves/uploads/messages.

Deployed `2720de7`; read-only live Bridal Train checks pass. Snapshot:
`/root/wedding-pre-v200`. Audit retained 13 guests, 1 RSVP, 26 media
records/files, 0 guestbook entries, 3 gifts, 1 fund, 2 competitions and
1 competition vote; SQLite integrity `ok`. The strict snapshot audit flagged
a concurrent `liveBroadcast.posterUrl` edit, investigated separately and
left untouched. All other settings (including bridalTrain) match the snapshot.
No backend changes, live test guests or content saves in this deployment;
API/nginx remain active.

## Live Broadcast reference layout — v199 (16 October)

Rebuilt the guest Live Broadcast composition to follow the supplied cream/gold
reference: edge-to-edge photo hero, S&J/menu overlay, flowing script heading,
heart divider, floral countdown strip, wide poster/player, gold join CTA,
three-column schedule and replay cards, and paired reminder/share cards.
Scoped `live-broadcast-reference.css` replaces the separate header only in
this view; seven main tabs and central Gallery remain unchanged. Existing
real configured photos are used; decorative hero/poster crops never alter
stored originals. Admin editor and settings are unchanged.

Missing dates show dashes and “to be announced”; empty replay slots are
explicitly unavailable placeholders, not invented broadcasts. No fabricated
LIVE/viewer/HD claims or copied sample dates. Calendar/reminder and join
controls remain disabled until real details exist. Section jumps and manual
refresh remain below the reference cards. Provider embeds still load only
after Play; active player survives metadata refresh and supports retry/close.

Disposable full broadcast browser suite passes (editing, ordering, draft
photos, failure/duplicate guards, conflicts, playback and preservation).
GET-only preview using actual public photos passes 320/375/430/1024px checks,
including three-column schedule/replays and two-column action cards, decoded
photos, no eager iframe and no JS exceptions. Broadcast schema/calendar and
service-worker regression suites pass. Cache: v199-broadcast-reference.

Deployed commit `6ed2927`. Read-only live broadcast checks pass at all four
widths. Fresh snapshot `/root/wedding-pre-v199`; preservation audit retained
13 guests, 1 RSVP, all 26 media records/files, 0 guestbook entries, 3 gifts,
1 fund, 37 settings and both competitions. SQLite integrity `ok`; API/nginx
active. No live data/settings were edited and no test guests were created.

## Temporary OTP pause and quick onboarding — v198 (16 October)

Guest OTP can be paused with server environment `GUEST_OTP_REQUIRED=false`.
Default is still OTP-required when unset/true; re-enabling requires updating
that variable and restarting wedding-api. Admin password/session protection is
unchanged. GET `/api/onboarding` returns only the public mode with no-store.
While paused, OTP send/verify, phone-only lookup and returning phone login
return 409 before creating codes or contacting SMS/email/voice providers.
Old clients are told to refresh for quick check-in.

Name and phone are the only required guest fields in quick mode. Contact,
location and relationship sections collapse and become optional; attendance
and party-size controls remain. Check-in waits for a confirmed server save,
enters immediately on success, keeps fields on errors, guards duplicate clicks
and remembers a successful guest on this device. No notification-permission
prompt is automatically requested during quick entry. New-device continuation
asks for details again, rather than exposing a prior profile by phone alone.

POST `/api/guest-entry` is available only while OTP is paused, rate-limited
and same-origin checked. It creates a pending, self-reported guest, never
overwrites/retrieves someone by an unverified phone and never issues a verified
voting cookie. Same-phone entries on different devices may remain separate
pending records; preventing account takeover is preferred to phone-only merge.
A per-attempt 256-bit secret (sessionStorage until success, hash only on server)
binds idempotent retries for 24 hours in additive `guest_entry_keys`. No guests,
settings or ballots are seeded or replaced. Admin lists label these entries
“Quick check-in · no OTP”. Existing signed-in guests retain their sessions.

Verified competitions keep their existing policy and ballots; quick check-in
does not qualify as verification. Their Verify action explains the temporary
limitation rather than looping through onboarding. Browser-voting competitions
remain available under their existing independent browser-cookie rules.

Disposable API tests pass: no OTP/code creation while paused, validation,
same-origin guard, concurrent/idempotent retries, hashed secrets, no phone
takeover/disclosure, no verified session, admin protection/labels, expiry,
restart persistence and re-enable switch. Disposable browser tests pass for
name/phone-only validation, optional sections and 320/375/430px layouts,
save failures, duplicate clicks, zero OTP requests, same-device reload entry
and safe new-device continuation. Existing full competition API/session/OTP
regressions also pass with verification re-enabled in isolated tests.
Command: `WEDDING_E2E_QUICK_ONLY=1 WEDDING_E2E_SERVER=/root/wedding-onboarding-v198-candidate/quick-onboarding-server.js node tests/isolated-e2e.cjs <output-dir>`.

Deployed with `GUEST_OTP_REQUIRED=false`; public config and all four paused
routes were verified live (empty requests only, no messages sent). Read-only
mobile onboarding and thirteen-category dashboard/upload checks pass. Fresh
predeployment snapshot: `/root/wedding-pre-v198` (private environment backup
stays on the server only). Preservation audit retained all 9 guests, 1 RSVP,
26 media records/files, 0 guestbook entries, 3 gifts, 1 fund, 37 settings and
both competitions; SQLite integrity `ok`. API/nginx active; backend files
match the deployed repository. No live test guests were created.

## Bridal Train / live-stream usability enhancements — v197 (16 October)

Frontend-only update; existing API, schema and saved settings are unchanged.
Bridal Train adds script-heading polish, group jump buttons/counts, keyboard
focus at the selected group, coordinated gold/cream cards and reduced-motion
aware hover treatment. The couple header opens its original full-size photo;
portrait buttons keep opening originals. Bridal photo viewer reports loading,
handles failed images and offers Retry photo without replacing the original.
No mock portraits were added; real portrait uploads are still needed.

Broadcast adds Schedule/Replays quick links, manual detail refresh, actual
scheduled date/time with the device timezone, optional schedule end times and
time-window labels that never imply a real feed is live. Replay cards have
clear Play overlays. Playback has a title, provider fallback link and explicit
Retry player. Direct-video loading/buffering/error messages are available;
cross-origin iframe failures cannot be reliably inspected, so provider fallback
is always visible rather than claiming an embed was successfully streaming.
Each player attempt has an identity guard so late events cannot overwrite a
newer attempt. Offline details remain visible with a connection message.
Direct videos also offer Safari's native full-screen method when the standard
container full-screen API is unavailable; provider players retain their own
full-screen controls. This remains subject to physical-device testing.

Details/replay/schedule changes now render while watching WITHOUT moving or
recreating the active iframe/video. Explicit retry replaces the player;
navigation, removed links and ended main broadcasts still stop playback.
Both editors keep pristine field DOM/focus when a poll returns the same
revision, show unsaved/working state, offer sticky Save/Reload/View Published
actions and request a browser unload warning when a draft/upload exists.
Unload prompts depend on browser support; drafts are not persisted across
reloads. Bridal header uploads now have an editor preview. Existing revision,
draft-only-upload and auth-session guards remain in place.

Extended disposable browser checks cover group/section jump focus, pristine
row preservation, draft state/unload warning, photo viewer retry, provider
fallback, player identity across remote detail changes, explicit player retry
and direct-video failure/stale-event recovery. Actual provider playback and
physical phone testing still require a real broadcast and device.

Deployed v197; fresh predeployment SQLite/frontend snapshot is
`/root/wedding-pre-v197`. Both disposable browser suites passed, followed by
read-only live Bridal Train/broadcast checks at 320/375/430/1024px and the
thirteen-category dashboard/upload regression suite. Live names and configured
couple photos match the API, seven main tabs remain, no eager iframe or JS
exceptions were found. Preservation audit: all 6 guests, 1 RSVP, 26 media
records/files, 0 guestbook entries, 3 gifts, 1 fund, 37 settings and 2
competitions retained; SQLite integrity `ok`. API/nginx remain active.

## Live Broadcast and Bridal Train refinements — v196 (16 October)

Added Home, Events and Share links to **Our Live Broadcast** without changing
the seven main tabs. Cream/gold photo-and-script header, floral countdown band,
poster/player, Join Us Live, three-column schedule, replay cards, calendar,
calendar reminder and share controls follow the reference. Uses the confirmed
real couple photo by default; mock-up people/venue photos are not published.
No invented dates, replays, viewer count or HD claim. Defaults are unconfigured:
**Broadcast details coming soon**, no countdown or LIVE badge, disabled calendar
actions until real dates are entered. Scheduled countdown uses server time;
reaching zero waits for the host rather than automatically claiming to be live.

Admin Dashboard's thirteenth category, **Live Broadcast**, supports title,
subtitle, introduction, explicit status, HTTPS stream URL, local start datetime,
header/poster uploads, schedule add/remove/order/times/links and replay
add/remove/order/date/duration/poster/link. SAVE BROADCAST publishes the draft;
photo uploads alone do not publish. Failed saves/polling retain drafts; stale
revision saves reject with 409. Reload confirms draft loss; logout clears editor.
Upload/save duplicate guards and auth-session response checks are included.

Public GET `/api/live-broadcast` returns defaults without a settings write;
admin PATCH `/api/admin/live-broadcast` validates and writes only `liveBroadcast`
using transactional revision comparison. Admin POST `/api/admin/live-broadcast/photo`
uses the 10 MiB JPEG/PNG/WebP photo limit. Missing saved photos reject updates.
Public HTTPS URLs are required; no server fetch of remote video links occurs.
YouTube/Vimeo iframe URLs are allowlisted and generated on the server. No iframe
or direct video loads until Play. Other providers use external HTTPS links.
Playback pauses background wedding music and is removed on navigation/hiding.
Provider playback itself depends on the host's real embed permissions/network;
synthetic browser checks verify iframe creation/cleanup, not an actual wedding feed.

Calendar downloads use confirmed dates only, UTC, escaped/folded ICS text, stable
event IDs and optional 15-minute VALARM. The guest must import the file; this is
not automatic web-push scheduling. Sharing uses the broadcast page `?live=1`,
preserves the existing entry flow and offers clipboard/manual-copy fallback.
The Bridal Train receives coordinated cream/caption/floral-footer styling;
both features poll only when their guest view or actual admin view is visible.

Tests: schema/calendar unit checks; disposable API auth, MIME/oversize cleanup,
missing-photo validation, revision conflicts, SQLite integrity and restart
persistence; actual disposable browser responsive layouts, all guest links,
schedule/replay editing, draft portrait upload, retry/duplicate guards, calendar
reminder/share, no eager embed, playback cleanup, conflict/reload/logout and
unrelated-settings preservation. Commands:
`WEDDING_E2E_BROADCAST_ONLY=1 WEDDING_E2E_SERVER=/root/wedding-broadcast-v196-candidate/server.js node tests/isolated-e2e.cjs <output-dir>`;
`node tests/live-broadcast.test.cjs`;
`node tests/gifts-design.cjs <output-dir> --live-broadcast` (read-only live).
Real broadcast link, dates, replay files and real Bridal Train portraits are
still to be supplied/configured. Physical-phone/provider playback not verified.

Deployment: v196 frontend and API are active. Fresh SQLite/code snapshot:
`/root/wedding-pre-v196`. Postdeployment preservation checks retained 6 guests,
1 RSVP, all 26 media records/files, 0 guestbook entries, 3 gifts, 1 fund,
all 37 settings and both competitions; SQLite integrity `ok`. Live new
admin routes reject unauthenticated requests, v196 assets return 200, and
public defaults remain unconfigured without writing a settings entry.
Read-only live broadcast/current-photo, thirteen-category mobile dashboard,
upload/navigation duplicate-guard and fresh Home reload checks pass. Entering
an already-selected Bridal Train/Broadcast admin section explicitly refreshes
its editor, without waiting for the next polling interval (script v196.1).

## Bridal Train — v195 (16 October)

Added Our Story → **Our Bridal Train** and a second link in Share's menu.
Seven main tabs remain unchanged. Guest page uses the reference's cream/gold
style, a current-couple-photo header, responsive portrait cards, group counts,
roles, hearts as decoration (not votes), and Together in Love closing text.
Default names: Cynthia, Becky, Abigail, Jennifer, Esther, Victoria, Vennessa,
Evelyn, Lian; Sammy Jay, Mike, Charles, Fada Ignatious, Mr. Larbi, Paak, Dave,
Kojo, Alhaji, Nana Kojo Ignis. Counts 9 bridesmaids / 10 groomsmen. Reference
role typos corrected to Groomsman. Mock-up faces are NOT published as actual
portraits; initials/Portrait coming soon remain until real photos are uploaded.

Admin Dashboard has a twelfth category, **Bridal Train**. It edits title,
subtitle, group headings, closing message, optional header photo, names, roles,
portraits and order; add/remove and Earlier/Later buttons support up to 50 people
per group. Changes publish only after SAVE BRIDAL TRAIN, including uploaded
portrait selection. Header defaults to the confirmed current couple photo.
Drafts survive polling, failed saves and navigation between dashboard sections;
explicit RELOAD SAVED confirms discarding drafts. Sign-out clears editor fields.
Duplicate submits/uploads are guarded; changed-session responses are ignored.

New public GET `/api/bridal-train` serves saved content or reference defaults
without writing settings. Admin-only PATCH `/api/admin/bridal-train` validates
metadata, unique IDs, group sizes, required names/roles and local JPEG/PNG/WebP
URLs. It compares the expected SHA-256 revision and saves in one SQLite
transaction, rejecting stale edits with 409. Missing files reject saves.
Persistence uses a separate `bridalTrain` settings key; no table migration.
Photo upload `/api/admin/bridal-train/photo` is admin-only, 10 MiB maximum,
JPEG/PNG/WebP only, with existing image optimisation and background 1280px display
previews. Originals retained; full-screen viewing uses originals. Unused draft
uploads are retained, like existing competition-photo uploads.

Page loads on demand, polls only when its guest view/editor is visible, skips
polls while hidden/uploading, and avoids repainting unchanged content. Portraits
are lazy/async decoded with stable aspect ratios. Header reuses the small current
couple image, not an extra large illustration. Loading/retry/stale-content states
are explicit, and failed portraits fall back to originals then initials.

Schema/API/actual disposable-browser checks pass: default names/roles/counts,
320/375/430/1024 widths, both guest links and Back, admin add/remove/reorder,
portrait upload/draft/save/full-screen source, failed-save retry, duplicate guard,
polling draft preservation, transactional conflict/reload, sign-out cleanup,
auth guards, unsafe-photo rejection, 10 MiB rejection and restart persistence.
No real bridesmaid/groomsman portraits or physical-phone checks were supplied.
Focused command: `WEDDING_E2E_BRIDAL_ONLY=1 WEDDING_E2E_SERVER=/root/wedding-bridal-v195-candidate/server.js node tests/isolated-e2e.cjs <output-dir>`.
Twelve-category dashboard/upload, Share/seven-page and fresh-photo/retry
regressions pass. Pre-v195 preservation audit: 6 guests, 1 RSVP, all 26 media
records/files, 0 guestbook entries, 3 gifts, 1 fund, 37 settings unchanged and
both existing competitions retained; SQLite `ok`, API/nginx active. No live
bridal edits or portrait uploads were submitted during verification.
Read-only deployed Bridal Train names/counts, current-couple hero, four viewport
widths, Back/admin guards and initial/reload Home image checks pass. Header photo
uses contain (uncropped); guest portraits use cover in cards and originals in
the full-screen viewer.

## Main site photo loading/recovery — v194 (15 October)

User reported missing Home photo/content. Live browser reproduced heavy first
loads: Home original 3,868,921 transfer bytes / about 25.5s in that browser,
plus several 2–4 MB welcome/heart/Gifts/story images competing for bandwidth.
API and nginx were active, load 0.00, originals present. The v193 previews only
covered memory/album images, not site-setting photos. No evidence of lost data.

Added non-destructive 1280px display JPEG generation for configured site photos.
Public settings expose a derived `photoPreviews` JSON map from original URLs to
existing display variants; no stored setting is rewritten. `sitePhoto()` uses
only the current confirmed original's matching variant, preserving the no-old-
photo flash guard. Home, header heart, welcome, landing art, Gifts and timeline
use smaller display images. Full-screen timeline viewing retains the original.
Startup queues missing display files; new site-photo uploads also enqueue them.
Original URLs/files remain available. Missing/unsupported outputs use originals.

Home photo gets high fetch priority and asynchronous decoding. Eager image
readiness also checks successful `decode()` to avoid cached/load-event timing
leaving a decoded image hidden. A loading/retry status is shown instead of
silent blank content; settings errors explain reconnection. Failed image loads
get up to three bounded retries, Retry Photo allows the same URL to recover,
and the online event retries settings/images. This addresses the old failure
state where unchanged `photoTarget` skipped future attempts indefinitely.

Candidate refresh tests cover delayed settings, current display mapping, stale
map rejection, no-old-photo flash, offline settings recovery, failed-image/same-
URL retry and cached decode readiness. Dashboard/Share/mobile and API security/
persistence tests pass; actual ffmpeg preview tests keep original hashes intact.
No physical Safari/iPhone verification is implied by desktop browser tests.
Live verification: Home display is 143,235 bytes versus 3,868,621 original
bytes (96% smaller). Same browser measured roughly 2.34s display transfer after
the fix versus 25.46s for the original before; not a controlled phone benchmark.
Initial/reload Home checks pass with the current display variant and fresh
settings. Guest album order/mobile and engagement content/navigation checks
pass. Seeded Gallery cards also retain original sources for full-screen viewing.
Fresh pre-v194 audit: 6 guests, 1 RSVP, all 26 memories/original files, 0 guestbook
entries, 3 gifts, 1 fund, 37 stored settings unchanged, existing competition
retained; SQLite `ok`, services active. No live content edit/upload/vote tested.

## Media browsing and upload feedback performance — v193 (15 October)

Diagnostic read-only server check: load average 0.00, API around 87 MB RSS,
about 11 GiB free disk; no evidence of CPU/memory/storage overload at that time.
An individual phone's upload throughput was not measured. Raising the file cap
does not shrink original videos; server compression cannot save inbound bytes.

Added serial, single-thread background JPEG preview generation for memory
photos, bounded to 640×640 while keeping aspect ratio. Original files and memory
rows remain untouched. Sidecars use `<original filename>.thumb.jpg`; startup
generates missing previews and new uploads enqueue after the response. Failed/
unsupported encodes leave the original working; each worker has a 60s timeout.
Feeds expose `thumbnailUrl` only when an output exists. Gallery/album covers,
Our Story and admin media cards prefer previews; full-screen guest photo viewing
still opens the original. Reorder responses retain thumbnail metadata. This is
for memory photos, not configurable Home/timeline photos or competition covers.
Existing sidecars are retained if an album row is removed (small orphan-preview
cleanup remains a maintenance follow-up).

Album covers avoid rebuilding unchanged DOM. Staged video previews use
`preload="none"` instead of reading video metadata every render. Share/Gallery/
S&J uploads now display MB sent/total, average MB/s and estimated time remaining
once a second of transfer is available; estimates vary with network conditions.
100% correctly means sent/saving, not published before the API response.
The 1 GiB cap, streaming upload path and extended deadlines are retained.
Uploads are still non-resumable. No risky real-time browser video recompression
was added: that could delay uploads, overheat phones and reduce quality.

nginx enables HTTP/2 for HTTPS and adds JSON gzip to reduce connection/request
overhead. This is not a promise of increased phone uplink bandwidth. Wi-Fi,
keeping the app foregrounded and choosing a smaller 1080p/720p export remain
the practical remedies when a large video exceeds the available uplink speed.

Actual ffmpeg disposable test: 2400×1600 test image 68,024 → 18,894 bytes;
preview dimensions bounded and original hash unchanged. Isolated nginx/API
large upload regression still accepts 257 MiB / exactly 1 GiB, rejects/cleans
1 GiB+1, with 171 concurrent health probes, worst 88ms, API peak RSS 107.4 MiB.
Order/browser tests verify thumbnail rendering uses the original for full screen.
Dashboard/Share/seven-page, fresh-photo/reduced-motion, upload helper ETA and
video queue/worker regressions pass. No actual iPhone throughput benchmark.
Deployed verification: HTTPS negotiates HTTP/2; 13 existing photo previews total
474,205 bytes versus 12,462,920 original bytes, a 96% preview-data reduction.
This does not quantify a video upload speedup. Live guest album ordering/mobile,
admin upload controls and image-preview source checks pass. Pre-v193 audit:
6 guests, 1 RSVP, all 26 memories/original files, 0 guestbook entries, 3 gifts,
1 fund, 37 settings unchanged, existing competition retained; SQLite `ok` and
services active. No live test upload, vote or content reorder was submitted.
Live Home refresh first run missed its readiness deadline; the original Home
file was confirmed present and settings HTTP/2 response was 200. Standalone
retry passed both initial/reload current-photo assertions, then the browser
harness exceeded its process-cleanup timeout after printing PASS. This is not
a measured physical-phone startup/upload timing result.

## Admin Our Story photo/video ordering — v192 (15 October)

Admin Dashboard → Our Story → S&J Gallery now has First, Earlier, Later and
Last controls and numbered positions on each published album item. Each move
saves automatically, for both photos and videos. Guests' Our Story → S&J Gallery
uses the same custom order. New uploads appear first, keeping existing custom
relative order. Reordering does not alter captions, dates, media files or URLs.
Timeline text/photo slots and guest-uploaded Gallery ordering are unchanged.

Order is persisted in a new `sj_gallery_order` table, keyed by memory ID; no
existing memory rows are migrated or modified. Public/admin memory feeds include
the optional `sjOrder` field. Admin-only PATCH `/api/admin/gallery/order` validates
every current album ID exactly once and compares the expected order in the same
SQLite transaction as the write. Changed order/membership returns 409, preventing
one admin's stale list overwriting another device's work. Failed saves do not
optimistically change the displayed order; the current list is reloaded for retry.
Duplicate taps are blocked while saving; sign-out/changed-session responses are
ignored. Controls use touch-friendly buttons, not drag-only gestures. Explicit
admin moves pause that editor's media; background polls do not stop playback.
Unchanged admin album snapshots now avoid unnecessary grid rebuilds.

Actual browser/disposable API tests pass for all four moves, mixed photo/video,
guest ordering, 320/375/430/1024 mobile widths, failed-save retry, duplicate taps,
admin guard, invalid/missing/duplicate IDs, stale conflicts and sign-out cleanup.
API tests verify saved order survives restart and files/metadata remain intact.
Dashboard upload/progress/duplicate-protection, Share/seven-page, API security,
upload helper and service-worker regressions pass. Focused command:
`WEDDING_E2E_ORDER_ONLY=1 WEDDING_E2E_SERVER=/root/wedding-order-v192-candidate/server.js node tests/isolated-e2e.cjs <output-dir>`.
Deployed read-only guest album order/mobile/auth checks and dashboard/upload
regressions pass. Fresh pre-v192 preservation audit: 6 guests, 1 RSVP, all
26 memories/files, 0 guestbook entries, 3 gifts, 1 fund, 37 settings unchanged;
existing competition retained, SQLite `ok`, services active. Existing live album
order was not rearranged for testing. No live media uploaded/deleted or votes cast.

## Large phone-video uploads — v191 (15 October)

Raised the general media per-file limit from 256 MiB to 1 GiB (1,024 MiB),
including Our Story / S&J Gallery. Competition photos retain their 10 MiB cap.
Browser preflight and song picker match the general cap. Added an Our Story
upload hint to use Wi-Fi and keep the page open. Files above the cap still need
trimming/compression; retrying an unchanged oversized file will not help.

Browser upload deadlines are now 60 minutes; ordinary API reads stay at 15s.
Node requestTimeout is 65 minutes instead of its default five minutes. nginx
permits 1,100 MiB request bodies (multipart overhead), uses 60-minute upstream
read/send inactivity timeouts, and streams request bodies directly to Multer
instead of first buffering another large disk copy. Its client body inactivity
timeout remains 120s. Multer still streams to disk rather than buffering in RAM.
The existing serial background compression queue is preserved; ffmpeg decoder,
filter and H.264 encoder threads are limited to one on this small server.
No compression or synchronous encoding was added to the browser/API request.
Proxy 413 responses now have a useful fallback error instead of bare HTTP text.

New disposable API + isolated loopback nginx integration test streams actual
257 MiB and exactly 1 GiB multipart files successfully through the candidate
proxy and API; 1 GiB + 1 byte returns 413 and its partial file is removed.
No live data is used. During those transfers 168 concurrent health probes
passed, worst 65ms, API peak RSS 108.1 MiB. Synthetic test bytes do not establish
real-phone video quality or codec compatibility. Browser-helper tests check
the 1 GiB boundary, oversized preflight, 10 MiB photo cap and extended XHR timeout.
API security/persistence, video queue, dashboard upload/retry, Share/seven-page
and service-worker regressions pass. New command:
`node tests/large-upload-api.cjs /root/wedding-upload-v191-candidate` (Linux).

Uploads remain non-resumable: phone backgrounding, a network loss or closing
the tab may require a full retry. Existing staged-file retention and duplicate
submit guards remain. No physical iPhone upload of the user's video was tested.
Predeployment disk check showed about 11 GiB free; off-site backups/automatic
storage expansion are not configured. Larger uploads consume more disk/bandwidth.
Deployed API/client/proxy changes; nginx configuration validated before reload.
Only targeted upload directives in the live nginx config were changed, retaining
its existing cache duration and IPv6 differences from the repository template.
Live refresh/current-photo, dashboard/upload controls and reception navigation
checks pass. A chained browser run timed out starting the final program check;
the standalone retry passed. Pre-v191 snapshot audit: 6 guests, 1 RSVP, all
27 memories/files, 0 guestbook entries, 3 gifts, 1 fund, 37 settings unchanged,
existing competition retained; SQLite `ok`, both services active. No test upload,
guest registration or vote was submitted to live records.

## Engagement / traditional program — v190 (13 October)

Added Events → **Engagement / Traditional Program**, alongside Reception
Program, using the supplied traditional wedding poster: January 9, 2027,
7:00 AM–11:00 AM, twelve entries including the untimed special guests speech
(OMANHENE OSEADEEYO KWESI AKUFFO III and NII KOJO ABABIO I) and untimed
ceremony conclusion. No time was invented for those two entries. Closing
gratitude and ALWAYS & FOREVER are included.

Admin Dashboard → Program Lineup now has RECEPTION and ENGAGEMENT / TRADITIONAL
selectors. Both editors stay mounted with separate drafts, save/reload controls,
settings keys and conflict checks. Engagement activity time is optional; title
is required. Existing reception validation still requires times. Saved programs
are validated before any settings writes; a malformed engagement in a combined
patch cannot partially overwrite reception. Shared program rendering/editor
keeps prior escaping, unsaved-draft/retry/polling protection and sign-out cleanup.
Engagement metadata and 1–40 activities use the same length limits as reception.
The new setting is `engagementProgram`; no data migration or existing setting
rewrite. Seven main tabs and eleven dashboard categories remain unchanged.

Actual-browser/disposable-API tests pass for both programs: supplied entries,
untimed activities/speakers, guest navigation and 320/375/430/1024 widths,
independent admin drafts and saves, optional engagement time, invalid combined
patch/auth guards, sign-out cleanup and preserved reception/event settings.
Both settings persist across isolated API restart. Dashboard, Share/seven-page,
schema and worker regressions pass. Focused engagement command:
`WEDDING_E2E_ENGAGEMENT_ONLY=1 WEDDING_E2E_SERVER=/root/wedding-program-v190-candidate/server.js node tests/isolated-e2e.cjs <output-dir>`.
Deployed read-only engagement/reception navigation/content/mobile checks and
current-photo reload checks pass. Fresh pre-v190 preservation audit: 5 guests,
1 RSVP, 31 memories/files, 0 guestbook entries, 3 gifts, 2 funds, 36 settings
unchanged, existing competition retained; SQLite `ok`, services active.
No live program save, guest registration, media upload or vote was submitted.

## Editable reception program — v189 (13 October)

Added Events → **Reception Program**, with an ivory/gold editable-text program
based on the supplied January 9, 2027 poster. It includes the full 12-activity
2:00 PM–10:00 PM reception lineup, names/tagline/date, MCs, activity descriptions
and End of Reception. Both 5:45 PM activities (dinner and live band) are kept
in their provided order. Existing main Events schedule, wedding details and
seven main navigation tabs are unchanged. Program is an Events subview.

Admin Dashboard has an eleventh category, **Program Lineup**, with directly
editable title, names, tagline, date, reception time, MC/hosts, closing message,
and 1–40 activities. Admins can add/remove/reorder entries and edit time/title/
details, then SAVE PROGRAM. RELOAD SAVED is explicit and confirms discarding
unsaved changes. Duplicate times are allowed; no automatic chronological sort.
Plain text is HTML-escaped for guest rendering. Failed saves preserve the draft;
live polling does not overwrite unsaved fields. Save rechecks the loaded program
against the server before writing and refuses known newer-content conflicts
(this is a client-side conflict check, not a database compare-and-swap guarantee).
Admin sign-out clears the editor. Guest updates use the existing settings poll.

`receptionProgram` is a separate public settings JSON value. Admin-only PATCH
validates its metadata/items/types/required fields/lengths before any setting
write, normalises the value and avoids the ordinary 8,000-character truncation
limit. Maximum encoded length is 32,000 characters. No table migration.
The poster content is a supplied fallback when fresh settings confirm no saved
program exists; publishing an edit persists the program in SQLite. On startup
the program waits for current settings rather than briefly showing an older
fallback; offline first-load asks for reconnection. Existing photos, games,
gifts, media and event times are not rewritten.

Added reception schema unit test and actual-browser/disposable-API program
tests: all supplied entries/repeated times, Events/Back navigation, mobile guest/
editor fit, add/remove/order, failed-save retry, dirty-field preservation,
newer-server conflict/reload, persistent save, admin guards, invalid JSON and
unchanged event settings pass. Expanded API tests verify >8 KB programs persist
untruncated across API restart and malformed program rejects the whole patch.
Dashboard tests now cover eleven categories. Candidate dashboard/Share/mobile,
Gift Message and worker regressions pass. Focused command:
`WEDDING_E2E_PROGRAM_ONLY=1 WEDDING_E2E_SERVER=/root/wedding-program-v189-candidate/server.js node tests/isolated-e2e.cjs <output-dir>`.
No live test program save, upload, vote or guest registration is submitted.
Deployed read-only program content/navigation and 320/375/430/1024 width checks
passed, along with eleven-category dashboard/upload, Share/seven-page and
current-photo reload checks. Public routes 200, admin guards 401, services active
and SQLite `ok`. Pre-v189 snapshot retained 5 guests, 1 RSVP, 31 media records/
files, 0 guestbook entries, 3 gifts, 2 funds, 35 settings and the live competition.
API restarted for validated program persistence; no existing settings were
changed and no data migration was needed.

## Hours/minutes/seconds voting countdown — v188 (12 October)

Competition timers now have three columns: Hrs, Mins, Secs. Hours are total
remaining hours (24 hours instead of 1 day, 49 hours instead of 2 days plus an
hour); minutes/seconds still roll normally. This applies to guest/admin lists,
guest detail, and admin management, including completed 00:00:00 timers.
The Home and Events wedding countdowns keep their existing day columns.
No closing time, vote, competition config or automatic-expiry behaviour changes.
Focused actual disposable countdown tests passed for three units, a greater-
than-24-hour timer, admin edits, guest/admin expiry and preserved votes.
Candidate mobile competition tests passed at 320/375/430/1024 widths.
Only the changed competition assets receive v188 URLs; unchanged assets keep
their existing v187 versions. Worker cache is v188. Frontend-only release.
Deployed mobile competition and worker reruns passed. Health/public routes 200,
admin guards 401, services active and SQLite `ok`. Snapshot retained the live
competition and all guest/RSVP/media/gift/fund/setting records and referenced
files. No API restart or live deadline change was required.

## Editable voting countdown — v187 (12 October)

Guest and admin competition lists, guest detail and admin management now show
days/hours/minutes/seconds countdowns. Upcoming polls count to opening; active
polls count to their saved closing time. Expired/manually closed polls show
**Completed — voting closed**, clamp time to zero and retain votes/results.
Drafts are labelled private/not published. Existing games without an end date
show **No closing time set**; no deadline is invented for live games.

Admin management includes **Edit Countdown / Closing Time**, opening the
Voting Countdown & Period portion of the existing editor. Dates remain editable
before and after votes, without changing locked verification/audience/mode.
Duration shortcuts set 15 minutes, 30 minutes, 1 hour or 24 hours from a future
scheduled start or from now if already open. Custom end dates are supported.
Saving a later deadline for a time-expired active poll can reopen its timed
window; a manually closed poll remains closed until Resume / Reopen. An end
date must be in the future when publishing/reopening and after a scheduled
start. Pausing does not freeze the deadline; this is labelled explicitly.
Date entry/display uses the device's existing local timezone interpretation.

API presentations include serverNow; the frontend calibrates a clock offset
using request midpoint and strips that transient field before polling-signature
comparison. One visible-page timer updates countdown text without rebuilding
the vote form every second. At deadline the UI immediately disables/removes
voting controls and refreshes authoritative state. Countdown expiry does not
erase ballots or bypass results privacy. The server already enforces endAt;
closed/upcoming/paused submission rejection now happens before asking for a
guest identity, and completed pages do not invite needless verification.
Hidden tabs resume reconciliation on visibility. Clock/network latency may
slightly affect displayed seconds; the server is authoritative for acceptance.

Expanded isolated API tests passed: server time, completed reason, deadline
changes after votes, extensions/shortening, late-vote rejection and preserved
totals. Added `tests/countdown-e2e-checks.cjs`: actual admin setup/duration/live
editing, guest/admin timer, immediate zero/closed controls, server late-vote
rejection and retention of an existing ballot all pass in disposable SQLite.
Focused command: `WEDDING_E2E_COUNTDOWN_ONLY=1 WEDDING_E2E_SERVER=<candidate>
node tests/isolated-e2e.cjs <output-dir>`. Candidate API lives separately under
`/root/wedding-countdown-candidate` with existing dependencies; no live runtime
module is changed before tests. The runner accepts a validated optional server
path. Existing full-suite runs hit unrelated microphone/poll-fixture timing;
focused countdown and candidate mobile competition tests passed. Browser wait
limits were increased and the delayed-list fixture retries while polling is busy.
Final full actual-browser/disposable-API suite passed, including recording/audio,
voting/moderation/privacy/photo and the new countdown tests. Candidate Share/
mobile, worker and sign-out/push-feedback regressions passed. Deployed competition
and Share/seven-page/mobile reruns passed. The optional read-only Best Dresses
photo test could not run because that title no longer exists: the pre-v187
snapshot and authenticated live audit both contained **0 competition records**.
No live game was created to work around this; both empty lists were preserved.
Health/public feeds 200, admin guards 401, services active and SQLite `ok`.
Baseline retained 7 guests, 1 RSVP, 32 media records/files, 0 guestbook entries,
3 gifts, 2 funds and 35 settings. API restarted for the additive presentation/
phase check changes; no table migration or data rewrite was needed.

## Voice recording and audio upload audit — v186 (12 October)

Fixed microphone-request and stop-callback races. A discarded recording's late
permission grant stops its tracks, and discarded stop callbacks cannot recreate
its preview. Single-flight microphone setup and finalising-state guards prevent
overlapping recorders. Recorder/chunks are captured per session; final Blob MIME
uses that recorder's actual format (normalised audio/webm, audio/mp4 or audio/ogg),
not a now-cleared global recorder with a WebM fallback. Supported MIME selection
is browser-aware. Unsupported browsers, denied permission, missing microphone,
recorder failures and empty recordings get inline feedback and leave controls
recoverable. Waveform/AudioContext failure does not block recording, and older
canvas implementations fall back from roundRect to rect.

Recording elapsed time clamps to 02:00 and auto-stops at the limit. Backgrounding
the document stops an active voice recording, preserving its captured preview;
an outstanding permission request is invalidated. Interrupted audio tracks stop
the recorder. Navigating away via existing Back/menu/tab actions still discards
the recording, but now cannot resurrect it. Tracks, waveform timer/animation,
AudioContext, chunks and preview URLs are released at the appropriate lifecycle.

The shared voice/audio/photo/video submission form now snapshots the upload,
guards duplicate submissions, requires a nonblank name, protects fields and
dismissal during upload, displays accessible percentage/save/error feedback,
and retains the same Blob and draft after failure for SHARE retry. Successful
uploads clear preview URLs and recorder state. Opening another share uses its
own name rather than a prior submitter's lingering name. Existing moderation
and device upload tracking are unchanged. Cancelled sheets retain their draft
until replaced; navigating away still follows existing recorder-discard rules.

Expanded actual-browser/disposable-API test uses Chrome's synthetic microphone
with actual MediaRecorder (not a mocked recorder). It passed permission denial
and recovery, delayed grant after Back/track cleanup, actual recording/manual
stop, accelerated elapsed-clock two-minute auto-stop, user-gesture preview
playback, correct MIME/name/album, upload failure retention, duplicate/dismissal
guards, one pending voice record, playback of saved upload bytes, successful
cleanup, and a separate uploaded-audio-file pending record. These are not tests
of a physical microphone, acoustic fidelity, Safari/iPhone recording, OS
permissions, background suspension timing or uninterrupted real two-minute
capture. Those still require real-device verification.

Run `node tests/isolated-e2e.cjs <output-dir>` after updating the isolated VPS
helper; it creates no live submissions. Candidate Share/mobile/dashboard and
dashboard/feed/push-feedback/sign-out/transcode regressions also pass. Initial
runs exposed harness device startup/timing and no-user-gesture playback issues;
clean serial reruns with an explicit playback gesture passed. No live audio
records, media files, guest names, settings or competitions are altered.
Discard/replacement/success explicitly pause preview audio before removing its
elements. The browser harness now waits up to 30 seconds for a nonempty valid
Chrome debugging port instead of reading a missing/partially written file.
Final expanded disposable voice/audio/competition test passed. Deployed Share/
seven-page/mobile, dashboard/upload, current-photo reload and worker regressions
passed. Health/public feeds 200, admin guards 401, services active and SQLite
`ok`. Pre-v186 comparison retained 7 guests, 1 RSVP, 31 media records/files,
0 guestbook entries, 3 gifts, 2 funds, 35 settings and 3 competitions. No API
restart or database migration was required.

## Best Dresses photo feedback — v185 (12 October)

Read-only checks confirmed the Best Dresses cover exists (HTTP 200 image/png,
1032x1524, 3.6 MB) and the game requires verified sign-in. Male/Female have no
individual photo URLs saved. No missing server photo or corrupted upload was
established from the user's pasted screen text; generic image alt text alone
does not prove a broken image. Verification policy and vote counts are retained.

Competition photos now show explicit loading feedback, hide broken-image/alt
fallbacks on errors, and offer tap-to-retry with a fresh query on the same file.
After successful retry, the loaded URL opens full-screen; unloaded/failed images
do not open a broken viewer. Cover images load eagerly and use the competition
title rather than generic "Competition photo" text. Cover frames reserve space
while loading. Existing contain/full-photo layout and separate vote labels stay.
No upload is replaced, optimised retroactively or deleted.

Disposable actual API/browser test covers error feedback and retry recovery
without triggering a vote, along with full-photo and voting regressions.
Candidate mobile competition tests pass. One initial expanded test stalled in
the pre-existing settings-polling fixture; a clean serial rerun passed.
Added read-only actual-game test `node tests/gifts-design.cjs <output-dir>
--live-competition` to inspect Best Dresses image loading, 320/375/430/1024
fit, full-screen view/Close and guest-verification navigation without voting
or live settings changes.
Deployed actual Best Dresses test passed with its real image, full-screen
controls, mobile/desktop fit and sign-in navigation. Worker regression passed.
Health/public feeds 200, admin guards 401, API/nginx active and SQLite `ok`.
Pre-v185 comparison retained all guest/media/gift/fund/setting/competition records
and media files. No API restart or database migration was required.

## Full-photo competition frames — v184 (12 October)

Competition cover and contestant photos now preserve the full image instead
of filling a cropped 16:9/square frame. Covers fit within 75% of the viewport
height; contestant previews retain natural proportions. List/result/editor
thumbnails use contain rather than cover. All competition photo controls are
keyboard-accessible buttons opening the existing full-screen contain viewer.
Contestant photo buttons sit outside the voting label: inspecting a photo does
not select a contestant or submit a ballot. Photos remain viewable when voting
is gated, paused or already counted. Viewer Close/Escape/background dismissal
remain available; focus moves to Close and returns to the opener afterwards,
and any pre-existing body scroll lock is preserved.

Uploaded Gallery and S&J Gallery photo cards also use contain, keeping the
entire photo within their existing grid frames; their existing full-screen
viewer remains available. This does not recover detail lost in prior upload
optimisation and does not replace original media files or saved photo URLs.

Actual disposable API/browser test uploads a 40x80 portrait, adds it to
contestants, verifies its original dimensions in the full-screen viewer while
voting is verification-gated, checks contain/focus/close and confirms no ballot
selection occurs. Existing actual voting/moderation/privacy/upload tests pass.
Candidate mobile competitions, Share/seven-page and refresh regressions pass.
One Chrome debugging-port startup failed; serial retry passed. No live photo,
competition config, verification policy or vote is changed by these tests.
Deployed competition/Share/mobile and current-photo reload regressions passed,
as did worker tests. Health/public feeds 200, admin guards 401, API/nginx active
and SQLite integrity `ok`. Pre-v184 comparison preserved 7 guests, 1 RSVP,
30 media records/files, 0 guestbook entries, 3 gifts, 2 funds, 35 settings and
all 3 competitions. No API restart or database migration was required.

## Refresh-photo and transition fix — v183 (12 October)

Root cause: HTML initially assigned the bundled `assets/couple-home.jpg`;
the footer then applied a device-local `sj_site_photos` map, and only afterwards
did fresh API settings replace those images. Either earlier photo could paint.
The startup couple/Gifts/heart slots now use a neutral ivory/gold SVG. A head
style masks all configurable photos before scripts run. Fresh settings resolve
their URLs; images fade in only after a matching URL successfully loads.
Changing a slot hides its previous image while the new URL loads. Failed images
use the neutral SVG, not an old couple photo. Failed settings leave photo slots
neutral/hidden; successful subsequent polling restores current photos/albums.
The legacy photo map is no longer applied and is removed when settings resolve.
Home/admin/album couple defaults also use the neutral SVG. Existing uploaded
photos, saved URLs, user identity and live settings are not changed.

Transitions now use a shorter non-blocking seal pulse and subtle page fade.
Each new pulse cancels the previous delayed-hide timer so rapid taps cannot
interrupt the newer transition. Reduced-motion preference disables these
effects and photo fading. There is no forced page reload or sign-out.

Worker precache no longer includes the old couple photo. Install fetches reload
assets; activation deletes only older `sj-wedding-` caches, then claims clients.
Online HTML/JS/CSS remain network-first, API/uploads remain uncached by the
worker. Offline fallback is restricted to the active cache: navigation may use
the offline app, missing JS/CSS returns 503 rather than receiving index.html.
Cache writes are lifetime-bound and tolerate quota failures. This does not
promise fresh server content while offline; neutral photos are intentional
when settings cannot be confirmed. Uploaded-media HTTP behaviour is unchanged.

New browser test: `node tests/competitions-ui.cjs <output-dir> --refresh`.
It seeds a stale device photo map, delays fresh settings, observes paints,
verifies loaded-current-image reveal, exercises rapid transitions and reduced
motion, reloads with failed settings and verifies subsequent recovery.
Settings/image identities are fixtures; no live writes. New worker VM test:
`node tests/service-worker.test.cjs`. Both pass. Actual disposable browser/API
end-to-end and candidate dashboard/upload, Gift Message, Share and mobile-width
regressions also pass. Tests do not establish every real-device cache state.
Deployed read-only initial/reload test (`gifts-design.cjs <output-dir>
--live-refresh`) confirmed the Home image is loaded and matches fresh server
settings, no bundled couple startup source remains and the legacy map is
removed. Deployed Share/seven-page/mobile, dashboard/photo/upload and Gift
Message regressions passed. Health/public feeds 200, admin guards 401,
API/nginx active, SQLite integrity `ok`. Pre-v183 snapshot retained 7 guests,
1 RSVP, 30 media records/files, 0 guestbook entries, 1 gift, 2 live funds,
35 settings and all 3 competitions. No API restart or live data change.

## Listed-screen enhancements — v182 (12 October)

Events now includes the same days/hours/minutes/seconds countdown as Home,
using the same saved wedding date and existing time interpretation. Admin date
changes update both immediately; past dates clamp to zero, invalid dates do
not overwrite the target. Countdown DOM writes skip unchanged values, stop
while the document is hidden and reconcile when visible again. No wedding
date, event schedule, timezone or venue was changed.

Admin login has a single-flight guard (including synthetic repeated submit
events), accessible busy status and polite error announcements. Real browser
tests exercised wrong-password feedback, recovery and successful login using
the actual form and disposable credentials. Existing production credentials
and email requirements were not altered or used in tests.

Gallery uploads now guard repeated file-change events, protect category and
caption while sending, display per-file percentages, retain the caption after
partial failure, show the server/network/size error on total failure, and cancel
an older completion timer before a new batch starts. A real disposable upload
with repeated change events produced exactly one pending-review API record.
Settings polling is single-flight and pauses during uploads; tests verify
both behaviours. Admin review videos use preload=none. Navigation pauses media
in pages being hidden without resetting its playback position or stopping
the background wedding song. These are bounded resource-saving changes,
not a measured universal speed improvement or resumable-upload implementation.

Expanded isolated end-to-end checks cover Home/Share games links and Back,
all four Story tabs, View Map URL/new-window wiring, Gallery album/Back/type
filters and Upload panel, guest-upload persistence/duplicate protection,
voice-page/Back/shared-gallery navigation, file-picker wiring, matching Home/
Events countdown, settings polling guards and media pause on navigation.
Existing real competition/API/cookie tests pass, including verification button
opening/focusing guest login. Candidate competition, mobile/seven-page Share,
Gift Message and dashboard/feed/push-feedback/transcode tests also passed.

Competition verification choices remain per-game and unchanged: a verification
prompt is expected for verification-on games; optional games remain browser-
limited. Live activity, names, captions, dates, gifts, likes and vote totals are
not replaced. Remaining real-device limitations from v181 still apply, including
OTP delivery, notifications, native file/camera/microphone/install/share prompts
and large-video transfer. No live ballot, admin credential test, upload or gift
confirmation is submitted during this release's tests.
Deployed Share/seven-page/mobile, competition, dashboard, Gifts and Gift Message
checks passed. Post-release health/public feeds were 200 and unauthenticated
admin guards 401; API/nginx remained active and SQLite integrity was `ok`.
Snapshot comparison retained guests, RSVP, all 30 media records/files, guestbook,
gift and fund. A concurrent `giftMomo` settings change was observed and preserved,
not overwritten. All three competition configs and the two existing ballot
rows were unchanged. This frontend-only release required no API restart.

## Deep action audit — v181 (12 October)

Fixed duplicate competition-editor opening on rapid clicks, stale polling
responses overwriting newer admin changes or guest ballots, stale voter-list
responses after navigation/auth changes, and outdated voting controls after
a failed submission to a paused/deleted game. Removed/private competitions
now clear obsolete voting controls and provide a return-to-list action.
Revision guards discard pre-mutation/pre-auth-change responses; editor loading
is single-flight and ignores responses after navigation or auth changes.

Added `tests/isolated-e2e.cjs`, `tests/isolated-browser-api.cjs` and
`tests/competition-e2e-checks.cjs`: actual frontend plus actual Express/SQLite
API over loopback-only SSH tunnels, disposable database/uploads, test-only
credentials and seeded OTP hashes. No live environment secrets, records or
submissions are used. Real uploaded image bytes are served from the disposable
upload directory. The runner removes only its own temporary directory after
stopping its child API and has a ten-minute maximum lifetime. It is VPS-specific;
copy the helper to `/opt/wedding-api/isolated-browser-api.cjs` before running
`node tests/isolated-e2e.cjs <absolute-output-directory>` locally.

Passing real-browser/API checks: repeated Create clicks, cover upload/render,
draft privacy/publish, delayed-list overwrite protection, verified OTP session
and vote, duplicate submission protection, pending/approved comment moderation,
public-result privacy, optional-verification cookie ballots, browser-labelled
counts, live rankings preserving selected ballot/comment focus, pause feedback
and deleted-game recovery. OTP hashes are seeded: these checks do not establish
real SMS/email delivery. One final runner startup timed out; a clean rerun passed.

Also passed candidate competition/mobile/toast tests, live read-only Gifts UI,
mocked ten-category dashboard/upload controls, admin Gifts layout/editor,
Gift Page Message drafts/retries, Share controls and all seven page widths,
plus dashboard/feed/Share-sign-out/push-feedback/video-transcode unit suites.
Mocked tests do not prove live writes or OS permission/delivery behaviour.

Live audit: health/public feeds 200; unauthenticated admin guards 401; services
active; SQLite integrity `ok`; disk 41% used (11 GB available). Live activity
changed guest records and added a third competition since the older v180
snapshot; those changes were not reverted. A fresh pre-v181 baseline retained
7 guests, 1 RSVP, 30 memories with referenced files, 0 guestbook entries,
1 gift, 1 fund, 35 settings and 3 competitions. No live voting policy changed.
Release is frontend-only; no API restart or database migration is required.
Deployed competition/Share/mobile reruns passed and the pre-v181 comparison
retained all baseline records/files with SQLite integrity `ok`. The new tunnel
runner disables shared SSH control sockets and bounds connection/startup waits
to avoid the intermittent harness SSH stalls observed during this audit.

Still unverified: real-phone OTP delivery, background push delivery, device
camera/microphone permissions, large-video transfer/transcoding, native install
and sharing. Real MoMo recipient remains unconfirmed. Pending-content ownership
hardening, resumable uploads and off-site backups remain known follow-up work.

## Optional competition sign-in verification — v180 (12 October)

Competition setup/edit → Voting Settings now includes **Require verified guest
sign-in before voting**. It defaults to checked for new and existing games.
Unchecking it permits browser-based voting without the extra verified sign-in
step or approved-guest requirement for that game. The wedding app’s existing
entry/check-in gates are not removed. Attending-only and selected-group policies
still require verification; choosing either checks/locks the checkbox, and the
server rejects an incompatible combination. Once any votes exist, verification
is locked alongside audience/mode to avoid changing voter identity semantics.
Duplicate the game to choose another policy without disturbing existing votes.
No existing live policy is changed automatically.

Optional voting uses a separate 90-day HttpOnly/SameSite=Strict browser cookie
(Secure on HTTPS) backed by hashed tokens in the additive `competition_browsers`
table. The vote route does not accept a guest ID supplied in the body as proof,
does not create fresh identities during vote retries, and does not unlock other
verified games. GET of an optional active/upcoming game prepares the cookie;
blocked cookies produce a clear reload/allow-cookies error, not a sign-in prompt.
Cross-site GETs cannot issue replacement voting cookies. Browser identities are
used even after later guest verification, so the same cookie cannot gain an
extra ballot simply by signing in. Optional voter/comment names are explicitly
marked unverified, and results/CSV use **Voting Browsers** rather than claiming
unique verified people. Clearing cookies, expiry, private windows, another
browser/device or deliberate cookie resets can allow extra votes; this weaker
protection is explained in setup and on the guest page. This is not strong
anti-fraud voting or a substitute for verification in restricted audiences.

Isolated full-API tests passed for defaults, on/off persistence, optional ballot
cookies, retries/changes, forged guest-ID rejection, verified-game isolation,
restricted audience validation, policy locking, comment/CSV labels, browser
identity after later sign-in and restart persistence. Mocked UI checks passed
for checkbox default/save, removal of the verification gate, optional vote
submission, honest browser counts and locking after votes, alongside the
existing mobile competitions/toast suite. No live setting, vote or competition
was created or changed for testing. Commands remain the competition API/UI
commands above; existing OTP restrictions still affect verification-on games.
Final deployed competition/verification/toast and Share/seven-page-width checks
passed. Existing unit/regression suites also passed. Live health/public feeds
returned 200 and unauthenticated admin guards returned 401. Pre-v180 snapshot
comparison retained both existing competitions and all guest, media, gift and
setting records; SQLite integrity was `ok`. Existing verification policies were
not changed, and no live ballot was submitted.

## Share page and navigation audit — v179 (12 October)

Audited every Share hub link and the seven main tabs, in guest and admin modes.
Menu columns now allow wrapping instead of overflowing on long song names;
the admin dashboard item uses the intended grid layout rather than the shared
admin-only flex override. Copy includes competitions as well as sharing.
Admin-only dashboard/song controls remain hidden from guests.

Share Sign Out now distinguishes admin mode from guest mode. Sign Out Admin
revokes the admin session, leaves the guest check-in untouched and returns to
Share. Guest sign-out revokes its secure session before clearing local identity.
Failed requests retain access state for retry; duplicate clicks are guarded and
sign-out is blocked during uploads. The dashboard’s separate existing admin
logout remains unchanged. Song selection is a keyboard-accessible button, with
percentage/saving feedback, duplicate/size/type checks and readable errors; no
real song was replaced during testing.

Notification feedback distinguishes blocked, dismissed, unsupported and
connection-error cases. Existing push subscriptions are reused and re-saved to
the server. Readiness is bounded to 8 seconds for enabling; label queries no
longer wait indefinitely for a service worker. Errors are retryable rather than
being described as unsupported. These tests mock permissions/push registration;
they do not establish actual background phone delivery.

Install App is visible in browser mode, with Safari/Android/desktop instructions
when no native prompt exists. Native cancellation remains actionable, failures
show instructions, and installed/standalone mode hides the control. Instructions
support Escape, keyboard focus and returning focus to the install button.
Calendar downloads escape user-controlled text, fold UTF-8 lines to 75 octets,
use a stable event UID, and report invalid dates instead of throwing. Existing
configured date/time interpretation is preserved; no new timezone setting was
introduced. The number on the couple-heart button is the existing love counter.

Candidate browser tests passed at 320/375/430/1024px in both modes, including
long filenames, all Share routes, seven-tab selection, calendar content/error
handling, notification states/duplicate guards, install help/cancellation,
song picker/progress/failure and admin sign-out. Isolated VM tests cover admin
and guest logout/failure/duplicates/upload guards, push subscription reuse,
permissions/offline cases and service-worker timeouts. No live submissions,
song upload, permission prompt or install operation was performed. Camera/mic,
large videos, actual push delivery and OTP restrictions remain outside these
mocked UI checks. Commands:

`node tests/share-actions.test.cjs`

`node tests/competitions-ui.cjs /absolute/output/directory --share`

`node tests/gifts-design.cjs /absolute/output/directory --share`

Post-deploy Share, seven-page-width, competition/toast, dashboard/upload and
Gift Page Message checks passed. Initial parallel Chrome runs exceeded their
timeouts; serial reruns passed, and the test harness now bounds font readiness
and Chrome shutdown. Live health/competition endpoints remained 200 and admin
guards remained 401. Snapshot checks retained 7 guests, 1 RSVP, all 30 memories
and referenced files, 0 guestbook entries, 1 gift, 1 fund and all 35 settings.
The existing competition’s publication timestamp changed during the checks;
its title, contestants and other settings were unchanged and the timestamp was
retained rather than overwritten. No testing code writes live competitions.
The live competition list also grew from 1 to 2 during the checks; the new
competition was left in place as live activity, not treated as a test fixture.
SQLite integrity was `ok`. This release changes only frontend files; the API
was not restarted and no new records or real song upload were used for tests.

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
