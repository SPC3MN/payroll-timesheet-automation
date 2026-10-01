# Handoff: Payroll Timesheet Automation

Last updated: 2026-09-30. This file replaces the previous Claude Code memory notes. It holds
everything needed to pick the project up on a new machine or account.

## Goal

Clients send each employee's hours for every two-week pay period. Those hours become
payroll tickets that staff work through. The pieces:

1. **Client-facing hours page** (Google, no sign-in): built.
2. **Internal Canvas App** (Power Apps) for staff to enter or review timesheets: Stage 1 built.
3. **Payroll ticketing** (SharePoint Lists + Power Automate): designed, not built.

## Decisions already made (don't reopen without a reason)

- **Clients use Google, not Power Apps.** The hard requirement was *free and no sign-in*
  for clients. Power Apps always needs an org sign-in, so the client piece moved to a
  Google Apps Script web app. The user explicitly said "not limited to Microsoft only".
  Microsoft is still used for internal tooling.
- **CSV layout** (one row per employee), used everywhere:
  `Client, PayPeriodStart, EmployeeName, Mon1Hours..Sun1Hours, Mon2Hours..Sun2Hours,
  Week1Total, Week2Total, TotalHours, Comments`
  (the same columns as the `TicketTimesheets` table).
- **Pay periods are biweekly and can start on any weekday.** The user said Mondays are not
  required. Week 1 is the first 7 days from `PayPeriodStart` and Week 2 the next 7. Each
  week contains every weekday once, so the server maps days into the `Mon1..Sun2` columns
  by weekday.
- **The Canvas App uses 14 individually named hour inputs** (`txtMon1Hours`…`txtSun2Hours`),
  **no Gallery or repeater.** The user asked for named, non-generic controls.
- **Ticketing should use SharePoint Lists, not Excel.** Excel Online locks when several
  people edit and is unreliable from flows. Dataverse needs premium licences. See the
  plan below.
- **All client information stays local; this repo is public.** Client names, the payroll
  company's own business names, contacts, pay schedules, employees, email addresses and the
  web app URL never get committed. They
  live in the gitignored `local/` folder and `google-timesheet-webapp/Local.gs`. Committed
  files hold only generic code, templates (`Local.example.gs`) and example data.

## Local client data: `local/` (gitignored, never commit)

- The payroll staff's weekly tracking workbooks, one per business name. The payroll
  company works under two names (one business), each with its own client book.
  `sources.json` names the businesses and says which sheets to read.
  - Each row is one client: frequency, timecards in, phone, client (contact), additional
    payroll report / delivery, payroll done, billing done, and standing notes.
  - `⇃` means not done and `X` means done. The sheets are reset each cycle.
  - The top rows hold one company-wide cycle: weekly Mon–Sun, bi-weekly two Mon–Sun weeks,
    pay date the following Friday. Semi-monthly clients are paid on the 5th and 20th, and
    monthly clients on their own day.
- The staff's ticket checklist (`New Spreadsheet Checklist.docx`), and
  `client-steps.json`, which lists the client-specific checklist steps.
- `node tools/import-clients.js` merges the current and inactive sheets of both workbooks
  into `local/clients.csv`, the seed for the SharePoint `Clients` list. It normalises
  frequency and delivery, and keeps the text as written next to each normalised value.
  Re-run it whenever the workbooks change.
- Frequencies in use: weekly, bi-weekly, semi-monthly, monthly, quarterly. Some clients
  run two schedules for different groups of employees (e.g. bi-weekly staff and monthly
  owners). **The web app still only handles bi-weekly periods.**

## 1. Google web app (v2): `google-timesheet-webapp/`

`Code.gs` + `Index.html`, an Apps Script HtmlService web app.

- Phone-friendly: one card per employee with a 7-column day grid per week, live
  Week 1 / Week 2 / period totals, and a grand total bar. Light mode only.
- Each client gets their own link, `?c=<token>`. Tokens live in Script Properties
  (`CLIENT_TOKENS`), and the client must also be listed in `CLIENTS` in `Local.gs`. Removing
  a client from `Local.gs` and redeploying turns their link off.
- **Employees are entered by hand by default.** A client with `employees: []` gets one
  blank card and adds more with "+ Add employee". Names listed in `employees` are only
  pre-filled, and can still be edited, removed or added to. The user will supply an
  employee list per company.
- Each client in `Local.gs` has a `payPeriodStart`. The page repeats it every 14 days,
  opens on the latest period that has ended, and has ‹ › buttons to step between periods.
