/**
 * FitBud early-access sign-ups → Google Sheet.
 *
 * Paste this into Extensions › Apps Script of the sign-up sheet, run `setup` once,
 * then deploy as a web app (Execute as: Me, Who has access: Anyone).
 * The landing page posts its form to the web app URL. Full steps: sheets/README.md.
 */

var SHEET_NAME = 'Sign-ups';
var TIMEZONE = 'Asia/Kolkata';
// Optional: an address to email on every new sign-up. Leave empty for none.
var NOTIFY_EMAIL = '';

var HEADERS = [
  'Submitted', 'Name', 'Contact', 'Contact type', 'Coaching mode', 'Clients',
  'Status', 'Follow-up notes', 'Page', 'Referrer'
];
var MODES = ['Online', 'Hybrid', 'In person'];
var CLIENTS = ['Under 5', '5 to 10', '10 to 20', '20+'];
var STATUSES = ['New', 'Contacted', 'Interested', 'Onboarded', 'Not a fit'];
var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Run once from the editor: creates the tab, headers, dropdowns and filter. */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.setSpreadsheetTimeZone(TIMEZONE);
  var sheet = getSheet_();
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  sheet.getRange('A2:A').setNumberFormat('ddd d mmm yyyy, h:mm am/pm');

  var rule = function (values) {
    return SpreadsheetApp.newDataValidation().requireValueInList(values, true).setAllowInvalid(false).build();
  };
  sheet.getRange('E2:E').setDataValidation(rule(MODES));
  sheet.getRange('F2:F').setDataValidation(rule(CLIENTS));
  sheet.getRange('G2:G').setDataValidation(rule(STATUSES));
  if (!sheet.getFilter()) sheet.getRange(1, 1, sheet.getMaxRows(), HEADERS.length).createFilter();
}

/** Health check: opening the web app URL in a browser shows {"ok":true}. */
function doGet() {
  return json_({ ok: true, service: 'fitbud-early-access' });
}

function doPost(e) {
  var p = (e && e.parameter) || {};

  // Spam trap: bots fill every field. Pretend it worked and store nothing.
  if (clean_(p.website)) return json_({ ok: true });

  var name = clean_(p.name).slice(0, 80);
  var contact = clean_(p.contact).slice(0, 120);
  var mode = clean_(p.mode);
  var clients = clean_(p.clients);
  var type = contactType_(contact);

  if (!name) return json_({ ok: false, error: 'name_required' });
  if (!type) return json_({ ok: false, error: 'contact_invalid' });
  if (MODES.indexOf(mode) < 0) return json_({ ok: false, error: 'mode_invalid' });
  if (CLIENTS.indexOf(clients) < 0) return json_({ ok: false, error: 'clients_invalid' });

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return json_({ ok: false, error: 'busy' });
  try {
    var sheet = getSheet_();
    var key = normalise_(contact, type);

    // Same person signing up twice: keep one row, refresh their answers.
    var last = sheet.getLastRow();
    if (last > 1) {
      var contacts = sheet.getRange(2, 3, last - 1, 2).getValues();
      for (var i = 0; i < contacts.length; i++) {
        if (normalise_(String(contacts[i][0]).replace(/^'/, ''), contacts[i][1]) === key) {
          sheet.getRange(i + 2, 2).setValue(safe_(name));
          sheet.getRange(i + 2, 5, 1, 2).setValues([[mode, clients]]);
          return json_({ ok: true, duplicate: true });
        }
      }
    }

    sheet.appendRow([
      new Date(), safe_(name), safe_(contact), type === 'email' ? 'Email' : 'WhatsApp',
      mode, clients, 'New', '', safe_(clean_(p.page).slice(0, 300)), safe_(clean_(p.referrer).slice(0, 300))
    ]);
  } finally {
    lock.releaseLock();
  }

  if (NOTIFY_EMAIL) {
    try {
      MailApp.sendEmail(NOTIFY_EMAIL, 'New FitBud early-access sign-up',
        name + ' (' + mode + ', ' + clients + ' clients) just joined the list. Open the sheet to follow up.');
    } catch (err) { /* a failed notification must not lose the sign-up */ }
  }
  return json_({ ok: true });
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
  return sheet;
}

function contactType_(v) {
  if (EMAIL_RE.test(v)) return 'email';
  return /^\d{10,13}$/.test(v.replace(/[\s()+-]/g, '')) ? 'phone' : '';
}

function normalise_(v, type) {
  v = String(v || '').trim().toLowerCase();
  if (type === 'email' || type === 'Email') return v;
  var d = v.replace(/\D/g, '');
  return d.length > 10 ? d.slice(-10) : d; // +91 98… and 98… are the same number
}

function clean_(v) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F]/g, ' ').trim();
}

// Stop a value like "=IMPORTXML(...)" from running as a formula in the sheet.
function safe_(v) {
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
