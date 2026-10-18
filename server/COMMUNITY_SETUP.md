# Wedding Chat and Entertainment

Both pages have bottom navigation buttons. Share Memories and Share Moments
remain accessible from Gallery, not the bottom bar.

## Chat

- Writing, attachments, reading chat and reactions require a server-verified
  guest session (the existing OTP sign-in) or a valid admin session. A saved
  local guest profile alone is not proof of identity; use **Verify guest
  sign-in** if prompted. No extra OTP is automatically sent by the chat page.
- Guest messages default to **pending approval**. The sender can see their
  pending messages; other guests cannot. Admin messages publish immediately.
- Admins open **Chat** to approve, hide, pin/unpin or remove messages. The
  composer offers a host-announcement checkbox only for admins. Names and
  host badges come from the server, never the submitted message body.
- Send IDs persist with the local draft. Retry after a lost response reuses
  the same ID. Do not reuse an ID for edited content.
- Reactions are unique per verified identity/message/emoji. Repeating an
  `active: true` request does not increase the count.
- Photos, MP4/WebM videos, PDFs and MP3/WAV audio files are supported up to
  25 MB. Bytes are checked to reject unsupported formats and HTML/SVG files;
  normal host moderation still applies. Uploading is not publishing. Public
  upload URLs are random but are not a confidential/private file store.
- No microphone recording is represented as implemented in the chat: the
  voice-memory link opens the existing recording page. Polls opens the
  existing wedding competitions system rather than creating a duplicate
  voting backend. No example votes or messages are inserted.
- Chat polls every 15 seconds while visible. The active-guest count means
  distinct verified guests with a chat heartbeat in the past 45 seconds,
  not total registrations or exact connection presence. Unchanged message
  cards are retained, including their media elements.
- Messages are bounded to the newest 150 (pinned first). This is an initial
  shared wedding-room release, not private messaging or an unlimited archive.

## Entertainment

Open **Admin Dashboard → Entertainment** to add confirmed names, categories,
descriptions, uploaded photos, optional social links and performance dates.
Use **Save Entertainment** to publish. Times entered use the admin device's
local timezone and are displayed in each guest's local timezone. Leave times
blank rather than guessing. Reordering is available in the editor.

No performers or schedule times are seeded. Empty categories explain that
the lineup is not confirmed. Uploaded photos and unsaved edits remain drafts;
revision checks reject stale saves without overwriting newer content.

## Storage and tests

Startup adds only `wedding_chat`, `wedding_chat_reactions`,
`wedding_chat_presence`, and `wedding_chat_uploads`. Existing guests, OTP,
gifts, memories and competitions are not migrated or replaced. Entertainment
creates its own settings key only when an admin saves it.

API regression (disposable data; run on VPS with installed dependencies):

```sh
node tests/wedding-community-api.cjs /path/to/candidate/server-directory
```

Browser regression (disposable API with seeded test identities):

```sh
WEDDING_E2E_COMMUNITY_ONLY=1 WEDDING_E2E_SERVER=/path/to/candidate/server.js \
  node tests/isolated-e2e.cjs /absolute/output-directory
```