- Client settings (`CLIENTS`, `NOTIFY_EMAIL`, `WEB_APP_URL`) are in `Local.gs`, which is
  gitignored. Copy `Local.example.gs` to create it and paste it into Apps Script as a script
  file named `Local`.
- Drafts are saved in the browser's localStorage. Each submission is emailed as a CSV
  attachment to `NOTIFY_EMAIL`, or to the script owner if that's blank.
- It is a **separate Apps Script project** from the Form on purpose. The page can call any
  function without a trailing `_`, so admin functions are guarded by `assertOwner_`.
- Tested locally in Node and headless Chrome at 375px width. **Not deployed yet.**
- **Deploy steps** are in the header comment of `Code.gs`:
  - Execute as: Me. Who has access: Anyone.
  - Paste the `/exec` URL into `WEB_APP_URL` in `Local`, then run `generateClientLinks`.
- **Gotcha:** code or `Local` edits only reach clients after Deploy → Manage deployments →
  Edit → Version "New version" → Deploy. The URL stays the same.
- There was a private preview artifact on the old account. It won't open from a new account.

## 2. Google Form (v1): `google-timesheet-form/`

`Code.gs` builds a Google Form when you run `setup`. It was run successfully on 2026-09-24.
The user found one question per day too long, so it was replaced by the web app. Kept for
reference only.

## 3. Canvas App: `employee-timesheet/`

Power Apps Canvas App source in `.pa.yaml` format:
- `App.pa.yaml`, `Screen1.pa.yaml`, `ReviewSubmission.pa.yaml`, `_EditorState.pa.yaml`
- Planning notes: `canvas-app-plan.md`, `canvas-app-shared.md`, `*.screen-plan.md`

- **Screen1 ("Timesheet Entry"):**
  - An employee dropdown (`cmbEmployee`, bound to `colEmployees`) and a pay-period start
    date picker (`dpPayPeriodStart`) fill in the 14 day dates.
  - 14 `ModernNumberInput` fields (Min 0, Max 24, Step 0.5), live Week 1 / Week 2 / Total
    labels, an optional comments box, and a "Review & Submit" button.
- **ReviewSubmission:** a read-only summary that reads Screen1's controls directly by name,
  with Edit and Submit buttons. **Submit is a placeholder:** `UpdateContext` + `Notify`,
  nothing is saved.
- `colEmployees` is a 3-row placeholder formula in `App.pa.yaml`. Swap it for the real
  employee list; that's a change in one place.
- Stage 1 was verified by the user: all 8 manual test cases passed in Studio preview
  (2026-09-22).
- **Moving accounts:** the live app lives in the original account's York University Power
  Apps tenant. A different account can't open it unless it's shared with that account. To
  continue elsewhere, either:
  - get the app shared with the new account, or
  - create a new blank Canvas App in the new tenant, open a coauthoring session with the
    `canvas-apps` plugin, and push these `.pa.yaml` files into it.
- **Gotcha:** after large YAML pushes through the Canvas Authoring MCP, the open Power Apps
  Studio tab can go blank or stale. Hard-refresh the tab. To check the app itself is fine,
  `sync_canvas` to a scratch folder and confirm the controls are there.

## 4. Payroll ticketing: `payroll-tickets-lists/DESIGN.md` (designed, not built)

**Current focus (2026-09-30):** the user wants the lists built first. The hours page waits.

**Built so far (2026-09-30), on the `Payroll_Ticketing` team site in the user's tenant:**
- `Clients` list: 150 rows (125 active) imported from `local/clients.csv`, and checked
  against the CSV (counts, step flags, full note lengths).
  - Internal column names are `field_0`… (Lists "From CSV" import): Company `field_0`,
    Contact `field_2`, Phone `field_3`, Frequency `field_4`, ReportDelivery `field_6`,
    ACH…CouncilOnAgingReport `field_8`–`field_13`, StandingNotes `field_14`,
    Active `field_15`. Flows must use these names.
  - Company is a checkbox choice (switching it to a single-choice dropdown hit a browser
    confirm dialog). Frequency and ReportDelivery are multi-choice with fixed options.
    StandingNotes is enhanced rich text.
  - Import gotcha: combined values ("Biweekly;Monthly") arrive as one value. The 12 such
    rows were re-saved by hand as separate values.
  - Not added yet: `MonthlyPayDay`, `Email`, views.
