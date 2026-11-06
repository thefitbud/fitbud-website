// npm test: static checks on the published page (no browser needed).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const founderLinks = [...html.matchAll(/<a\b[^>]*\bdata-founder-wa\b[^>]*>/g)].map((m) => m[0]);
const hrefOf = (tag) => tag.match(/\bhref="([^"]+)"/)[1].replace(/&amp;/g, '&');

test('every "Talk to the founders" button opens the same WhatsApp chat', () => {
  assert.equal(founderLinks.length, 3, 'hero, closing section and mobile sticky bar');
  const hrefs = new Set(founderLinks.map(hrefOf));
  assert.equal(hrefs.size, 1, 'all buttons use one number and one message');
});

test('the founder WhatsApp number is set and well formed', () => {
  const url = new URL(hrefOf(founderLinks[0]));
  assert.equal(url.origin, 'https://wa.me');
  const number = url.pathname.slice(1);
  assert.notEqual(number, 'FOUNDER_WA_NUMBER', 'replace the placeholder with the founder number');
  // wa.me wants the full international number, digits only: e.g. 91 + 10-digit Indian mobile.
  assert.match(number, /^[1-9]\d{9,14}$/);
  if (number.startsWith('91')) assert.equal(number.length, 12, 'Indian numbers are 91 + 10 digits');
});

test('the WhatsApp message is prefilled for the visitor to send', () => {
  const url = new URL(hrefOf(founderLinks[0]));
  assert.match(url.searchParams.get('text') || '', /FitBud/);
  for (const tag of founderLinks) {
    assert.match(tag, /target="_blank"/);
    assert.match(tag, /rel="noopener"/);
  }
});
