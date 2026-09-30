# Canvas App Plan

## Mode

CREATE

## Requirements

Build a Canvas App: an employee two-week timesheet, for a supervisor to enter an
employee's hours on phone or computer. Stage 1 only — Canvas App UI and calculations
only; no Power Automate flow, no Excel connector, no data source/connector — mock/local
data only.

Two screens:

1. **Screen1** (timesheet entry) — Employee dropdown (`cmbEmployee`, bound to a mock
   `colEmployees` collection seeded in `App.OnStart`) and a single Pay Period Start date
   picker (`dpPayPeriodStart`, `DefaultDate: =Today()`) drive 14 auto-computed day dates
   (`dpPayPeriodStart.SelectedDate + offset`, offsets 0-13), grouped into a tinted "Week 1"
   and "Week 2" section. 14 individually named `ModernNumberInput` controls
   (`txtMon1Hours`…`txtSun2Hours`, Min 0/Max 24/Step 0.5/Precision 1/Default 0) capture
   hours per day, each paired with its own sibling date label in its own row container (no
   Gallery/repeater — explicit non-generic named controls). Live Week 1/Week 2/Total sums
   (`"0.0"` format) update reactively. An optional multiline Comments field. A "Review &
   Submit" button navigates to the second screen.
2. **ReviewSubmission** (read-only recap) — reads every Screen1 control directly by name
   (control names are unique app-wide and every screen stays loaded simultaneously),
   displaying Employee, Pay Period range, all 14 day/hours lines, the same three totals,
   and Comments (with an empty-state). `btnEdit` navigates back to Screen1. `btnSubmit` is
   an explicit stage-1 stub (`UpdateContext` + `Notify`, no data-source write) that reveals
   a green confirmation banner; the banner resets to hidden every time the screen is
   (re-)entered.

Professional utilitarian design: dominant navy, warm off-white background, white cards,
distinct light-blue/light-amber tints for Week 1/Week 2, ≥44px (prefer 48px) touch targets,
phone-first responsive layout, `AccessibleLabel` on every control that supports it.

## Requirement Coverage