- `Payroll Tickets` list (URL `Lists/PayrollTickets`), empty and ready for the flow.
  Internal names match DESIGN.md:
  - `Client` is a required lookup to Clients, which also shows the client's Contact and
    Phone. `Company` is a choice filled in by the flow (a choice can't be brought across
    by lookup).
  - `Schedule` and `Status` are required; Status defaults to Open.
  - `ReportSent` defaults to "To do". The six client-specific steps (`ACH`,
    `JobCostReport`, `Report`, `SendPreviewForApproval`, `SendForApproval`,
    `CouncilOnAgingReport`) are To do / Done / N/A and default to N/A.
  - `TimecardsIn`, `PayrollDone` and `BillingDone` are yes/no, default No.
  - `PeriodStart` (required), `PeriodEnd`, `PayDate` (required) and `DueDate` are
    date only.
  - `TicketKey` is indexed and enforces unique values.
  - `AssignedTo` allows several people. `Notes` is enhanced rich text.
  - Indexed: Client, Status, PayDate, TicketKey.
  - Display names have spaces ("Timecards in"); internal names don't.
  - Default view **Open this cycle**: Status = Open, grouped by Company then Schedule,
    sorted by Title, 500 rows.
  - **My tickets**: Assigned to includes [Me] and Status = Open, sorted by Pay date.
  - **Waiting on timecards**: Status = Open and Timecards in = No, sorted by Due date.
  - **Board**: kanban by Status, with no filter, so completed tickets pile up in the
    Complete column. Add a date filter later if it gets long.
  - **All Items**: the untouched default list of every ticket.
- Clients also has `MonthlyPayDay` (number, min 1) for monthly and quarterly clients.
- **Ticket flow (in progress):** `node tools/build-ticket-flow.js` builds
  `local/CreatePayrollTickets.zip`, a legacy Power Automate import package, from
  `local/flow-config.json` (site URL, list IDs, placeholder schedule rules; all rules are
  documented in the script header). The schedule rules were checked by simulation over
  2026–2027.
  - **Live since 2026-09-30** as "Create payroll tickets (weekly)": on, Mondays 06:00
    Mountain time. Flow checker reports 0 errors.
  - First run (manual, Wed 2026-09-30, acting as the week of Mon Sep 28) succeeded in
    10m38s and created the 41 expected weekly tickets: period Sep 21–27, due Sep 29, paid
    Oct 2. That's 27 under one company name and 14 under the other, with 41 unique keys.
    Client steps (ACH / send-for-approval) and Report sent were set correctly. No other
    schedule was due that week, so bi-weekly, semi-monthly, monthly and quarterly are
    checked only by simulation so far.
  - Slow (about 3 tickets/min) because both loops run one at a time to share the flow
    variables. Speed-up: compute the period with per-iteration Compose actions instead
    of variables, then let the client loop run in parallel.
  - Package-format lessons, taken from a real export (a trivial "Format probe (delete me)"
    flow, left turned off):
    - The flow's folder under `Microsoft.Flow/flows/` and `flowAssets.assetPaths` use
      the **package resource id** (the key in manifest.json), not the flow id. Getting
      this wrong makes the import hang forever with no error.
    - The zip holds only the five files, with no directory entries.
    - `connectionReferences` carries `apiName` and
      `isProcessSimpleApiReferenceConversionAlreadyDone`. The real connection name is in
      `local/flow-config.json`.
  - Test with `testRunDate` in the config (rebuild and re-import, or edit the TestRunDate
    Compose in the designer) to make a manual run behave like a given week.
  - Classic view form gotchas: Yes/No filter values must be "No"/"Yes" (not 0/1).
    Native dropdowns can't be clicked open by automation; set them with form_input.
  - Gotcha: the classic column pages sometimes raise a browser confirm dialog (e.g.
    enforcing unique values on an unindexed column), and automation can't see it. Index
    the column first, then change the setting.
- The site's two older lists are the user's tests. Ignore them; don't delete them
  unless asked.

SharePoint Lists + Power Automate, standard connectors only. The full column-by-column
design, views, flows and answers to the staff's questions are in
`payroll-tickets-lists/DESIGN.md`. In short:

- `Clients`: one row per client, loaded from `local/clients.csv`.
  - Frequency allows several values (one ticket per schedule).
  - Yes/No switches for the client-specific steps.
  - Rich-text standing notes.
