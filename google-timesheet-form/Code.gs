/**
 * Client Timesheet Form — Google Forms + Apps Script (free, no sign-in for clients)
 *
 * Builds a public Google Form where clients enter two-week hours for their
 * employees, and emails you a CSV for every submission in this layout
 * (one row per employee):
 *
 *   Client,PayPeriodStart,EmployeeName,Mon1Hours..Sun1Hours,Mon2Hours..Sun2Hours,
 *   Week1Total,Week2Total,TotalHours,Comments
 *
 * One-time setup:
 *   1. Go to https://script.google.com → New project. Paste this file over Code.gs.
 *   2. Edit CONFIG below (your clients and, optionally, their employees).
 *   3. Pick `setup` in the function dropdown → Run → approve the permissions prompt.
 *   4. The form link and one pre-filled link per client are printed in the
 *      Execution log and emailed to you.
 *   5. Open a client link in a private/incognito window and submit a test to
 *      confirm it needs no sign-in and that the CSV email arrives.
 *
 * Later:
 *   - Added/changed clients in CONFIG → run `generateClientLinks` (same form, new links).
 *   - Want to re-send the CSV for the latest submission → run `resendLatestSubmission`.
 *   - Changed MAX_EMPLOYEES → run `setup` again (creates a new form; old links stop
 *     emailing you, so send clients the new ones).
 */

const CONFIG = {
  FORM_TITLE: 'Employee Hours Submission',
  // Where CSVs are sent. Blank = the Google account that owns this script.
  NOTIFY_EMAIL: '',
  // Most employees a single submission can hold (each one is a page of the form).
  // Keep this at or below ~12 so `setup` finishes within Apps Script's 6-minute limit.
  MAX_EMPLOYEES: 10,
  // Client name → employee names to pre-fill on that client's link (may be empty).
  CLIENTS: {
    'Example Client A': ['Example Employee 1', 'Example Employee 2'],
    'Example Client B': [],
  },
};

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const HOUR_COLUMNS = [1, 2].flatMap(week => DAY_NAMES.map(day => `${day.slice(0, 3)}${week}Hours`));
const CSV_HEADER = ['Client', 'PayPeriodStart', 'EmployeeName', ...HOUR_COLUMNS,
  'Week1Total', 'Week2Total', 'TotalHours', 'Comments'];
const ADD_ANOTHER_YES = 'Yes';
const ADD_ANOTHER_NO = 'No, submit now';
const TRIGGER_HANDLER = 'onTimesheetSubmit';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

function setup() {
  const form = FormApp.create(CONFIG.FORM_TITLE)
      .setDescription('Enter the hours each employee worked in the two-week pay period. ' +
                      'No sign-in needed. Leave a day blank if they did not work it.')
      .setCollectEmail(false)
      .setLimitOneResponsePerUser(false)  // true would force respondents to sign in
      .setAllowResponseEdits(false)
      .setProgressBar(true)
      .setConfirmationMessage('Thanks, your hours have been submitted.');
  try { form.setRequireLogin(false); } catch (err) { /* only exists on Workspace accounts */ }
  try { if (form.setPublished) form.setPublished(true); } catch (err) { /* older API */ }

  const clientItem = form.addTextItem().setTitle('Client / company name').setRequired(true);
  const periodItem = form.addDateItem()
      .setTitle('Pay period start date')
      .setHelpText('The Monday the two-week pay period begins.')
      .setRequired(true);

  const hoursValidation = FormApp.createTextValidation()
      .setHelpText('Enter a number from 0 to 24 (e.g. 7.5).')
      .requireNumberBetween(0, 24)
      .build();

  const slots = [];
  for (let n = 1; n <= CONFIG.MAX_EMPLOYEES; n++) {
    const page = form.addPageBreakItem().setTitle(`Employee ${n}`);
    const name = form.addTextItem().setTitle('Employee name').setRequired(true);
    const hours = [];
    [1, 2].forEach(week => DAY_NAMES.forEach(day => {
      hours.push(form.addTextItem().setTitle(`Week ${week} – ${day}`).setValidation(hoursValidation));
    }));
    const comments = form.addParagraphTextItem().setTitle('Comments (optional)');
    const more = n < CONFIG.MAX_EMPLOYEES
        ? form.addMultipleChoiceItem().setTitle('Add another employee?').setRequired(true)
        : null;
    slots.push({ page, name, hours, comments, more });
  }
  // Choices can only point at a page once that page exists, so wire them up last.
  slots.forEach((slot, i) => {
    if (!slot.more) return;
    slot.more.setChoices([
      slot.more.createChoice(ADD_ANOTHER_YES, slots[i + 1].page),
      slot.more.createChoice(ADD_ANOTHER_NO, FormApp.PageNavigationType.SUBMIT),
    ]);
  });

  saveMap_({
    formId: form.getId(),
    client: clientItem.getId(),
    period: periodItem.getId(),
    slots: slots.map(s => ({
      name: s.name.getId(),
      hours: s.hours.map(h => h.getId()),
      comments: s.comments.getId(),
      more: s.more ? s.more.getId() : null,
    })),
  });

  ScriptApp.getProjectTriggers()
      .filter(t => t.getHandlerFunction() === TRIGGER_HANDLER)
      .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger(TRIGGER_HANDLER).forForm(form).onFormSubmit().create();

  Logger.log('Form editor: ' + form.getEditUrl());
  generateClientLinks();
}

