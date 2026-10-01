/**
 * Client settings for the timesheet web app: a TEMPLATE. The real values stay local.
 *
 * Copy this file to `Local.gs` (same folder), fill it in, and paste it into the Apps Script
 * project as a script file named `Local`. `Local.gs` is gitignored because the repo is public:
 * never commit real client names, employees, email addresses or the web app URL.
 */

const LOCAL_CONFIG = {
  // Where CSVs are sent. Blank = the Google account that owns this script.
  NOTIFY_EMAIL: '',
  // The deployment's Web app URL (ends in /exec). Used only to build client links.
  WEB_APP_URL: '',
  // One entry per client:
  //   payPeriodStart: the first day of any one of their two-week pay periods (YYYY-MM-DD).
  //     The page repeats it every 14 days and opens on the latest period that has ended.
  //     Leave it out and the client picks the start date themselves.
  //   employees: leave empty (the default) and the client types each employee's name on
  //     the page, adding as many as they need. Names listed here are only pre-filled, and
  //     the client can still edit, remove or add employees.
  CLIENTS: {
    'Example Client A': { payPeriodStart: '2026-01-07', employees: [] },
    'Example Client B': { payPeriodStart: '2026-01-02', employees: ['Example Employee 1', 'Example Employee 2'] },
  },
};
