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
| `850-TestUniverse-build-guide.md` | Module-by-module instructions for assembling the OCC from those values |
| `7SD82-TestUniverse-build-guide.md` | The same for the line differential, where the staging decides what a test proves |
| `build-testplan.js` | The generator |

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
```

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
