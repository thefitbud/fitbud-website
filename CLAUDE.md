# FitBud website · instructions for Claude Code

Static marketing site for www.thefitbud.com. Everything published lives in `public/`; there's no build step. The product itself lives in `thefitbud/thefitbud`.

## Rules for copy and UI (same product rules as the app)
- No percentages, streaks, scores or invented stats, customer counts or testimonials. A trainer quote needs their permission.
- WhatsApp is a wa.me prefill the user sends. Never claim auto-sending.
- Dates read like "Wed 21 Oct". No ISO dates.
- Touch targets are at least 44 px. Keep keyboard focus visible and honour reduced motion.
- FitBud presents context to trainers; it doesn't make coaching decisions. Don't promise automation the app doesn't do.
- App screens are copies of locked frames from the app repo's `docs/design/mockups/png/`. Don't edit them; re-export from there.

## Working rules
- Run `npm test` (and `npm run test:e2e` when the page or form changes) before pushing. Check the page at 1440×900 and 393×852.
- Keep `_headers` in step with what the page loads: the content policy only allows the sign-ups worker (`worker/`) for the form.
- Never run deploy commands (`wrangler pages deploy`, Cloudflare or Hostinger changes). Firoz deploys.
- No secrets in the repo. The worker URL in `index.html` is public by design; the Loops key is a Cloudflare secret.
