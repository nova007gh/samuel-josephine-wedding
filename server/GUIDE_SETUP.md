# In-house S&J Guide

This is deterministic local search and structured answers, **not an LLM or
generative AI**. There is no third-party AI API, model download, training job,
conversation database or question logging. Questions stay in the browser;
only `GET /api/guide` fetches public knowledge from this wedding server.

The explicit settings allowlist is in `wedding-guide.js`. It includes published
couple details/story, events/programmes, saved bridal profiles, Entertainment
and Broadcast. It never reads guests, RSVPs, sessions, OTPs, payments, chat,
guestbook submissions or uploads tables. Only allowlisted output fields are
returned. Generic app instructions are maintained in the shared
`wedding-guide-knowledge.js`; update them when app behaviour changes.
There are no seeded dates, bookings or invented venue details in the guide.
No automatic crawling or link-metadata fetching is performed: image cards use
existing local published photo URLs. Missing images are omitted, not replaced
by imaginary activity imagery. Private or arbitrary URLs are not fetched.

Knowledge refreshes on open, request, and every minute while visible/open or
with reminders enabled. A failed refresh labels previously loaded information
as stale. The browser matches questions against titles, keywords and public
text. Unknown topics receive an explicit fallback, not a generated answer.
This is not capable of answering every possible phrasing or arbitrary question.

The guide now opens with the saved wedding overview and upcoming activity
cards, rather than an empty question panel. Individual programme rows and
published hosts/MCs have their own source cards, so questions about dinner,
cake cutting, performers or a first dance can retrieve the specific entry.
Entertainment distinguishes its separately saved lineup from performances
already named in the reception programme. Generic app instructions also cover
OTP delivery, upload/camera trouble, playback/sound and installation.

Local ranking uses canonical terms/synonyms, document-frequency weighting,
conservative one-edit/transposition spelling matches and minimum term coverage.
It can handle limited explicit follow-ups such as “What time is it?” using the
previous answer’s source IDs. This is bounded retrieval, not language-model
reasoning. Up to six turns are retained only in page memory; older turns are
collapsed in the UI. New conversation clears the turns, context and draft.
Refresh recomputes saved answer sources only when public content changes; it
never submits an unsubmitted draft or duplicates a conversation turn.
“Today” and “now” questions use Ghana GMT calendar days and published start
times, not inferred activity progress. No scheduled activity is declared live
solely because its start time passed.

Reminders are **opt-in per browser/device**; only preferences and bounded seen
IDs are saved locally. They run only with the app open and visible, near a
published event/performance time (10 minutes before to 20 minutes after) or
when a broadcast is explicitly marked live. Event clock strings use Ghana GMT;
performer times use the saved absolute timestamps. Untimed/invalid schedules
never trigger reminders. A scheduled time does not establish that an activity
is actually underway. Reminder wording reflects this. No email/SMS/web push is
sent; existing app announcement/competition systems remain unchanged.

Event start parsing accepts published single times, ranges (hyphen/en dash/
em dash), 24-hour clocks and open-ended “Till…” labels. Only the first clock
is used; no end time is invented. Calendar days and clock bounds are checked.
Programme reminders require a separate explicit ISO or English month-name
date in that programme’s saved dateLabel. They never silently borrow the
wedding date, so an untimed or differently dated programme cannot trigger
misdated reminders. Schedule cards are not evidence of actual progress.

Launcher opens an accessible native dialog, without adding a bottom tab or
changing Home. Chat uses the compact icon-only launcher above its composer.
Questions and results are not saved across reloads. Reminder dismissal is
bounded locally and disabling reminders removes an active guide reminder.
Shared devices share reminder settings; this is not verified guest identity.

## Deployment

Serve `wedding-guide.js`, `wedding-guide.css`, `wedding-guide-knowledge.js` and
`assets/guide-companions.jpg` with the frontend. In the flat production API
directory, install `server/wedding-guide.js` and the identical root
`wedding-guide-knowledge.js`, alongside the updated `server.js` registration.
No npm dependency, database migration, environment value or model service is
needed. Repository mode resolves the shared module one directory up.

## Tests

```
node tests/wedding-guide.test.cjs
node tests/readonly-preview.cjs /absolute/output/directory --guide
```

Browser tests use local disposable fixtures for public content and reminders,
not real guest submissions. Preview blocks production writes. Resize tests
are not proof of physical-phone keyboard/camera behaviour.
