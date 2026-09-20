# Samuel & Josephine Wedding Web App

This upgraded build is a mobile-first Progressive Web App (PWA) designed for high-density displays and 4K-class rendering.

## Upgrades
- Installable web app on supported mobile browsers
- Apple mobile web app metadata
- Safe-area support for modern iPhones
- High-density 4K seal artwork
- Large-screen scaling up to desktop/4K displays
- Responsive mobile layouts using dynamic viewport units
- Offline caching via Service Worker
- Home-screen app icons
- RSVP prototype with local browser persistence
- Touch-friendly controls and install button

## Run locally
Because Service Workers require HTTP/HTTPS, do not open `index.html` directly for full PWA behavior.

Run:
python3 -m http.server 8080

Then open:
http://localhost:8080

## Production
Live at https://snybena.com (nginx on the VPS, Let's Encrypt). Redeploy with `deploy-wedding` on the server after pushing to `main`.

## Firebase setup (one-time, in the Firebase console for project `wedding-4db15`)
Guests can only create submissions and read approved content; everything else needs an admin sign-in.

1. **Authentication → Sign-in method** → enable **Email/Password**.
2. **Authentication → Users → Add user** → create the admin account (this is the login for the in-app Admin dashboard).
3. **Authentication → Settings → Authorized domains** → add `snybena.com` and `www.snybena.com`.
4. **Firestore Database** → **Create database** if none exists yet (production mode, any region; nothing saves until it exists), then **Rules** → paste `firestore.rules` and publish.
5. **Storage** → click **Get started** if the bucket has not been created yet (uploads 404 until it exists), then **Rules** → paste `storage.rules` and publish.

Or, with the Firebase CLI: `firebase deploy --only firestore:rules,storage`.


## New: Couple Story & Memory Vault
- Upload Samuel's childhood photos
- Upload Josephine's childhood photos
- Upload adulthood photos for both
- Upload first pictures together
- Upload proposal/engagement memories
- Upload videos together with inline playback
- Add captions to each memory
- Filter the gallery by life stage/category
- Edit the couple's "How We Met" story directly in the web app
- Media uses IndexedDB in the prototype, which is much better suited than localStorage for photos/videos

### Production note
The current upload gallery stores media on the device where it was uploaded. For a real public wedding site, connect the same UI to cloud object storage (e.g. Supabase Storage, Firebase Storage, S3/Cloudflare R2) and a database so guests see the same approved memories on every device.
