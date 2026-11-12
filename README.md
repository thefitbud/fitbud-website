# FitBud website

The marketing site for **www.thefitbud.com**: one static landing page for freelance, online and hybrid trainers, plus the early-access sign-up that saves to a Google Sheet.

No framework, no build step, no dependencies.

```
public/       the website, exactly as published (index.html, styles.css, main.js, assets/,
              _headers for security headers, robots.txt, sitemap.xml)
sheets/       the old Google Apps Script sign-up sheet (replaced by worker/), plus its tests
worker/       Cloudflare Worker: sign-ups → D1, new emails → Loops follow-ups (see worker/README.md)
docs/         screenshots of the page and form states
DEPLOY.md     how it's hosted: Cloudflare Pages, DNS at Hostinger
```

## Run it locally

```bash
npm start   # serves public/ at http://localhost:4321 (needs python3; any static server works)
```

Submitting the form from localhost is refused by the worker (only the live site may post), so local tests use the stand-in in `sheets/test/`.

## Tests

```bash
npm test           # sign-up script and worker logic (Node 22+, nothing to install)
npm run test:e2e   # the real page in Chromium posting to a local stand-in for Google
```

`test:e2e` needs Playwright: `npm i --no-save playwright && npx playwright install chromium`. CI (`.github/workflows/ci.yml`) runs both on every push and pull request.

## What's where

- **Early-access form** (`#signup` in `public/index.html`): name, email or WhatsApp number, coaching mode (Online / Hybrid / In person) and client count. It posts to the sign-ups worker in `data-endpoint`, which saves one row per person to D1 and passes new emails to Loops for follow-ups. Setup: `worker/README.md`.
- **Share button:** a wa.me prefill; the visitor presses Send.
- **Link previews:** `public/assets/og-image.png` (1200×630). The canonical URL is `https://www.thefitbud.com/`.
- **Brand and screens:** the palette, Satoshi font, logo and app screens are copies from the FitBud app repo (`thefitbud/thefitbud`: `packages/brand`, `docs/design/`). When the brand or a screen changes there, copy the new file here. `public/assets/img/` holds WebP exports of these locked frames: `07-trainee-diet-ios`, `106-notif-workout-reminder-lock-ios`, `02-trainer-web-home-panel-v3-web`, `152-trainer-web-workout-builder-web` (full and cropped) and `05-trainer-mobile-needs-you-v3-ios`.
- **Team note** (`#why-fitbud`): a draft. Edit and sign it before launch.

## History

The page started in the app monorepo (`apps/landing/` on branch `claude/awesome-bohr-ej66ou`) and moved here with its commit history.