- `PayrollTickets`: one row per client, per schedule, per pay period, created each
  Monday by a flow.
  - A unique `TicketKey` stops duplicates.
  - Timecards in / payroll done / billing done checkboxes.
  - Client-specific steps as To do / Done / N/A.
  - Status: Open, Complete, or No payroll this period.
- `ClientEmployees`: waiting on the employee lists the user will provide.
- `TicketTimesheets`: comes with the hours page later.
- The `.xlsx` files in `payroll-tickets-lists/` are the older layouts; DESIGN.md
  supersedes them.

**Open questions for the user:**
- Can they create a SharePoint site and lists in their Microsoft 365 tenant, or do they
  need to ask IT? And how should the lists be created: a provisioning script, or built
  together in the browser?
- Semi-monthly clients are paid on the 5th and 20th. Which days does each period cover?
- Should the monthly Council-on-Aging report be its own monthly ticket?
- Confirm the guesses in `local/client-steps.json` (checklist shorthand and a truncated line).

## Next steps (in order)

1. Create the `Clients` and `PayrollTickets` lists and views in the user's tenant, and
   import `local/clients.csv`.
2. Build flow 1 (weekly ticket creation), then the optional reminder flow.
3. `ClientEmployees`, once the user sends the employee lists.
4. Later: deploy the Google hours page, build `TicketTimesheets` and flow 2 (CSV email
   import), and Canvas App Stage 2.

## Setup on a new machine

```sh
git clone <this repo> && cd <repo>
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt   # only for the .xlsx files
```

For Claude Code, install the `canvas-apps` plugin from the `power-platform-skills`
marketplace. `.claude/settings.json` already enables it.

## Payroll Tickets "To do" view (default)

- Open tickets grouped by company, one row per ticket: urgency stripe (red = timecards overdue,
  amber = payday within 2 days, green = ready to close), title (opens the ticket), due / pay dates,
  assignee, and click-to-tick step labels plus a "Mark complete" button.
- Layout is `payroll-tickets-lists/formatting/todo-view.json` (built by `tools/build-formatting.js`).
  The view must include Status and every step column, or ticks silently don't save.
- View JSON is stored as XML: it must not contain `&` or `<` (the generator uses nested ifs and `>`).
- The classic ViewEdit.aspx OK button failed to save; view fields and the formatter were set through
  the site REST API (`viewfields/addviewfield`, MERGE `CustomFormatter`) from a signed-in browser.
- Tick tested on ticket 1 and reverted. Left: widen the Checklist column in other views.
- Ticket form (display/new/edit): the step columns, Period end, Ticket key and Checklist are hidden
  through the form's Edit columns panel (New item panel → form icon → Edit columns). Steps are ticked
  in the To do view; the columns still exist and the flow still fills them. Period start and Pay date
  are required, so they can't be hidden. Custom form JSON and the REST field-link route did not work.
- Ticket form: each client-specific step (ACH, JobCostReport, Report, SendPreviewForApproval,
  SendForApproval, CouncilOnAgingReport, ReportSent) has a conditional formula
  `=if([$Field] != 'N/A', true, false)` (Edit columns → field options → Edit conditional formula),
  so N/A steps are hidden. Timecards in, Payroll done and Billing done always show.
- To do row also shows client Contact, Phone and Report delivery (lookup projections `Client_x003a_Contact`,
  `Client_x003a_Phone`, `Report_x0020_delivery`; the last one was added with `addDependentLookupField`)
  (the "No payroll this period" button was removed again: set that Status on the ticket form instead; the Board column for it is hidden).
- Staff checklist docx is checked against the Clients data; open question: BVTI "send preview" (the source
  line is cut off). The staff answers and user guide are in `local/Staff-Response-and-Guide.md` (names clients, so local only).
- "No payroll this period" is now a Yes/No column `NoPayroll` on the ticket form (bottom of the form).
  When ticked, the To do row turns grey with a "No payroll this period" badge and the Mark complete
  button appears at once. The Status choice "No payroll this period" still exists but is unused.
  Reading a view's CustomFormatter through REST returns `>` as `&gt;`: decode it before editing and
  writing it back, and never write `&` or `<`.
- Client standing notes: SharePoint cannot project multi-line text through a lookup column (blank) and a row cannot open another list's item in a panel. So the flow copies the client's StandingNotes (Clients field_14) into a Client notes column (ClientNotes) on each new ticket, and the existing tickets were back-filled. Notes stays for per-ticket notes. A later edit to a client's standing note does not reach existing tickets (a sync flow would be needed).
