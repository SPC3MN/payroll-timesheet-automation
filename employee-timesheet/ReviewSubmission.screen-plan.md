# Screen Plan: Review Submission (ReviewSubmission)

## Assignment

- Action: Create
- Target file: `/Users/alecsangster/Desktop/Microsoft_Auto/employee-timesheet/ReviewSubmission.pa.yaml`
- YAML key: `ReviewSubmission`
- Control name prefix: `rev`

## Specification

- Purpose: read-only recap of everything entered on Screen1, plus a stage-1 submit stub
  (no data-source write) and a way back to edit. Every displayed value is a direct formula
  reference to a named Screen1 control — there is no local copy of any value.
- Layout — top to bottom, all direct children of `revRoot`, `FillPortions: =0`,
  `AlignInContainer: =AlignInContainer.Stretch`:
  1. `revPageTitle` — "Review & Submit" page heading
  2. `revConfirmationBanner` — green success banner, hidden until Submit
  3. `revSummaryCard` — Employee + Pay Period range
  4. `revWeek1Card` — Week 1 header + 7 read-only day/hours lines (blue tint)
  5. `revWeek2Card` — Week 2 header + 7 read-only day/hours lines (amber tint)
  6. `revTotalsCard` — 3 live total lines (same formulas as Screen1)
  7. `revCommentsCard` — comments recap with empty-state
  8. `revButtonRow` — `btnEdit` + `btnSubmit`
- Root: `revRoot` = `GroupContainer`/`AutoLayout`, `LayoutDirection:
  =LayoutDirection.Vertical`, `LayoutOverflowY: =LayoutOverflow.Scroll`,
  `Width: =Parent.Width`, `Height: =Parent.Height`, `LayoutMinWidth: =0`,
  `LayoutMinHeight: =0`, `LayoutAlignItems: =LayoutAlignItems.Stretch`,
  `LayoutGap: =16`, `PaddingTop: =16`, `PaddingBottom: =24`, `PaddingLeft: =16`,
  `PaddingRight: =16`, `Fill: =RGBA(244,246,249,1)`. Screen `Children:` contains only
  `revRoot`.
- Breakpoint source: none needed — every section is a single vertical column at every
  width; `revButtonRow` is a two-child row where both children use `FillPortions: =1`
  (the documented `QACHK-NO-REFLOW` proportional-fill exception), so it needs no
  `LayoutWrap`/breakpoint either.
- Numeric layout budgets (phone width 390, root content width after root's own 16+16
  padding = 358):
  - `revPageTitle`: `Height: =36`, single line.
  - `revConfirmationBanner`: `PaddingTop/Bottom/Left/Right: =16`, one text line
    `Height: =24`. `Height: =16+16+24 = 56`.
  - `revSummaryCard`: `PaddingTop/Bottom/Left/Right: =20`, `LayoutGap: =8`. Employee line
    `Height: =28` (single line, `Wrap: =false`, fits `"Employee: Employee 2"` easily).
    Pay Period line uses `AutoHeight: =true` + `Wrap: =true` (no fixed `Height`) because
    `"Pay Period: September 21, 2026 – October 4, 2026"` (~50 chars) does not fit one line
    in the card's content width (358 − 40 = 318 at ~9px/char ≈ 450px needed); budget 2
    lines ≈ `52`. `Height: =20+20+28+8+52 = 128`.
  - `revWeek1Card`/`revWeek2Card`: `PaddingTop/Bottom: =16`, `PaddingLeft/Right: =12`,
    `LayoutGap: =8`. Children = header (32) + 7 recap lines (28 each, single
    `ModernText`, no row wrapper needed since there is no paired input control) = 8
    children → 7 gaps @8 = 56. Recap line text (e.g. `"Wednesday, September 24 — 8 hrs"`,
    ~33 chars) fits one line at `Size: =14` within card content width (358 − 24 = 334).
    `Height: =16+16+32+56+(7*28) = 316`.
  - `revTotalsCard`: identical shape/heights to Screen1's `tsTotalsCard` —
    `Height: =148` (same three formulas, same "0.0" format, same text).
  - `revCommentsCard`: `PaddingTop/Bottom/Left/Right: =20`, `LayoutGap: =8`. Caption
    `Height: =20`. Value uses `AutoHeight: =true` + `Wrap: =true` (comments are free text);
    budget 3 lines ≈ `60`. `Height: =20+20+20+8+60 = 128`.
  - `revButtonRow`: `LayoutDirection: =LayoutDirection.Horizontal`,
    `LayoutGap: =12`, `Height: =52`, `FillPortions: =0`,
    `AlignInContainer: =AlignInContainer.Stretch`. Both buttons `FillPortions: =1`,
    `Height: =52` → each gets `(358-12)/2 = 173px`, comfortably fitting "Edit"/"Submit".
