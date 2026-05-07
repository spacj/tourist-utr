# Android APK — TourHunts

Goal: ship an Android APK to the Play Store (and optionally distribute the .apk directly) without maintaining a second codebase. Your existing PWA does all the heavy lifting; the APK is a thin native wrapper.

The technique is **Trusted Web Activity (TWA)** — a Google-blessed pattern where Android opens your URL in a Chrome runtime with the address bar and Chrome chrome hidden. Compared to alternatives:

| Approach | Bundle size | Code changes | Native APIs | Verdict |
|---|---|---|---|---|
| **TWA (Bubblewrap or PWABuilder)** | ~2 MB | None | All Web APIs you already use (GPS, camera, etc.) | ✅ Best fit |
| Capacitor | ~10 MB | Wrapper config | Adds native plugin layer | Only if you need native push, biometrics, etc. |
| Cordova | ~10 MB | Significant | Plugin layer | Older, declining ecosystem |
| Full native rewrite | n/a | Total | Everything | Don't, unless you have to |

The rest of this doc walks the TWA path.

---

## TL;DR — Going from PWA → APK in 5 steps

1. Verify the PWA passes Lighthouse → "Installable" check.
2. Open https://www.pwabuilder.com → enter `https://tourhunts.com` → click **Package for Android**.
3. Download the `.apk` (testing) and `.aab` (Play Store) PWABuilder generates.
4. Sign the APK with a keystore you create + own.
5. Upload `.apk` to your device for testing, or `.aab` to Google Play Console for distribution.

The optional polish steps after that — asset links so the address bar is hidden, custom splash screen, push notifications — are at the bottom.

---

## Step 1 — Pre-flight (verify PWA is installable)

Open the deployed site in Chrome → DevTools → **Lighthouse** → run a "PWA" audit. You need:

- ✅ HTTPS (yes — Vercel/Netlify/etc. give you this for free)
- ✅ Valid `manifest.json` with `name`, `short_name`, `start_url`, `display: standalone` or `fullscreen`, and at least one 512×512 icon (we already have all of this)
- ✅ Service worker registered (already done in `app/layout.tsx`)
- ✅ Responds offline with a cached page (the `huntFallback` + offline shell handles this)

If Lighthouse says "Installable", you're ready. If not, the audit pinpoints what's missing.

> **One thing to verify**: open `https://tourhunts.com/manifest.json` and confirm it returns the file. The PWA will fail TWA otherwise.

## Step 2 — Generate the package

Easiest path is the web tool:

