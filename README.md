# FitBud landing page

Static, dependency-free marketing page for trainers (`index.html`, `styles.css`, `main.js`, `assets/`).
No build step and no workspace package, so it doesn't touch `pnpm lint/typecheck/test`.

```bash
cd apps/landing && python3 -m http.server 4321   # then open http://localhost:4321
```

- Brand: palette and Satoshi from `packages/brand` / `docs/design/DESIGN-NOTES.md`.
- Images in `assets/img/` are WebP exports of locked frames: `07-trainee-diet-ios`, `106-notif-workout-reminder-lock-ios`, `02-trainer-web-home-panel-v3-web`, `152-trainer-web-workout-builder-web` (full and cropped), `05-trainer-mobile-needs-you-v3-ios`.
- Early-access form (`#signup`): set `data-endpoint` to a form endpoint that accepts a POST (Formspree, Tally, a Worker). Until then, submitting says sign-ups aren't connected yet.
- The team note (`#why-fitbud`) is a draft: edit and sign it before launch.
- The WhatsApp share button is a wa.me prefill; the visitor presses Send.
- Screenshots: `docs/qa/landing/`.
