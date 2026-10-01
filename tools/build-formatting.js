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
const urgency = (red, amber, green, none) =>
  `=if(${ready}, '${green}', if(${overdue}, '${red}', if(${paySoon}, '${amber}', '${none}')))`;
const short = f => `=if([$${f}] == '', '-', toLocaleDateString([$${f}]))`;
const text = (txt, style) => ({ elmType: 'span', txtContent: txt, style });
// The checklist labels, reused in the row layout with no current field and no && (see above).
// The "Next:" text is dropped there: the urgency badge and the labels already say it.
const rowChildren = JSON.parse(JSON.stringify(column.children).split('@currentField').join('[$Checklist]')).slice(1);
const markComplete = rowChildren.find(c => c.txtContent === 'Mark complete');
markComplete.style.display = '=' + [`[$Status] == 'Open'`, ...STEPS.map(s => (s[2] === 'bool' ? done(s) : `[$${s[0]}] != 'To do'`))]
  .reduceRight((inner, cond) => `if(${cond}, ${inner}, 'none')`, "'inline-block'");
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
      'border-left': urgency('5px solid #d13438', '5px solid #f7a21b', '5px solid #0e700e', '5px solid #c8c6c4'),
      'background-color': urgency('#fdf3f4', '#fffaf0', '#f3faf3', '#ffffff'),
    },
    children: [
      {
        elmType: 'div',
        style: { display: 'flex', 'flex-wrap': 'wrap', 'align-items': 'baseline', 'column-gap': '12px', width: '100%' },
        children: [
          {
            elmType: 'a',
            txtContent: '[$Title]',
            attributes: { href: "=@currentWeb + '/Lists/PayrollTickets/DispForm.aspx?ID=' + [$ID]", target: '_blank' },
            style: { 'font-weight': '600', 'font-size': '14px', color: '#201f1e', 'text-decoration': 'none' },
          },
          text(urgency('Timecards overdue', 'Payday soon', 'Ready to close', ''), {
            'font-size': '11px', 'font-weight': '600', color: urgency('#a4262c', '#8a5a00', '#0e700e', '#605e5c'),
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
          ...rowChildren,
          // Skip the whole ticket when the client has nothing to pay this period.
          {
            elmType: 'button',
            txtContent: 'No payroll this period',
            attributes: { title: 'Close this ticket: the client has no hours to pay' },
            style: {
              display: "=if([$Status] == 'Open', 'inline-block', 'none')",
              padding: '2px 8px', margin: '2px 4px', 'border-radius': '4px', 'font-size': '12px', cursor: 'pointer',
              border: '1px solid #8a8886', 'background-color': '#ffffff', color: '#605e5c',
            },
            customRowAction: { action: 'setValue', actionInput: { Status: 'No payroll this period' } },
          },
          // Client details pulled from the Clients list (lookup columns).
          text('[$Client_x003a_Contact]', { 'margin-left': 'auto', 'padding-left': '12px', 'font-size': '12px', color: '#605e5c' }),
          text('[$Client_x003a_Phone]', { 'padding-left': '12px', 'font-size': '12px', color: '#605e5c' }),
          text('[$Report_x0020_delivery]', { 'padding-left': '12px', 'font-size': '12px', color: '#605e5c' }),
        ],
      },
    ],
  },
};

const out = path.join(__dirname, '..', 'payroll-tickets-lists', 'formatting');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'checklist-column.json'), JSON.stringify(column, null, 2) + '\n');
fs.writeFileSync(path.join(out, 'todo-view.json'), JSON.stringify(rows, null, 2) + '\n');
console.log(`Wrote ${out}`);
