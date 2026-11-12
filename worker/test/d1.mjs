// A small stand-in for Cloudflare D1 on top of Node's built-in SQLite, running the real migrations.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';

export function createD1() {
  const db = new DatabaseSync(':memory:');
  const dir = new URL('../migrations/', import.meta.url);
  for (const f of readdirSync(dir).sort()) db.exec(readFileSync(new URL(f, dir), 'utf8'));
  const stmt = (query, args = []) => ({
    bind: (...a) => stmt(query, a),
    first: async () => db.prepare(query).get(...args) ?? null,
    all: async () => ({ results: db.prepare(query).all(...args) }),
    run: async () => { const r = db.prepare(query).run(...args); return { meta: { changes: r.changes } }; },
  });
  return { prepare: (q) => stmt(q), exec: (q) => db.exec(q), raw: db };
}