| Requirement | Planned affordance | Fidelity |
|---|---|---|
| Employee dropdown bound to swappable mock data | `cmbEmployee` (`ModernDropdown`), `Items: =colEmployees`, `ItemDisplayText: =ThisItem.Name` | Exact |
| Pay Period Start is the only date ever picked | `dpPayPeriodStart` (`ModernDatePicker`), `DefaultDate: =Today()` | Exact |
| Sibling field labels (Dropdown/DatePicker have no native `Label`) | `lblEmployeeFieldLabel`, `lblPayPeriodFieldLabel` — real `ModernText` siblings, same immediate parent | Exact |
| 14 auto-computed dates, no manual entry | `=Text(dpPayPeriodStart.SelectedDate + <0..13>, "dddd, mmmm d")` on 14 named labels | Exact |
| Week 1 / Week 2 visual separation | `tsWeek1Card`/`tsWeek2Card`, distinct tint `Fill`, section header labels | Exact |
| 14 individually named hour inputs, not a Gallery | `txtMon1Hours`…`txtSun2Hours` (`ModernNumberInput`), each in its own named row container with its own named date label | Exact |
| Hour validation (0-24, step 0.5, 1 decimal, default 0, hint, visual error state) | `Min: =0`, `Max: =24`, `Step: =0.5`, `Precision: =DecimalPrecision.'1'`, `Default: =0`, `HintText`, `ValidationState` formula | Exact (documented: `Min`/`Max` are the primary enforcement; `ValidationState` is supplemental visual feedback only — no custom clamp code this stage, as specified) |
| Live Week 1/Week 2/Total calculations | Direct inline sum expressions over the 14 controls' `.Value`, repeated wherever displayed, `Text(...,"0.0")` | Exact |
| Optional, non-blocking comments | `txtCommentsNotes` (`ModernTextInput`, `Type: =TextInputType.Multiline`), no gate on any button | Exact |
| Review & Submit navigation | `btnReviewEntry.OnSelect: =Navigate(ReviewSubmission, ScreenTransition.None)` | Exact |
| Read-only recap reading Screen1 directly (single source of truth) | Every ReviewSubmission value is a direct formula reference to a named Screen1 control | Exact |
| Edit / Submit actions on recap | `btnEdit` (Navigate back), `btnSubmit` (stage-1 stub, no data write) | Exact |
| Confirmation banner, reset on (re-)entry | `revConfirmationBanner`/`lblConfirmationMessage`, `Visible: =varSubmissionConfirmed`, reset in `OnVisible` | Exact (see note below) |
| Scrollable, responsive, phone-first, ≥44px touch targets | `tsRoot`/`revRoot` scrollable AutoLayout roots; 48-52px controls throughout | Exact |
| `AccessibleLabel` on every control | Set on every `ModernText`/`ModernButton`/`ModernDropdown`/`ModernDatePicker`/`ModernNumberInput`/`ModernTextInput` | Approximation: `GroupContainer` has **no `AccessibleLabel` property** per the discovery packet's `describe_control` result — omitted only on layout/card containers, which is the only way to keep the file compiling |
| Design palette (navy/off-white/tints/slate/green) | Exact `RGBA(...)` literals per the shared plan, applied consistently across both screens | Exact |
| `btnSubmit`'s stated `Set(varSubmissionConfirmed, true)` vs. the reset's stated "do not use `Set()`/global for this" | Both the set and the reset use `UpdateContext({varSubmissionConfirmed: ...})` | Approximation: the requirements text is internally inconsistent (one line says use `Set()` on submit, the next says do not use `Set()`/global for the reset of the **same** variable). Power Fx variables are exclusively global (`Set`) or screen-scoped (`UpdateContext`), never both for one name, so mixing them is not a valid, compilable choice. Resolved in favor of the explicit, more specific instruction (context variable via `UpdateContext`, "fresh state on return") applied consistently to both the write and the reset. The requested observable behavior — banner shown on Submit, hidden again on re-entry — is fully preserved. |

## Required Record Fields

| Field key | Screen | Record surface | Required field | Source field | Presentation requirement |
|---|---|---|---|---|---|
| `day-date` | Screen1 | 14 day rows `tsDayRowMon1`…`tsDayRowSun2` | Date for this pay-period day | `dpPayPeriodStart.SelectedDate + offset` (0-13) | Sibling `ModernText` label (`lblMon1Date`…`lblSun2Date`), left of its input, `"dddd, mmmm d"` format |
| `day-hours` | Screen1 | Same 14 day rows | Hours worked this day (0-24, default 0) | User-entered `ModernNumberInput.Value` | `txtMon1Hours`…`txtSun2Hours`, fixed-width, right of its date label |
| `review-day-combined` | ReviewSubmission | 14 recap lines `lblReviewMon1`…`lblReviewSun2` | Date and entered hours for each day | Same date offset + matching Screen1 `txt*Hours.Value` | Single combined `ModernText` per day (`"<weekday>, <month> <day> — <hours> hrs"`); the formula references both the date and the hours source, satisfying the combined-control exception |

## State-Driven Surface Visibility

| Surface key | Owner screen | Surface control | State predicate | Visible and hidden states |
|---|---|---|---|---|
| `revConfirmationBanner` | ReviewSubmission | `revConfirmationBanner` | `=varSubmissionConfirmed` | Visible immediately after `btnSubmit` is tapped; hidden on every screen entry (`OnVisible` resets it to `false`) until the next Submit |

## Action Contracts

