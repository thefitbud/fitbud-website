# Early-access sign-ups → Google Sheet

The landing page form posts to a small Google Apps Script (`Code.gs`) that adds one row per sign-up to a Google Sheet. It's free, with no server to run, and the team can follow up straight from the sheet.

## What lands in the sheet

| Submitted | Name | Contact | Contact type | Coaching mode | Clients | Status | Follow-up notes | Page | Referrer |
|---|---|---|---|---|---|---|---|---|---|
| Sat 31 Oct 2026, 1:47 pm | Asha Rao | +91 98765 43210 | WhatsApp | Hybrid | 10 to 20 | New | | https://… | |

- **Coaching mode** (Online / Hybrid / In person) and **Clients** (Under 5 / 5 to 10 / 10 to 20 / 20+) are dropdown columns with a filter on the header row.
- **Status** starts at `New`. Change it as you follow up: New, Contacted, Interested, Onboarded, Not a fit. Write anything else in **Follow-up notes**.
- Someone who signs up twice keeps **one row**. Their name, mode and client count are refreshed, and your Status and notes are left alone. `+91 98765 43210` and `9876543210` count as the same number; email matching ignores case.
- Bots that fill a hidden field are dropped silently. Values that look like formulas are stored as text.

## Set it up (about 10 minutes, once)

1. **Create the sheet.** In the FitBud Google account, create a Google Sheet, for example "FitBud early access". Share it only with the people who follow up.
2. **Add the script.** In the sheet, open **Extensions › Apps Script**. Delete what's there, paste in all of `Code.gs` and save.
   - Optional: to get an email for every sign-up, set `NOTIFY_EMAIL` at the top to the team address.
3. **Run setup once.** Pick `setup` in the function dropdown and press **Run**. Google asks you to authorise the script (it needs access to this spreadsheet only, plus sending email if you set `NOTIFY_EMAIL`). A `Sign-ups` tab appears with headers, dropdowns and a filter.
4. **Deploy as a web app.** Press **Deploy › New deployment**, choose type **Web app**, then:
   - Execute as: **Me**
   - Who has access: **Anyone** (the public form has to reach it; it only accepts sign-ups and never returns sheet data)

   Press **Deploy** and copy the **Web app URL** (`https://script.google.com/macros/s/…/exec`).
5. **Connect the page.** In `apps/landing/index.html`, paste that URL into the form's `data-endpoint=""`.
6. **Check it.** Open the web app URL in a browser: it should show `{"ok":true,…}`. Then submit the form on the live page once with your own details and confirm the row appears. Delete the test row afterwards.

**Changing the script later:** use **Deploy › Manage deployments › edit (pencil) › Version: New version › Deploy**. That keeps the same URL. "New deployment" would create a new URL, and you'd have to update the page.

## Notes

- The form only saves from the real site. The claude.ai preview link blocks requests to other sites, so there the form can't reach the sheet.
- Apps Script on a free Google account is plenty for a sign-up form's traffic. Each sign-up takes well under a second of script time.
- The sheet holds names and phone numbers: keep sharing limited to the team.

## Tests

```bash
node --test apps/landing/sheets/test/code.test.mjs   # Code.gs logic against an in-memory sheet
node apps/landing/sheets/test/e2e.mjs                # real page in Chromium → stand-in web app (needs Playwright)
```

`test/mock-server.mjs` runs `Code.gs` behind a local URL that copies Google's redirect and CORS behaviour. Run it with `node apps/landing/sheets/test/mock-server.mjs` to try the form locally: put `http://localhost:4400/exec` in `data-endpoint` and see the rows at `http://localhost:4400/rows.csv`.
