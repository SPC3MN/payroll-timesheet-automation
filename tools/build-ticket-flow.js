#!/usr/bin/env node
/**
 * Builds the "create payroll tickets" Power Automate flow as an import package
 * (Power Automate → My flows → Import → Import Package (Legacy)).
 *
 *   node tools/build-ticket-flow.js
 *
 * Reads local/flow-config.json (gitignored: it holds the tenant's site URL and list IDs):
 *   { "flowName", "siteUrl", "clientsListId", "ticketsListId", "timeZone", "runHour",
 *     "biweeklyAnchor": "YYYY-MM-DD" (any Monday a biweekly period started on),
 *     "dueDaysBeforePay", "defaultPayDay",
 *     "testRunDate": "" (or "YYYY-MM-DD" to make a manual run act as that week),
 *     "sharePointConnectionName": the SharePoint connection to use (from any exported flow) }
 * Writes local/definition.json (readable copy) and local/CreatePayrollTickets.zip.
 *
 * What the flow does, every week (default Monday 06:00): for each active client and each of
 * its Frequency values, work out whether a pay period for that schedule ended in the last
 * week. If so, create a ticket unless one with the same TicketKey already exists. The run
 * date R is the Monday of the current week, so a manual run any day that week behaves the same.
 *
 * Schedules (placeholders until the payroll staff confirm them):
 *   Weekly        period R-7 .. R-1 (Mon–Sun), paid R+4 (Friday)
 *   Biweekly      every 14 days from biweeklyAnchor: period R-14 .. R-1, paid R+4
 *   Semi-monthly  1st–15th paid the 20th; 16th–month end paid the 5th of the next month;
 *                 ticketed the Monday after the period ends
 *   Monthly       previous calendar month, ticketed the Monday on/after the 1st,
 *                 paid on the client's MonthlyPayDay (defaultPayDay if blank; capped at 28)
 *   Quarterly     previous quarter, ticketed the Monday on/after 1 Jan/Apr/Jul/Oct, same pay day
 *   DueDate = PayDate - dueDaysBeforePay.
 *
 * SharePoint internal names used (Clients list was created by a CSV import):
 *   Clients: ID, Title, field_0 Company, field_4 Frequency, field_6 ReportDelivery,
 *            field_8..field_13 client-specific steps, field_15 Active, MonthlyPayDay
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const LOCAL = path.join(__dirname, '..', 'local');
const cfg = JSON.parse(fs.readFileSync(path.join(LOCAL, 'flow-config.json'), 'utf8'));

const SP = '/providers/Microsoft.PowerApps/apis/shared_sharepointonline';
const sp = (operationId, parameters) => ({
  type: 'OpenApiConnection',
  inputs: {
    host: { apiId: SP, connectionName: 'shared_sharepointonline', operationId },
    parameters,
    authentication: "@parameters('$authentication')",
  },
});
const setVar = (name, value) => ({ type: 'SetVariable', inputs: { name, value } });

/** Chains actions in order: each runs after the one before it. */
function seq(pairs, firstRunAfter = {}) {
  const out = {};
  pairs.forEach(([name, action], i) => {
    out[name] = { ...action, runAfter: i === 0 ? firstRunAfter : { [pairs[i - 1][0]]: ['Succeeded'] } };
  });
  return out;
}

// ---------------------------------------------------------------------------
// Expressions (R = the run week's Monday, as yyyy-MM-dd)
// ---------------------------------------------------------------------------
const R = "outputs('RunDate')";
const d = expr => `formatDateTime(${expr}, 'yyyy-MM-dd')`;
const plus = (n) => d(`addDays(${R}, ${n})`);
const client = f => `items('For_each_client')?['${f}']`;
const schedule = "items('For_each_schedule')?['Value']";
const payDay = `min(int(coalesce(${client('MonthlyPayDay')}, ${cfg.defaultPayDay})), 28)`;

const today = `convertFromUtc(utcNow(), '${cfg.timeZone}', 'yyyy-MM-dd')`;
const monday = d(`addDays(${today}, mul(-1, mod(add(dayOfWeek(${today}), 6), 7)))`);

