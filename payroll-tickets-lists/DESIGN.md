# Payroll ticketing lists: design

SharePoint Lists (Microsoft Lists) + Power Automate, standard connectors only. It replaces the
staff's weekly tracking spreadsheets, where each client is a row and the "timecards in /
payroll done / billing done" marks are cleared every cycle. Here each client and pay period
gets its own ticket instead, so nothing is cleared and the history is kept.

Real client data never goes in this repo. The Clients list is loaded from `local/clients.csv`
(built by `tools/import-clients.js`). Choice values that name the business (the `Company`
column) are typed into SharePoint by hand from `local/sources.json`.

## Lists

### Clients: one row per client (set up once, edited when a client changes)

| Column | Type | Notes |
|---|---|---|
| Title | Single line of text | Client name, as in the spreadsheet (`ClientName` in clients.csv) |
| Company | Choice | Which business name the client is under (values from `local/sources.json`) |
| Contact | Single line of text | Contact name(s) |
| Phone | Single line of text | Free text: some rows hold two numbers |
| Email | Single line of text | Not in the spreadsheets; fill in over time |
| Frequency | Choice, **multiple selections** | Weekly, Biweekly, Semi-monthly, Monthly, Quarterly. Two values = two schedules, one ticket per schedule |
| MonthlyPayDay | Number (1–31) | For monthly clients: the pay day (e.g. 5, 15, 20). Blank = not monthly |
| ReportDelivery | Choice, multiple selections | None, Email from Extreme, Email, Mail, Paper, See notes |
| ACH, JobCostReport, Report, SendPreviewForApproval, SendForApproval, CouncilOnAgingReport | Yes/No (six columns) | Client-specific checklist steps; decide which steps appear on this client's tickets |
| StandingNotes | Multiple lines of text, **enhanced rich text** | The long per-client instructions (spreadsheet columns H and I). Colour, highlight, bold |
| Active | Yes/No | Inactive clients get no new tickets |
| FrequencyAsWritten, ReportDeliveryAsWritten | Single line of text | The spreadsheet's original wording, kept to check the import; can be deleted later |

### PayrollTickets: one row per client, per schedule, per pay period (created by flow 1)

| Column | Type | Notes |
|---|---|---|
| Title | Single line of text | `<client> · <schedule> · <period>` e.g. `Example Co · Biweekly · Aug 10–23` |
| Client | Lookup → Clients | Also show `Company`, `Phone`, `Contact` from the Clients list |
| Schedule | Choice | Weekly, Biweekly, Semi-monthly, Monthly, Quarterly |
| PeriodStart, PeriodEnd, PayDate | Date | |
| DueDate | Date | When timecards are needed by (default: PayDate − 3 working days; adjustable) |
| TicketKey | Single line of text, **enforce unique values** | `<Clients ID>-<Schedule>-<PeriodStart yyyy-MM-dd>`; stops flow 1 making duplicates |
| Status | Choice | Open, Complete, No payroll this period |
| AssignedTo | Person, **multiple selections** | Optional (not required) unless the staff decide otherwise |
| TimecardsIn, PayrollDone, BillingDone | Yes/No | The three general steps every ticket has |
| ReportSent | Choice | To do / Done / N/A. N/A when the client's ReportDelivery is None |
| ACH, JobCostReport, Report, SendPreviewForApproval, SendForApproval, CouncilOnAgingReport | Choice (six columns) | To do / Done / N/A. Flow 1 sets "To do" where the client has the step, "N/A" otherwise |
| Notes | Multiple lines of text, enhanced rich text | Notes for this pay period. Optionally "Append changes to existing text" for a dated history |
| Attachments | (built in) | Payroll report / invoice PDFs, job cost reports, approval emails, the hours CSV |

**Skipping a pay period:** set Status to "No payroll this period". The ticket leaves the open
views without any step being ticked.

**Standing notes on a ticket:** SharePoint lookups can't bring multi-line text across, so the
client's StandingNotes aren't shown on the ticket itself. The ticket's Client link opens the
client row. (If the staff want them side by side, a Power Apps form over the list can show
both.)

### ClientEmployees: one row per employee (waiting on the employee lists)

| Column | Type | Notes |
|---|---|---|
| Title | Single line of text | Employee name |
| Client | Lookup → Clients | |
| Active | Yes/No | |

Feeds the Canvas App's employee dropdown and, optionally, pre-filled names on the hours page.

### TicketTimesheets: one row per employee per ticket (with the hours page, later)

The CSV layout (`Client, PayPeriodStart, EmployeeName, Mon1Hours..Sun2Hours, Week1Total,
Week2Total, TotalHours, Comments`) with `Ticket` as a lookup to PayrollTickets. Built when the
hours page work resumes.

## Views

- **PayrollTickets**
  - *Open this cycle* (default): Status = Open, grouped by Company then Schedule, sorted
    by Client. The same at-a-glance grid as the spreadsheet, with checkboxes editable in
    place.
  - *My tickets*: AssignedTo includes [Me], Status = Open.
  - *Waiting on timecards*: Status = Open and TimecardsIn = No, sorted by DueDate. Overdue
    rows are highlighted red with column formatting.
  - *Board*: board view by Status.
  - *All*: history, grouped by PayDate.
- **Clients**
  - *Active*: grouped by Company.
  - *Inactive*.

## Flows (Power Automate, standard connectors)

1. **Create tickets** (scheduled, every Monday early morning). For each active client and
   each of its Frequency values:
   - Work out the pay period that just ended.
   - If that schedule is due this week, build the TicketKey. Create the ticket when no
     ticket with that key exists; the unique key also blocks duplicates.
   - Copy the client's step switches into the ticket as To do / N/A.

   Schedules, from the staff spreadsheets:
   - *Weekly:* Monday–Sunday, paid the following Friday.
   - *Biweekly:* two Monday–Sunday weeks on one company-wide cycle (a period started Mon
     2026-08-10), paid the following Friday.
   - *Semi-monthly:* paid on the 5th and 20th. The period boundaries are still to confirm.
   - *Monthly:* one ticket a month, PayDate = MonthlyPayDay.
   - *Quarterly:* one ticket a quarter.
2. **Import hours email** (with the hours page, later). The CSV from the Google page goes to
   a shared inbox. The flow finds the ticket by client + PeriodStart, adds the
   TicketTimesheets rows, and ticks TimecardsIn. It doesn't use the HTTP trigger, which is
   premium.
3. **Reminder** (optional): each morning, email the assignee(s) about open tickets past
   DueDate with TimecardsIn = No.

## Answers to the staff checklist questions

| Question | Answer |
|---|---|
| Highlight / colour in notes? | Yes: enhanced rich text allows font colour, highlight, bold, tables. |
| What are attachments for? | Reports, invoices, approval emails, the hours CSV. Can be turned off. |
| Assign to more than one person? Required? | Multiple people allowed; required is a per-column setting (off by default). |
| How long can notes be? | Far beyond a spreadsheet cell. Existing long notes fit. |
| Skip steps when there are no hours? | Status "No payroll this period". |
