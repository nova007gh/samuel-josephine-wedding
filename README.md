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
Host behind HTTPS. Connect RSVP submissions to a real database/API before public launch.


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
