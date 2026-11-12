# Putting the landing page on thefitbud.com

**Plan:** host the page on **Cloudflare Pages**, connected to this GitHub repo (`thefitbud/fitbud-website`), and keep DNS at **Hostinger**.
`www.thefitbud.com` serves the page, and `thefitbud.com` redirects to it.

Why this way:
- **Email keeps working.** `tech@thefitbud.com` is the app's support and system address. This plan only touches the `www` record and the bare-domain redirect, never mail records or nameservers.
- **Every push to `main` redeploys it.** No uploads by hand, and pull requests get their own preview links.
- **It's free** and on the Cloudflare account FitBud already uses.

Only the `public/` folder is published. `_headers` there sets the security headers, including a content policy that only lets the form talk to the sign-ups worker (`worker/README.md`).

> These steps are for whoever holds the Cloudflare and Hostinger logins (Firoz). Hostinger's menu names change now and then. If a label differs, look for the closest match.

## 0. Before you start

- [ ] `main` has the version you want live.
- [ ] In Hostinger, open **Domains › thefitbud.com › DNS / Nameservers** and **screenshot the current records**. This is your undo.
- [ ] Note whether `thefitbud.com` shows a website today (a Hostinger site, a parking page or nothing). The redirect in step 4 replaces whatever is there.

## 1. Create the Pages project (Cloudflare)

**Workers & Pages › Create › Pages › Connect to Git**, then choose `thefitbud/fitbud-website`.

| Setting | Value |
|---|---|
| Project name | `fitbud-landing` |
| Production branch | `main` |
| Framework preset | None |
| Build command | *(leave empty)* |
| Build output directory | `public` |
| Root directory | *(leave empty)* |

Check `https://fitbud-landing.pages.dev`. The page should load, and the sign-up form should work (try it once and delete the row).

*Without Git:* `wrangler pages deploy public --project-name fitbud-landing` uploads the folder directly. Repeat it after every change.

## 2. Add the domain to the project (Cloudflare)

In the Pages project, go to **Custom domains › Set up a custom domain** and enter `www.thefitbud.com`. Cloudflare will say the DNS is managed elsewhere and give you a **CNAME target**: `fitbud-landing.pages.dev`.

## 3. Point `www` at Cloudflare (Hostinger)

In **DNS / Nameservers › DNS records**:

- If there's already a `www` record (Hostinger often adds `CNAME www → thefitbud.com`), **edit** it. Otherwise **add** one:

  | Type | Name | Points to / Target | TTL |
  |---|---|---|---|
  | CNAME | `www` | `fitbud-landing.pages.dev` | default |

- **Don't touch** `MX` records, `TXT` records (SPF, DKIM, DMARC, verification), or mail-related names like `mail`, `autodiscover` or `_dmarc`. Those carry the email.

Back in Cloudflare, the custom domain moves from *Verifying* to **Active** once DNS has spread and the HTTPS certificate is issued. That usually takes minutes, sometimes a few hours.

## 4. Send the bare domain to `www` (Hostinger)

Cloudflare Pages can only serve `thefitbud.com` itself if Cloudflare runs the domain's DNS, so Hostinger redirects it instead:

- **Domain only (no Hostinger hosting plan):** **Domains › thefitbud.com › Domain forwarding** (or **Redirect**), forward to `https://www.thefitbud.com`, type **Permanent (301)**.
- **With a Hostinger hosting plan on this domain:** **Websites › thefitbud.com › Redirects**, redirect `thefitbud.com` to `https://www.thefitbud.com`, **Permanent (301)**.

Then check that both `http://thefitbud.com` and `https://thefitbud.com` land on `https://www.thefitbud.com`. If the `https://` one shows a certificate warning, Hostinger hasn't issued SSL for the redirect yet. Its SSL section can issue a free one.

*Later, optional:* moving the domain's DNS to Cloudflare would let Pages serve `thefitbud.com` directly. That means copying every record, mail ones included, first. It isn't needed for launch.

## 5. After it's live

- [ ] `https://www.thefitbud.com` loads, with a padlock, on a laptop and a phone.
- [ ] `thefitbud.com` redirects to `www`.
- [ ] Sign up once with your own details. You should see "You're on the list", and a row in the D1 `signups` table whose `page` reads `https://www.thefitbud.com/`. Delete it.
- [ ] Paste `https://www.thefitbud.com` into a WhatsApp chat. The preview card ("More clients shouldn't mean more chaos.") should appear. WhatsApp caches previews, so a first try may lag.
- [ ] Send a test email to `tech@thefitbud.com` and confirm it arrives.

## Undo

- Delete the `www` CNAME, or restore it from your screenshot, and remove the forwarding in Hostinger.
- The Pages project can stay. It costs nothing and is only reachable at `fitbud-landing.pages.dev`.

## Changing the page later

Edit files in `public/` and merge to `main`. Pages redeploys in about a minute.
The sign-up endpoint is the form's `data-endpoint` in `public/index.html`. The worker that receives it is in `worker/`.
