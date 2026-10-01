#!/usr/bin/env node
/**
 * Builds the SharePoint JSON formatting for the Payroll Tickets "To do" view.
 *
 *   node tools/build-formatting.js
 *
 * Writes (no client data, safe to commit):
 *   payroll-tickets-lists/formatting/checklist-column.json
 *     Paste into Payroll Tickets → column "Checklist" → Column settings → Format this column
 *     → Advanced mode (or the classic column settings page's "Column Formatting" box).
 *     Shows the next step, then one clickable label per step that applies to the ticket
 *     (steps set to N/A are hidden). Clicking a label toggles it done / not done. When
 *     every step is done a "Mark complete" button appears and sets Status = Complete.
 *   payroll-tickets-lists/formatting/todo-view.json
 *     Paste into the "To do" view → Format current view → Advanced mode.
 *     Red row: timecards not in and past the due date. Amber: payday within 2 days.
 *     Green: every step done ("Ready to close").
 *
 * Step order matches the "Checklist" calculated column's formula (the next step it names).
 */

const fs = require('fs');
const path = require('path');

// [internal name, label, kind] in working order. 'bool' = Yes/No, 'choice' = To do/Done/N/A.
const STEPS = [
  ['TimecardsIn', 'Timecards', 'bool'],
  ['SendForApproval', 'Send for approval', 'choice'],
  ['SendPreviewForApproval', 'Preview approval', 'choice'],
  ['PayrollDone', 'Payroll', 'bool'],
  ['ACH', 'ACH', 'choice'],
  ['JobCostReport', 'Job cost report', 'choice'],
  ['Report', 'Report', 'choice'],
  ['CouncilOnAgingReport', 'Council on Aging', 'choice'],
  ['ReportSent', 'Send report', 'choice'],
  ['BillingDone', 'Billing', 'bool'],
];

const done = ([f, , kind]) => (kind === 'bool' ? `[$${f}] == true` : `[$${f}] == 'Done'`);
// Yes/No steps always apply; choice steps are hidden when N/A.
const display = ([f, , kind]) => (kind === 'bool' ? 'inline-block' : `=if([$${f}] != 'N/A', 'inline-block', 'none')`);
const toggle = ([f, , kind]) => (kind === 'bool' ? `=if([$${f}] == true, 'false', 'true')` : `=if([$${f}] == 'Done', 'To do', 'Done')`);
const allDone = STEPS.map(s => (s[2] === 'bool' ? done(s) : `[$${s[0]}] != 'To do'`)).join(' && ');

const chip = step => {
  const [f, label] = step;
  const d = done(step);
  return {
    elmType: 'button', // setValue row actions are documented on buttons
    txtContent: `=if(${d}, '✓ ', '○ ') + '${label}'`,
    attributes: { title: `=if(${d}, 'Done: click to undo', 'Click when done')` },
    style: {
      display: display(step),
      padding: '2px 8px',
      margin: '2px 4px 2px 0',
      'border-radius': '12px',
      'font-size': '12px',
      'line-height': '18px',
      cursor: 'pointer',
      'white-space': 'nowrap',
      'background-color': `=if(${d}, '#dff6dd', '#ffffff')`,
      color: `=if(${d}, '#0e700e', '#323130')`,
      border: `=if(${d}, '1px solid #9fd89f', '1px solid #8a8886')`,
    },
    customRowAction: { action: 'setValue', actionInput: { [f]: toggle(step) } },
  };
};

const column = {
  $schema: 'https://developer.microsoft.com/json-schemas/sp/v2/column-formatting.schema.json',
  elmType: 'div',
  style: { display: 'flex', 'flex-wrap': 'wrap', 'align-items': 'center', padding: '4px 0' },
  children: [
    {
      elmType: 'div',
      txtContent: "=if(@currentField == 'Ready to close', 'All done', if(@currentField == 'Closed', 'Closed', 'Next: ' + @currentField))",
      style: {
        'font-weight': '600',
        'font-size': '12px',
        'margin-right': '8px',
        'min-width': '130px',
        color: "=if(@currentField == 'Ready to close', '#0e700e', '#323130')",
      },
    },
    ...STEPS.map(chip),
    {
      elmType: 'button',
      txtContent: 'Mark complete',
      attributes: { title: 'Every step is done: close this ticket' },
      style: {
        display: `=if([$Status] == 'Open' && ${allDone}, 'inline-block', 'none')`,
        padding: '3px 10px',
        margin: '2px 0 2px 4px',
        'border-radius': '4px',
        border: 'none',
        cursor: 'pointer',
        'font-size': '12px',
        'font-weight': '600',
        color: '#ffffff',
        'background-color': '#0e700e',
      },
      customRowAction: { action: 'setValue', actionInput: { Status: 'Complete' } },
    },
  ],
};

// Full-row layout for the "To do" view. The view must include Status and every step column
// (setValue only saves fields that are in the view); column headers are hidden so they don't show.
const DAY = 24 * 60 * 60 * 1000;
// The view's CustomFormatter is stored as XML, so view JSON must avoid & and < characters:
// conditions are nested ifs (no &&) and comparisons are written with >.
const overdue = `if([$TimecardsIn] == false, if(Number([$DueDate]) > 0, if(Number(@now) > Number([$DueDate]), 1, 0), 0), 0) == 1`;
const paySoon = `if(Number([$PayDate]) > 0, if(${2 * DAY} > Number([$PayDate]) - Number(@now), 1, 0), 0) == 1`;
const ready = `[$Checklist] == 'Ready to close'`;
// np: shown when the ticket's "No payroll this period" box is ticked.
const urgency = (red, amber, green, none, np = none) =>
  `=if([$NoPayroll] == true, '${np}', if(${ready}, '${green}', if(${overdue}, '${red}', if(${paySoon}, '${amber}', '${none}'))))`;
