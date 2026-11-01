# Floating Wedding Chat activity icon

Approved signed-in guests and authenticated hosts have a faint gold **Chat**
shortcut above the existing Sam launcher outside Chat and admin views. It remains
available even without new activity. Hover/focus makes it easier to see. New room
activity makes it bold, adds a red badge and changes its label to **New chat** for
**10 seconds**, then it returns to faint instead of disappearing. Tap either
state to open Wedding Chat; × clears only the bold highlight. Bursts do not extend
the highlight timer or create a stack of icons. Reduced motion disables floating
animation, not the shortcut/highlight.

## What triggers it

- New published chat messages/replies, announcements and messages with attachments.
- New reactions from other people, and newly pinned messages.
- Messages now publish immediately; the former review queue is published on upgrade.
- Hidden messages never enter guest discovery. Their own messages and
  reactions do not alert them. Passive presence/polling is not chat activity.

The first successful feed establishes a baseline without replaying existing
history. This is a per-open-page discovery indicator, **not a durable unread count
or delivery/read receipt**. The current 150-message window and net reaction counts
cannot capture every intermediate change between polls.

## Delivery and privacy

Checks run every **15 seconds while the app is open and visible**, with additional
checks after navigation/reconnect. It is not a background OS/push notification;
there are no sounds, provider sends or browser-notification permission prompts.
Forms, uploads and active media defer bold presentation for up to one minute,
while the faint shortcut stays available. Dialogs/lightboxes temporarily hide it.
Opening Chat/admin, backgrounding or security/session changes remove it; it
returns faint when an authorised ordinary app view is available. Auth changes
invalidate in-flight replies and the baseline. A failed activity refresh removes
the bold state, not the generic shortcut; failed approval checks still lock access.
Private RSVP, gifts, arrivals, ownership and other admin-only app activity are not
turned into public Chat alerts.

`GET /api/chat/activity` uses the existing approval and verified actor/admin gates,
returns `Cache-Control: no-store` and exposes only the actor's ID and up to 150
visible message IDs with own/pinned/status/other-reaction metadata. It contains no
message bodies, sender names, phones, attachment URLs or private app events.
The GET never writes chat presence, messages or settings. Snapshots are held only
in memory; blocked/full browser storage does not break this feature. No SQL schema
or authentication changes are required.
