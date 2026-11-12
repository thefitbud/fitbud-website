// One-time import: the sign-up sheet (File › Download › CSV) → SQL for D1.
//
//   node worker/scripts/import-sheet.mjs sign-ups.csv > import.sql
//   npx wrangler d1 execute fitbud-signups --remote --file import.sql   (from worker/)
//
// Safe to run again: people already in D1 are left as they are.
// Only email rows whose Status is "New" (or empty) are queued for Loops. Anyone the team has
// already contacted, onboarded or ruled out is imported as 'skipped' so they get no automated mail.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { contactType, contactKey, MODES, CLIENTS } from '../src/index.js';

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

export function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim()));
}

// "Sat 31 Oct 2026, 1:47 pm" in the sheet's Asia/Kolkata time → UTC ISO string.
export function parseSubmitted(v) {
  const m = String(v).match(/(\d{1,2}) (\w{3})\w* (\d{4}),? (\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (!m) return null;
  let h = Number(m[4]) % 12;
  if ((m[6] || '').toLowerCase() === 'pm') h += 12;
  if (!m[6]) h = Number(m[4]);
  const month = MONTHS[m[2].toLowerCase()];
  if (month === undefined) return null;
  const utc = Date.UTC(Number(m[3]), month, Number(m[1]), h, Number(m[5])) - 330 * 60 * 1000;
  return new Date(utc).toISOString();
}

const sql = (v) => (v === null || v === undefined || v === '' ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);

export function toSql(csvText, now = new Date().toISOString()) {
  const [header, ...rows] = parseCsv(csvText);
  const col = (name) => header.findIndex((h) => h.trim().toLowerCase() === name);
  const idx = {
    submitted: col('submitted'), name: col('name'), contact: col('contact'), mode: col('coaching mode'),
    clients: col('clients'), status: col('status'), page: col('page'), referrer: col('referrer'),
  };
  if (idx.name < 0 || idx.contact < 0) throw new Error('CSV needs at least Name and Contact columns');

  const out = [];
  const skipped = [];
  for (const r of rows) {
    const get = (k) => (idx[k] >= 0 ? (r[idx[k]] || '').trim() : '');
    const name = get('name').replace(/^'/, '').slice(0, 80);
    const contact = get('contact').replace(/^'/, '').slice(0, 120);
    const type = contactType(contact);
    if (!name || !type) { skipped.push(contact || '(blank)'); continue; }
    const status = get('status').toLowerCase();
    const queue = type === 'email' && (status === '' || status === 'new');
    const created = parseSubmitted(get('submitted')) || now;
    const mode = MODES.includes(get('mode')) ? get('mode') : '';
    const clients = CLIENTS.includes(get('clients')) ? get('clients') : '';
    out.push(
      `INSERT INTO signups (contact_key, name, contact, contact_type, mode, clients, page, referrer, source, created_at, updated_at, loops_status) VALUES (` +
        [contactKey(contact, type), name, contact, type, mode, clients, get('page').slice(0, 300), get('referrer').slice(0, 300), 'sheet', created, now, queue ? 'pending' : 'skipped']
          .map(sql).join(', ') +
        `) ON CONFLICT (contact_key) DO NOTHING;`
    );
  }
  return { sql: out.join('\n') + '\n', count: out.length, skipped };
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const file = process.argv[2];
  if (!file) { console.error('usage: node worker/scripts/import-sheet.mjs sign-ups.csv > import.sql'); process.exit(1); }
  const { sql: text, count, skipped } = toSql(readFileSync(file, 'utf8'));
  process.stdout.write(text);
  console.error(`${count} rows ready.` + (skipped.length ? ` Skipped ${skipped.length} without a valid name or contact.` : ''));
}
