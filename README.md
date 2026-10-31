# FitBud landing page

Static, dependency-free marketing page for trainers, for `www.thefitbud.com`.
There's no build step and it isn't a workspace package, so it doesn't touch `pnpm lint/typecheck/test`.

```
apps/landing/
  public/          ← the website, exactly as published (index.html, styles.css, main.js, assets/,
                     _headers for security headers, robots.txt, sitemap.xml)
  sheets/          ← Google Apps Script that saves sign-ups to a sheet, plus its tests
  DEPLOY.md        ← how to put it on thefitbud.com (Cloudflare Pages + Hostinger DNS)
```

Run it locally:

```bash
cd apps/landing/public && python3 -m http.server 4321   # then open http://localhost:4321
```

- **Brand:** palette and Satoshi from `packages/brand` / `docs/design/DESIGN-NOTES.md`.
- **Screens:** `public/assets/img/` holds WebP exports of locked frames: `07-trainee-diet-ios`, `106-notif-workout-reminder-lock-ios`, `02-trainer-web-home-panel-v3-web`, `152-trainer-web-workout-builder-web` (full and cropped), `05-trainer-mobile-needs-you-v3-ios`.
- **Early-access form** (`#signup`): name, email or WhatsApp number, coaching mode (Online / Hybrid / In person) and client count. It posts to the Google Apps Script web app in `data-endpoint`, which writes to the sign-up sheet. Setup and tests: `sheets/README.md`.
- **Share button:** a wa.me prefill; the visitor presses Send.
- **Link previews:** `public/assets/og-image.png` (1200×630). Canonical URL `https://www.thefitbud.com/`.
- **Team note** (`#why-fitbud`): a draft. Edit and sign it before launch.
- **Screenshots:** `docs/qa/landing/`.
