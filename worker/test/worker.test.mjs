// npm test: the sign-ups worker against an in-memory D1 and a stubbed Loops.
import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { pushToLoops, MAX_ATTEMPTS } from '../src/index.js';
import { toSql, parseSubmitted } from '../scripts/import-sheet.mjs';
import { createD1 } from './d1.mjs';

const ORIGIN = 'https://www.thefitbud.com';
const realFetch = globalThis.fetch;

function setup({ loops = () => new Response('{"success":true}'), env: extra = {} } = {}) {
  const DB = createD1();
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).includes('loops.so')) return loops(calls.filter((c) => c.url.includes('loops.so')).length, init);
    throw new Error(`unexpected fetch ${url}`);
  };
  const env = { DB, ALLOWED_ORIGINS: `${ORIGIN},https://fitbud-landing.pages.dev`, LOOPS_API_KEY: 'test-key',
    LOOPS_EVENT_NAME: 'early_access_signup', ...extra };
  const ctx = { waitUntil() {} };
  const post = async (fields, origin = ORIGIN) => {
    const res = await worker.fetch(new Request('https://w.example/signup', {
      method: 'POST', headers: origin ? { Origin: origin } : {}, body: new URLSearchParams(fields),
    }), env, ctx);
    return { status: res.status, body: await res.json(), headers: res.headers };
  };
  const rows = () => DB.raw.prepare('SELECT * FROM signups ORDER BY id').all();
  return { env, ctx, post, rows, calls, loopsCalls: () => calls.filter((c) => c.url.includes('loops.so')) };
}
test.afterEach(() => { globalThis.fetch = realFetch; });

const asha = { name: 'Asha Rao', contact: 'Asha@Example.com', mode: 'Hybrid', clients: '10 to 20', page: 'https://www.thefitbud.com/' };

test('a sign-up is saved once and queued for Loops', async () => {
  const t = setup();
  const r = await t.post(asha);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true });
  assert.equal(r.headers.get('Access-Control-Allow-Origin'), ORIGIN);
  const [row] = t.rows();
  assert.equal(row.contact_key, 'asha@example.com');
  assert.equal(row.contact_type, 'email');
  assert.equal(row.loops_status, 'pending');
  assert.equal(t.calls.length, 0, 'nothing leaves the worker until the cron runs');
});

test('signing up twice keeps one row, refreshes answers and does not re-queue', async () => {
  const t = setup();
  await t.post(asha);
  await pushToLoops(t.env);
  const r = await t.post({ ...asha, contact: ' asha@example.COM ', name: 'Asha R', mode: 'Online' });
  assert.deepEqual(r.body, { ok: true, duplicate: true });
  const rows = t.rows();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'Asha R');
  assert.equal(rows[0].mode, 'Online');
  assert.equal(rows[0].loops_status, 'synced');
});

test('phone numbers match across formats and are never sent to Loops', async () => {
  const t = setup();
  await t.post({ ...asha, contact: '+91 98765 43210' });
  const r = await t.post({ ...asha, contact: '9876543210' });
  assert.equal(r.body.duplicate, true);
  assert.equal(t.rows()[0].loops_status, 'skipped');
  await pushToLoops(t.env);
  assert.equal(t.loopsCalls().length, 0);
});

test('invalid input is rejected with the same errors as the sheet script', async () => {
  const t = setup();
  assert.equal((await t.post({ ...asha, name: '' })).body.error, 'name_required');
  assert.equal((await t.post({ ...asha, contact: 'nope' })).body.error, 'contact_invalid');
  assert.equal((await t.post({ ...asha, mode: 'Remote' })).body.error, 'mode_invalid');
  assert.equal((await t.post({ ...asha, clients: '50' })).body.error, 'clients_invalid');
  assert.equal(t.rows().length, 0);
});

test('the spam trap stores nothing and other sites cannot post', async () => {
  const t = setup();
  assert.deepEqual((await t.post({ ...asha, website: 'http://spam' })).body, { ok: true });
  assert.equal((await t.post(asha, 'https://evil.example')).status, 403);
  assert.equal((await t.post(asha, null)).status, 403);
  assert.equal(t.rows().length, 0);
  assert.equal(t.calls.length, 0);
});

