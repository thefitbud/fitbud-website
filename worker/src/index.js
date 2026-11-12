// FitBud sign-ups worker.
//   POST /signup   the landing page form → one row per person in D1
//   cron           pending email sign-ups → Loops event, which starts the follow-up emails
// Validation matches sheets/Code.gs, which it replaces.

export const MODES = ['Online', 'Hybrid', 'In person'];
export const CLIENTS = ['Under 5', '5 to 10', '10 to 20', '20+'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const LOOPS_URL = 'https://app.loops.so/api/v1/events/send';
export const MAX_ATTEMPTS = 5;
const BATCH = 50; // per cron run; Loops allows about 10 requests a second

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (url.pathname === '/' && request.method === 'GET') return json({ ok: true, service: 'fitbud-signups' }, 200, cors);
    if (url.pathname !== '/signup') return json({ ok: false, error: 'not_found' }, 404, cors);
    if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, cors);
    if (!cors['Access-Control-Allow-Origin']) return json({ ok: false, error: 'origin_not_allowed' }, 403);

    let params;
    try {
      params = new URLSearchParams(await request.text());
    } catch {
      return json({ ok: false, error: 'bad_request' }, 400, cors);
    }

    const result = await saveSignup(env.DB, params);
    return json(result, result.ok ? 200 : 400, cors);
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(pushToLoops(env));
  },
};

export async function saveSignup(db, p) {
  // Spam trap: bots fill every field. Pretend it worked and store nothing.
  if (clean(p.get('website'))) return { ok: true };

  const name = clean(p.get('name')).slice(0, 80);
  const contact = clean(p.get('contact')).slice(0, 120);
  const mode = clean(p.get('mode'));
  const clients = clean(p.get('clients'));
  const type = contactType(contact);

  if (!name) return { ok: false, error: 'name_required' };
  if (!type) return { ok: false, error: 'contact_invalid' };
  if (!MODES.includes(mode)) return { ok: false, error: 'mode_invalid' };
  if (!CLIENTS.includes(clients)) return { ok: false, error: 'clients_invalid' };

  const now = new Date().toISOString();
  // Same person twice: keep one row and refresh their answers. Loops status is left alone,
  // so nobody gets the follow-up sequence twice.
  const row = await db
    .prepare(
      `INSERT INTO signups (contact_key, name, contact, contact_type, mode, clients, page, referrer,
                            source, created_at, updated_at, loops_status)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'form', ?9, ?9, ?10)
       ON CONFLICT (contact_key) DO UPDATE SET
         name = excluded.name, mode = excluded.mode, clients = excluded.clients, updated_at = excluded.updated_at
       RETURNING created_at`
    )
    .bind(
      contactKey(contact, type), name, contact, type, mode, clients,
      clean(p.get('page')).slice(0, 300), clean(p.get('referrer')).slice(0, 300),
      now, type === 'email' ? 'pending' : 'skipped'
    )
    .first();

  return row && row.created_at !== now ? { ok: true, duplicate: true } : { ok: true };
}

export async function pushToLoops(env) {
  const summary = { synced: 0, failed: 0, retry: 0 };
  if (!env.LOOPS_API_KEY) return summary;

  const { results } = await env.DB
    .prepare(
      `SELECT id, name, contact, mode, clients, source, loops_attempts FROM signups
       WHERE loops_status = 'pending' AND contact_type = 'email' ORDER BY id LIMIT ?1`
    )
    .bind(BATCH)
    .all();

  for (const row of results) {
    const res = await sendEvent(env, row);
    if (res.rateLimited) break; // try the rest next run
    const now = new Date().toISOString();
    if (res.ok) {
      summary.synced++;
      await env.DB
        .prepare(`UPDATE signups SET loops_status = 'synced', loops_synced_at = ?2, loops_error = NULL,
                  loops_attempts = loops_attempts + 1 WHERE id = ?1`)
        .bind(row.id, now)
        .run();
    } else {
      const attempts = row.loops_attempts + 1;
      const status = attempts >= MAX_ATTEMPTS ? 'failed' : 'pending';
      summary[status === 'failed' ? 'failed' : 'retry']++;
      await env.DB
        .prepare(`UPDATE signups SET loops_status = ?2, loops_attempts = ?3, loops_error = ?4 WHERE id = ?1`)
        .bind(row.id, status, attempts, res.error.slice(0, 300))
        .run();
    }
  }
  return summary;
}

async function sendEvent(env, row) {
  const [firstName, ...rest] = row.name.split(/\s+/);
  let r;
  try {
    r = await fetch(LOOPS_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.LOOPS_API_KEY}`,
        'Content-Type': 'application/json',
        // Loops ignores a repeat with the same key, so a retry after a timeout can't double-send.
        'Idempotency-Key': `fitbud-signup-${row.id}`,
      },
      body: JSON.stringify({
        email: row.contact.toLowerCase(),
        eventName: env.LOOPS_EVENT_NAME || 'early_access_signup',
        firstName,
        lastName: rest.join(' '),
        source: row.source === 'sheet' ? 'Early access (sheet)' : 'Early access form',
        eventProperties: { coachingMode: row.mode || '', clientCount: row.clients || '' },
      }),
    });
  } catch (err) {
    return { ok: false, error: `network: ${err.message}` };
  }
  if (r.status === 429) return { ok: false, rateLimited: true };
  // 409 = this idempotency key was already accepted, so the event went through earlier.
  if (r.ok || r.status === 409) return { ok: true };
  const text = await r.text().catch(() => '');
  return { ok: false, error: `${r.status} ${text}` };
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!allowed.includes(origin)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

export function contactType(v) {
  if (EMAIL_RE.test(v)) return 'email';
  return /^\d{10,13}$/.test(v.replace(/[\s()+-]/g, '')) ? 'phone' : '';
}

export function contactKey(v, type) {
  v = String(v || '').trim().toLowerCase();
  if (type === 'email') return v;
  const d = v.replace(/\D/g, '');
  return d.length > 10 ? d.slice(-10) : d;
}

function clean(v) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F]/g, ' ').trim();
}

function json(obj, status = 200, headers = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}