- Text fit: all recap `ModernText` values are single-line (`Wrap: =false`) except the Pay
  Period line and the Comments value, which are `AutoHeight: =true` + `Wrap: =true` for
  their longer/variable content, per the budgets above.
- Visual hierarchy: `revPageTitle` `Size: =24` Bold (largest element on the screen);
  section headers `Size: =20` Bold; body/recap lines `Size: =15` (summary) / `Size: =14`
  (day recap lines, slightly smaller since they are denser); `lblReviewTotalHours`
  `Size: =20` Bold. All per the shared Visual Contract.
- Core visualization: N/A — recap screen, not a visualization.
- Grid contract: N/A.
- Column headers: N/A — no repeated input row on this screen (recap lines are read-only
  combined text, not inputs).
- Controls: see "Recap Day Line Pattern" table below for the 14 repeated lines;
  everything else is named explicitly below.
- Data binding: **every** value on this screen is a direct formula reference into
  `Screen1`'s named controls (`cmbEmployee.Selected.Name`, `dpPayPeriodStart.SelectedDate`,
  `txtMon1Hours.Value` … `txtSun2Hours.Value`, `txtCommentsNotes.Text`). No collection or
  variable duplicates any of these values — this is required for
  `QACHK-SHARED-SOURCE-DERIVATION`.
- Navigation: `btnEdit.OnSelect: =Navigate(Screen1, ScreenTransition.None)`.
- State: `OnVisible: |- =UpdateContext({varSubmissionConfirmed: false})` — a screen-scoped
  context variable, reset every time this screen is (re-)entered. Never call `Navigate`
  from `OnVisible`.

## Recap Day Line Pattern

