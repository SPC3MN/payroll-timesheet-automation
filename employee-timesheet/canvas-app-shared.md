# Canvas App Shared Plan

## Aesthetic Direction

Professional, utilitarian two-week timesheet. Clean, minimal, spacious, large touch
targets. No decorative flourishes beyond the tint that separates Week 1 from Week 2.

- Palette: navy-dominant utilitarian, warm off-white background, white cards, two soft
  week tints, slate text, amber used only for the Week 2 tint.
- App background: `RGBA(244,246,249,1)` — `appBackground`
- Dominant navy (header/primary actions/btnSubmit): `RGBA(30,41,63,1)` — `navy`
- Amber accent (Week 2 tint only): `RGBA(202,138,4,1)` — `amber` (not used as a fill
  literal directly; see Week 2 tint below, which is the amber wash)
- Card surface: `RGBA(255,255,255,1)` — `white`
- Week 1 tint (card `Fill`): `RGBA(219,234,254,0.5)` — `week1Tint` (light blue wash)
- Week 2 tint (card `Fill`): `RGBA(254,243,199,0.5)` — `week2Tint` (light amber wash)
- Text primary (slate): `RGBA(30,41,59,1)` — `textPrimary`
- Text secondary / field captions (slate): `RGBA(100,116,139,1)` — `textSecondary`
- Confirmation banner text (green): `RGBA(21,128,61,1)` — `confirmText`
- Confirmation banner background (green): `RGBA(220,252,231,1)` — `confirmBg`
- Text on `navy` surfaces (button labels): `RGBA(255,255,255,1)` — `white`

Every screen writes these as literal `RGBA(...)` values (no `App.Formulas` palette — kept
out of `App.pa.yaml` to keep it minimal; copy the literals above verbatim in every screen).

## Visual Contract

- Type roles (all on `ModernText` unless noted):
  - Page/section header (e.g. `lblWeek1Header`, `lblReviewWeek1Header`, `revPageTitle`):
    `Size: =20`, `FontWeight: =FontWeight.Bold`, `Color: =RGBA(30,41,59,1)`.
  - Field caption / label (sibling labels for inputs, e.g. `lblEmployeeFieldLabel`):
    `Size: =13`, `FontWeight: =FontWeight.Semibold`, `Color: =RGBA(100,116,139,1)`,
    `Wrap: =false`.
  - Body / date / recap text: `Size: =15`, `FontWeight: =FontWeight.Normal`,
    `Color: =RGBA(30,41,59,1)`, `Wrap: =false` unless noted otherwise.
  - Emphasis total line (`lblTotalHours`, `lblReviewTotalHours`): `Size: =20`,
    `FontWeight: =FontWeight.Bold`, `Color: =RGBA(30,41,59,1)`.
  - `ModernButton.Text` has no `FontWeight` property (not in its `describe_control`
    output) — do not set it on buttons.
- Spacing scale: card padding `20` (16/20 alt for tinted week cards — see below), card
  internal `LayoutGap: =8`, day-row internal `LayoutGap: =8`, section-to-section root
  `LayoutGap: =16`.
- Surfaces: every section is a `GroupContainer` / `Variant: AutoLayout` "card" with
  `RadiusTopLeft/TopRight/BottomLeft/BottomRight: =8` and `DropShadow: =DropShadow.Light`.
  Header, Totals, Comments, Summary (Review) cards use `Fill: =RGBA(255,255,255,1)`. The
  two week cards use their tint fill instead of white — that tint **is** the requested
  Week 1 / Week 2 visual separation.
- Actions: primary = `Appearance: =ButtonAppearance.Primary`,
  `BasePaletteColor: =RGBA(30,41,63,1)`, `Color: =RGBA(255,255,255,1)` (navy surface,
  white text — used for `btnReviewEntry` and `btnSubmit`). Secondary = `Appearance:
  =ButtonAppearance.Secondary`, `Color: =RGBA(30,41,63,1)` (light Fluent surface, navy
  text — `Secondary` is a light-surface appearance per `QACHK-VARIANT-SURFACE-CONTRAST`,
  so its text must stay dark, never white — used for `btnEdit`).
