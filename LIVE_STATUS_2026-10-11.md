# snybena.com live audit — 11 October 2026

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
