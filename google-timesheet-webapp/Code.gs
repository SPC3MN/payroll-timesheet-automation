/**
 * Client Timesheet Web App — Google Apps Script (free, no sign-in for clients)
 *
 * A compact, phone-friendly page: each employee is one card with two 7-day rows and
 * live Week 1 / Week 2 / period totals. Every submission emails you a CSV in this
 * layout (one row per employee):
 *
 *   Client,PayPeriodStart,EmployeeName,Mon1Hours..Sun1Hours,Mon2Hours..Sun2Hours,
 *   Week1Total,Week2Total,TotalHours,Comments
 *
 * A pay period can start on any day. "Week 1" is the first 7 days from PayPeriodStart
 * and "Week 2" the next 7; each week holds every weekday exactly once, so Mon1Hours is
 * the Monday that falls in week 1, and so on.
 *
 * One-time setup:
 *   1. script.google.com → New project. Paste this file over Code.gs.
 *      Then File (+) → HTML → name it `Index` and paste Index.html into it.
 *   2. Edit CONFIG below (your clients, their pay schedules and employees).
 *   3. Deploy → New deployment → type "Web app":
 *        Execute as: Me    Who has access: Anyone
 *      Approve the permissions prompt, then copy the Web app URL (ends in /exec).
 *   4. Paste that URL into CONFIG.WEB_APP_URL, save, pick `generateClientLinks` in
 *      the function dropdown → Run. Client links are logged and emailed to you.
 *   5. Open a client link in a private/incognito window and submit a test.
 *
 * Any later code or CONFIG change (e.g. adding a client) only reaches clients after
 * Deploy → Manage deployments → ✎ Edit → Version: "New version" → Deploy.
 * The URL stays the same. Then run `generateClientLinks` for the new client's link.
 * Removing a client from CONFIG (and redeploying) turns their link off.
 */

const CONFIG = {
  TITLE: 'Employee Hours Submission',
  // Where CSVs are sent. Blank = the Google account that owns this script.
  NOTIFY_EMAIL: '',
  // The deployment's Web app URL (ends in /exec). Used only to build client links.
  WEB_APP_URL: '',
  // Allow the plain URL (no client code), where the submitter types the client name.
  ALLOW_BLANK_LINK: true,
  // Most employees one submission can hold.
  MAX_EMPLOYEES: 50,
  // One entry per client:
  //   payPeriodStart: the first day of any one of their two-week pay periods (YYYY-MM-DD).
  //     The page repeats it every 14 days and opens on the latest period that has ended.
  //     Leave it out and the client picks the start date themselves.
  //   employees: names pre-filled on that client's page (may be empty).
  CLIENTS: {
    'Example Client A': { payPeriodStart: '2026-01-07', employees: ['Example Employee 1', 'Example Employee 2'] },
    'Example Client B': { payPeriodStart: '2026-01-02', employees: [] },
  },
};

const HOUR_COLUMNS = [1, 2].flatMap(week =>
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => `${day}${week}Hours`));
const CSV_HEADER = ['Client', 'PayPeriodStart', 'EmployeeName', ...HOUR_COLUMNS,
  'Week1Total', 'Week2Total', 'TotalHours', 'Comments'];

// ---------------------------------------------------------------------------
// Web app (every function without a trailing _ can be called from the page,
// so admin functions check that the script owner is the one running them)
// ---------------------------------------------------------------------------

