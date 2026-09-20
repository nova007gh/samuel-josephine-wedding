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
Live at https://snybena.com — fully self-hosted on the VPS, no external services.

- **Frontend**: static files in the repo root, served by nginx from `/var/www/snybena.com`. Redeploy with `deploy-wedding` on the server after pushing to `main`.
- **Backend**: `server/` — a small Node.js + Express + SQLite API (`server/server.js`) running as the `wedding-api` systemd service on `127.0.0.1:3100`. nginx proxies `/api/` to it and serves uploaded media from `/uploads/`.
- **Data**: SQLite at `/var/lib/wedding/wedding.db`; uploads at `/var/lib/wedding/uploads/`. Nightly backup to `/var/backups/wedding/` via cron.
- **Admin**: password lives in `/opt/wedding-api/api.env` on the server (`ADMIN_PASSWORD`); sign in at `?view=admin`. Redeploy API changes with `deploy-wedding-api`.

Guests can create check-ins, RSVPs, guestbook messages and media uploads (all start as `pending` where moderation applies) and read approved content; everything else needs an admin sign-in. Feeds refresh every 15 seconds.


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
- Guest-uploaded media is stored on the server (`/var/lib/wedding/uploads/`) and moderated from the admin dashboard before it appears publicly
