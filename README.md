# Payroll Timesheet Automation

Tools for collecting two-week employee hours from clients and processing payroll per pay period.

| Folder | What it is | Status |
|---|---|---|
| `employee-timesheet/` | Power Apps Canvas App (internal): enter an employee's 14 days of hours, review, submit | Stage 1 (screens + calculations) done; Submit doesn't save anything yet |
| `google-timesheet-webapp/` | Google Apps Script web app: clients submit hours with no sign-in; each submission is emailed as a CSV | Built and tested locally; not deployed yet |
| `google-timesheet-form/` | Google Form version (v1) of the same thing | Works, replaced by the web app |
| `payroll-tickets-lists/` | Table layouts for `ClientEmployees`, `PayrollTickets`, `TicketTimesheets` | Example data only |
| `TimesheetSubmissions_v2.xlsx` | Excel table the Canvas App was originally meant to write to | Example data only |

See [`HANDOFF.md`](HANDOFF.md) for the full state and next steps. Setup steps for the Google
apps are in the comment at the top of each `Code.gs`.

Local Python (only used to inspect or generate the `.xlsx` files):

```sh
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
```
