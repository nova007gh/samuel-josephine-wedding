# Wedding Vendors

Guest access: **Events → Our Vendors**. The existing five bottom tabs and
original Home remain unchanged. Cream/gold styling follows the supplied
reference, adapted to readable mobile cards. No people, bookings, performance
times, stock photos or contact numbers from the reference are seeded.

## Admin editing

Open **Admin Dashboard → Vendors**. Edit banner photo/focus and accessible
description, every page heading/subtitle, category/button/search/filter/empty
state wording, and the footer note. The banner defaults to the current saved
couple photo. JPEG/PNG/WebP uploads are limited to 8 MB and checked on the
server; clearing the banner returns to the current couple photo.

Add, rename, reorder or remove up to 12 categories, choosing their icons. Move
cards out of a category before removing it. Add up to 60 vendor cards with
name, category, optional badge, description, photo, Call and WhatsApp numbers,
featured flag and published flag. Use international contact format (`+233…`)
with no spaces. Contact buttons only appear when their numbers are supplied.
Numbers must be approved for public sharing. The app never places a call or
sends a WhatsApp message automatically.

New cards start hidden. **Save Vendors** persists the complete page atomically;
only checked Published cards appear to guests. **View Page** shows saved public
content, not an unsaved preview. **Reload Saved** asks before discarding an
unsaved draft. Failed/conflicting saves retain the current draft. Returning
to a different section preserves unsaved edits; sign-out clears them.

## Server/privacy boundaries

- `GET /api/vendors` returns only published cards with `Cache-Control: no-store`.
- `GET /api/admin/vendors`, `PATCH /api/admin/vendors`, and
  `POST /api/admin/vendors/photo` require the existing admin session. Writes
  additionally check request origin.
- `settings.vendors` is excluded from the generic public settings dump. The
  public guide allowlist is unchanged; hidden cards never enter guide answers.
- Private drafts are not persisted to browser storage. Uploaded files still
  have public random `/uploads/` URLs, so uploads are **not confidential storage**.
- SHA-256 revisions prevent stale-device saves overwriting newer edits.
  A response-loss retry may return a conflict; reload and review saved content
  instead of blindly resubmitting.
- Removing/clearing a photo or vendor never deletes a shared media file. No
  existing wedding records, OTP settings or payment credentials are changed.
- Deploy `server/vendors.js` and root `vendor-schema.js` into the flat API
  directory; registration passes `{app,db,requireAdmin,multer,uploadsDir}`.
  There are no schema migrations or initial database writes.

## Tests

```sh
node tests/vendors.test.cjs
WEDDING_E2E_VENDORS_ONLY=1 WEDDING_E2E_SERVER=/root/wedding-v229-candidate/server.js WEDDING_E2E_RUNNER=/root/wedding-audit-v227/isolated-browser-api.cjs node tests/isolated-e2e.cjs /absolute/output/directory
```

The isolated test creates disposable fixtures only. Never seed sample vendor
cards on production to make the new page appear populated.