test('the cron sends one Loops event per new email with the right payload', async () => {
  const t = setup();
  await t.post(asha);
  const summary = await pushToLoops(t.env);
  assert.deepEqual(summary, { synced: 1, failed: 0, retry: 0 });
  const [call] = t.loopsCalls();
  assert.equal(call.url, 'https://app.loops.so/api/v1/events/send');
  assert.equal(call.init.headers.Authorization, 'Bearer test-key');
  assert.match(call.init.headers['Idempotency-Key'], /^fitbud-signup-\d+$/);
  assert.deepEqual(JSON.parse(call.init.body), {
    email: 'asha@example.com', eventName: 'early_access_signup', firstName: 'Asha', lastName: 'Rao',
    source: 'Early access form', eventProperties: { coachingMode: 'Hybrid', clientCount: '10 to 20' },
  });
  assert.equal(t.rows()[0].loops_status, 'synced');
  await pushToLoops(t.env);
  assert.equal(t.loopsCalls().length, 1, 'never sent twice');
});

test('Loops errors are retried, then marked failed', async () => {
  const t = setup({ loops: () => new Response('{"success":false,"message":"bad"}', { status: 400 }) });
  await t.post(asha);
  for (let i = 0; i < MAX_ATTEMPTS + 2; i++) await pushToLoops(t.env);
  const [row] = t.rows();
  assert.equal(row.loops_status, 'failed');
  assert.equal(row.loops_attempts, MAX_ATTEMPTS);
  assert.match(row.loops_error, /^400 /);
  assert.equal(t.loopsCalls().length, MAX_ATTEMPTS);
});

test('a rate limit stops the run without using up attempts', async () => {
  const t = setup({ loops: (n) => (n === 2 ? new Response('', { status: 429 }) : new Response('{"success":true}')) });
  await t.post(asha);
  await t.post({ ...asha, contact: 'b@example.com' });
  await t.post({ ...asha, contact: 'c@example.com' });
  await pushToLoops(t.env);
  assert.deepEqual(t.rows().map((r) => [r.loops_status, r.loops_attempts]), [['synced', 1], ['pending', 0], ['pending', 0]]);
  await pushToLoops(t.env);
  assert.deepEqual(t.rows().map((r) => r.loops_status), ['synced', 'synced', 'synced']);
});

test('nothing is sent without an API key', async () => {
  const t = setup({ env: { LOOPS_API_KEY: '' } });
  await t.post(asha);
  await pushToLoops(t.env);
  assert.equal(t.loopsCalls().length, 0);
  assert.equal(t.rows()[0].loops_status, 'pending');
});

test('sheet import: only "New" email rows are queued, existing people are kept', async () => {
  const csv = [
    'Submitted,Name,Contact,Contact type,Coaching mode,Clients,Status,Follow-up notes,Page,Referrer',
    '"Sat 31 Oct 2026, 1:47 pm",Asha Rao,asha@example.com,Email,Hybrid,10 to 20,New,,https://www.thefitbud.com/,',
    '"Sun 1 Nov 2026, 9:05 am",Ravi K,ravi@example.com,Email,Online,Under 5,Contacted,"called, keen",,',
    '"Sun 1 Nov 2026, 9:10 am",Neha,+91 98765 43210,WhatsApp,In person,5 to 10,New,,,',
    '"Mon 2 Nov 2026, 6:00 pm","O\'Brien, Sam",sam@example.com,Email,Online,20+,,,,',
    ',,not-a-contact,,,,,,,',
  ].join('\n');
  const { sql, count, skipped } = toSql(csv, '2026-11-12T00:00:00.000Z');
  assert.equal(count, 4);
  assert.equal(skipped.length, 1);

  const t = setup();
  await t.post({ ...asha, name: 'Asha (form)' });
  t.env.DB.exec(sql);
  t.env.DB.exec(sql); // re-running is harmless
  const rows = Object.fromEntries(t.rows().map((r) => [r.contact_key, r]));
  assert.equal(Object.keys(rows).length, 4);
  assert.equal(rows['asha@example.com'].name, 'Asha (form)', 'form row kept');
  assert.equal(rows['ravi@example.com'].loops_status, 'skipped');
  assert.equal(rows['9876543210'].loops_status, 'skipped');
  assert.equal(rows['sam@example.com'].loops_status, 'pending');
  assert.equal(rows['sam@example.com'].name, "O'Brien, Sam");
  assert.equal(rows['ravi@example.com'].source, 'sheet');
});

test('sheet dates are read as India time', () => {
  assert.equal(parseSubmitted('Sat 31 Oct 2026, 1:47 pm'), '2026-10-31T08:17:00.000Z');
  assert.equal(parseSubmitted('Sun 1 Nov 2026, 12:05 am'), '2026-10-31T18:35:00.000Z');
  assert.equal(parseSubmitted('garbage'), null);
});