| Requested action | Preconditions | Entry point | Owner screen | Control and event | Source and stable ID | Transition and postcondition | Mutation write set | Receipt proof set | Observer and evidence |
|---|---|---|---|---|---|---|---|---|---|
| Enter/calculate daily and total hours | None — always available | `txtMon1Hours`…`txtSun2Hours` | Screen1 | 14× `ModernNumberInput.Value` (native reactive read, no handler code) | N/A — no data source this stage; the 14 controls are the source of truth | Each `Value` change recomputes the week/total sums | N/A | N/A | `lblWeek1Total`/`lblWeek2Total`/`lblTotalHours` recompute immediately |
| Select employee for timesheet | `colEmployees` populated in `App.OnStart` | `cmbEmployee` | Screen1 | `ModernDropdown` native `Selected` commit | `colEmployees` | `cmbEmployee.Selected` = chosen row | N/A | N/A | `cmbEmployee.Selected.Name`, read directly by ReviewSubmission's `lblReviewEmployee` |
| Set pay period start (auto-populates all 14 dates) | None — `DefaultDate: =Today()` always populates it | `dpPayPeriodStart` | Screen1 | `ModernDatePicker` native `SelectedDate` commit | N/A | `SelectedDate` updates | N/A | N/A | All 14 `lbl*Date` labels and ReviewSubmission's date/day lines recompute |
| Navigate to Review & Submit | None — always reachable | `btnReviewEntry` | Screen1 | `OnSelect: =Navigate(ReviewSubmission, ScreenTransition.None)` | N/A | Screen changes | N/A | N/A | ReviewSubmission renders using current Screen1 control values |
| Return to edit from Review | None — always available | `btnEdit` | ReviewSubmission | `OnSelect: =Navigate(Screen1, ScreenTransition.None)` | N/A | Screen changes | N/A | N/A | Screen1 shows previously entered values unchanged (both screens stay loaded) |
| Submit timesheet (stage-1 preview stub) | None — always available (explicit no-data-write stub) | `btnSubmit` | ReviewSubmission | `OnSelect` | N/A — screen-scoped context variable, no data source this stage | `UpdateContext({varSubmissionConfirmed: true})` | `varSubmissionConfirmed: true` | Identity: this timesheet's Employee/Pay Period (already shown); proof: banner + message visible | `revConfirmationBanner.Visible: =varSubmissionConfirmed`, `lblConfirmationMessage.Text`, supplemental `Notify(...)` |
| Fresh non-confirmed state on (re-)entry | User navigates to ReviewSubmission | `ReviewSubmission.OnVisible` | ReviewSubmission | `OnVisible` | N/A | `UpdateContext({varSubmissionConfirmed: false})` | `varSubmissionConfirmed: false` | N/A | `revConfirmationBanner.Visible` is `false` immediately on entry |
| Optional comments never block submit/navigation | `txtCommentsNotes.Text` may be blank | `txtCommentsNotes` | Screen1 / ReviewSubmission | native `Text` | N/A | N/A | N/A | N/A | Recap shows entered text or `"(No comments entered)"`; no button is gated on this field |

## Mutation Lifecycle Evidence

| Action | Receipt binding | Canonical source and observer | Requested destination and observer | Stable ID continuity | Synchronization when sources differ | Destination focus |
|---|---|---|---|---|---|---|
| Submit timesheet (stage-1 preview stub) | `revConfirmationBanner`/`lblConfirmationMessage`, captured via `UpdateContext({varSubmissionConfirmed: true})` | `varSubmissionConfirmed` (screen-scoped context variable) is the only source this stage — no data source integration in Stage 1; observer `revConfirmationBanner.Visible: =varSubmissionConfirmed` | Same screen/surface — recap values are read live from Screen1 and are unaffected by Submit | N/A — no persisted record identity; single in-session draft, not a stored row | N/A — same live context variable | N/A — single surface, not a multi-record destination |

## Mutation Field Ledger

