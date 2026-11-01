# Floating Wedding Chat activity icon

Approved signed-in guests and authenticated hosts can see a small gold Chat icon
above the existing Sam launcher when new room activity is detected outside Chat.
Tap it to open Wedding Chat, or dismiss it with ×. It expires after **10 seconds**;
several events in a burst do not extend its timer or create a stack of icons.
Reduced motion disables floating animation, not the alert itself.

## What triggers it

- New published chat messages, announcements and messages with attachments.
- New reactions from other people, and newly pinned messages.
- Hosts can also discover pending messages they are authorised to review.
- Guests never receive pending/hidden-message discovery. Their own messages and
  reactions do not alert them. Passive presence/polling is not chat activity.

The first successful feed establishes a baseline without replaying existing
history. This is a per-open-page discovery indicator, **not a durable unread count
or delivery/read receipt**. The current 150-message window and net reaction counts
cannot capture every intermediate change between polls.

## Delivery and privacy

Checks run every **15 seconds while the app is open and visible**, with additional
checks after navigation/reconnect. It is not a background OS/push notification;
there are no sounds, provider sends or browser-notification permission prompts.
Forms, dialogs, uploads and active media defer presentation for up to one minute.
Opening Chat, backgrounding, security/session changes or unsafe interactions
remove the icon early. Auth changes invalidate in-flight replies and the baseline.
Private RSVP, gifts, arrivals, ownership and other admin-only app activity are not
turned into public Chat alerts.

`GET /api/chat/activity` uses the existing approval and verified actor/admin gates,
returns `Cache-Control: no-store` and exposes only the actor's ID and up to 150
visible message IDs with own/pinned/status/other-reaction metadata. It contains no
message bodies, sender names, phones, attachment URLs or private app events.
The GET never writes chat presence, messages or settings. Snapshots are held only
in memory; blocked/full browser storage does not break this feature. No SQL schema
or authentication changes are required.