function doGet(e) {
  const token = String((e && e.parameter && e.parameter.c) || '').trim();
  const client = token ? clientForToken_(token) : '';
  let blocked = '';
  if (token && !client) blocked = 'This link is no longer active. Please ask for a new one.';
  if (!token && !CONFIG.ALLOW_BLANK_LINK) blocked = 'Please use the link you were sent.';

  const settings = client ? clientSettings_(client) : { payPeriodStart: '', employees: [] };
  const page = HtmlService.createTemplateFromFile('Index');
  page.boot = JSON.stringify({
    title: CONFIG.TITLE,
    token: client ? token : '',
    client,
    employees: settings.employees,
    anchor: settings.payPeriodStart,
    maxEmployees: CONFIG.MAX_EMPLOYEES,
    blocked,
  }).replace(/</g, '\\u003c');
  return page.evaluate()
      .setTitle(CONFIG.TITLE)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Called from the page. Throws an Error whose message is shown to the submitter. */
function submitTimesheet(payload) {
  payload = payload || {};
  let client;
  if (payload.token) {
    client = clientForToken_(String(payload.token));
    if (!client) throw new Error('This link is no longer active. Please ask for a new one.');
  } else {
    if (!CONFIG.ALLOW_BLANK_LINK) throw new Error('Please use the link you were sent.');
    client = String(payload.clientName || '').trim().slice(0, 100);
  }
  const submission = normalizeSubmission_(payload, client);
  const rows = buildRows_(submission);
  const submitted = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm');
  const source = payload.token ? 'client link' : 'blank link (client name typed by submitter)';
  const anchor = payload.token ? clientSettings_(client).payPeriodStart : '';

  MailApp.sendEmail({
    to: notifyEmail_(),
    subject: `Timesheet: ${submission.client}, pay period ${submission.periodStart}`,
    body: summaryText_(submission, rows, submitted, source, anchor),
    attachments: [Utilities.newBlob(toCsv_([CSV_HEADER, ...rows]), 'text/csv',
        `timesheet_${slug_(submission.client)}_${submission.periodStart}.csv`)],
  });
  return { employees: rows.length, totalHours: round2_(rows.reduce((sum, r) => sum + r[19], 0)) };
}

function generateClientLinks() {
  assertOwner_();
  const url = CONFIG.WEB_APP_URL || ScriptApp.getService().getUrl();
  if (!url) throw new Error('Deploy the web app first, then paste its URL into CONFIG.WEB_APP_URL.');
  Object.keys(CONFIG.CLIENTS).forEach(client => {
    const start = clientSettings_(client).payPeriodStart;
    if (start && !parseIsoDate_(start)) {
      throw new Error(`${client}: payPeriodStart "${start}" is not a date in YYYY-MM-DD form.`);
    }
  });

  const tokens = loadTokens_();
  Object.keys(CONFIG.CLIENTS).forEach(client => {
    if (!tokens[client]) tokens[client] = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
  });
  PropertiesService.getScriptProperties().setProperty('CLIENT_TOKENS', JSON.stringify(tokens));

  const links = Object.keys(CONFIG.CLIENTS).map(client => `${client}\n${url}?c=${tokens[client]}`);
  const blank = CONFIG.ALLOW_BLANK_LINK ? `Blank link (client types their name):\n${url}\n\n` : '';
  const body = `${blank}Client links:\n\n${links.join('\n\n')}\n`;
  Logger.log(body);
  MailApp.sendEmail(notifyEmail_(), `${CONFIG.TITLE}: client links`, body);
}

// ---------------------------------------------------------------------------
// Submission → CSV
// ---------------------------------------------------------------------------

/**
 * Re-validates everything server-side: the page's checks can be bypassed.
 * payload.employees[].hours are 14 values in date order from periodStart; they are
 * returned in CSV column order (Mon..Sun of week 1, then Mon..Sun of week 2).
 */
function normalizeSubmission_(payload, client) {
  if (!client) throw new Error('Please enter the client / company name.');
  const periodStart = String(payload.periodStart || '');
  const start = parseIsoDate_(periodStart);
  if (!start) throw new Error('Please choose the pay period start date.');

  const list = Array.isArray(payload.employees) ? payload.employees : [];
  if (!list.length) throw new Error('Add at least one employee.');
  if (list.length > CONFIG.MAX_EMPLOYEES) {
    throw new Error(`A submission can hold up to ${CONFIG.MAX_EMPLOYEES} employees.`);
  }
  const employees = list.map((emp, i) => {
    const name = String((emp && emp.name) || '').trim().slice(0, 100);
    if (!name) throw new Error(`Employee ${i + 1} needs a name.`);
    const hours = Array.isArray(emp.hours) ? emp.hours.map(h => (h === '' || h == null ? 0 : Number(h))) : [];
    if (hours.length !== 14 || hours.some(h => !isFinite(h) || h < 0 || h > 24)) {
      throw new Error(`Check the hours for ${name}: each day must be a number from 0 to 24.`);
    }
    return { name, hours: toWeekdayColumns_(start, hours.map(round2_)),
             comments: String(emp.comments || '').trim().slice(0, 1000) };
  });
  return { client, periodStart, employees };
}

/** Date-ordered hours → Mon..Sun per week. Each 7-day week has every weekday once. */
function toWeekdayColumns_(start, hours) {
  const columns = new Array(14).fill(0);
  hours.forEach((h, i) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const mondayBased = (date.getDay() + 6) % 7;
    columns[(i < 7 ? 0 : 7) + mondayBased] = h;
  });
  return columns;
}

