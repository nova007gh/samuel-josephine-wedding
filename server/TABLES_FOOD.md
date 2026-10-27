# Tables & Food (v250)

## Login changes

“Your Relationship / Invited By” now includes **GROOMSMAN**, **BRIDESMAID** and
**VENDOR**. These are saved connection labels only: they do not grant approval,
verified-phone status, team membership or profile ownership. Existing labels and
free-text Other are unchanged; no existing guest relation is rewritten.

Wedding Team Login & My Profile is removed from Home and placed on the guest
login/registration screen, below the sign-in panes. Approved team members can
also use **More → My Team Profile** without signing out. It still uses the same
verified/approved-account and explicit admin Profile Access ownership checks.

## Admin → Tables & Food

1. Add actual tables: unique names, real capacities, locations/directions. The
   Enabled checkbox controls use in automatic seating, not manual admin access.
2. Add rules. Choose an exact saved relation (including the new role labels), or
   explicit Sam/groom or Jossy/bride inviter side. Select the permitted tables in
   priority order. Exact-relation rules take precedence over side rules.
3. Save; enable automatic seating only after this plan is correct. No default
   table, capacity, location or seating rule is invented at deployment.
4. Search any registered attendee to assign, change or clear a table. Pending,
   approved, not-yet-arrived and arrived attendees can all be managed by admin.
   Guests see only their own saved table after confirmed arrival, as before.
5. For already-arrived unassigned parties, **Preview automatic seating** is
   read-only. **Apply previewed assignments** atomically rechecks an opaque
   snapshot token before writing; changed parties/seats/rules invalidate it.

Automatic allocation runs inside the existing explicit entrance-confirmation
transaction, after an arrival is inserted (never on scan preview or registration).
It requires an approved guest, attending RSVP and real confirmed arrival.
Existing assignments, including manual and historic free-text seats, are kept.
Only whole parties that fit an enabled table in a saved matching rule are seated.
Unknown/mixed inviters, no matching rule or insufficient room leave the party
unassigned. Unlike the companion-avatar fallback, seating never hashes unknown
relations into Sam or Jossy tables.

Party size uses the latest RSVP linked to the authenticated account by the
existing ownership table; otherwise it uses registration size (guest + extras).
Names/contact similarity do not establish RSVP ownership. Reservations include
every assigned party, including pending/not-arrived attendees, to prevent
overbooking. These are **reserved seats**, not physical arrival counts. Later
RSVP changes may make an existing table over capacity; admin sees it and must
review/move parties. Existing assignments are not silently split, moved or erased.

The shared service updates the existing authoritative `guest_seating` records,
with their revision checks. New `guest_table_links(guestId,tableId,source)` metadata
adds stable table IDs/source for named tables. Renaming/moving a configured table
updates the same guest seats and increments seat revisions. Occupied tables
cannot be removed; capacity cannot fall below reserved seats. Known legacy seats
matching a table name are counted without a bulk migration. Once tables exist,
new free-text table names from the older scanner editor are rejected rather than
bypassing configured capacity; unchanged historic free-text seats remain editable.
Before any table plan exists, the approved legacy manual editor still works.
Concurrent confirmations/manual assignments serialize in SQLite transactions;
duplicate arrival confirmations keep the same assignment and never double-count.
Seating failure does not invent a table or erase an arrival: confirmation can
return an explicit seating-unavailable notice for admin follow-up.

## Food & Drinks guest page

Open **Events → Food & Drinks Menu**. The cream/gold reference-style layout uses
the wedding seal, header/back/menu controls and All / Local Chops / Main Dishes /
Drinks / Desserts category filters. Saved photos display fully, not cropped.
Existing compact five-tab navigation and Gallery remain unchanged.

Admin can add dishes/drinks, descriptions, dietary/allergen notes, photos and an
optional header photograph. Photo uploads require JPEG/PNG/WebP byte signatures,
maximum 8 MB, and stay in the draft until Save. Original uploads are never removed
merely because a dish is edited or hidden. Preview is local-only.

Two switches govern publication: **Publish this menu** and each dish's
**Show this confirmed dish** checkbox. The reference's 20 dish names can be added
explicitly as **unpublished draft suggestions**; no sample food photographs or
claims about actual catering are fabricated. Without a confirmed published menu,
guests see an honest coming-soon state. No food orders, dietary promises, payments
or notifications are triggered. Guests should ask the catering team about food.

## Boundaries / endpoints

Settings key `tablesFood` is private: excluded from general settings (even for
approved guests) and guide knowledge. Admin GET/PATCH `/api/admin/tables-food`,
guest assignment PATCH `/api/admin/tables-food/guests/:id`, GET `/preview`, POST
`/allocate`, POST `/photo` require the existing admin session; writes check origin.
All use no-store. Whole-plan saves use a shared SHA-256 revision and transactional
capacity/deletion/photo checks; failed/conflicting writes retain client drafts.

GET `/api/food-menu` is approval-gated and returns only the published menu/dishes,
never table plans, guest identities, draft dishes or unpublished header text.
It exposes no per-guest or aggregate seating data. The existing own-guest arrival
endpoint continues withholding table/directions before arrival. Arrival totals
remain on Admin → Entrance & Tables only. Detailed Guest List automatically sees
the same authoritative guest seating. Removing a guest also removes new table-ID
metadata, without changing the existing historical-arrival retention policy.

Client admin data stays in page memory; logout/access loss/page exit clears
contacts, plans, draft preview and late responses. Dynamic text is rendered as
text, and image URLs are local uploaded files only. Default reads do not save a
plan or menu. No bulk allocation, guest-role ownership or menu publication is
performed on live data during deployment/testing.
