# Omicron Test Universe test plans

Generated test plans for every relay tool in this repository — four GE Multilin 8 Series
and two Siemens SIPROTEC 5.

## Why there is no .occ file here

A `.occ` is Test Universe's own document format: a proprietary binary container
(OLE compound file) holding module state, hardware configuration and a reference to the
test object. There is no public specification for it, and its internal streams describe
the CMC hardware setup as much as the test values.

A file written outside Test Universe and given that extension would either fail to open
or open with content that does not mean what its name claims. On a commissioning job that
is worse than having no file at all, so this folder does not contain one.

What it contains instead is everything the OCC needs, in formats that carry no such risk:

| File | What it is |
|------|------------|
| `<relay>-steps.csv` | One row per test step — the test-record skeleton, with every channel value laid out in columns and empty `Measured` / `PassFail` columns to fill in |
| `<relay>-channels.csv` | One row per channel per step — the long form, for pasting into module tables |
| `<relay>-TestUniverse-build-guide.md` | Module-by-module instructions for assembling that relay's OCC from those values — one per device |
| `xlsx/<relay>-test-plan.xlsx` | The same plan as an Excel workbook — a front sheet, the steps ready to fill in, the channel long form and the build guide, in one file per relay |
| `build-testplan.js` | The generator |
| `build-static.js` | Builds the no-script static edition of each tool |
| `build-workbooks.py` | Turns the CSVs into the workbooks |

There is a build guide for every device:

| Guide | The thing it exists to stop you getting wrong |
|---|---|
| `845-TestUniverse-build-guide.md` | Vector-group compensation, and a differential that looks balanced because both windings were built from the same angle |
| `850-TestUniverse-build-guide.md` | k0, the 32 A channel limit on 50P, and reclose sequences driven from fixed times instead of the relay's own outputs |
| `869-TestUniverse-build-guide.md` | Thermal memory — a string of short operate times that all look like a fast relay |
| `889-TestUniverse-build-guide.md` | An amplifier conflict: 87G and 50P cannot share a hardware configuration with the rest of the plan |
| `7SJ85-TestUniverse-build-guide.md` | A 67Ns sector placed at ±90°, and V 4 asked to be two different things at once |
| `7SD82-TestUniverse-build-guide.md` | Staging — a local-end test that proves the minimum pickup and is recorded as proving the scheme |

You build the OCC once in Test Universe from the guide, save it as a template, and reuse
it. That is the normal workflow for a relay family anyway — the first one takes an hour,
every one after that is a re-point of the test object.

## The values are not retyped

`build-testplan.js` loads each tool's own page, enumerates every element at its settings
and reads back the channel tables the tool computed. Nothing is transcribed by hand, so
the CSVs cannot drift from the calculations that were verified in the tools.

```
node build-testplan.js 850      # one relay
node build-testplan.js 7sd82    # both stagings of the line differential
node build-testplan.js all      # everything
python3 build-workbooks.py      # then rebuild the Excel workbooks from the CSVs
```

## The workbooks

`xlsx/` is what goes onto the job. One file per relay, four sheets (six for the line
differential, which carries both stagings):

| Sheet | What it is |
|---|---|
| Start here | Where the values came from, a record-identification block to fill in, and live counters for passed / failed / outstanding |
| Test steps | The record. Every channel value in columns, and two shaded columns — MEASURED and PASS / FAIL — which are the only cells anyone should type into |
| Channels | One row per channel per step, for pasting into a Test Universe module table |
| Build guide | The same guide as the Markdown file, so one file carries everything for that relay |

The workbooks are built from the CSVs, which are built from the tools. Nothing is retyped
at any step, so a setting change flows through to the injected values without anyone
editing a number by hand. If a setting changes: change it in the tool, re-run the
generator, rebuild the workbooks. Do not edit the workbook.

Requires Node and Playwright's Chromium. Re-run it after entering real station data in a
tool — the CSVs currently carry each tool's **sample** configuration, which is written into
the header comment of every file.

## Conventions

Every quantity is **secondary**, at the relay terminals. Angles are degrees, counter-clockwise
positive, with V L1 at 0° — the same convention as the CMC's own phasor display, so what the
CSV says is what you type.

Current channels are named `I L1..L3` for a single triple and `I A-L1..L3` / `I B-L1..L3`
when two triples are in use. `V 4` is the auxiliary voltage output.

## Coverage

| Relay | Elements | Steps | Channel rows | Sequences |
|-------|---------:|------:|-------------:|-----------|
| 845-VEC transformer | 21 | 91 | 743 | — |
| 850-FDR feeder | 27 | 124 | 753 | 79, CLPU |
| 869-MTR motor | 20 | 92 | 548 | 48, 66, 19 |
| 889-GEN generator | 27 | 137 | 1147 | — |
| 7SJ85-SIP Siemens overcurrent | 26 | 125 | 758 | 79 |
| 7SD82-DIF Siemens line differential | 16 | 69 | 407 | 79 |

## Two plans for the line differential

The 7SD82 is generated twice, because a differential plan is not one plan: what can be
injected depends on how the two ends are staged.

| File | Staging | Steps not reachable |
|---|---|---:|
| `7SD82-DIF-*.csv` | local end only, remote device quiescent | 12 |
| `7SD82-DIF-loopback-*.csv` | one test set driving both current triples | 0 |

The injected values are identical in both — only the `Reachable` column changes. With the
remote end quiescent the operating point can only move along Idiff = Irest, so the slope,
the through-current stability point and the CT ratio and polarity agreement between the ends
are simply not testable. Those steps stay in the plan, marked, so they are carried forward as
untested rather than disappearing from the record.

The two columns `CurrentNeededAt` and `Reachable` appear in every relay's CSVs for
consistency. On the single-ended tools `CurrentNeededAt` is blank and `Reachable` reads
`yes` throughout.

Elements marked `sequence (assemble from these steps)` are ones where the tool lists the
states as ordinary points but the test only means anything run in order — 50BF and 68 on the
feeder, for instance. The guide says which.