const short = f => `=if([$${f}] == '', '-', toLocaleDateString([$${f}]))`;
// "Label: value" pair, e.g. Phone: 360-0000.
const labelled = (label, field) => ({
  elmType: 'span',
  style: { 'padding-left': '14px', 'font-size': '12px', color: '#605e5c' },
  children: [{ elmType: 'span', txtContent: label + ': ', style: { 'font-weight': '600', color: '#323130' } }, { elmType: 'span', txtContent: '[$' + field + ']' }],
});
const text = (txt, style) => ({ elmType: 'span', txtContent: txt, style });
// The checklist labels, reused in the row layout with no current field and no && (see above).
// The "Next:" text is dropped there: the urgency badge and the labels already say it.
const rowChildren = JSON.parse(JSON.stringify(column.children).split('@currentField').join('[$Checklist]')).slice(1);
const markComplete = rowChildren.find(c => c.txtContent === 'Mark complete');
// Shown when every step is done, or straight away when the ticket is marked "No payroll this period".
const stepsDone = STEPS.map(s => (s[2] === 'bool' ? done(s) : `[$${s[0]}] != 'To do'`))
  .reduceRight((inner, cond) => `if(${cond}, ${inner}, 'none')`, "'inline-block'");
markComplete.style.display = `=if([$Status] == 'Open', if([$NoPayroll] == true, 'inline-block', ${stepsDone}), 'none')`;
// Two lines per ticket: title, badge and dates on the first; step labels on the second.
const rows = {
  $schema: 'https://developer.microsoft.com/json-schemas/sp/v2/row-formatting.schema.json',
  hideSelection: true,
  hideColumnHeader: true,
  rowFormatter: {
    elmType: 'div',
    style: {
      display: 'block',
      width: '100%',
      'box-sizing': 'border-box',
      padding: '4px 12px',
      'border-bottom': '1px solid #edebe9',
      'border-left': urgency('5px solid #d13438', '5px solid #f7a21b', '5px solid #0e700e', '5px solid #c8c6c4', '5px solid #8a8886'),
      'background-color': urgency('#fdf3f4', '#fffaf0', '#f3faf3', '#ffffff', '#f3f2f1'),
    },
    children: [
      {
        elmType: 'div',
        style: { display: 'flex', 'flex-wrap': 'wrap', 'align-items': 'baseline', 'column-gap': '12px', width: '100%' },
        children: [
          {
            elmType: 'button', // opens the editable ticket in the side panel, same tab (checkboxes show without extra clicks)
            txtContent: '[$Title]',
            customRowAction: { action: 'editProps' },
            style: { 'font-weight': '600', 'font-size': '14px', color: '#201f1e', border: 'none', 'background-color': 'transparent', padding: '0', cursor: 'pointer', 'text-align': 'left' },
          },
          text(urgency('Timecards overdue', 'Payday soon', 'Ready to close', '', 'No payroll this period'), {
            'font-size': '11px', 'font-weight': '600', color: urgency('#a4262c', '#8a5a00', '#0e700e', '#605e5c', '#323130'),
          }),
          text("='Due ' + " + short('DueDate').slice(1) + " + '  Pay ' + " + short('PayDate').slice(1) +
            " + '  ' + if([$AssignedTo] == '', 'Unassigned', [$AssignedTo.title])",
            { 'font-size': '12px', color: '#605e5c' }),
        ],
      },
      {
        elmType: 'div',
        style: { display: 'flex', 'flex-wrap': 'wrap', 'align-items': 'center', width: '100%' },
        children: [
          // Fixed-width step labels in a 370px box: two per row (the grid style is not supported in views).
          { elmType: 'div', style: { display: 'flex', 'flex-wrap': 'wrap', width: '370px' }, children: rowChildren.filter(c => c !== markComplete).map(c => ({ ...c, style: { ...c.style, width: '172px', 'text-align': 'center', 'box-sizing': 'border-box' } })) },
          markComplete,
          // Client details pulled from the Clients list (lookup columns).
          { elmType: 'div', style: { 'margin-left': 'auto' } },
          labelled('Contact', 'Client_x003a_Contact'),
          labelled('Phone', 'Client_x003a_Phone'),
          labelled('Report', 'Report_x0020_delivery'),
        ],
      },
    ],
  },
};

// Larger rows for the To do view: bigger text, labels and spacing.
const SIZES = { '11px': '13px', '12px': '14px', '13px': '14px', '14px': '17px' };
const PADS = { '4px 12px': '10px 16px', '2px 8px': '4px 12px', '3px 10px': '6px 14px', '2px 4px 2px 0': '4px 6px 4px 0', '2px 4px': '4px 6px', '2px 0 2px 4px': '4px 0 4px 6px' };
(function enlarge(n) {
  if (Array.isArray(n)) return n.forEach(enlarge);
  if (!n || typeof n !== 'object') return;
  if (n.style) {
    if (SIZES[n.style['font-size']]) n.style['font-size'] = SIZES[n.style['font-size']];
    if (n.style['line-height']) n.style['line-height'] = '20px';
    for (const k of ['padding', 'margin']) if (PADS[n.style[k]]) n.style[k] = PADS[n.style[k]];
    if (n.style['border-radius'] === '12px') n.style['border-radius'] = '16px';
    if (n.style['column-gap']) n.style['column-gap'] = '20px';
  }
  Object.values(n).forEach(enlarge);
})(rows);

const out = path.join(__dirname, '..', 'payroll-tickets-lists', 'formatting');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'checklist-column.json'), JSON.stringify(column, null, 2) + '\n');
fs.writeFileSync(path.join(out, 'todo-view.json'), JSON.stringify(rows, null, 2) + '\n');
console.log(`Wrote ${out}`);
