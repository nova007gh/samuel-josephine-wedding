# Wedding Chat and Entertainment

Chat and Entertainment are reached through Events. Share Memories and Share
Moments remain accessible from Gallery. The compact five-tab navigation is unchanged.

## Chat

- Writing, attachments, reading chat and reactions require a server-verified
  approved guest session (the existing OTP sign-in) or a valid admin session. A saved
  local guest profile alone is not proof of identity; use **Verify guest
  sign-in** if prompted. No extra OTP is automatically sent by the chat page.
- All guest and host messages now **publish immediately** to the shared room.
  Account/guest approval is still required; message-by-message approval is not.
  On upgrade, former pending chat messages become approved. Hidden messages are
  never republished by that migration.
- Admins open **Chat** to hide/show, pin/unpin or remove messages. The
  composer offers a host-announcement checkbox only for admins. Names and
  host badges come from the server, never the submitted message body.
- Send IDs persist with the local draft. Retry after a lost response reuses
  the same ID. Do not reuse an ID for edited content.
- Reactions are unique per verified identity/message/emoji. Repeating an
  `active: true` request does not increase the count.
- Reply selects a visible message and displays a cancellable quote above the
  composer. A reply and its optional attachment use the same retry-safe send ID.
  Tapping its quote scrolls within the conversation to the original (if loaded).
  Only the parent ID is stored, not a duplicate snippet: hidden/deleted parents
  show **Original message unavailable** on refresh and cannot be newly quoted.
  Reply previews never bypass visibility or expose hidden parent names/text/files.
- Copy-message actions use the clipboard when permitted. Date separators,
  chronological bubbles, compact reaction/reply tools, smaller contained media,
  a taller conversation and a reduced header keep the room vertically neat.
  New messages do not pull users away from older messages; Latest messages jumps
  to the end. Reduced motion disables smooth scrolling. Desktop Enter sends,
  Shift+Enter inserts a newline, and touch keyboards retain normal multiline input.
  Photos open the existing full-image viewer. These are shared-room features,
  not private DMs, end-to-end encryption, fabricated typing indicators or read receipts.
- Photos, MP4/WebM videos, PDFs and MP3/WAV audio files are supported up to
  25 MB. Bytes are checked to reject unsupported formats and HTML/SVG files;
  hosts can still hide/remove inappropriate posts. Uploading is not publishing. Public
  upload URLs are random but are not a confidential/private file store.
- The microphone opens the existing voice-memory recording page. Wedding polls
  and games remain in the existing competitions destination; no category strip
  or duplicate voting backend is added to Chat. No example posts are published.
- Chat refreshes every 5 seconds while visible. Presence heartbeats are at most
  once per 30 seconds; a failed heartbeat never blocks reading. The active count means
  distinct verified guests with a chat heartbeat in the past 45 seconds,
  not total registrations or exact connection presence. Unchanged message
  cards are retained, including their media elements.
- The API window is bounded to 150 messages with pinned rows retained first;
  the conversation displays that window chronologically. It is not an unlimited archive.

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
`wedding_chat_presence`, `wedding_chat_uploads` and `wedding_chat_replies`.
The only existing-content migration publishes the former pending chat queue;
deliberately hidden posts and all other content/identities are preserved.
Guests, OTP, gifts, memories and competitions are not migrated or replaced. Entertainment
creates its own settings key only when an admin saves it.

API regression (disposable data; run on VPS with installed dependencies):

```sh
node tests/wedding-community-api.cjs /path/to/candidate/server-directory
```

Browser regression (disposable API with seeded test identities):

```sh
WEDDING_E2E_APPROVED_SUITE=modernchat WEDDING_E2E_SERVER=/path/to/candidate/server.js \
  node tests/isolated-e2e.cjs /absolute/output-directory
```