- Density: phone (≤639px) and desktop use the identical vertical single-column
  composition; there is no horizontal multi-column desktop branch in this app. The only
  place a breakpoint could apply — the day-entry rows — is explicitly exempted below.

## Layout Strategy

- Every screen has exactly one root `GroupContainer` / `Variant: AutoLayout`,
  `LayoutDirection: =LayoutDirection.Vertical`, `LayoutOverflowY: =LayoutOverflow.Scroll`,
  `Width: =Parent.Width`, `Height: =Parent.Height`, `LayoutMinWidth: =0`,
  `LayoutMinHeight: =0`, `LayoutAlignItems: =LayoutAlignItems.Stretch`,
  `Fill: =RGBA(244,246,249,1)`. The screen's top-level `Children:` list contains only
  that root.
- Every direct child of the root is a "card" section with `FillPortions: =0` (scroll-trap
  rule) and `AlignInContainer: =AlignInContainer.Stretch`.
- **Day-entry rows are the one exception to the reflow rule.** Each of the 14 day rows on
  Screen1 (and the recap rows on ReviewSubmission are single `ModernText` controls, not
  rows) has exactly two children — a date label with `FillPortions: =1` and a fixed-width
  `ModernNumberInput` with `FillPortions: =0`. Per `QACHK-NO-REFLOW`'s stated exception
  ("a two-child row of a label and a fixed icon/control... remain legible when
  proportionally narrowed"), these rows do **not** need `LayoutWrap` or a breakpoint
  `LayoutDirection`. Numeric width budgets for this row are in each screen brief.
- No screen uses `Parent.Width`/`App.Width` as a stacking breakpoint source because no
  row on either screen needs to change `LayoutDirection` — every horizontal row is a
  two-child exception row, and every other section is already a single vertical column.
- `GroupContainer` has **no `AccessibleLabel` property** (confirmed absent from the
  `describe_control` result in the discovery packet). Do not set it on any
  `GroupContainer` — doing so is an `Unknown property` compile error. Set
  `AccessibleLabel` on every `ModernText`, `ModernButton`, `ModernDropdown`,
  `ModernDatePicker`, `ModernNumberInput`, and `ModernTextInput` instance instead. This is
  a documented, required approximation of the literal "every control" instruction in the
  requirements, driven by the control's actual property surface.

## Named State

- `colEmployees` — App-level collection (seeded in `App.OnStart`), rows `{Name: Text}`.
  `Screen1.cmbEmployee.Items: =colEmployees`, `ItemDisplayText: =ThisItem.Name`. Swapping
  the source later only requires changing the `ClearCollect` in `App.OnStart` (or
  replacing `colEmployees` with a real data source of the same shape) — no screen formula
  changes.
- No other collections. All 14 day dates and all three totals are pure Power Fx formulas
  read directly off `Screen1.dpPayPeriodStart.SelectedDate` and the 14
  `Screen1.txt*Hours.Value` outputs — repeated verbatim wherever they are displayed
  (Screen1 and ReviewSubmission both read the same 16 Screen1 controls). This is the
  single source of truth satisfying `QACHK-SHARED-SOURCE-DERIVATION`; there is no
  App-level named formula for the sums because `App.pa.yaml` must compile before any
  screen/control exists.
- `varSubmissionConfirmed` — **screen-scoped context variable**, owned by
  `ReviewSubmission` only, via `UpdateContext`. `ReviewSubmission.OnVisible` resets it to
  `false`; `btnSubmit.OnSelect` sets it to `true` via `UpdateContext` (not `Set`). Do not
  mix `Set()` and `UpdateContext()` for this name — Power Fx variables are one or the
  other, and using `UpdateContext` consistently for both the reset and the write is what
  makes "fresh, non-confirmed state on return" and "no Navigate in OnVisible" both hold
  true. This is a corrected reading of the requirements text (which mentioned `Set()` in
  the button's own line but then explicitly forbade `Set()`/global for the reset); the
  observable behavior — banner appears on Submit, disappears again on next visit — is
  unchanged.

## Control Naming

- Standard abbreviations: `cmb` dropdown, `dp` date picker, `txt` text/number input,
  `lbl` text, `btn` button, `con`/`ts`/`rev` generic containers.
- Screen1 prefix: `ts` for every supporting container and section label not given an
  explicit literal name by the requirements (e.g. `tsRoot`, `tsHeaderCard`,
  `tsWeek1Card`, `tsDayRowMon1`). The 14 hour inputs, 14 date labels, `cmbEmployee`,
  `dpPayPeriodStart`, `txtCommentsNotes`, and `btnReviewEntry` use the exact literal names
  given in the requirements.
- ReviewSubmission prefix: `rev` for every supporting container/label
  (`revRoot`, `revSummaryCard`, `revWeek1Card`, `revConfirmationBanner`,
  `lblReviewMon1`…`lblReviewSun2`, etc.). `btnEdit` and `btnSubmit` use their literal
  names.
- No prefix is reused between screens; every control name is unique app-wide. There is no
  repeated nav-bar/header pattern shared across the two screens (Screen1's header is data
  entry, ReviewSubmission's is a read-only recap — each screen brief specifies its own
  header fully).

## Cross-Screen Contracts

- `Screen1.btnReviewEntry.OnSelect: =Navigate(ReviewSubmission, ScreenTransition.None)`
- `ReviewSubmission.btnEdit.OnSelect: =Navigate(Screen1, ScreenTransition.None)`
- `ReviewSubmission` contains **no data of its own** — every recap value is a direct
  formula reference to a named `Screen1` control (`cmbEmployee.Selected.Name`,
  `dpPayPeriodStart.SelectedDate`, `txtMon1Hours.Value` … `txtSun2Hours.Value`,
  `txtCommentsNotes.Text`). Canvas Apps keep every screen's controls loaded and addressable
  by name for the life of the running app, and control names are unique app-wide, so this
  is the correct zero-duplication way to keep the recap always in sync with Screen1
  (`QACHK-SHARED-SOURCE-DERIVATION`). Never introduce a second collection or variable that
  copies these values.
- Both screens use `ModernButton` rows for navigation, never `ModernTabList` (there is no
  in-screen panel switch in this app).

## YAML Conventions

- Every property value starts with `=`. Multi-statement formulas use a `|-` block scalar
  with `=` on the first content line.
- Any single-line value containing `: ` (a caption concatenation such as
  `="Week 1 Total: " & ...`) must be wrapped in single quotes at the YAML level, e.g.
  `Text: '="Week 1 Total: " & Text(...,"0.0")'`.
- Any formula containing a Power Fx record literal (`{Key: value}`, e.g.
  `UpdateContext({varSubmissionConfirmed: true})`) must be written as a `|-` block scalar
  (block scalars have no colon-space restriction) rather than a quoted single line.
- `Precision: =DecimalPrecision.'1'` — the `1` must be quoted because it starts with a
  digit (`Expected operator` / `Expected an operand` otherwise).
- `ValidationState: =ValidationState.Error` / `=ValidationState.None` — unqualified enum
  name.
- `Appearance: =Appearance.___` is unqualified on `ModernDropdown`/`ModernNumberInput`/
  `ModernTextInput`/`ModernDatePicker`; `Appearance: =ButtonAppearance.___` (qualified,
  different enum) on `ModernButton`.
- `FontWeight: =FontWeight.Bold` / `.Semibold` / `.Normal` — unqualified.
- Date/time format specifiers are lower-case: `"dddd, mmmm d"`, `"mmmm d, yyyy"`.
- Every `GroupContainer` sets `Variant: AutoLayout` and both
  `LayoutMinWidth: =0` / `LayoutMinHeight: =0`.
- Every AutoLayout child sets `FillPortions` explicitly (`=0` fixed-size, `=1`
  proportional) and `AlignInContainer` explicitly (`Stretch` for cross-axis fill,
  `Center` when the child's cross-axis size is intentionally smaller than the parent's).
