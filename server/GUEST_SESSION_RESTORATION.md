# Returning guest sign-in

The server's existing HTTP-only `sj_guest_session` cookie identifies a guest.
Its rolling lifetime is 400 days; approval and confirmed physical arrival are
separate. No cached name, phone, relationship or guest ID grants access.

On DOM readiness the app calls `/api/guest-access` and restores the authenticated
guest even if browser storage is empty, blocked or full. Foreground, back/forward
cache restoration and reconnect events refresh approval. A failed network check
keeps saved identity but locks private features and displays reconnect guidance;
guests should reconnect rather than register again. Explicit sign-out still
revokes the session; failed sign-out retains it and reports the failure.

If a returning guest is asked to verify:

1. Open the same `https://snybena.com` browser or installed app used to register.
2. Avoid switching between WhatsApp/Instagram's embedded browser, Safari/Chrome,
   private windows and installed apps: their cookie stores may be isolated.
3. Reconnect and use Refresh approval. Wait for the startup check to finish.
4. If cookies were deleted or the device/browser changed, use returning-guest
   verification. Do not create another registration to replace a missing cookie.
5. Check admin approval separately; sign-in does not confirm entrance arrival.

The app cannot safely restore a deleted credential from a phone/name or guarantee
permanent sign-in against browser eviction. Do not disable verification, approval
or cookie security to bypass that limitation. The app-scoped `WeddingStorage`
fallback is memory-only when native storage fails, never an authentication store.