function buildRows_(submission) {
  return submission.employees.map(emp => {
    const week1 = round2_(emp.hours.slice(0, 7).reduce((a, b) => a + b, 0));
    const week2 = round2_(emp.hours.slice(7).reduce((a, b) => a + b, 0));
    return [submission.client, submission.periodStart, emp.name, ...emp.hours,
            week1, week2, round2_(week1 + week2), emp.comments];
  });
}

function toCsv_(rows) {
  return rows.map(row => row.map(csvCell_).join(',')).join('\r\n') + '\r\n';
}

function csvCell_(value) {
  let s = String(value);
  // Public input: stop Excel treating a cell like "=HYPERLINK(...)" as a formula.
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function summaryText_(submission, rows, submitted, source, anchor) {
  const start = parseIsoDate_(submission.periodStart);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 13);
  const fmt = d => Utilities.formatDate(d, Session.getScriptTimeZone(), 'EEE MMM d, yyyy');
  const lines = rows.map(row => `  ${row[2]}: week 1 ${row[17]}h, week 2 ${row[18]}h, total ${row[19]}h`);
  const anchorDate = anchor ? parseIsoDate_(anchor) : null;
  const offSchedule = anchorDate && ((Math.round((start - anchorDate) / 86400000) % 14) + 14) % 14 !== 0;
  const warning = offSchedule
      ? `\nNOTE: this start date is not on the client's usual pay schedule (repeats every 14 days from ${anchor}).\n`
      : '';
  return `Client: ${submission.client}\nPay period: ${fmt(start)} – ${fmt(end)}\n` +
         `Submitted: ${submitted} via ${source}\n${warning}\n${lines.join('\n')}\n\nCSV attached.`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Accepts the older `'Client': ['Employee', ...]` form as well. */
function clientSettings_(client) {
  const entry = CONFIG.CLIENTS[client];
  if (Array.isArray(entry)) return { payPeriodStart: '', employees: entry };
  return { payPeriodStart: (entry && entry.payPeriodStart) || '', employees: (entry && entry.employees) || [] };
}

function clientForToken_(token) {
  const tokens = loadTokens_();
  const client = Object.keys(tokens).find(name => tokens[name] === token);
  return client && Object.prototype.hasOwnProperty.call(CONFIG.CLIENTS, client) ? client : '';
}

function loadTokens_() {
  return JSON.parse(PropertiesService.getScriptProperties().getProperty('CLIENT_TOKENS') || '{}');
}

function assertOwner_() {
  const active = Session.getActiveUser().getEmail();
  if (!active || active !== Session.getEffectiveUser().getEmail()) {
    throw new Error('Run this from the Apps Script editor.');
  }
}

/** "YYYY-MM-DD" → local Date, or null if it isn't a real date. */
function parseIsoDate_(isoDate) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return null;
  const date = new Date(+m[1], m[2] - 1, +m[3]);
  return date.getMonth() === m[2] - 1 && date.getDate() === +m[3] ? date : null;
}

function round2_(n) {
  return Math.round(n * 100) / 100;
}

function slug_(s) {
  return s.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'client';
}

function notifyEmail_() {
  return CONFIG.NOTIFY_EMAIL || Session.getEffectiveUser().getEmail();
}