// Semi-monthly: A = the 15th fell in the last week; B = a month end fell in the last week.
const d15 = `concat(formatDateTime(addDays(${R}, -1), 'yyyy-MM'), '-15')`;
const semiA = `and(greaterOrEquals(ticks(${d15}), ticks(addDays(${R}, -7))), lessOrEquals(ticks(${d15}), ticks(addDays(${R}, -1))))`;
const monthEnd = d(`addDays(startOfMonth(${R}), -1)`);
const semiB = `greaterOrEquals(ticks(${monthEnd}), ticks(addDays(${R}, -7)))`;

// Monthly / quarterly: the 1st of R's month fell within R-6 .. R.
const first = d(`startOfMonth(${R})`);
const firstInWeek = `greaterOrEquals(ticks(${first}), ticks(addDays(${R}, -6)))`;
const quarterStartMonth = `contains(createArray(1, 4, 7, 10), int(formatDateTime(${R}, 'MM')))`;
const monthlyPay = d(`addDays(${first}, sub(${payDay}, 1))`);

const periodCases = {
  Weekly: [
    `@true`, `@${plus(-7)}`, `@${plus(-1)}`, `@${plus(4)}`],
  Biweekly: [
    `@equals(mod(div(sub(ticks(${R}), ticks('${cfg.biweeklyAnchor}')), 864000000000), 14), 0)`,
    `@${plus(-14)}`, `@${plus(-1)}`, `@${plus(4)}`],
  'Semi-monthly': [
    `@or(${semiA}, ${semiB})`,
    `@if(${semiA}, concat(formatDateTime(addDays(${R}, -1), 'yyyy-MM'), '-01'), concat(formatDateTime(${monthEnd}, 'yyyy-MM'), '-16'))`,
    `@if(${semiA}, ${d15}, ${monthEnd})`,
    `@if(${semiA}, concat(formatDateTime(addDays(${R}, -1), 'yyyy-MM'), '-20'), concat(formatDateTime(${R}, 'yyyy-MM'), '-05'))`],
  Monthly: [
    `@${firstInWeek}`,
    `@${d(`startOfMonth(addDays(${first}, -1))`)}`,
    `@${d(`addDays(${first}, -1)`)}`,
    `@${monthlyPay}`],
  Quarterly: [
    `@and(${firstInWeek}, ${quarterStartMonth})`,
    `@${d(`addToTime(${first}, -3, 'Month')`)}`,
    `@${d(`addDays(${first}, -1)`)}`,
    `@${monthlyPay}`],
};

const cases = {};
for (const [name, [due, start, end, pay]] of Object.entries(periodCases)) {
  cases[`Case_${name.replace(/\W/g, '_')}`] = {
    case: name,
    actions: seq([
      ['Set_IsDue_' + name.replace(/\W/g, '_'), setVar('IsDue', due)],
      ['Set_PeriodStart_' + name.replace(/\W/g, '_'), setVar('PeriodStart', start)],
      ['Set_PeriodEnd_' + name.replace(/\W/g, '_'), setVar('PeriodEnd', end)],
      ['Set_PayDate_' + name.replace(/\W/g, '_'), setVar('PayDate', pay)],
    ]),
  };
}

const step = f => `@if(equals(${client(f)}, true), 'To do', 'N/A')`;
const reportSent = `@if(and(equals(length(${client('field_6')}), 1), equals(first(${client('field_6')})?['Value'], 'None')), 'N/A', 'To do')`;

