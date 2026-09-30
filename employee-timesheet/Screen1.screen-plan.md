# Screen Plan: Timesheet Entry (Screen1)

## Assignment

- Action: Create
- Target file: `/Users/alecsangster/Desktop/Microsoft_Auto/employee-timesheet/Screen1.pa.yaml`
- YAML key: `Screen1`
- Control name prefix: `ts`

## Specification

- Purpose: Supervisor enters an employee's two-week timesheet. Picking one employee and
  one pay-period-start date auto-generates all 14 day dates; the supervisor types hours
  per day; totals are always live; a button proceeds to the read-only recap screen.
- This screen is intentionally large (~60 controls) because the requirements explicitly
  forbid a Gallery/repeater and require 14 individually named inputs, 14 individually
  named date labels, and 14 individually named row containers. This is the approved
  design — do not consolidate the day rows into a repeater.
- Layout — top to bottom, all direct children of `tsRoot`, `FillPortions: =0`,
  `AlignInContainer: =AlignInContainer.Stretch`:
  1. `tsHeaderCard` — Employee + Pay Period Start
  2. `tsWeek1Card` — Week 1 header + 7 day rows (blue tint)
  3. `tsWeek2Card` — Week 2 header + 7 day rows (amber tint)
  4. `tsTotalsCard` — 3 live total lines
  5. `tsCommentsCard` — optional multiline comments
  6. `btnReviewEntry` — navigates to ReviewSubmission
- Root: `tsRoot` = `GroupContainer`/`AutoLayout`, `LayoutDirection: =LayoutDirection.Vertical`,
  `LayoutOverflowY: =LayoutOverflow.Scroll`, `Width: =Parent.Width`,
  `Height: =Parent.Height`, `LayoutMinWidth: =0`, `LayoutMinHeight: =0`,
  `LayoutAlignItems: =LayoutAlignItems.Stretch`, `LayoutGap: =16`, `PaddingTop: =16`,
  `PaddingBottom: =24`, `PaddingLeft: =16`, `PaddingRight: =16`,
  `Fill: =RGBA(244,246,249,1)`. Screen `Children:` contains only `tsRoot`.
- Breakpoint source: none needed. Every horizontal row on this screen is a two-child
  label+fixed-input row (the documented `QACHK-NO-REFLOW` exception); every other section
  is a single vertical column at every width. No `LayoutDirection` on this screen is ever
  conditional.