Every line below is a single read-only `ModernText` (no paired input, so no row wrapper is
needed — this differs from Screen1's two-child rows). Build all 14 using this shape:

```yaml
- lblReviewMon1:
    Control: ModernText
    Properties:
      Text: =Text(dpPayPeriodStart.SelectedDate + 0, "dddd, mmmm d") & " — " & Text(txtMon1Hours.Value, "0.#") & " hrs"
      Color: =RGBA(30,41,59,1)
      Size: =14
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
      AccessibleLabel: ="Monday week 1 date and hours"
```

Substitution table (label / offset / source hours control / AccessibleLabel text):

| # | Label | Offset | Source hours control | AccessibleLabel text |
|---|-------|--------|-----------------------|------------------------|
| 1 | `lblReviewMon1` | 0 | `txtMon1Hours` | Monday week 1 date and hours |
| 2 | `lblReviewTue1` | 1 | `txtTue1Hours` | Tuesday week 1 date and hours |
| 3 | `lblReviewWed1` | 2 | `txtWed1Hours` | Wednesday week 1 date and hours |
| 4 | `lblReviewThu1` | 3 | `txtThu1Hours` | Thursday week 1 date and hours |
| 5 | `lblReviewFri1` | 4 | `txtFri1Hours` | Friday week 1 date and hours |
| 6 | `lblReviewSat1` | 5 | `txtSat1Hours` | Saturday week 1 date and hours |
| 7 | `lblReviewSun1` | 6 | `txtSun1Hours` | Sunday week 1 date and hours |
| 8 | `lblReviewMon2` | 7 | `txtMon2Hours` | Monday week 2 date and hours |
| 9 | `lblReviewTue2` | 8 | `txtTue2Hours` | Tuesday week 2 date and hours |
| 10 | `lblReviewWed2` | 9 | `txtWed2Hours` | Wednesday week 2 date and hours |
| 11 | `lblReviewThu2` | 10 | `txtThu2Hours` | Thursday week 2 date and hours |
| 12 | `lblReviewFri2` | 11 | `txtFri2Hours` | Friday week 2 date and hours |
| 13 | `lblReviewSat2` | 12 | `txtSat2Hours` | Saturday week 2 date and hours |
| 14 | `lblReviewSun2` | 13 | `txtSun2Hours` | Sunday week 2 date and hours |

Rows 1-7 are the 7 `Children:` of `revWeek1Card` (after `lblReviewWeek1Header`); rows 8-14
are the 7 `Children:` of `revWeek2Card` (after `lblReviewWeek2Header`).

## Full structure — title, banner, summary, totals, comments, buttons

```yaml
- revPageTitle:
    Control: ModernText
    Properties:
      Text: ="Review & Submit"
      Color: =RGBA(30,41,63,1)
      Size: =24
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
      AccessibleLabel: ="Review and submit page title"

- revConfirmationBanner:
    Control: GroupContainer
    Variant: AutoLayout
    Properties:
      LayoutDirection: =LayoutDirection.Vertical
      LayoutAlignItems: =LayoutAlignItems.Stretch
      PaddingTop: =16
      PaddingBottom: =16
      PaddingLeft: =16
      PaddingRight: =16
      LayoutMinWidth: =0
      LayoutMinHeight: =0
      Height: =56
      FillPortions: =0
      AlignInContainer: =AlignInContainer.Stretch
      Fill: =RGBA(220,252,231,1)
      DropShadow: =DropShadow.Light
      RadiusTopLeft: =8
      RadiusTopRight: =8
      RadiusBottomLeft: =8
      RadiusBottomRight: =8
      Visible: =varSubmissionConfirmed
    Children:
      - lblConfirmationMessage:
          Control: ModernText
          Properties:
            Text: ="Timesheet for " & cmbEmployee.Selected.Name & " submitted (preview only). Excel/Power Automate integration comes in the next stage."
            Color: =RGBA(21,128,61,1)
            Size: =15
            FontWeight: =FontWeight.Semibold
            Wrap: =false
            AutoHeight: =false
            Height: =24
            PaddingTop: =0
            PaddingBottom: =0
            PaddingLeft: =0
            PaddingRight: =0
            FillPortions: =0
            AlignInContainer: =AlignInContainer.Stretch
            AccessibleLabel: ="Submission confirmation message"

- revSummaryCard:
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
      Height: =128
      FillPortions: =0
      AlignInContainer: =AlignInContainer.Stretch
      Fill: =RGBA(255,255,255,1)
      DropShadow: =DropShadow.Light
      RadiusTopLeft: =8
      RadiusTopRight: =8
      RadiusBottomLeft: =8
      RadiusBottomRight: =8
    Children:
      - lblReviewEmployee:
          Control: ModernText
          Properties:
            Text: '="Employee: " & cmbEmployee.Selected.Name'
            Color: =RGBA(30,41,59,1)
            Size: =16
            FontWeight: =FontWeight.Semibold
            Wrap: =false
            AutoHeight: =false
            Height: =28
            PaddingTop: =0
            PaddingBottom: =0
            PaddingLeft: =0
            PaddingRight: =0
            FillPortions: =0
            AlignInContainer: =AlignInContainer.Stretch
            AccessibleLabel: ="Employee name"
      - lblReviewPayPeriod:
          Control: ModernText
          Properties:
            Text: '="Pay Period: " & Text(dpPayPeriodStart.SelectedDate,"mmmm d, yyyy") & " – " & Text(dpPayPeriodStart.SelectedDate+13,"mmmm d, yyyy")'
            Color: =RGBA(30,41,59,1)
            Size: =15
            FontWeight: =FontWeight.Normal
            Wrap: =true
            AutoHeight: =true
            PaddingTop: =0
            PaddingBottom: =0
            PaddingLeft: =0
            PaddingRight: =0
            FillPortions: =0
            AlignInContainer: =AlignInContainer.Stretch
            AccessibleLabel: ="Pay period date range"

# revWeek1Card: GroupContainer/AutoLayout, Fill: =RGBA(219,234,254,0.5), Height: =316,
# same Padding/LayoutGap/Radius/DropShadow shape as revSummaryCard above, containing:
#   - lblReviewWeek1Header (Text: ="Week 1", Size 20 Bold, Height 32, else same as ModernText shape above)
#   - the 7 Week 1 recap lines from the Recap Day Line Pattern table, in order

# revWeek2Card: identical shape, Fill: =RGBA(254,243,199,0.5), Height: =316,
#   - lblReviewWeek2Header (Text: ="Week 2")
#   - the 7 Week 2 recap lines from the Recap Day Line Pattern table, in order

- revTotalsCard:
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
      - lblReviewWeek1Total:
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
      - lblReviewWeek2Total:
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
      - lblReviewTotalHours:
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

- revCommentsCard:
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
      Height: =128
      FillPortions: =0
      AlignInContainer: =AlignInContainer.Stretch
      Fill: =RGBA(255,255,255,1)
      DropShadow: =DropShadow.Light
      RadiusTopLeft: =8
      RadiusTopRight: =8
      RadiusBottomLeft: =8
      RadiusBottomRight: =8
    Children:
      - lblReviewCommentsCaption:
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
            AccessibleLabel: ="Comments and notes label"
      - lblReviewCommentsValue:
          Control: ModernText
          Properties:
            Text: =If(IsBlank(Trim(txtCommentsNotes.Text)), "(No comments entered)", txtCommentsNotes.Text)
            Color: =RGBA(30,41,59,1)
            Size: =15
            FontWeight: =FontWeight.Normal
            Wrap: =true
            AutoHeight: =true
            PaddingTop: =0
            PaddingBottom: =0
            PaddingLeft: =0
            PaddingRight: =0
            FillPortions: =0
            AlignInContainer: =AlignInContainer.Stretch
            AccessibleLabel: ="Comments or notes value"

- revButtonRow:
    Control: GroupContainer
    Variant: AutoLayout
    Properties:
      LayoutDirection: =LayoutDirection.Horizontal
      LayoutAlignItems: =LayoutAlignItems.Stretch
      LayoutGap: =12
      PaddingTop: =0
      PaddingBottom: =0
      PaddingLeft: =0
      PaddingRight: =0
      LayoutMinWidth: =0
      LayoutMinHeight: =0
      Height: =52
      FillPortions: =0
      AlignInContainer: =AlignInContainer.Stretch
    Children:
      - btnEdit:
          Control: ModernButton
          Properties:
            Text: ="Edit"
            Appearance: =ButtonAppearance.Secondary
            Color: =RGBA(30,41,63,1)
            Size: =16
            Height: =52
            FillPortions: =1
            AlignInContainer: =AlignInContainer.Stretch
            AccessibleLabel: ="Edit timesheet"
            OnSelect: =Navigate(Screen1, ScreenTransition.None)
      - btnSubmit:
          Control: ModernButton
          Properties:
            Text: ="Submit"
            Appearance: =ButtonAppearance.Primary
            BasePaletteColor: =RGBA(30,41,63,1)
            Color: =RGBA(255,255,255,1)
            Size: =16
            Height: =52
            FillPortions: =1
            AlignInContainer: =AlignInContainer.Stretch
            AccessibleLabel: ="Submit timesheet"
            OnSelect: |-
              =UpdateContext({varSubmissionConfirmed: true});
              Notify("Timesheet submitted (preview only — Excel/Power Automate integration comes in the next stage)", NotificationType.Success)
```

Screen-level property (sibling of `Children:`, on the `ReviewSubmission` key itself):

```yaml
Properties:
  OnVisible: |-
    =UpdateContext({varSubmissionConfirmed: false})
```

## Required Record Fields

| Field key | Record surface | Required field | Source field | Bound control | Exact formula | Placement and visibility |
|---|---|---|---|---|---|---|
| `review-day-combined` | 14 recap lines `lblReviewMon1`…`lblReviewSun2` | Date and entered hours for each pay-period day | `dpPayPeriodStart.SelectedDate + offset` and the matching `Screen1.txt*Hours.Value` | `lblReviewMon1`…`lblReviewSun2` | `=Text(dpPayPeriodStart.SelectedDate + <offset>, "dddd, mmmm d") & " — " & Text(txt*Hours.Value, "0.#") & " hrs"` | Inside `revWeek1Card`/`revWeek2Card`, single line, always visible |

## State-Driven Surface Visibility

| Surface key | Surface control | State predicate | Visible and hidden states |
|---|---|---|---|
| `revConfirmationBanner` | `revConfirmationBanner` | `=varSubmissionConfirmed` | Visible immediately after `btnSubmit` is tapped; hidden on every screen entry (reset `false` in `OnVisible`) until the next Submit |

## Required Actions

| Action | Preconditions | Entry point and event | Source and stable ID | Transition and postcondition | Mutation write set | Receipt proof set | Observer and evidence |
|---|---|---|---|---|---|---|---|
| Return to edit from Review | None — always available | `btnEdit.OnSelect` | N/A | Screen changes to `Screen1` | N/A | N/A | `Screen1` shows all previously entered values unchanged (controls persist — both screens stay loaded) |
| Submit timesheet (stage-1 preview stub) | None — always available (no data-source write, explicit stage-1 stub) | `btnSubmit.OnSelect` | N/A — screen-scoped context variable `varSubmissionConfirmed`, no data source this stage | `UpdateContext({varSubmissionConfirmed: true})` | `varSubmissionConfirmed: true` (context-variable state only) | Identity: this timesheet's Employee/Pay Period (already shown above); proof: confirmation banner + message become visible | `revConfirmationBanner.Visible: =varSubmissionConfirmed` and `lblConfirmationMessage.Text`, plus a supplemental `Notify(...)` toast |
| Fresh non-confirmed state on (re-)entry | User navigates to `ReviewSubmission` from `Screen1` or returns after `Edit` | `ReviewSubmission.OnVisible` | N/A | `UpdateContext({varSubmissionConfirmed: false})` | `varSubmissionConfirmed: false` | N/A | `revConfirmationBanner.Visible` is `false` immediately on entry, hiding any previous confirmation until the next Submit |
| Optional comments never block submit | `txtCommentsNotes.Text` may be blank | `lblReviewCommentsValue` (read-only) | N/A | N/A | N/A | N/A | Shows `"(No comments entered)"` when blank; `btnSubmit` has no `DisplayMode` gate tied to this field |

## Data Entry Label Contracts

N/A — this screen has no data-entry controls (read-only recap only).

## Mutation Lifecycle Evidence

| Action | Receipt binding | Canonical source and observer | Requested destination and observer | Stable ID continuity | Synchronization when sources differ | Destination focus |
|---|---|---|---|---|---|---|
| Submit timesheet (stage-1 preview stub) | `revConfirmationBanner`/`lblConfirmationMessage`, captured via `UpdateContext({varSubmissionConfirmed: true})` in `btnSubmit.OnSelect` | `varSubmissionConfirmed` (screen-scoped context variable) is itself the only source this stage — no data source integration in Stage 1; observer: `revConfirmationBanner.Visible: =varSubmissionConfirmed` | Same screen/surface — there is no separate destination list; the recap values above are read live from Screen1 and are unaffected by Submit | N/A — no persisted record identity; this is a single in-session draft, not a stored row | N/A — same live context variable, no cache/projection to synchronize | N/A — single surface, not a multi-record destination |

## Mutation Field Ledger

| Action | Field | Classification | Canonical pre-state or input | Write or preservation mechanism | Receipt/proof binding | Post-state observer |
|---|---|---|---|---|---|---|
| Submit timesheet (stage-1 preview stub) | `varSubmissionConfirmed` | Changed | `false` (set by `ReviewSubmission.OnVisible`) | `btnSubmit.OnSelect: =UpdateContext({varSubmissionConfirmed: true})` | `revConfirmationBanner.Visible` and `lblConfirmationMessage.Text` both read the same `true` state | `ReviewSubmission.OnVisible: =UpdateContext({varSubmissionConfirmed: false})` proves the value returns to `false` on the next visit |

## Functional Test Scenarios

| Scenario | Given | When | Then | Evidence surface | Boundary or negative case |
|---|---|---|---|---|---|
| Recap matches Screen1 exactly (shared source) | Screen1: Employee 2 selected, `dpPayPeriodStart` = Sept 21 2026, Week 1 = 39.5, Week 2 = 40.0 | Supervisor taps `btnReviewEntry` | `lblReviewEmployee` = "Employee: Employee 2", `lblReviewWeek1Total` = "Week 1 Total: 39.5", `lblReviewWeek2Total` = "Week 2 Total: 40.0", `lblReviewTotalHours` = "Total Hours: 79.5" | Direct read of Screen1 controls, no duplication | N/A |
| Submit shows confirmation | On `ReviewSubmission`, `varSubmissionConfirmed` = false (fresh entry) | Supervisor taps `btnSubmit` | `varSubmissionConfirmed` becomes `true`; no data source is written (explicit stage-1 stub) | `revConfirmationBanner` becomes visible with `lblConfirmationMessage` text; `Notify` toast appears | N/A |
| Fresh state after Edit round-trip | Confirmation banner visible after Submit | Supervisor taps `btnEdit`, changes nothing, then taps `btnReviewEntry` again | `ReviewSubmission.OnVisible` resets `varSubmissionConfirmed` to `false` | `revConfirmationBanner.Visible` = `false` again, even though recap values are unchanged | Regression: entered hours/employee/date are NOT reset — only the confirmation flag is |
| Optional comments empty-state | `txtCommentsNotes.Text` = "" | Supervisor reaches Review without entering comments | Comments recap shows the empty-state text | `lblReviewCommentsValue.Text` = "(No comments entered)" | Boundary: whitespace-only comments (e.g. spaces) also trigger the empty state via `Trim(...)` |

## Relevant Data Source Schemas

N/A — this screen reads only Screen1's controls, not `colEmployees` directly (it reads
`cmbEmployee.Selected.Name`, which is already resolved by Screen1).