| Action | Field | Classification | Canonical pre-state or input | Write or preservation mechanism | Receipt/proof binding | Post-state observer |
|---|---|---|---|---|---|---|
| Submit timesheet (stage-1 preview stub) | `varSubmissionConfirmed` | Changed | `false` (set by `ReviewSubmission.OnVisible`) | `btnSubmit.OnSelect: =UpdateContext({varSubmissionConfirmed: true})` | `revConfirmationBanner.Visible` + `lblConfirmationMessage.Text` both read the same `true` state | `ReviewSubmission.OnVisible: =UpdateContext({varSubmissionConfirmed: false})` proves it returns to `false` on next visit |

## Functional Test Matrix

| Scenario | Given | When | Then | Evidence surface | Boundary or negative case |
|---|---|---|---|---|---|
| Live weekly/total calculation matches spec example | `dpPayPeriodStart` = Sept 21, 2026; Week 1: Mon-Thu=8, Fri=7.5, Sat/Sun=0; Week 2: Mon-Fri=8, Sat/Sun=0 | Supervisor types the above into the 14 hour inputs | Week 1 = 39.5, Week 2 = 40.0, Total = 79.5 | `lblWeek1Total`/`lblWeek2Total`/`lblTotalHours` show exactly "Week 1 Total: 39.5" / "Week 2 Total: 40.0" / "Total Hours: 79.5" | N/A |
| Out-of-range hour entry | Any `txt*Hours`, `Min: =0`, `Max: =24` | Supervisor attempts a value outside 0-24 | `Min`/`Max` constrain the committed value; `ValidationState` shows `Error` for any represented out-of-range value | `txt*Hours.ValidationState` | Boundary: exactly `0` and exactly `24` are valid, non-error |
| Auto-date recompute on date change | `dpPayPeriodStart.SelectedDate` initially `Today()` | Supervisor picks a new pay-period start date | All 14 `lbl*Date` labels immediately show the new 14-day range | Each `lbl*Date.Text` | N/A |
| Navigate to Review shows identical values (shared source) | Screen1 populated as in the first scenario, Employee 2 selected | Supervisor taps `btnReviewEntry` | ReviewSubmission shows "Employee: Employee 2", "Week 1 Total: 39.5", "Week 2 Total: 40.0", "Total Hours: 79.5" | `lblReviewEmployee`, `lblReviewWeek1Total`, `lblReviewWeek2Total`, `lblReviewTotalHours` | N/A |
| Submit shows confirmation, no data write | On ReviewSubmission, `varSubmissionConfirmed` = false (fresh entry) | Supervisor taps `btnSubmit` | `varSubmissionConfirmed` becomes `true`; no collection or data source is written | `revConfirmationBanner` visible with message; `Notify` toast | N/A |
| Fresh state after Edit round-trip | Confirmation banner visible after Submit | Supervisor taps `btnEdit`, changes nothing, taps `btnReviewEntry` again | `OnVisible` resets `varSubmissionConfirmed` to `false` | `revConfirmationBanner.Visible` = `false` again | Regression: entered hours/employee/date are NOT reset — only the confirmation flag |
| Optional comments empty-state | `txtCommentsNotes.Text` = "" (blank) | Supervisor reaches Review without entering comments | Comments recap shows the empty-state text; navigation/Submit are never blocked | `lblReviewCommentsValue.Text` = "(No comments entered)" | Boundary: whitespace-only comments also trigger empty state via `Trim(...)` |
| Employee selection is the single source of truth | `colEmployees` = [Employee 1, Employee 2, Employee 3] | Supervisor selects "Employee 3" | `cmbEmployee.Selected.Name` = "Employee 3" | Directly observable on Screen1 and reused verbatim by ReviewSubmission and the confirmation banner message | N/A |

## Data Entry Label Contracts

