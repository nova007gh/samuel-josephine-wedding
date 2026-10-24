# Locally bundled QR libraries

These files run entirely on the device; camera frames, QR images and guest
passes are never sent to a third-party decoder or generator.

- `qrcode-generator-1.4.4.js`: qrcode-generator 1.4.4, Kazuhiko Arase, MIT.
  Source: https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js
  SHA-256: `18ae399f81182bc9de916e9c77b195df20cc58d6f2d55a62b085a299f1bf1780`
  Copyright and license notice retained in source; MIT terms included in
  `qrcode-generator-LICENSE.txt`.
- `jsqr-1.4.0.js`: jsQR 1.4.0, Cozmo / Daniel Shaby, Apache-2.0.
  Source: https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js
  SHA-256: `bc40c8a15196236b2314db0856f72ca0b49980cd5413b8c852a7349f5fee0859`
  Upstream license retained as `jsqr-LICENSE.txt`.

No CDN requests are made by the deployed scanner. QR content is accepted only
in the exact wedding-pass format and is never followed as a URL or executed.
