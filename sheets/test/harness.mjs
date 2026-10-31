// Runs sheets/Code.gs in Node with in-memory stand-ins for the Apps Script services it uses.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const CODE = readFileSync(new URL('../Code.gs', import.meta.url), 'utf8');

export function loadScript({ notifyEmail = '' } = {}) {
  const rows = [];
  const mail = [];
  const range = (r, c, nr = 1, nc = 1) => ({
    getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => rows[r - 1 + i]?.[c - 1 + j] ?? '')),
    setValue: (v) => { rows[r - 1][c - 1] = v; },
    setValues: (vs) => vs.forEach((row, i) => row.forEach((v, j) => { rows[r - 1 + i][c - 1 + j] = v; })),
    setFontWeight() { return this; }, setNumberFormat() { return this; }, setDataValidation() { return this; }, createFilter() { return this; },
  });
  const sheet = {
    getLastRow: () => rows.length,
    getMaxRows: () => 1000,
    appendRow: (r) => rows.push([...r]),
    getRange: (a, b, c, d) => (typeof a === 'string' ? range(1, 1) : range(a, b, c, d)),
    setFrozenRows() {}, getFilter: () => null,
  };
  const validation = { requireValueInList() { return this; }, setAllowInvalid() { return this; }, build() { return {}; } };
  const ctx = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({ getSheetByName: () => sheet, insertSheet: () => sheet, setSpreadsheetTimeZone() {} }),
      newDataValidation: () => validation,
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text) => ({ text, setMimeType() { return this; } }),
    },
    MailApp: { sendEmail: (to, subject, body) => mail.push({ to, subject, body }) },
  };
  vm.createContext(ctx);
  vm.runInContext(CODE.replace("var NOTIFY_EMAIL = '';", `var NOTIFY_EMAIL = ${JSON.stringify(notifyEmail)};`), ctx);
  return {
    rows, mail,
    post: (params) => JSON.parse(ctx.doPost({ parameter: params }).text),
    get: () => JSON.parse(ctx.doGet().text),
    setup: () => ctx.setup(),
  };
}
