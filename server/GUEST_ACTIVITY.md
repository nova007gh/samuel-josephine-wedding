# Admin → Guest Activity

Use **Admin Dashboard → View Guest Activity** on Overview, or the **Guest
Activity** category. The panel scrolls into view, refreshes every 15 seconds
while visible, and supports name search, recently-active/24-hour filters,
50-guest pages and selecting one guest's saved actions.

## What the hosts can see

- Registered guest names and approval status.
- The latest allowlisted page reported by an approved signed-in browser.
- Last signal time, and **Recently active** only for signals within 90 seconds.
- Account-linked, timestamped saved actions: Chat messages, RSVPs, submitted
  memories/guest-book messages, gift reports and competition participation.
  The dashboard returns metadata, not message bodies, vote choices, amounts,
  contact details, attachment URLs, credentials or unsent attachment drafts.
- Existing Detailed Guest List remains the place for older or possible legacy
  matches. The new panel never infers an actor from a display name or phone.

This is **not** a connection/reading/attendance guarantee: a backgrounded or
closed tab can remain recently seen for up to 90 seconds. Multiple devices/tabs
can report the same account; only the latest stored page is shown. A page open
on Gifts does not mean payment, and a page open on Chat does not mean typing.
Anonymous/public-welcome and pending-approval guests have no identified live
signal; “No live signal” does not prove they are absent/offline. Saved gift
reports are never payment verification. Reactions without timestamps and other
unrecorded transient actions are not fabricated as recent events.

## Guest reporting and privacy

`POST /api/guest-activity/presence` accepts **only `{page}`**, from the fixed
`guest-activity-schema.js` page allowlist. Existing approval gates, server-side
guest cookie identity and same-origin validation apply; client names/IDs, raw
URLs, query strings, drafts, typed text and client timestamps are rejected.
Admin browsers do not report an incidental guest cookie. The client reports
on eligible navigation/foreground and at most every 30 seconds while visible;
rapid navigation is coalesced, with at least five seconds between completed
reports. Hidden/pagehide, unverified/pending and admin views stop reporting.
Uploads may defer heartbeats. No external analytics, camera/GPS permission,
provider sends or browser-notification prompts are introduced.

The only new table is `guest_site_presence(guestId,page,lastSeen)`: one latest
row per account, not a page-history trail. Signals older than seven days are
not displayed, and expired rows are pruned on the next accepted heartbeat.
The guest-facing **More → Activity & privacy** disclosure describes this.

`GET /api/admin/guest-activity` requires the existing admin bearer session and
sends `Cache-Control: no-store`, including failed authentication. Approved
guests cannot read the monitor. Private dashboard data is memory-only and
cleared on navigation, hiding and session loss; stale replies cannot restore
it. Failed refreshes remove old live counts rather than claim they are current.
Existing signed-in account ownership powers saved-action attribution. No
registration, physical-arrival, payment or profile-permission rules change.
