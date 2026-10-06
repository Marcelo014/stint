# Stint Chrome Extension

Manifest V3. Plain JavaScript — no React, no Plasmo.

Authentication is delegated entirely to the Stint web app via Clerk's **sync
host**: sign in once at the website and the extension picks the session up
from the Clerk cookie. There is no sign-in UI in the extension.

## Layout

```
extension/
  manifest.json      MV3 manifest
  popup.html         popup markup
  popup.css          Stint palette (light + dark)
  src/config.js      ← every URL lives here
  src/popup.js       popup logic
  src/scrape.js      page extraction, injected into the active tab
  build.mjs          esbuild bundler
  dist/              generated (gitignored) — loaded by popup.html
```

## How it reads the page

Nothing runs until the toolbar icon is clicked. There is no `content_scripts`
entry, no background service worker, no badge and no notifications — the popup
injects `scrapeJobPage` into the active tab on open, under `activeTab`, which
Chrome grants only on that click.

Extraction order, each layer filling only what the one above left empty:

1. **schema.org `JobPosting` JSON-LD** — structured, so it's the only source
   that reliably yields salary and deadline.
2. **Site extractors** — LinkedIn, Greenhouse, Lever, Workday. Each tries
   several selectors (LinkedIn's signed-in and signed-out DOMs differ
   entirely) and falls back to the URL slug or tenant subdomain for the
   company name, which outlives any DOM change.
3. **Page title** — split on `-`/`|`/`–`, giving "Title" and "Company".

`job_url` is always captured. Everything else may be null, and the popup shows
only the fields that came back with a value.

## Build

Requires `@clerk/chrome-extension` and `esbuild` (see the repo root).

```bash
node extension/build.mjs           # one-off
node extension/build.mjs --watch   # rebuild on save
```

`extension/dist/` must exist before Chrome can load the popup.

## Load unpacked (Chrome / Chromium on Linux)

1. Build first: `node extension/build.mjs`
2. Open `chrome://extensions` (Chromium: same URL; Brave: `brave://extensions`).
3. Toggle **Developer mode** on — top-right.
4. Click **Load unpacked**.
5. Select the `extension/` folder (the one with `manifest.json`), not the repo root.
6. The Stint tile appears. Click the puzzle-piece icon in the toolbar and pin it.
7. Copy the **extension ID** shown on the tile — it's needed for Clerk's
   `allowed_origins`.

After editing source: re-run the build, then click the **reload** ↻ icon on
the Stint tile. A manifest change needs the reload; a `dist/` change needs it
too, since the popup is cached.

## Stable extension ID

`manifest.json` carries a `key` — the public half of an RSA keypair — which
pins the extension ID to:

```
mlhnojpajbdffkbacbkcmbmjkccgjlfb
```

Without it Chrome assigns a random ID per machine, and Clerk's
`allowed_origins` plus `authorizedParties` in `src/proxy.js` would break on
every new checkout. The private half is only needed to publish to the Web
Store and is not in this repo.

## Switching to production

In `src/config.js`:

- `API_BASE_URL` → your deployed Stint origin
- `CLERK_SYNC_HOST` → your Clerk Frontend API origin
- `CLERK_PUBLISHABLE_KEY` → the `pk_live_...` key

Then update `host_permissions` in `manifest.json` to match, and re-run Clerk's
`allowed_origins` call with the production secret key.
