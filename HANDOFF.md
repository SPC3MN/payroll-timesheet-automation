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

## 1. Google web app (v2): `google-timesheet-webapp/`

`Code.gs` + `Index.html`, an Apps Script HtmlService web app.

- Phone-friendly: one card per employee with a 7-column day grid per week, live
  Week 1 / Week 2 / period totals, and a grand total bar. Light mode only.
- Each client gets their own link, `?c=<token>`. Tokens live in Script Properties
  (`CLIENT_TOKENS`), and the client must also be listed in `CONFIG.CLIENTS`. Removing a
  client from CONFIG and redeploying turns their link off.
- Each client in `CONFIG.CLIENTS` has a `payPeriodStart`. The page repeats it every 14 days,
  opens on the latest period that has ended, and has ‹ › buttons to step between periods.
- Drafts are saved in the browser's localStorage. Each submission is emailed as a CSV
  attachment to `NOTIFY_EMAIL`, or to the script owner if that's blank.
- It is a **separate Apps Script project** from the Form on purpose. The page can call any
  function without a trailing `_`, so admin functions are guarded by `assertOwner_`.
- Tested locally in Node and headless Chrome at 375px width. **Not deployed yet.**
- **Deploy steps** are in the header comment of `Code.gs`:
  - Execute as: Me. Who has access: Anyone.
  - Paste the `/exec` URL into `CONFIG.WEB_APP_URL`, then run `generateClientLinks`.
- **Gotcha:** code or CONFIG edits only reach clients after Deploy → Manage deployments →
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

## 4. Payroll ticketing: recommended design (not built)

Build it on **SharePoint Lists** (Microsoft Lists) with Power Automate. Both come with M365
and need only standard connectors.

- **Lists** (layouts are in `payroll-tickets-lists/*.xlsx`; all rows are examples):
  - `ClientEmployees` (Title, Client, Active): the real employee list. It should replace
    `colEmployees` in the Canvas App.
  - `PayrollTickets` (Title, Client, PayPeriodStart, PayPeriodEnd, Status, AssignedTo,
    CompletedDate). Add a `DueDate` column and a unique key column (e.g.
    `ClientA-2026-10-05`) so tickets can't be duplicated.
  - `TicketTimesheets`: one row per employee per ticket. Make `TicketId` a **lookup**
    column pointing to PayrollTickets.
  - Suggested new `Clients` list: name, `PayPeriodStart` anchor, `Frequency`, contact.
- **Statuses:** Open → Awaiting hours → Hours received → In review → Processed → Closed.
  Add a board view grouped by Status.
- **Flows:**
  1. *Scheduled:* for each client, create the ticket for the current pay period, based on
     each client's own biweekly schedule rather than a flat monthly recurrence.
  2. *"When a new email arrives"* (shared inbox): read the CSV the Google web app sends,
     find the ticket by Client + PayPeriodStart, add the TicketTimesheets rows, and set the
     ticket to "Hours received". Don't use the HTTP trigger: it's premium.
  3. *Optional:* send a reminder when a ticket is still "Awaiting hours" after its DueDate.
- The Canvas App's Stage 2 Submit should write to `TicketTimesheets` instead of
  `TimesheetSubmissions_v2.xlsx`.

**Open questions for the user:**
- Are any clients paid monthly rather than biweekly? If so, use the `Frequency` column.
- Can the user create a SharePoint site or lists in the tenant, or do they need to ask IT?

## Next steps (in order)

1. Deploy the Google web app with real `CONFIG.CLIENTS`, generate client links, and send a
   test submission from a private window.
2. Create the SharePoint lists above and fill in real clients and employees.
3. Build flow 1 (ticket creation) and flow 2 (CSV email import).
4. Canvas App Stage 2: point `cmbEmployee` at `ClientEmployees`, and make Submit write to
   `TicketTimesheets`.

## Setup on a new machine

```sh
git clone <this repo> && cd <repo>
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt   # only for the .xlsx files
```

For Claude Code, install the `canvas-apps` plugin from the `power-platform-skills`
marketplace. `.claude/settings.json` already enables it.