- Numeric layout budgets (phone width 390, root content width after root's own 16+16
  padding = 358):
  - **Day row** (applies to all 14 `tsDayRow*` containers): `LayoutDirection:
    =LayoutDirection.Horizontal`, `LayoutAlignItems: =LayoutAlignItems.Center`,
    `LayoutGap: =8`, `PaddingTop: =4`, `PaddingBottom: =4`, `PaddingLeft: =0`,
    `PaddingRight: =0`, `LayoutMinWidth: =0`, `LayoutMinHeight: =0`, `Height: =56`,
    `FillPortions: =0`, `AlignInContainer: =AlignInContainer.Stretch`. Card content width
    = 358 − (week card's own 12+12 padding) = 334. Row budget: gap 8 + input width 92 =
    100 fixed; date label gets `FillPortions: =1` → 234px, comfortably fits the longest
    value `"Wednesday, September 23"` (~204px at Size 15). Input `Height: =48` (≥44,
    prefer 48 touch target) inside a `Height: =56` row (4px top/bottom padding) — exactly
    the "comfortably fit a ≥44px touch target plus padding" requirement.
  - **Week card vertical budget** (`tsWeek1Card`/`tsWeek2Card`): `PaddingTop: =16`,
    `PaddingBottom: =16`, `PaddingLeft: =12`, `PaddingRight: =12`, `LayoutGap: =8`.
    Children = header label (Height 32) + 7 day rows (Height 56 each) = 8 children → 7
    gaps @8 = 56. `Height: =16+16+32+56+(7*56) = 512`. Set `Height: =512` explicitly on
    both week cards.
  - **Header card** (`tsHeaderCard`): `PaddingTop/Bottom/Left/Right: =20`,
    `LayoutGap: =16`. Children: employee label(20)+gap4+dropdown(52) = 76-tall block, gap
    16, date label(20)+gap4+date picker(52) = 76-tall block. `Height: =20+20+76+16+76 =
    208`.
  - **Totals card** (`tsTotalsCard`): `PaddingTop/Bottom/Left/Right: =20`,
    `LayoutGap: =8`. Children: 28 (week1) + 8 + 28 (week2) + 8 + 36 (total, bold/larger) =
    108. `Height: =20+20+108 = 148`.
  - **Comments card** (`tsCommentsCard`): `PaddingTop/Bottom/Left/Right: =20`,
    `LayoutGap: =8`. Children: label 20 + gap 8 + input 120 = 148. `Height: =20+20+148 =
    188`.
  - `btnReviewEntry`: `Height: =52`, `FillPortions: =0`,
    `AlignInContainer: =AlignInContainer.Stretch` (no explicit `Width` — stretches to the
    root's content width, ~358px, comfortably fitting "Review & Submit" at `Size: =18`).
- Text fit: every date label and total label uses `Wrap: =false` (single-line values,
  budgeted above); `txtCommentsNotes` is the only control that accepts free-flowing
  multi-line text and needs no `Wrap` property (it is an input, not a `ModernText`).
- Visual hierarchy: section headers (`lblWeek1Header`, `lblWeek2Header`) at `Size: =20`
  Bold; field captions at `Size: =13` Semibold secondary; body/date text at `Size: =15`
  Normal; `lblTotalHours` at `Size: =20` Bold as the visual summary line. All per the
  shared Visual Contract.
- Core visualization: N/A — this screen is a data-entry form, not a visualization.
- Grid contract: N/A — no `GridLayout` on this screen.
- Column headers: N/A — each day row already carries its own persistent date label as
  the "header" for that row; there is no headerless repeated-input row on this screen.
- Controls: see "Day Row Pattern" table below for the 14 repeated rows/labels/inputs;
  everything else is named explicitly in the requirements and used verbatim
  (`cmbEmployee`, `dpPayPeriodStart`, `txtCommentsNotes`, `btnReviewEntry`).
- Data binding: `cmbEmployee.Items: =colEmployees` (App-level collection),
  `ItemDisplayText: =ThisItem.Name`. All 14 dates and all 3 totals are formulas reading
  `dpPayPeriodStart.SelectedDate` and the 14 `txt*Hours.Value` outputs directly — no
  collection, no variable. `txtCommentsNotes.Text` is read directly by ReviewSubmission;
  it is never copied into a variable.
- Navigation: `btnReviewEntry.OnSelect: =Navigate(ReviewSubmission, ScreenTransition.None)`.
- State: no `OnVisible` needed on this screen (nothing to initialize — `dpPayPeriodStart`
  self-populates via `DefaultDate`, and every input defaults to `0` via its own
  `Default` property).

## Day Row Pattern

Every row below has the exact same container/label/input shape (values from "Numeric
layout budgets" above). Build all 14 using this shape, substituting the row/label/input
names and the offset:

```yaml
- tsDayRowMon1:
    Control: GroupContainer
    Variant: AutoLayout
    Properties:
      LayoutDirection: =LayoutDirection.Horizontal
      LayoutAlignItems: =LayoutAlignItems.Center
      LayoutJustifyContent: =LayoutJustifyContent.Start
      LayoutGap: =8
      PaddingTop: =4
      PaddingBottom: =4
      PaddingLeft: =0
      PaddingRight: =0
      LayoutMinWidth: =0
      LayoutMinHeight: =0
      Height: =56
      FillPortions: =0
      AlignInContainer: =AlignInContainer.Stretch
    Children:
      - lblMon1Date:
          Control: ModernText
          Properties:
            Text: =Text(dpPayPeriodStart.SelectedDate + 0, "dddd, mmmm d")
            Color: =RGBA(30,41,59,1)
            Size: =15
            FontWeight: =FontWeight.Normal
            Align: =Align.Left
            VerticalAlign: =VerticalAlign.Middle
            Wrap: =false
            AutoHeight: =false
            Height: =48
            PaddingTop: =0
            PaddingBottom: =0
            PaddingLeft: =0
            PaddingRight: =0
            FillPortions: =1
            AlignInContainer: =AlignInContainer.Center
            AccessibleLabel: ="Date for Monday, week 1"
            Visible: =true
      - txtMon1Hours:
          Control: ModernNumberInput
          Properties:
            Min: =0
            Max: =24
            Precision: =DecimalPrecision.'1'
            Step: =0.5
            Default: =0
            HintText: ="0-24 hours"
            ValidationState: =If(Self.Value < 0 || Self.Value > 24, ValidationState.Error, ValidationState.None)
            Height: =48
            FillPortions: =0
            Width: =92
            AlignInContainer: =AlignInContainer.Center
            AccessibleLabel: ="Hours worked Monday, week 1"
```

Substitution table (row / label / input / weekday-name-used-in-AccessibleLabel / offset):

| # | Row | Label | Input | Weekday text | Offset |
|---|-----|-------|-------|--------------|--------|
| 1 | `tsDayRowMon1` | `lblMon1Date` | `txtMon1Hours` | Monday, week 1 | 0 |
| 2 | `tsDayRowTue1` | `lblTue1Date` | `txtTue1Hours` | Tuesday, week 1 | 1 |
| 3 | `tsDayRowWed1` | `lblWed1Date` | `txtWed1Hours` | Wednesday, week 1 | 2 |
| 4 | `tsDayRowThu1` | `lblThu1Date` | `txtThu1Hours` | Thursday, week 1 | 3 |
| 5 | `tsDayRowFri1` | `lblFri1Date` | `txtFri1Hours` | Friday, week 1 | 4 |
| 6 | `tsDayRowSat1` | `lblSat1Date` | `txtSat1Hours` | Saturday, week 1 | 5 |
| 7 | `tsDayRowSun1` | `lblSun1Date` | `txtSun1Hours` | Sunday, week 1 | 6 |
| 8 | `tsDayRowMon2` | `lblMon2Date` | `txtMon2Hours` | Monday, week 2 | 7 |
| 9 | `tsDayRowTue2` | `lblTue2Date` | `txtTue2Hours` | Tuesday, week 2 | 8 |
| 10 | `tsDayRowWed2` | `lblWed2Date` | `txtWed2Hours` | Wednesday, week 2 | 9 |
| 11 | `tsDayRowThu2` | `lblThu2Date` | `txtThu2Hours` | Thursday, week 2 | 10 |
| 12 | `tsDayRowFri2` | `lblFri2Date` | `txtFri2Hours` | Friday, week 2 | 11 |
| 13 | `tsDayRowSat2` | `lblSat2Date` | `txtSat2Hours` | Saturday, week 2 | 12 |
| 14 | `tsDayRowSun2` | `lblSun2Date` | `txtSun2Hours` | Sunday, week 2 | 13 |

Rows 1-7 are the 7 `Children:` of `tsWeek1Card` (after its header label); rows 8-14 are the
7 `Children:` of `tsWeek2Card` (after its header label). Every property value, including
`Min`/`Max`/`Precision`/`Step`/`Default`/`HintText`/`ValidationState`, is identical across
all 14 inputs except the `AccessibleLabel` text and the date-label offset. `Min`/`Max` are
the primary enforcement mechanism (the platform constrains committed values to [0,24] with
0.5 steps); `ValidationState` is a supplemental visual affordance layered on top — there is
no separate custom clamp code in this stage.

## Header, Week Header, Totals, Comments, Button — full structure

```yaml
- tsHeaderCard:
    Control: GroupContainer
    Variant: AutoLayout
    Properties:
      LayoutDirection: =LayoutDirection.Vertical
      LayoutAlignItems: =LayoutAlignItems.Stretch
      LayoutGap: =16
      PaddingTop: =20
      PaddingBottom: =20
      PaddingLeft: =20
      PaddingRight: =20
      LayoutMinWidth: =0
      LayoutMinHeight: =0
      Height: =208
      FillPortions: =0
      AlignInContainer: =AlignInContainer.Stretch
      Fill: =RGBA(255,255,255,1)
      DropShadow: =DropShadow.Light
      RadiusTopLeft: =8
      RadiusTopRight: =8
      RadiusBottomLeft: =8
      RadiusBottomRight: =8
    Children:
      - lblEmployeeFieldLabel:
          Control: ModernText
          Properties:
            Text: ="Employee"
            Color: =RGBA(100,116,139,1)
            Size: =13
            FontWeight: =FontWeight.Semibold
            Wrap: =false
            AutoHeight: =false
            Height: =20
            PaddingTop: =0
            PaddingBottom: =0
            PaddingLeft: =0
            PaddingRight: =0
            FillPortions: =0
            AlignInContainer: =AlignInContainer.Stretch
            AccessibleLabel: ="Employee field label"
      - cmbEmployee:
          Control: ModernDropdown
          Properties:
            Items: =colEmployees
            ItemDisplayText: =ThisItem.Name
            Height: =52
            FillPortions: =0
            AlignInContainer: =AlignInContainer.Stretch
            AccessibleLabel: ="Employee"
      - lblPayPeriodFieldLabel:
          Control: ModernText
          Properties:
            Text: ="Pay Period Start"
            Color: =RGBA(100,116,139,1)
            Size: =13
            FontWeight: =FontWeight.Semibold
            Wrap: =false
            AutoHeight: =false
            Height: =20
            PaddingTop: =0
            PaddingBottom: =0
            PaddingLeft: =0
            PaddingRight: =0
            FillPortions: =0
            AlignInContainer: =AlignInContainer.Stretch
            AccessibleLabel: ="Pay period start date field label"
      - dpPayPeriodStart:
          Control: ModernDatePicker
          Properties:
            DefaultDate: =Today()
            Height: =52
            FillPortions: =0
            AlignInContainer: =AlignInContainer.Stretch
            AccessibleLabel: ="Pay period start date"

- tsWeek1Card:
    Control: GroupContainer
    Variant: AutoLayout
    Properties:
      LayoutDirection: =LayoutDirection.Vertical
      LayoutAlignItems: =LayoutAlignItems.Stretch
      LayoutGap: =8
      PaddingTop: =16
      PaddingBottom: =16
      PaddingLeft: =12
      PaddingRight: =12
      LayoutMinWidth: =0
      LayoutMinHeight: =0
      Height: =512
      FillPortions: =0
      AlignInContainer: =AlignInContainer.Stretch
      Fill: =RGBA(219,234,254,0.5)
      DropShadow: =DropShadow.Light
      RadiusTopLeft: =8
      RadiusTopRight: =8
      RadiusBottomLeft: =8
      RadiusBottomRight: =8
    Children:
      - lblWeek1Header:
          Control: ModernText
          Properties:
            Text: ="Week 1"
            Color: =RGBA(30,41,59,1)
            Size: =20
            FontWeight: =FontWeight.Bold
            Wrap: =false
            AutoHeight: =false
            Height: =32
            PaddingTop: =0
            PaddingBottom: =0
            PaddingLeft: =0
            PaddingRight: =0
            FillPortions: =0
            AlignInContainer: =AlignInContainer.Stretch
            AccessibleLabel: ="Week 1 section header"
      # then the 7 Week 1 day rows from the Day Row Pattern table, in order

# tsWeek2Card is identical in shape to tsWeek1Card except:
#   Fill: =RGBA(254,243,199,0.5)
#   lblWeek2Header.Text: ="Week 2", AccessibleLabel: ="Week 2 section header"
#   the 7 Week 2 day rows from the Day Row Pattern table, in order

- tsTotalsCard:
    Control: GroupContainer
    Variant: AutoLayout
    Properties:
      LayoutDirection: =LayoutDirection.Vertical
      LayoutAlignItems: =LayoutAlignItems.Stretch
      LayoutGap: =8
      PaddingTop: =20
      PaddingBottom: =20
      PaddingLeft: =20
      PaddingRight: =20
      LayoutMinWidth: =0
      LayoutMinHeight: =0
      Height: =148
      FillPortions: =0
      AlignInContainer: =AlignInContainer.Stretch
      Fill: =RGBA(255,255,255,1)
      DropShadow: =DropShadow.Light
      RadiusTopLeft: =8
      RadiusTopRight: =8
      RadiusBottomLeft: =8
      RadiusBottomRight: =8
    Children:
      - lblWeek1Total:
          Control: ModernText
          Properties:
            Text: '="Week 1 Total: " & Text(txtMon1Hours.Value + txtTue1Hours.Value + txtWed1Hours.Value + txtThu1Hours.Value + txtFri1Hours.Value + txtSat1Hours.Value + txtSun1Hours.Value, "0.0")'
            Color: =RGBA(30,41,59,1)
            Size: =16
            FontWeight: =FontWeight.Normal
            Wrap: =false
            AutoHeight: =false
            Height: =28
            PaddingTop: =0
            PaddingBottom: =0
            PaddingLeft: =0
            PaddingRight: =0
            FillPortions: =0
            AlignInContainer: =AlignInContainer.Stretch
            AccessibleLabel: ="Week 1 total hours"
      - lblWeek2Total:
          Control: ModernText
          Properties:
            Text: '="Week 2 Total: " & Text(txtMon2Hours.Value + txtTue2Hours.Value + txtWed2Hours.Value + txtThu2Hours.Value + txtFri2Hours.Value + txtSat2Hours.Value + txtSun2Hours.Value, "0.0")'
            Color: =RGBA(30,41,59,1)
            Size: =16
            FontWeight: =FontWeight.Normal
            Wrap: =false
            AutoHeight: =false
            Height: =28
            PaddingTop: =0
            PaddingBottom: =0
            PaddingLeft: =0
            PaddingRight: =0
            FillPortions: =0
            AlignInContainer: =AlignInContainer.Stretch
            AccessibleLabel: ="Week 2 total hours"
      - lblTotalHours:
          Control: ModernText
          Properties:
            Text: '="Total Hours: " & Text((txtMon1Hours.Value + txtTue1Hours.Value + txtWed1Hours.Value + txtThu1Hours.Value + txtFri1Hours.Value + txtSat1Hours.Value + txtSun1Hours.Value) + (txtMon2Hours.Value + txtTue2Hours.Value + txtWed2Hours.Value + txtThu2Hours.Value + txtFri2Hours.Value + txtSat2Hours.Value + txtSun2Hours.Value), "0.0")'
            Color: =RGBA(30,41,59,1)
            Size: =20
            FontWeight: =FontWeight.Bold
            Wrap: =false
            AutoHeight: =false
            Height: =36
            PaddingTop: =0
            PaddingBottom: =0
            PaddingLeft: =0
            PaddingRight: =0
            FillPortions: =0
            AlignInContainer: =AlignInContainer.Stretch
            AccessibleLabel: ="Total hours for the pay period"

- tsCommentsCard:
    Control: GroupContainer
    Variant: AutoLayout
    Properties:
      LayoutDirection: =LayoutDirection.Vertical
      LayoutAlignItems: =LayoutAlignItems.Stretch
      LayoutGap: =8
      PaddingTop: =20
      PaddingBottom: =20
      PaddingLeft: =20
      PaddingRight: =20
      LayoutMinWidth: =0
      LayoutMinHeight: =0
      Height: =188
      FillPortions: =0
      AlignInContainer: =AlignInContainer.Stretch
      Fill: =RGBA(255,255,255,1)
      DropShadow: =DropShadow.Light
      RadiusTopLeft: =8
      RadiusTopRight: =8
      RadiusBottomLeft: =8
      RadiusBottomRight: =8
    Children:
      - lblCommentsFieldLabel:
          Control: ModernText
          Properties:
            Text: ="Comments / Notes"
            Color: =RGBA(100,116,139,1)
            Size: =13
            FontWeight: =FontWeight.Semibold
            Wrap: =false
            AutoHeight: =false
            Height: =20
            PaddingTop: =0
            PaddingBottom: =0
            PaddingLeft: =0
            PaddingRight: =0
            FillPortions: =0
            AlignInContainer: =AlignInContainer.Stretch
            AccessibleLabel: ="Comments and notes field label"
      - txtCommentsNotes:
          Control: ModernTextInput
          Properties:
            Type: =TextInputType.Multiline
            Placeholder: ="Add any comments or notes (optional)"
            Height: =120
            FillPortions: =0
            AlignInContainer: =AlignInContainer.Stretch
            AccessibleLabel: ="Comments or notes (optional)"

- btnReviewEntry:
    Control: ModernButton
    Properties:
      Text: ="Review & Submit"
      Appearance: =ButtonAppearance.Primary
      BasePaletteColor: =RGBA(30,41,63,1)
      Color: =RGBA(255,255,255,1)
      Size: =18
      Height: =52
      FillPortions: =0
      AlignInContainer: =AlignInContainer.Stretch
      AccessibleLabel: ="Review and submit timesheet"
      OnSelect: =Navigate(ReviewSubmission, ScreenTransition.None)
```

## Required Record Fields

| Field key | Record surface | Required field | Source field | Bound control | Exact formula | Placement and visibility |
|---|---|---|---|---|---|---|
| `day-date` | 14 day rows `tsDayRowMon1`…`tsDayRowSun2` | Date for this pay-period day | `dpPayPeriodStart.SelectedDate + offset` (0-13) | `lblMon1Date`…`lblSun2Date` | `=Text(dpPayPeriodStart.SelectedDate + <offset>, "dddd, mmmm d")` | Left side of the row, `FillPortions: =1`, always visible, single line |
| `day-hours` | Same 14 day rows | Hours worked this day (0-24, editable, default 0) | User-entered value | `txtMon1Hours`…`txtSun2Hours` | `ModernNumberInput.Value` (native) | Right side of the row, fixed `Width: =92`, always visible |

## State-Driven Surface Visibility

N/A — no whole-surface state gating on this screen.

## Required Actions

| Action | Preconditions | Entry point and event | Source and stable ID | Transition and postcondition | Mutation write set | Receipt proof set | Observer and evidence |
|---|---|---|---|---|---|---|---|
| Enter/calculate daily and total hours | None — always available | `txtMon1Hours`…`txtSun2Hours` (`ModernNumberInput.Value`, native reactive read) | N/A — no data source this stage; the 14 controls are the source of truth | Each `Value` change recomputes the week/total sums | N/A | N/A | `lblWeek1Total`/`lblWeek2Total`/`lblTotalHours` recompute immediately from the live formulas above |
| Select employee for timesheet | `colEmployees` populated in `App.OnStart` | `cmbEmployee` (native `Selected` commit on tap/click) | `colEmployees` | `cmbEmployee.Selected` = chosen row | N/A | N/A | `cmbEmployee.Selected.Name` read directly by ReviewSubmission's `lblReviewEmployee` |
| Set pay period start (auto-populates all 14 dates) | None — `DefaultDate: =Today()` always populates it | `dpPayPeriodStart` (native `SelectedDate` commit) | N/A | `SelectedDate` updates | N/A | N/A | All 14 `lbl*Date` labels and ReviewSubmission's date/day lines recompute from the new `SelectedDate` |
| Navigate to Review & Submit | None — always reachable | `btnReviewEntry.OnSelect` | N/A | Screen changes to `ReviewSubmission` | N/A | N/A | `ReviewSubmission` renders using the current values of every Screen1 control listed above |
| Optional comments never block submit | `txtCommentsNotes` may be blank | `txtCommentsNotes` (native `Text`) | N/A | N/A | N/A | N/A | ReviewSubmission's comments recap shows entered text or `"(No comments entered)"`; `btnSubmit` is never disabled by this field |

## Data Entry Label Contracts

| Required input | Persistent visible label | Shared field region |
|---|---|---|
| `cmbEmployee` | `lblEmployeeFieldLabel` ("Employee") | Both are direct children of `tsHeaderCard` |
| `dpPayPeriodStart` | `lblPayPeriodFieldLabel` ("Pay Period Start") | Both are direct children of `tsHeaderCard` |
| `txtMon1Hours`…`txtSun2Hours` (14 inputs) | `lblMon1Date`…`lblSun2Date` (14 labels — the date **is** the persistent visible label for each hours field, per the requirements) | Each label/input pair are the only two children of their shared `tsDayRow*` container |
| `txtCommentsNotes` | `lblCommentsFieldLabel` ("Comments / Notes") | Both are direct children of `tsCommentsCard` |

## Functional Test Scenarios

| Scenario | Given | When | Then | Evidence surface | Boundary or negative case |
|---|---|---|---|---|---|
| Live weekly/total calculation | `dpPayPeriodStart` = September 21, 2026; Week 1 entries Mon-Thu=8, Fri=7.5, Sat/Sun=0; Week 2 entries Mon-Fri=8, Sat/Sun=0 | Supervisor types the values above into the 14 hour inputs | Week 1 sum = 39.5, Week 2 sum = 40.0, Total = 79.5 | `lblWeek1Total.Text` = "Week 1 Total: 39.5", `lblWeek2Total.Text` = "Week 2 Total: 40.0", `lblTotalHours.Text` = "Total Hours: 79.5" | N/A |
| Out-of-range hour entry | Any `txt*Hours` control, `Min: =0`, `Max: =24` | Supervisor attempts to enter a value outside 0-24 | The platform's `Min`/`Max` bounds constrain the committed value; if a transient value outside range is ever represented, `ValidationState` shows `Error` | `txt*Hours.ValidationState` | Boundary: exactly `0` and exactly `24` are both valid, non-error values |
| Auto-date recompute on date change | `dpPayPeriodStart.SelectedDate` initially Today() | Supervisor picks a new pay-period start date | All 14 `lbl*Date` labels immediately show the new 14-day date range | Each `lbl*Date.Text` | N/A |
| Employee selection is the single source of truth | `colEmployees` = [Employee 1, Employee 2, Employee 3] | Supervisor selects "Employee 3" | `cmbEmployee.Selected.Name` = "Employee 3" | Directly observable on this screen and reused verbatim by ReviewSubmission | N/A |
| Optional comments never block navigation | `txtCommentsNotes.Text` = "" (blank) | Supervisor taps `btnReviewEntry` with comments left blank | Navigation proceeds; nothing on this screen requires a non-blank comment | `btnReviewEntry` has no `DisplayMode` gate tied to `txtCommentsNotes` | N/A |

## Relevant Data Source Schemas

- `colEmployees` (App-level mock collection, seeded in `App.OnStart`): single field
  `Name: Text`. Rows: `{Name: "Employee 1"}`, `{Name: "Employee 2"}`,
  `{Name: "Employee 3"}`.

## Relevant API Details

N/A — no APIs or connectors in this stage.

## Required Variants

- `GroupContainer` -> `AutoLayout` (every container on this screen).

## Control Definitions

### GroupContainer
Creation keywords:
```yaml
Control: GroupContainer
Variant: AutoLayout
```
Valid input properties used here: `BorderColor`, `BorderStyle`, `BorderThickness`,
`DropShadow` (Enum name: `DropShadow`; members `Bold`/`ExtraBold`/`Light`/`None`/
`Regular`/`Semibold`/`Semilight`), `Fill`, `Height`, `RadiusTopLeft`, `RadiusTopRight`,
`RadiusBottomLeft`, `RadiusBottomRight`, `Visible`, `Width`, `X`, `Y`,
`LayoutAlignItems` (Enum name: `LayoutAlignItems`; members `Center`/`End`/`Start`/
`Stretch`), `LayoutDirection` (Enum name: `LayoutDirection`; members `Horizontal`/
`Vertical` — required), `LayoutGap`, `LayoutJustifyContent` (Enum name:
`LayoutJustifyContent`; members `Center`/`End`/`SpaceBetween`/`Start`),
`LayoutOverflowX`/`LayoutOverflowY` (Enum name: `LayoutOverflow`; members `Hide`/
`Scroll`), `LayoutWrap`, `PaddingTop`/`PaddingBottom`/`PaddingLeft`/`PaddingRight`,
`AlignInContainer` (Enum name: `AlignInContainer`; members `Center`/`End`/
`SetByContainer`/`Start`/`Stretch`), `FillPortions`, `LayoutMinWidth`, `LayoutMinHeight`,
`LayoutMaxWidth`, `LayoutMaxHeight`. **No `AccessibleLabel` property — never set it on
this control type.**

### ModernText
Creation keywords:
```yaml
Control: ModernText
```
Valid input properties used here: `AccessibleLabel`, `Align` (Enum name: `Align`;
members `Center`/`Justify`/`Left`/`Right`), `AutoHeight`, `Color`, `FontWeight` (Enum
name: `FontWeight`; members `Bold`/`Semibold`/`Normal`/`Lighter`), `Height`,
`PaddingTop`/`PaddingBottom`/`PaddingLeft`/`PaddingRight`, `Size`, `Text`,
`VerticalAlign` (Enum name: `VerticalAlign`; members `Bottom`/`Middle`/`Top`), `Visible`,
`Width`, `Wrap`, `X`, `Y`, `AlignInContainer`, `FillPortions`, `LayoutMinWidth`,
`LayoutMinHeight`.

### ModernDropdown
Creation keywords:
```yaml
Control: ModernDropdown
```
Valid input properties used here: `AccessibleLabel`, `Height`, `Items`,
`ItemDisplayText`, `Visible`, `Width`, `AlignInContainer`, `FillPortions`,
`LayoutMinWidth`, `LayoutMinHeight`. Output: `Selected`.

### ModernDatePicker
Creation keywords:
```yaml
Control: ModernDatePicker
```
Valid input properties used here: `AccessibleLabel`, `DefaultDate`, `Height`, `Visible`,
`Width`, `AlignInContainer`, `FillPortions`, `LayoutMinWidth`, `LayoutMinHeight`. Output:
`SelectedDate`.

### ModernNumberInput
Creation keywords:
```yaml
Control: ModernNumberInput
```
Valid input properties used here: `AccessibleLabel`, `Default`, `Height`, `HintText`,
`Max`, `Min`, `Precision` (Enum name: `DecimalPrecision`; compile-ready literal used here:
`=DecimalPrecision.'1'` — the member is quoted because it starts with a digit), `Step`,
`ValidationState` (Enum name: `ValidationState`; compile-ready literals used here:
`=ValidationState.Error`, `=ValidationState.None`), `Visible`, `Width`,
`AlignInContainer`, `FillPortions`, `LayoutMinWidth`, `LayoutMinHeight`. Output: `Value`.

### ModernTextInput
Creation keywords:
```yaml
Control: ModernTextInput
```
Valid input properties used here: `AccessibleLabel`, `Height`, `Placeholder`, `Type`
(Enum name: `TextInputType`; compile-ready literal used here:
`=TextInputType.Multiline`), `Visible`, `Width`, `AlignInContainer`, `FillPortions`,
`LayoutMinWidth`, `LayoutMinHeight`. Output: `Text`.

### ModernButton
Creation keywords:
```yaml
Control: ModernButton
```
Valid input properties used here: `AccessibleLabel`, `Appearance` (Enum name:
`ButtonAppearance`; compile-ready literal used here: `=ButtonAppearance.Primary`),
`BasePaletteColor`, `Color`, `Height`, `OnSelect`, `Size`, `Text`, `Visible`, `Width`,
`AlignInContainer`, `FillPortions`, `LayoutMinWidth`, `LayoutMinHeight`. **No
`FontWeight` property on this control — do not set it.**