const createTicket = sp('PostItem', {
  dataset: cfg.siteUrl,
  table: cfg.ticketsListId,
  'item/Title': `@{${client('Title')}} · @{${schedule}} · @{formatDateTime(variables('PeriodStart'), 'MMM d')}–@{formatDateTime(variables('PeriodEnd'), 'MMM d, yyyy')}`,
  'item/Client/Id': `@${client('ID')}`,
  'item/Company/Value': `@first(${client('field_0')})?['Value']`,
  'item/Schedule/Value': `@${schedule}`,
  'item/Status/Value': 'Open',
  'item/PeriodStart': "@variables('PeriodStart')",
  'item/PeriodEnd': "@variables('PeriodEnd')",
  'item/PayDate': "@variables('PayDate')",
  'item/DueDate': `@${d(`addDays(variables('PayDate'), -${cfg.dueDaysBeforePay})`)}`,
  'item/TicketKey': "@outputs('TicketKey')",
  'item/ReportSent/Value': reportSent,
  'item/ACH/Value': step('field_8'),
  'item/JobCostReport/Value': step('field_9'),
  'item/Report/Value': step('field_10'),
  'item/SendPreviewForApproval/Value': step('field_11'),
  'item/SendForApproval/Value': step('field_12'),
  'item/CouncilOnAgingReport/Value': step('field_13'),
});

const whenDue = {
  type: 'If',
  expression: { and: [{ equals: ["@variables('IsDue')", true] }] },
  actions: seq([
    ['TicketKey', { type: 'Compose', inputs: `@{${client('ID')}}-@{${schedule}}-@{variables('PeriodStart')}` }],
    ['Find_existing_ticket', sp('GetItems', {
      dataset: cfg.siteUrl, table: cfg.ticketsListId,
      $filter: "TicketKey eq '@{outputs('TicketKey')}'", $top: 1,
    })],
    ['If_no_ticket_yet', {
      type: 'If',
      expression: { and: [{ equals: ["@length(outputs('Find_existing_ticket')?['body/value'])", 0] }] },
      actions: { Create_ticket: { ...createTicket, runAfter: {} } },
      else: { actions: {} },
    }],
  ]),
  else: { actions: {} },
};

const forEachSchedule = {
  type: 'Foreach',
  foreach: `@${client('field_4')}`,
  runtimeConfiguration: { concurrency: { repetitions: 1 } },
  actions: seq([
    ['Reset_IsDue', setVar('IsDue', false)],
    ['Work_out_period', { type: 'Switch', expression: `@${schedule}`, cases, default: { actions: {} } }],
    ['When_a_period_is_due', whenDue],
  ]),
};

const actions = seq([
  ['TestRunDate', { type: 'Compose', inputs: cfg.testRunDate || '' }],
  ['RunDate', { type: 'Compose', inputs: `@if(empty(outputs('TestRunDate')), ${monday}, outputs('TestRunDate'))` }],
  ['Init_IsDue', { type: 'InitializeVariable', inputs: { variables: [{ name: 'IsDue', type: 'boolean', value: false }] } }],
  ['Init_PeriodStart', { type: 'InitializeVariable', inputs: { variables: [{ name: 'PeriodStart', type: 'string' }] } }],
  ['Init_PeriodEnd', { type: 'InitializeVariable', inputs: { variables: [{ name: 'PeriodEnd', type: 'string' }] } }],
  ['Init_PayDate', { type: 'InitializeVariable', inputs: { variables: [{ name: 'PayDate', type: 'string' }] } }],
  ['Get_active_clients', sp('GetItems', {
    dataset: cfg.siteUrl, table: cfg.clientsListId, $filter: 'field_15 eq 1', $top: 5000,
  })],
  ['For_each_client', {
    type: 'Foreach',
    foreach: "@outputs('Get_active_clients')?['body/value']",
    runtimeConfiguration: { concurrency: { repetitions: 1 } },
    actions: { For_each_schedule: { ...forEachSchedule, runAfter: {} } },
  }],
]);

const definition = {
  $schema: 'https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#',
  contentVersion: '1.0.0.0',
  parameters: {
    $connections: { defaultValue: {}, type: 'Object' },
    $authentication: { defaultValue: {}, type: 'SecureObject' },
  },
  triggers: {
    Every_week: {
      type: 'Recurrence',
      recurrence: {
        frequency: 'Week', interval: 1, timeZone: cfg.timeZone,
        schedule: { weekDays: ['Monday'], hours: [String(cfg.runHour)], minutes: [0] },
      },
    },
  },
  actions,
};