function generateClientLinks() {
  const map = loadMap_();
  const form = FormApp.openById(map.formId);
  const sections = Object.entries(CONFIG.CLIENTS).map(([client, employees]) => {
    const prefill = form.createResponse()
        .withItemResponse(form.getItemById(map.client).asTextItem().createResponse(client));
    const listed = employees.slice(0, map.slots.length);
    listed.forEach((employee, i) => {
      const slot = map.slots[i];
      prefill.withItemResponse(form.getItemById(slot.name).asTextItem().createResponse(employee));
      if (slot.more) {
        const answer = i < listed.length - 1 ? ADD_ANOTHER_YES : ADD_ANOTHER_NO;
        prefill.withItemResponse(form.getItemById(slot.more).asMultipleChoiceItem().createResponse(answer));
      }
    });
    const note = employees.length > listed.length
        ? ` (only the first ${listed.length} employees fit; raise MAX_EMPLOYEES)` : '';
    return `${client}${note}\n${prefill.toPrefilledUrl()}`;
  });

  const body = `Blank form (no client pre-filled):\n${form.getPublishedUrl()}\n\n` +
               `Client links:\n\n${sections.join('\n\n')}\n`;
  Logger.log(body);
  MailApp.sendEmail(notifyEmail_(), `${CONFIG.FORM_TITLE}: client links`, body);
}

// ---------------------------------------------------------------------------
// Submission → CSV email
// ---------------------------------------------------------------------------

function onTimesheetSubmit(e) {
  emailResponse_(e.response);
}

function resendLatestSubmission() {
  const responses = FormApp.openById(loadMap_().formId).getResponses();
  if (!responses.length) throw new Error('No submissions yet.');
  emailResponse_(responses[responses.length - 1]);
}

function emailResponse_(response) {
  const answers = {};
  response.getItemResponses().forEach(ir => { answers[ir.getItem().getId()] = ir.getResponse(); });
  const submitted = Utilities.formatDate(response.getTimestamp(), Session.getScriptTimeZone(),
                                         'yyyy-MM-dd HH:mm');
  try {
    const submission = parseSubmission_(answers, loadMap_());
    const csv = toCsv_([CSV_HEADER, ...buildRows_(submission)]);
    const fileName = `timesheet_${slug_(submission.client)}_${submission.periodStart}.csv`;
    MailApp.sendEmail({
      to: notifyEmail_(),
      subject: `Timesheet: ${submission.client}, pay period ${submission.periodStart}`,
      body: summaryText_(submission, submitted),
      attachments: [Utilities.newBlob(csv, 'text/csv', fileName)],
    });
  } catch (err) {
    // Never lose a submission silently: send the raw answers so it can be handled by hand.
    MailApp.sendEmail(notifyEmail_(), `Timesheet submission FAILED to convert (${submitted})`,
                      `${err.stack || err}\n\nRaw answers:\n${JSON.stringify(answers, null, 2)}`);
    throw err;
  }
}

/** answers: { itemId: responseValue }. Returns { client, periodStart, employees[] }. */
function parseSubmission_(answers, map) {
  const text = id => (answers[id] == null ? '' : String(answers[id]).trim());
  const employees = [];
  for (const slot of map.slots) {
    const name = text(slot.name);
    if (!name) break;
    employees.push({
      name,
      hours: slot.hours.map(id => toHours_(text(id))),
      comments: text(slot.comments),
    });
    if (text(slot.more) !== ADD_ANOTHER_YES) break;
  }
  return { client: text(map.client), periodStart: text(map.period), employees };
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
  // Public form input: stop Excel treating a cell like "=HYPERLINK(...)" as a formula.
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function summaryText_(submission, submitted) {
  const lines = buildRows_(submission).map(row =>
      `  ${row[2]}: week 1 ${row[17]}h, week 2 ${row[18]}h, total ${row[19]}h`);
  const warning = isMonday_(submission.periodStart) ? '' :
      `\nWARNING: ${submission.periodStart} is not a Monday, so the Mon1..Sun2 columns ` +
      `may not line up with the real dates.\n`;
  return `Client: ${submission.client}\nPay period start: ${submission.periodStart}\n` +
         `Submitted: ${submitted}\n${warning}\n${lines.join('\n')}\n\nCSV attached.`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toHours_(value) {
  const n = parseFloat(value);
  return isFinite(n) ? n : 0;
}

function round2_(n) {
  return Math.round(n * 100) / 100;
}

function isMonday_(isoDate) {
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, m - 1, d).getDay() === 1;
}

function slug_(s) {
  return s.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'client';
}

function notifyEmail_() {
  return CONFIG.NOTIFY_EMAIL || Session.getEffectiveUser().getEmail();
}

function saveMap_(map) {
  PropertiesService.getScriptProperties().setProperty('FORM_MAP', JSON.stringify(map));
}

function loadMap_() {
  const raw = PropertiesService.getScriptProperties().getProperty('FORM_MAP');
  if (!raw) throw new Error('Run setup first.');
  return JSON.parse(raw);
}
