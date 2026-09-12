# App links

Two files here let `https://cheapmarket.app/p?id=…` open the app instead of the browser.

- `apple-app-site-association` — replace `TEAMID` with the Apple Team ID (App Store Connect → Membership). Must be served as `application/json` (the root `vercel.json` sets the header).
- `assetlinks.json` — replace the fingerprint with the SHA-256 of the **Play App Signing** certificate (Play Console → Setup → App signing → App signing key certificate).

After deploying, verify: https://cheapmarket.app/.well-known/apple-app-site-association and …/assetlinks.json both return JSON.