1. Go to https://www.pwabuilder.com
2. Enter `https://tourhunts.com` and click **Start**
3. Wait for the analysis (it scores your manifest, SW, security, etc. — the scores aren't blocking; even partial PWAs build)
4. Click **Package for stores** → **Android** tab → **Generate Package**

PWABuilder asks for some details:

| Field | Value |
|---|---|
| Package ID | `com.tourhunts.twa` (must be a stable reverse-DNS string — never change after first Play submission) |
| App name | TourHunts |
| Launcher name | TourHunts |
| App version | 1.0.0 |
| Version code | 1 (integer, must increment for every Play release) |
| Display mode | standalone |
| Theme / background colors | matches manifest (#0b0d1a) |
| Icon | upload a 512×512 PNG, or let PWABuilder generate from your `/icon.svg` |
| Signing key | "I have a key" (after step 3 below) OR "Generate new key" the first time |

Click **Download Package**. You get a zip with:
- `app-release-signed.apk` — installable on Android devices for testing
- `app-release-bundle.aab` — uploads to Google Play Console
- `signing-key-info.txt` — **back this up offline**, you can never re-sign updates without it
- `assetlinks.json` — template for the next step

**Alternative — Bubblewrap CLI** (more control, scriptable):

```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest=https://tourhunts.com/manifest.json
bubblewrap build
```

PWABuilder uses the same machinery underneath. Use Bubblewrap if you want CI integration or fine-grained config.

## Step 3 — Sign the APK (one-time setup)

PWABuilder generates a keystore for you the first time. **Save the keystore file and password somewhere you won't lose them** — you can't update the app on Play without the original signing key.

If you'd rather generate your own:

```bash
keytool -genkey -v -keystore tourhunts.keystore \
  -alias tourhunts -keyalg RSA -keysize 2048 \
  -validity 10000
```

You'll be prompted for a password and identity info (name, organization, etc.). Keep `tourhunts.keystore` somewhere safe — backed up to two places ideally.

To sign an unsigned APK manually:
```bash
jarsigner -keystore tourhunts.keystore -storepass <pass> \
  app-release-unsigned.apk tourhunts
zipalign -v 4 app-release-unsigned.apk app-release.apk
```

PWABuilder does both automatically.

## Step 4 — Asset Links (hides the URL bar)

By default the TWA shows the URL bar above the page — fine for testing, ugly for production. To hide it:

1. After signing, get the SHA-256 fingerprint of your signing certificate:
   ```bash
   keytool -list -v -keystore tourhunts.keystore -alias tourhunts | grep SHA256
   ```
   Copy the hex string (looks like `AB:CD:EF:...`).

2. Open `public/.well-known/assetlinks.json` (we'll create this — see below) and paste the fingerprint into the `sha256_cert_fingerprints` array.

3. Deploy. The file must be reachable at `https://tourhunts.com/.well-known/assetlinks.json` — Next.js serves anything in `public/` as-is.

4. Verify it's working: `curl https://tourhunts.com/.well-known/assetlinks.json` should return the JSON.

5. Reinstall the APK. The URL bar should be gone.

If you don't ship asset links, the TWA still works — Chrome just shows the URL bar at the top. You can ship without it for v1 and add later.

## Step 5 — Test on a real device

1. Plug an Android phone in via USB, enable Developer Options + USB debugging.
2. `adb install app-release-signed.apk`
3. Launch from the home screen — should look identical to your PWA but without browser chrome.
4. Test: GPS hunts, payment flows (PayPal opens in an external browser tab and returns — test this carefully), offline mode, language switching.

> **Important: PayPal in TWA.** TWA opens external links in a Custom Tab, not a browser. PayPal Checkout works fine in a Custom Tab. Test the full payment loop on the APK before shipping.

## Step 6 — Submit to Play Store

1. Create a Google Play Console account (one-time $25 fee).
2. Create a new app, fill the listing (title, screenshots, description — pull from PAYMENT_SETUP.md and the homepage hero).
3. Upload `app-release-bundle.aab`.
4. Internal testing track first. Add yourself as a tester. Install via the test link.
5. Once happy → promote to Closed Beta → Open Beta → Production.

Initial review takes 1–7 days for new accounts.

---

## Optional polish

### Custom splash screen
PWABuilder generates one based on your icon + theme color. To customize, edit the splash drawable in the generated Android Studio project (only needed if you go the Bubblewrap CLI route — PWABuilder gives you the binary directly).

### Web Push notifications inside the TWA
Possible but requires extra wiring:
1. Web Push must be set up in your PWA (it isn't currently — we only have the `Notification` API stubbed, no push subscription).
2. The TWA sends push to the system tray automatically once the PWA's service worker handles `push` events.
3. Requires a push service (Firebase Cloud Messaging is free up to a high limit).

This is a separate workstream — say the word if you want push notifications wired.

### Deep linking from URLs to the APK
Once asset links are live, any link to `https://tourhunts.com/...` opens in the installed APK instead of the browser if the user has it installed. Already configured by Bubblewrap/PWABuilder out of the box.

### iOS App Store
Apple doesn't allow TWA-style wrappers. To ship on iOS App Store you either:
- Use Capacitor or React Native (rewrite the shell)
- Wait for Apple to support PWAs natively (they tease this each year, never deliver)

For now, iOS users get the PWA via "Add to Home Screen" from Safari — that's the standard for now.

---

## Maintenance — updating the APK

When you push a code change to the website, **the APK auto-updates** (it's just loading your live URL). You don't need to ship a new APK for content or code changes.

You only ship a new APK when you change:
- The package ID (don't)
- The signing key (don't)
- The native config (icon, splash, theme colors)
- The version code (incremented for Play Store updates, e.g. when manifest icons change)

For most updates, just deploy the website — APK users see them on next launch.

---

## Troubleshooting

**APK installs but launches into a "Hello World" page**
The TWA can't reach your URL. Check that `https://tourhunts.com/manifest.json` returns 200 and the manifest is valid JSON.

**URL bar is still showing after asset links setup**
The fingerprint is wrong, the file isn't being served, or Chrome cached the old check. Try:
1. `adb shell am force-stop com.tourhunts.twa`
2. Clear Chrome's data for tourhunts.com
3. Relaunch the APK

**Play Store rejects the upload**
Almost always a version code conflict (must be higher than any previous upload — even uploads to internal testing count). Bump `version_code` in PWABuilder and re-package.

**Payment redirect goes to browser, doesn't return to APK**
Asset links must include the path PayPal redirects to (`/api/...`). Either include `*` in the path or list the specific routes. The default PWABuilder asset links allow all paths under your origin.
