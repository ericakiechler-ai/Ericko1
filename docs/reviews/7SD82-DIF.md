# 7SD82-DIF — calculation review and QC record

**Tool:** `src/7sd82-dif.html` — Siemens SIPROTEC 5 7SD82 line differential protection × Omicron CMC 356
**Scope:** every `compute()`, the two-ended differential model and its restraint
definitions, the staging logic, the charging-current model, the channel mapper, the limit
checks, the vector calculator, the presets and the sample configuration. Each injected
quantity was traced from setting to channel with the sample ratios (600:1 at both ends,
600 A reference so 1 pu = 1.000 A at each end, 110000:100 VT, 25 A charging current =
0.0417 pu), and the notes were checked against what the code actually does.
**Outcome:** released. One medium finding and three low ones fixed; two items left open.

## Findings

| # | Severity | Finding | Fix |
|---|---|---|---|
| 1 | Medium | **No phase-rotation setting.** The tool had no rotation field at all: `P3()`, the 27/59 single-phase sets, all seven vector presets and `seq()` were fixed ABC. On an ACB system every balanced set the tool produced was negative sequence to the device and the vector calculator swapped I1 and I2. | A *Phase rotation* field on the Line setup tab (default ABC, carried in the station file and the sheet header), `rotS()`/`rotA()` helpers, a rotation-aware `P3()` and `seq()`, presets rebuilt through them. |
| 2 | Low | **87L characteristic stepped at Break 1** — the pickup alone below it, slope 1 × restraint above it (0.30 → 0.60 pu on the sample), in both the element and the copy the vector calculator uses. Slope 1 applies below Break 1 with the pickup as a floor. | Both `req()` functions return max(pickup, slope1·Ir) up to Break 2. Unchanged at the sample's 1.0, 3.0 and 8.0 pu points; different between 1.0 and 2.0 pu. |
| 3 | Low | Duplicate `inputmode`; no Setup-first on a fresh load. | Fixed. |

## Open — needs the 7SD82 manual

1. **Restraint and slope form.** The 7SD8x differential is specified as an I-DIFF>
   threshold with an adaptive restraint built from the estimated measuring errors at each
   end, not as a classical two-slope characteristic. The tool draws a two-slope
   characteristic with a selectable restraint definition (sum, max, average; the field
   says *confirm in DIGSI*) so the tester can place points on the plane the device
   displays. The through-current stability point and the minimum pickup are independent of
   that model; the slope points are only as good as the characteristic entered. Read the
   device's own characteristic display and set the slopes and breaks to match it before
   trusting the slope table.
2. **Charging current phase.** The standing-differential points model the charging
   current as an in-phase shortfall at end B; on the system it is in quadrature with the
   voltage, entering at both ends. The differential magnitude is the same, which is what
   the points test; the *Charging current only* preset places it at 90° as the physics
   says.

## Verified correct (no change)

Per-unit conversion through each end's own CT ratio to the common reference current
(and the note that differing ratios make the same per-unit value a different secondary
current at each end); the three restraint definitions and the two-current split that
places the device at (Irest, Idiff) for each; the cap on reachable differential for the
sum and average definitions and the dropping of points beyond it; the staging logic
(local reaches minimum pickup only, loop-back and end-to-end reach the plane) and the
automatic *needs current at both ends* flag on any point that drives end B; 87N's
single-phase residual at each end; the charging-current standing differential and the
over-compensation check; the backup overcurrent conversions and IEC/ANSI curves; the
stub-bus interlock sequence; 79 with both ends reclosing; 50BF; 25 including the
dead-line case; 27/59 phase logic; 81; the channel-limit, amplifier-mode and
two-test-set warnings.

## Accepted simplifications (documented, not changed)

- All two-ended points hold the voltage set at nominal (or a fixed fraction for faults);
  the differential does not measure voltage.
- The protection interface, intertrip and trip-circuit functions are checklists, not
  injections, and say so.

## Verification

`tests/7sd82.test.mjs` — 27 checks. Builds the tool, mints a licence, drives it from
`file://` with all network blocked, renders all 16 functions, and checks 87L minimum
pickup, the slope split at 3 pu and at 1.5 pu (below Break 1), through-current
stability, the unreachable flag at local staging and its release at loop-back, the
per-unit scaling with unequal CT ratios, 87N, the charging-current point, the backup
overcurrent stages, 27, 25 and the new rotation setting against an independent
implementation written in the test from the sample constants. Licence, evaluation,
forged and Setup-first states, decimal entry and sheet provenance are covered as for the
other tools.
