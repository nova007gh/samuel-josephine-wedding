# AI Actions · Sam & Jossy

Open **Admin → ✨ AI Actions · Sam & Jossy**. This is a declarative in-app
companion scheduler, not an autonomous agent or command execution interface.

## Use

1. Choose a quick start (Welcome, Share photos, Programme, Watch live, RSVP,
   Wave hello, Neon kiss), or fill the form yourself.
2. Choose Sam, Jossy or both, action type and exact guest-facing text. Kisses
   always use both companions. Optionally choose an allowlisted wedding-page
   button; guests navigate only by tapping it.
3. Pick a date/time in the displayed device timezone, or use In 1/5/15 minutes.
   Choose once or a repeat interval and a maximum number of appearances.
4. Preview locally, then **Save scheduled action**. A preview does not save,
   publish, mark seen or send a notification. It is a labelled sample of the
   message/action and intended duration, not live delivery.
5. Edit, Pause/Resume or Remove saved actions. The top master checkbox pauses
   all scheduled actions and automatic waves/kisses/suggestions after saving.

The Everyday companion behaviour form controls kiss first delay, interval, visit
cap, duration and neon pulse; independent first Sam/Jossy wave delays, recurring
wave interval and duration; suggestion first delay, interval, lifetime and cap;
and programme reminder lead time, grace window and lifetime. Existing saved plans
receive defaults for missing fields on read, without rewriting their saved data.
Default behaviour remains first kiss after 5 seconds, then every 5 minutes,
maximum 15 per page visit; kisses last 5 seconds with 1-second neon pulses.
Jossy/Sam first wave after 60/120 seconds; waves last 2.4 seconds. Suggestions
start after 8 minutes, recur every 8 minutes, last 14 seconds and cap at 3 per
visit. Reminders use a 10-minute lead, 20-minute grace and 18-second lifetime.
Scheduled messages, waves and kisses each honour their 3–60 second duration;
the editor preserves exact scheduled seconds. Changed policies re-anchor future
timers; idle/approval/visibility safeguards can defer actual presentation.
Guide questions and the user's explicit controls remain usable when schedules
are paused. Private host-activity alerts remain a separate admin-only feature;
they are not guest announcements or proof of physical arrival.

## Timing and delivery limits

Only approved guests with the app **open and visible** participate. There is no
server job, background execution, web push, SMS, voice or email delivery. Guest
polling is every 15 seconds; unsafe moments defer presentation. Due occurrences
expire after 2 minutes. Only the most recent repeat can be due; no missed-action
flood is replayed. A per-tab sessionStorage set of occurrence IDs prevents
refresh/reload retries from showing the same occurrence again. Different tabs
or devices may show their own copy. No personal data is stored with those IDs.
The repeat count is per app tab, not a global audience quota.
Editing the text of an occurrence already shown does not replay it; schedule a
new time or a new action if you intentionally want another appearance.

Messages and links never force navigation. Forms, dialogs, uploads, media
playback, Chat/Gifts/Live views, sign-in gates and admin views are protected.
Hidden-page/navigation/logout clears visible notices. Reduced motion skips
waves/kisses but still allows non-animated messages. Animations retain existing
click/scroll/resize/lifecycle cancellation. Poll failure or a stale feed pauses
automatic actions; future polls can recover. Changed revisions invalidate the
active scheduled presentation on the next poll. These controls cannot guarantee
instant revocation on offline devices or confirm that everyone saw/read a
message. No delivery/read counts are claimed or stored.

## Security and persistence

Shared `companion-actions-schema.js` validates fixed action/side/page allowlists,
40-action maximum, bounded date/time/repeat/duration settings and plain-text
lengths. No eval, executable instructions, custom URLs or privileged action
types exist. Selecting Gifts only offers a navigation button to manual gifts;
it does not request or verify payment. Actions cannot approve guests, assign
tables, edit profiles, send provider messages or access private guest data.

The `companionActions` settings key stores the plan. It is excluded from the
general `/api/settings` feed, including approved guests, and never enters guide
knowledge. Default reads do not write a settings row. Only admin GET/PATCH
`/api/admin/companion-actions` exposes the full saved plan. Saves require the
existing admin bearer session, same-origin checks, schema validation and a
shared SHA-256 revision in a SQLite transaction; conflicts preserve drafts.
Guest GET `/api/companion-actions` uses the existing approval gate and exposes
only behaviour policy, server time and currently due enabled actions. Draft,
future, paused and expired message text stays out of that feed. All these
endpoints send `Cache-Control: no-store`; the worker never caches API data.

Admin previews/editor use textContent, not untrusted markup. Busy writes disable
controls, stale responses are discarded after logout, and private plan/drafts
are cleared on admin-session loss or page exit. Nothing is automatically
scheduled live at deployment; defaults preserve approved existing behaviour.
