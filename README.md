# FitBud landing page

Static, dependency-free marketing page for trainers (`index.html`, `styles.css`, `main.js`, `assets/`).
No build step and no workspace package, so it doesn't touch `pnpm lint/typecheck/test`.

```bash
cd apps/landing && python3 -m http.server 4321   # then open http://localhost:4321
```

- Brand: palette and Satoshi from `packages/brand` / `docs/design/DESIGN-NOTES.md`.
- Images in `assets/img/` are WebP exports of locked frames: `07-trainee-diet-ios`, `106-notif-workout-reminder-lock-ios`, `02-trainer-web-home-panel-v3-web`.
- "Follow the build" (`#follow-link` in `index.html`) has no destination yet. Point it at the waitlist or build log when one exists.
- The WhatsApp share button is a wa.me prefill; the visitor presses Send.
- Screenshots: `docs/qa/landing/`.
