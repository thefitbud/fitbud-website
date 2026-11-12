# Sign-ups → D1 → Loops follow-up emails

A Cloudflare Worker (`fitbud-signups`) that replaces the Google Sheet as the place sign-ups are stored, so follow-up emails can go out automatically.

```
landing page form ──POST /signup──▶ worker ──▶ D1 table `signups` (one row per person)
                                       └──▶ right away: Loops event `early_access_signup` ──▶ Loops sends the follow-up loop

every 10 min (cron) ──▶ worker ──▶ retries any sign-up Loops didn't accept yet
```

- **Same rules as the sheet.** Validation, the spam trap and "same person twice keeps one row" match `sheets/Code.gs`. A repeat sign-up refreshes name, mode and clients, and is **never sent to Loops twice**.
- **Only emails go to Loops.** WhatsApp-number sign-ups are stored with `loops_status = 'skipped'`. The team follows those up by hand (a wa.me prefill they send, as today).
- **New emails go to Loops straight away.** The visitor gets their reply first; the worker sends the event a moment later. If Loops is down or slow, the visitor still sees success and the cron picks it up.
- **Each email is sent to Loops once.** `loops_status` goes `pending` → `synced`. Errors are retried by the cron, up to 5 attempts, then the row is marked `failed` with the error in `loops_error`. If Loops rate-limits a run, the rest wait for the next run. Each event carries an `Idempotency-Key`, so a retry after a timeout can't send it twice.
- **No key, no sends.** Without the `LOOPS_API_KEY` secret, sign-ups still save and wait as `pending`.

What Loops receives per sign-up: `email`, `name` (the whole name as typed; create a **Text** contact property called `name` in Loops under Settings › Contact properties first), `source` (`Early access form` or `Early access (sheet)`), and event properties `coachingMode` and `clientCount`.

## Set it up (Firoz: needs the Cloudflare login)

Run these from `worker/`. Nothing here touches DNS or the Pages project.

1. **Database: done.** D1 database `fitbud-signups` (id in `wrangler.toml`). The `signups` table was created by pasting `migrations/0001_signups.sql` into its Console on Thu 12 Nov, so don't run `wrangler d1 migrations apply` for that file. Put any later table change in a new numbered file and run it the same way.

2. **Worker: created in the dashboard** (Workers & Pages › Import a repository › `thefitbud/fitbud-website`, root directory `worker`, deploy command `npx wrangler deploy`). Every push to `main` redeploys it.

3. **Set up Loops** (app.loops.so):
   - **Settings › API**: create an API key.
   - **Loops › New loop**, trigger **Event received**, event name `early_access_signup`. Write the follow-up emails in that loop. If the emails use the coaching mode or client count, add event properties `coachingMode` and `clientCount` (both text) under **Settings › Events** first.
   - Loops adds the unsubscribe link and footer. Copy must follow the product rules in `CLAUDE.md`: no invented stats or testimonials, and no promises the app doesn't keep.

4. **Add the key to the worker:** the worker's **Settings › Variables and Secrets › Add › Secret**, name `LOOPS_API_KEY`. Cloudflare stores it encrypted; it's never in the repo. It must be type **Secret**, not Text: every deploy from `main` replaces Text variables with the ones in `wrangler.toml`. If the key is missing, sign-ups still save as `pending` and the logs say `LOOPS_API_KEY is not set`.

5. **Check the worker.** Its overview page shows the URL, like `https://fitbud-signups.<account>.workers.dev`. Opening it shows `{"ok":true,…}`.

6. **Bring in the people already in the sheet.** Download the `Sign-ups` tab (**File › Download › CSV**), then from the repo root:

   ```bash
   node worker/scripts/import-sheet.mjs sign-ups.csv > import.sql
   ```

   ```bash
   cd worker && npx wrangler d1 execute fitbud-signups --remote --file ../import.sql
   ```

   Only email rows whose **Status** is `New` (or empty) are queued for Loops. Anyone already Contacted, Interested, Onboarded or Not a fit is imported as `skipped`, so they get no automated email. Running it again is harmless. Delete the CSV and SQL afterwards: they hold contact details (both are git-ignored).

7. **Form: done.** The page posts to `https://fitbud-signups.restless-unit-1f42.workers.dev/signup`, and `_headers` allows only that in `connect-src`. New sign-ups go to D1 only; the Google Sheet keeps the earlier ones. To check after a deploy, sign up once on the live page with your own email: the row appears in D1 straight away, and the contact in Loops within a few seconds. Delete the test contact from D1 and Loops.

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

## Settings (`wrangler.toml`)

| Name | What it does |
|---|---|
| `ALLOWED_ORIGINS` | Sites that may post the form. Other origins get a 403. |
| `LOOPS_EVENT_NAME` | The event that starts the Loops follow-up loop. Default `early_access_signup`. |
| `LOOPS_API_KEY` | Secret, set with `wrangler secret put`. |
| cron `*/10 * * * *` | How often sign-ups Loops didn't accept are retried. |

## Tests

`npm test` at the repo root runs `worker/test/worker.test.mjs`: the worker against the real migration in Node's built-in SQLite, with Loops stubbed. Nothing to install.