// ---------------------------------------------------------------------------
// Legacy import package
// ---------------------------------------------------------------------------
const flowId = crypto.randomUUID();
const flowRes = crypto.randomUUID();
const apiRes = crypto.randomUUID();
const connRes = crypto.randomUUID();
const icon = 'https://connectoricons-prod.azureedge.net/releases/v1.0.1664/1.0.1664.3477/sharepointonline/icon.png';

const flowJson = {
  name: flowId,
  id: `/providers/Microsoft.Flow/flows/${flowId}`,
  type: 'Microsoft.Flow/flows',
  properties: {
    apiId: '/providers/Microsoft.PowerApps/apis/shared_logicflows',
    displayName: cfg.flowName,
    definition,
    connectionReferences: {
      shared_sharepointonline: {
        connectionName: cfg.sharePointConnectionName || 'shared-sharepointonl-placeholder',
        source: 'Embedded', id: SP, tier: 'NotSpecified', apiName: 'sharepointonline',
        isProcessSimpleApiReferenceConversionAlreadyDone: false,
      },
    },
    flowFailureAlertSubscribed: false,
    isManaged: false,
  },
};
const manifest = {
  schema: '1.0',
  details: {
    displayName: cfg.flowName,
    description: 'Creates one payroll ticket per client, schedule and pay period each week.',
    createdTime: new Date().toISOString(),
    packageTelemetryId: crypto.randomUUID(),
    creator: 'N/A',
    sourceEnvironment: '',
  },
  resources: {
    [flowRes]: {
      type: 'Microsoft.Flow/flows',
      suggestedCreationType: 'New', creationType: 'Existing, New, Update',
      details: { displayName: cfg.flowName }, configurableBy: 'User', hierarchy: 'Root', dependsOn: [apiRes, connRes],
    },
    [apiRes]: {
      id: SP, name: 'shared_sharepointonline', type: 'Microsoft.PowerApps/apis', suggestedCreationType: 'Existing',
      details: { displayName: 'SharePoint', iconUri: icon }, configurableBy: 'System', hierarchy: 'Child', dependsOn: [],
    },
    [connRes]: {
      type: 'Microsoft.PowerApps/apis/connections', suggestedCreationType: 'Existing', creationType: 'Existing',
      details: { displayName: 'SharePoint', iconUri: icon }, configurableBy: 'User', hierarchy: 'Child', dependsOn: [apiRes],
    },
  },
};

const build = path.join(LOCAL, 'flow-package');
fs.rmSync(build, { recursive: true, force: true });
// A real export keys the flow's folder and assetPaths by the package resource id, not the flow id.
const flowDir = path.join(build, 'Microsoft.Flow', 'flows', flowRes);
fs.mkdirSync(flowDir, { recursive: true });
const write = (p, obj) => fs.writeFileSync(p, JSON.stringify(obj, null, 2));
write(path.join(build, 'manifest.json'), manifest);
write(path.join(build, 'Microsoft.Flow', 'flows', 'manifest.json'), { packageSchemaVersion: '1.0', flowAssets: { assetPaths: [flowRes] } });
write(path.join(flowDir, 'definition.json'), flowJson);
write(path.join(flowDir, 'apisMap.json'), { shared_sharepointonline: apiRes });
write(path.join(flowDir, 'connectionsMap.json'), { shared_sharepointonline: connRes });
write(path.join(LOCAL, 'definition.json'), definition);

const zip = path.join(LOCAL, 'CreatePayrollTickets.zip');
fs.rmSync(zip, { force: true });
// Zip entries must use forward slashes; bsdtar (shipped with Windows 10+ and macOS) does that.
// Git Bash's GNU tar can't write zips, so prefer the Windows copy when it exists.
const winTar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
const tar = process.platform === 'win32' && fs.existsSync(winTar) ? winTar : 'tar';
const rel = `Microsoft.Flow/flows/${flowRes}`;
execFileSync(tar, ['-a', '-c', '-f', zip, '-C', build, 'manifest.json', 'Microsoft.Flow/flows/manifest.json',
  `${rel}/definition.json`, `${rel}/apisMap.json`, `${rel}/connectionsMap.json`]);
console.log(`Wrote ${zip}`);