| Required input | Persistent visible label | Shared field region |
|---|---|---|
| `cmbEmployee` | `lblEmployeeFieldLabel` ("Employee") | Both direct children of `tsHeaderCard` |
| `dpPayPeriodStart` | `lblPayPeriodFieldLabel` ("Pay Period Start") | Both direct children of `tsHeaderCard` |
| `txtMon1Hours`…`txtSun2Hours` (14 inputs) | `lblMon1Date`…`lblSun2Date` (the date **is** the persistent visible label for each hours field, per the requirements) | Each label/input pair are the only two children of their shared `tsDayRow*` container |
| `txtCommentsNotes` | `lblCommentsFieldLabel` ("Comments / Notes") | Both direct children of `tsCommentsCard` |

## Layout Budget Contracts

| Screen / container | Branch / screen-width source | Horizontal total-width arithmetic | Vertical height arithmetic | Protected controls |
|---|---|---|---|---|
| Screen1 `tsDayRow*` (all 14, phone width 390) | Single branch — no breakpoint (two-child label+fixed-input exception) | Root content 358 − week card padding 24 = 334; row gap 8 + input 92 = 100 fixed; label gets remaining 234px (fits "Wednesday, September 23" ≈204px) | Row `Height: =56` = input `Height: =48` + 4+4 padding | Both the date label and the hours input remain visible and tappable at every width |
| Screen1 `tsWeek1Card`/`tsWeek2Card` | N/A (fixed vertical stack) | N/A | Padding 32 + header 32 + 7 rows×56=392 + 7 gaps×8=56 = 512 | Header label + all 7 day rows fit inside `Height: =512` |
| ReviewSubmission `revWeek1Card`/`revWeek2Card` | N/A (fixed vertical stack) | N/A | Padding 32 + header 32 + 7 lines×28=196 + 7 gaps×8=56 = 316 | Header label + all 7 recap lines fit inside `Height: =316` |
| ReviewSubmission `revButtonRow` | Single branch — two-child proportional-fill exception | Root content 358, gap 12, each button `FillPortions: =1` → 173px each | `Height: =52` | Both `btnEdit` and `btnSubmit` stay ≥44px tall and reachable |

## Working Directory

`/Users/alecsangster/Desktop/Microsoft_Auto/employee-timesheet`

## Discovery Summary

- Controls used: `ModernDropdown`, `ModernDatePicker`, `ModernNumberInput`, `ModernText`,
  `ModernButton`, `GroupContainer` (`Variant: AutoLayout` only), `ModernTextInput`. All
  `describe_control` results confirmed in the discovery packet; `GroupContainer` confirmed
  to have **no `AccessibleLabel`** property, and `ModernButton` confirmed to have **no
  `FontWeight`** property.
- Data sources: none (Stage 1 explicitly excludes connectors/data sources).
- Connectors: none.
- Mock data: `colEmployees` (App-level collection, 3 rows: Employee 1/2/3).

## Dispatch

| Action | Screen | Target File | YAML Key | Name Prefix | Screen Brief |
|---|---|---|---|---|---|
| Create | Timesheet Entry | `/Users/alecsangster/Desktop/Microsoft_Auto/employee-timesheet/Screen1.pa.yaml` | Screen1 | `ts` | `/Users/alecsangster/Desktop/Microsoft_Auto/employee-timesheet/Screen1.screen-plan.md` |
| Create | Review Submission | `/Users/alecsangster/Desktop/Microsoft_Auto/employee-timesheet/ReviewSubmission.pa.yaml` | ReviewSubmission | `rev` | `/Users/alecsangster/Desktop/Microsoft_Auto/employee-timesheet/ReviewSubmission.screen-plan.md` |

Note: Screen1 is intentionally large (~60 controls, above the ~40-control rule of thumb)
because the requirements explicitly forbid a Gallery/repeater and require 14 individually
named inputs, labels, and row containers. This is a deliberate, approved exception, not an
oversight — do not consolidate into a repeater.

## Editor State Changes

```yaml
EditorState:
  ScreensOrder:
    - Screen1
    - ReviewSubmission
  ComponentDefinitionsOrder: []
```