## Relevant API Details

N/A.

## Required Variants

- `GroupContainer` -> `AutoLayout` (every container on this screen).

## Control Definitions

### GroupContainer
Creation keywords:
```yaml
Control: GroupContainer
Variant: AutoLayout
```
Valid input properties used here: `DropShadow` (Enum name: `DropShadow`; members
`Bold`/`ExtraBold`/`Light`/`None`/`Regular`/`Semibold`/`Semilight`), `Fill`, `Height`,
`RadiusTopLeft`, `RadiusTopRight`, `RadiusBottomLeft`, `RadiusBottomRight`, `Visible`,
`Width`, `LayoutAlignItems` (Enum name: `LayoutAlignItems`; members `Center`/`End`/
`Start`/`Stretch`), `LayoutDirection` (Enum name: `LayoutDirection`; members
`Horizontal`/`Vertical` — required), `LayoutGap`,
`PaddingTop`/`PaddingBottom`/`PaddingLeft`/`PaddingRight`, `AlignInContainer` (Enum name:
`AlignInContainer`; members `Center`/`End`/`SetByContainer`/`Start`/`Stretch`),
`FillPortions`, `LayoutMinWidth`, `LayoutMinHeight`. **No `AccessibleLabel` property —
never set it on this control type.**

### ModernText
Creation keywords:
```yaml
Control: ModernText
```
Valid input properties used here: `AccessibleLabel`, `AutoHeight`, `Color`, `FontWeight`
(Enum name: `FontWeight`; members `Bold`/`Semibold`/`Normal`/`Lighter`), `Height`,
`PaddingTop`/`PaddingBottom`/`PaddingLeft`/`PaddingRight`, `Size`, `Text`, `Visible`,
`Wrap`, `AlignInContainer`, `FillPortions`, `LayoutMinWidth`, `LayoutMinHeight`.

### ModernButton
Creation keywords:
```yaml
Control: ModernButton
```
Valid input properties used here: `AccessibleLabel`, `Appearance` (Enum name:
`ButtonAppearance`; compile-ready literals used here: `=ButtonAppearance.Secondary`
(`btnEdit`, a light Fluent surface — its `Color` must stay dark) and
`=ButtonAppearance.Primary` (`btnSubmit`)), `BasePaletteColor`, `Color`, `Height`,
`OnSelect`, `Size`, `Text`, `Visible`, `AlignInContainer`, `FillPortions`,
`LayoutMinWidth`, `LayoutMinHeight`. **No `FontWeight` property on this control — do not
set it.**

Screen-level property used on this screen's `Properties:` block: `OnVisible` — a
multi-statement/record-literal formula, written as a `|-` block scalar.
