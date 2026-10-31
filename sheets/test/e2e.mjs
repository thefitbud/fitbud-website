// End-to-end: the real landing page posting to the mock web app (needs Playwright + Chromium).
//   node apps/landing/sheets/test/e2e.mjs
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { startMock } from './mock-server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const ROOT = new URL('../../', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const SHOTS = process.env.SHOTS_DIR;

const site = http.createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try {
    const body = await readFile(join(ROOT, path === '/' ? 'index.html' : path));
    res.writeHead(200, { 'Content-Type': TYPES[extname(path || '.html')] || 'text/html' }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise((r) => site.listen(4410, r));
const { server: mock, script } = await startMock(4400);
const browser = await chromium.launch();
const results = [];
const step = async (name, fn) => { await fn(); results.push(name); console.log('ok -', name); };

try {
  for (const [label, viewport] of [['web', { width: 1440, height: 900 }], ['mobile', { width: 393, height: 852 }]]) {
    const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('http://localhost:4410/#early-access');
    const form = page.locator('#signup');
    const msg = page.locator('#signup-msg');

    await step(`${label}: no endpoint configured says so and stores nothing`, async () => {
      await page.fill('#f-name', 'Asha Rao');
      await page.fill('#f-contact', 'asha@example.com');
      await page.check('input[name=mode][value="Online"]', { force: true });
      await page.check('input[name=clients][value="5 to 10"]', { force: true });
      await form.locator('button[type=submit]').click();
      await assert.match(await msg.textContent(), /aren't connected yet/);
      await page.evaluate(() => document.getElementById('signup').reset());
    });

    await page.evaluate(() => document.getElementById('signup').setAttribute('data-endpoint', 'http://localhost:4400/exec'));
    const before = script.rows.length;

    await step(`${label}: empty submit shows a message on every field`, async () => {
      await form.locator('button[type=submit]').click();
      assert.equal(await page.textContent('#f-name-err'), 'Please add your name.');
      assert.equal(await page.textContent('#f-contact-err'), 'Please add an email or WhatsApp number.');
      assert.equal(await page.textContent('#f-mode-err'), 'Please pick how you coach.');
      assert.equal(await page.textContent('#f-clients-err'), 'Please pick a client count.');
      assert.equal(await page.evaluate(() => document.activeElement.id), 'f-name');
      if (SHOTS) await form.screenshot({ path: `${SHOTS}/form-${label}-errors.png` });
      assert.equal(script.rows.length, before);
    });

    await step(`${label}: a bad contact is caught before sending`, async () => {
      await page.fill('#f-name', 'Asha Rao');
      await page.fill('#f-contact', 'asha at gmail');
      await form.locator('button[type=submit]').click();
      assert.equal(await page.textContent('#f-contact-err'), "That doesn't look like an email or a phone number.");
    });

    const contact = label === 'web' ? 'asha@example.com' : '+91 98765 43210';
    const mode = label === 'web' ? 'In person' : 'Hybrid';
    await step(`${label}: a valid sign-up lands in the sheet with coaching mode`, async () => {
      await page.fill('#f-contact', contact);
      assert.equal(await page.textContent('#f-contact-err'), '', 'error clears once the field is edited');
      assert.equal(await page.getAttribute('#f-contact', 'aria-invalid'), 'false');
      await page.locator(`.chips label:has(input[name=mode][value="${mode}"])`).click();
      await page.locator('.chips label:has(input[name=clients][value="10 to 20"])').click();
      if (SHOTS) await form.screenshot({ path: `${SHOTS}/form-${label}-filled.png` });
      await form.locator('button[type=submit]').click();
      await page.waitForFunction(() => document.getElementById('signup-msg').classList.contains('is-ok'));
      assert.match(await msg.textContent(), /You're on the list/);
      if (SHOTS) await form.screenshot({ path: `${SHOTS}/form-${label}-success.png` });
      const row = script.rows.at(-1);
      // Sheets hides the leading ' that keeps "+91…" as text.
      assert.deepEqual(row.slice(1, 7), ['Asha Rao', contact.startsWith('+') ? `'${contact}` : contact, label === 'web' ? 'Email' : 'WhatsApp', mode, '10 to 20', 'New']);
      assert.equal(row[8], 'http://localhost:4410/');
      assert.equal(await page.inputValue('#f-name'), '', 'form resets after success');
    });

    await step(`${label}: signing up again does not add a second row`, async () => {
      const n = script.rows.length;
      await page.fill('#f-name', 'Asha Rao');
      await page.fill('#f-contact', contact);
      await page.locator('.chips label:has(input[name=mode][value="Online"])').click();
      await page.locator('.chips label:has(input[name=clients][value="20+"])').click();
      await form.locator('button[type=submit]').click();
      await page.waitForFunction(() => /on the list/.test(document.getElementById('signup-msg').textContent));
      assert.equal(script.rows.length, n);
      assert.deepEqual(script.rows.at(-1).slice(4, 6), ['Online', '20+']);
    });

    await step(`${label}: an unreachable endpoint shows a retry message and re-enables the button`, async () => {
      await page.evaluate(() => document.getElementById('signup').setAttribute('data-endpoint', 'http://localhost:4499/exec'));
      await page.fill('#f-name', 'Vikram Iyer');
      await page.fill('#f-contact', 'vikram@example.com');
      await page.locator('.chips label:has(input[name=mode][value="Online"])').click();
      await page.locator('.chips label:has(input[name=clients][value="Under 5"])').click();
      await form.locator('button[type=submit]').click();
      await page.waitForFunction(() => document.getElementById('signup-msg').classList.contains('is-error'));
      assert.match(await msg.textContent(), /didn't go through/);
      assert.equal(await form.locator('button[type=submit]').isEnabled(), true);
    });

    assert.deepEqual(errors, []);
    await page.close();
  }
  const csv = await (await fetch('http://localhost:4400/rows.csv')).text();
  console.log('\nRows in the mock sheet:\n' + csv);
  console.log(`${results.length} checks passed`);
} finally {
  await browser.close();
  site.close();
  mock.close();
}
