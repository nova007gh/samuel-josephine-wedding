# Vendor, bridesmaid and groomsman profiles

## Identity and access

Use the existing verified wedding-account sign-in (phone/code and the existing
secure HTTP-only guest cookie). A separate password store, shared team password,
public phone-number claim or self-selected privileged role is not introduced.
The Home **Vendor / Bridesmaid / Groomsman Login & My Profile** button opens a
role selector and the user's own editor. Selecting a role only filters profiles;
it never grants ownership or changes approval. Registration, approval and
physical entrance arrival remain separate.

Admin must verify the person independently, approve their registered account,
then assign the intended profile under **Admin → Profile Access**. Existing
public vendor contact numbers and member names do not prove ownership. Existing
profiles are not auto-claimed or migrated into guest records. No notification,
SMS, email, password or paid OTP test is sent when assigning ownership.

Existing SMS delivery issues remain an operational prerequisite. This feature
does not change providers or claim codes were delivered. Pending/unverified
accounts see guidance, not profile records. A guest account may hold multiple
explicit assignments, including multiple roles; admin controls each separately.

## Admin workflow

1. Add/edit/remove the actual profile in the existing **Vendors** or **Bridal
   Train** editor and save. Those editors remain the authoritative profile CRUD
   controls, including ordering, category, bridal role, publication and featuring.
2. Open **Profile Access** and reload. Choose the verified registered account
   for each profile, then **Save access**. A pending account must be approved
   under Guests & RSVPs before it can edit.
3. Choose **No self-edit access** to revoke, or select another account to
   transfer ownership. Removal from the authoritative editor also deletes the
   assignment transactionally. Re-adding the same profile ID does not restore it.

New additive table: `role_profile_owners(kind, profileId, guestId)`, primary key
`(kind,profileId)`. No sample mappings are seeded. Owner IDs are available only
to admin; public vendor/bridal responses retain their existing shape.

## Self-service boundaries

- Approved signed-in accounts can GET only their assigned profiles, PATCH only
  those profiles, and upload a photo only for an assigned existing profile.
- Vendors edit name, card label, description, public phone/WhatsApp and photo.
  Bridesmaids/groomsmen edit name and photo. Existing bridal role labels remain
  admin-controlled; self-edits cannot change groups, categories, featured status,
  publication, ownership, guest approval or entrance/seating records.
- Profile edits update the original settings JSON, not a second copy. Existing
  whole-document revisions prevent silent overwrites between admin and owners.
  On conflict, the draft remains; reload explicitly before retrying.
- Photos use MIME-signature validation, 8 MB limit and random local filenames.
  Uploading stages a draft URL; saving publishes it on the original card. Uploaded
  URLs are not confidential. No automatic file deletion is introduced.
- Same-origin checks protect writes; ownership and approval are re-evaluated on
  every request. Authenticated JSON stays no-store. Logout/revocation clears
  editor content, and open editors periodically recheck assigned IDs. Drafts
  remain in memory only, never local storage, worker caches or guide history.

## Home and entrance pass

Home always says **Enter Our Wedding to Check In**. The pass is parked inside a
hidden container outside Home and shown only inside the deliberate check-in
dialog. QR generation, scanning, explicit duplicate-safe arrival confirmation,
post-arrival seating and private companion assistance use the existing endpoints.
The companion's personal-table action opens the private dialog rather than
scrolling to a removed Home card.
