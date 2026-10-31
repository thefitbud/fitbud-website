// Local stand-in for the deployed Apps Script web app, for testing the landing form.
// POST /exec runs Code.gs's doPost, then answers like Google does: a 302 to an /echo URL
// that returns the JSON. Both carry Access-Control-Allow-Origin: *, as Google's do.
//   node apps/landing/sheets/test/mock-server.mjs [port]   (rows: GET /rows.csv)
import http from 'node:http';
import { loadScript } from './harness.mjs';

export function startMock(port = 4400) {
  const script = loadScript();
  const results = new Map();
  let seq = 0;
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`);
    if (req.method === 'POST' && url.pathname === '/exec') {
      let raw = '';
      req.on('data', (c) => (raw += c));
      req.on('end', () => {
        const out = script.post(Object.fromEntries(new URLSearchParams(raw)));
        const id = String(++seq);
        results.set(id, out);
        res.writeHead(302, { Location: `/echo?id=${id}`, 'Access-Control-Allow-Origin': '*' }).end();
      });
      return;
    }
    if (url.pathname === '/echo') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify(results.get(url.searchParams.get('id')) ?? { ok: false }));
    }
    if (url.pathname === '/rows.csv') {
      const csv = script.rows.map((r) => r.map((v) => `"${String(v instanceof Object && v.toISOString ? v.toISOString() : v).replace(/"/g, '""')}"`).join(',')).join('\n');
      res.writeHead(200, { 'Content-Type': 'text/csv' });
      return res.end(csv + '\n');
    }
    res.writeHead(404).end();
  });
  return new Promise((r) => server.listen(port, () => r({ server, script })));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.argv[2] || 4400);
  startMock(port).then(() => console.log(`Mock sign-up endpoint: http://localhost:${port}/exec`));
}
