# Payroll Timesheet Automation

Read `HANDOFF.md` first. It has the current state of every part of the project, the decisions
already made (and why), and the next steps.

- `employee-timesheet/`: Power Apps Canvas App source (`.pa.yaml`) for internal staff. Edit it
  with the `canvas-apps` Claude Code plugin (enabled in `.claude/settings.json`).
- `google-timesheet-webapp/`: the current client-facing, no-sign-in hours page (Apps Script).
- `google-timesheet-form/`: the older Google Form version (v1), kept for reference.
- `payroll-tickets-lists/` + `TimesheetSubmissions_v2.xlsx`: table layouts for the
  SharePoint Lists / Excel data. Every row is example data.
