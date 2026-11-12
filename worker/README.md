# Sign-ups → D1 → Loops follow-up emails

A Cloudflare Worker (`fitbud-signups`) that takes over from the Google Sheet as the place sign-ups are stored, so follow-up emails can go out automatically.

```
landing page form ──POST /signup──▶ worker ──▶ D1 table `signups` (one row per person)
                                       └──▶ Google Sheet (copy, while the team still works from it)

every 10 min (cron) ──▶ worker ──▶ Loops event `early_access_signup` ──▶ Loops sends the follow-up loop
```

- **Same rules as the sheet.** Validation, the spam trap and "same person twice keeps one row" match `sheets/Code.gs`. A repeat sign-up refreshes name, mode and clients, and is **never sent to Loops twice**.
- **Only emails go to Loops.** WhatsApp-number sign-ups are stored with `loops_status = 'skipped'`. The team follows those up by hand (a wa.me prefill they send, as today).
- **Each email is sent to Loops once.** `loops_status` goes `pending` → `synced`. Errors are retried on later runs, up to 5 attempts, then the row is marked `failed` with the error in `loops_error`. If Loops rate-limits a run, the rest wait for the next run. Each event carries an `Idempotency-Key`, so a retry after a timeout can't send it twice.
- **No key, no sends.** Without the `LOOPS_API_KEY` secret, sign-ups still save and wait as `pending`.

What Loops receives per sign-up: `email`, `firstName`, `lastName` (name split at the first space), `source` (`Early access form` or `Early access (sheet)`), and event properties `coachingMode` and `clientCount`.

## Set it up (Firoz: needs the Cloudflare login)

Run these from `worker/`. Nothing here touches DNS or the Pages project.

1. **Create the database.**

   ```bash
   npx wrangler d1 create fitbud-signups
   ```

   Paste the `database_id` it prints into `wrangler.toml` (replace `REPLACE_WITH_ID_FROM_wrangler_d1_create`) and commit that. The id isn't a secret.

2. **Create the table.**

   ```bash
   npx wrangler d1 migrations apply fitbud-signups --remote
   ```

3. **Set up Loops** (app.loops.so):
   - **Settings › API**: create an API key.
   - **Loops › New loop**, trigger **Event received**, event name `early_access_signup`. Write the follow-up emails in that loop. If the emails use the coaching mode or client count, add event properties `coachingMode` and `clientCount` (both text) under **Settings › Events** first.
   - Loops adds the unsubscribe link and footer. Copy must follow the product rules in `CLAUDE.md`: no invented stats or testimonials, and no promises the app doesn't keep.

4. **Add the key to the worker** (it's stored encrypted by Cloudflare, never in the repo):

   ```bash
   npx wrangler secret put LOOPS_API_KEY
   ```

5. **Deploy the worker.**

   ```bash
   npx wrangler deploy
   ```

   It prints the URL, like `https://fitbud-signups.<account>.workers.dev`. Opening it shows `{"ok":true,…}`.

6. **Bring in the people already in the sheet.** Download the `Sign-ups` tab (**File › Download › CSV**), then from the repo root:

   ```bash
   node worker/scripts/import-sheet.mjs sign-ups.csv > import.sql
   ```

   ```bash
   cd worker && npx wrangler d1 execute fitbud-signups --remote --file ../import.sql
   ```

   Only email rows whose **Status** is `New` (or empty) are queued for Loops. Anyone already Contacted, Interested, Onboarded or Not a fit is imported as `skipped`, so they get no automated email. Running it again is harmless. Delete the CSV and SQL afterwards: they hold contact details (both are git-ignored).

7. **Point the form at the worker.** Two edits in `public/`, in one commit:
   - `index.html`: set the form's `data-endpoint` to `https://fitbud-signups.<account>.workers.dev/signup`.
   - `_headers`: add the worker URL to `connect-src`. The Google hosts can go once nothing posts to Apps Script from the browser.

   Then sign up once on the live page with your own email. The row should appear in D1 straight away, in the sheet a moment later, and the contact in Loops (with the event) within about 10 minutes. Delete the test contact from D1, the sheet and Loops.

Until step 7 is merged the page keeps posting straight to the sheet, so nothing breaks in between.

## Day to day

```bash
# Who's waiting, sent or failed
npx wrangler d1 execute fitbud-signups --remote --command "SELECT loops_status, COUNT(*) FROM signups GROUP BY 1"

# Why something failed
npx wrangler d1 execute fitbud-signups --remote --command "SELECT contact, loops_attempts, loops_error FROM signups WHERE loops_status = 'failed'"

# Retry the failed ones after fixing the cause
npx wrangler d1 execute fitbud-signups --remote --command "UPDATE signups SET loops_status = 'pending', loops_attempts = 0 WHERE loops_status = 'failed'"

# Live logs
npx wrangler tail
```

To stop copying sign-ups to the sheet, set `SHEET_ENDPOINT = ""` in `wrangler.toml` and redeploy.

## Settings (`wrangler.toml`)

| Name | What it does |
|---|---|
| `ALLOWED_ORIGINS` | Sites that may post the form. Other origins get a 403. |
| `LOOPS_EVENT_NAME` | The event that starts the Loops follow-up loop. Default `early_access_signup`. |
| `SHEET_ENDPOINT` | Apps Script web app that also gets each sign-up. Empty to stop. |
| `LOOPS_API_KEY` | Secret, set with `wrangler secret put`. |
| cron `*/10 * * * *` | How often pending emails go to Loops. |

## Tests

`npm test` at the repo root runs `worker/test/worker.test.mjs`: the worker against the real migration in Node's built-in SQLite, with Loops and Google stubbed. Nothing to install.
