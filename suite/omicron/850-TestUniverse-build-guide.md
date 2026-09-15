# Building the 850 OCC in Test Universe

Assembles `850-FDR-steps.csv` and `850-FDR-channels.csv` into one Test Universe document.
Work through it once, save the result as a template, and every subsequent 850 becomes a
re-point of the test object rather than a rebuild.

Values below are for the tool's **sample** feeder — 13.8 kV, 8 miles, 0.65 Ω/mi ∠68°, CT 600:5,
VT 13800:120. Enter your real data in `850.html`, re-run the generator, and the numbers change
underneath you. The header comment in each CSV records which configuration produced it.

---

## 1 · Test object

Test Universe references everything through the test object, so this comes first.

If OMICRON publish an XRIO converter for the 8 Series, use it — it maps the relay's own setting
names and is worth more than a hand-built object. Otherwise create a generic test object and
fill in:

| Field | Sample value | Where it comes from |
|-------|--------------|---------------------|
| Nominal voltage, secondary | 120 V L–L (69.282 V L–N) | VT secondary |
| Nominal current, secondary | 5 A | CT secondary |
| VT ratio | 13800 : 120 = 115 : 1 | VT schedule |
| CT ratio | 600 : 5 = 120 : 1 | CT schedule |
| Nominal frequency | 60 Hz | |
| Line angle | 68° | Z1 angle |
| Z1 secondary | 5.426 Ω | `z1m × len × CTR/VTR` |
| Z0 secondary | 17.530 Ω | same conversion |
| k0 | 0.7448 ∠5.79° | `(Z0 − Z1) / 3Z1` |

The k0 value is the one worth double-checking against the relay's own setting. It is also the
one that makes ground reaches measure wrong while every phase reach measures right.

## 2 · Hardware configuration

**Amplifier mode: 3 × 32 A.** A feeder relay has one CT set, so nothing is gained by splitting
into two triples, and the 32 A channel limit is what makes the instantaneous elements testable —
50P at 8 ×CT is 40 A, which needs attention either way (see §7).

Voltage: three phases plus **V 4** for the line-side input. The synchrocheck slip test needs V 4
running at an independent frequency, so declare it as a separate generator rather than a copy of
V L1.

### Binary I/O

| CMC | Direction | To / from the relay |
|-----|-----------|---------------------|
| Bin. in 1 | in | Trip contact — the timing reference for every operate time |
| Bin. in 2 | in | Close output — reclose, and the 25 permissive |
| Bin. in 3 | in | Pickup / start flag, where the relay offers one |
| Bin. out 1 | out | 52a breaker simulation |
| Bin. out 2 | out | 52b breaker simulation |
| Bin. out 3 | out | Breaker failure initiate (BFI) |

The 52a/52b pair is not optional for the reclose work. The scheme tracks breaker position to know
whether its close took; without it the relay declares a close failure part-way through and the
later shots never run.

## 3 · Module map

Filter `850-FDR-steps.csv` on the `TU_Module` column. Each group below becomes one module in the
document, in this order — it puts the quick checks first and the long sequences last, which is
also the order you want if the outage gets cut short.

| Order | Module | Elements | Steps |
|------:|--------|----------|------:|
| 1 | Overcurrent — pickup + time | 50P, 50G, 50N, 50SG, 50_2, 37 | 19 |
| 2 | Overcurrent — characteristic | 51P, 51G, 51N, 51SG, 46 | 30 |
| 3 | Voltage | 27, 59 | 7 |
| 4 | Quick CMC | 32, 46BC, 47, 59N, 81 | 17 |
| 5 | Ramping | 67 (6 points), 81R (3 ramps) | 9 |
| 6 | Synchronizer | 25 | 7 |
| 7 | Advanced Distance | 21, FLOC | 11 |
| 8 | State Sequencer | 79, CLPU (15 sequenced) · 50BF, 68 (9 assembled) | 24 |

## 4 · Overcurrent modules

Pickup rows come in pairs — one above the threshold that must operate and one below that must
not. Enter the pair, not just the operate point; a relay that trips on both tells you nothing and
a relay that trips on neither looks identical to one that is out of service.

For the characteristic tests, the `Expected` column carries the predicted operate time from the
curve equation. **Check the first one against the relay's own prediction before accepting the
rest** — curve constants have moved between firmware revisions, and if the first point disagrees
every other time in the table is wrong by the same factor.

Negative-sequence rows (50_2, 46) already carry the ×3 that a single-phase injection needs to
produce the intended I2. Do not apply it again.

Sensitive-ground rows (50SG, 51SG) go **through the core-balance window**, not into a phase CT.
A lead routed back through the window the wrong way inverts the result.

## 5 · Advanced Distance — 21 and FLOC

Both elements place a fault at a position on the line rather than at a current. Enter each row as
a shot; the `WhatIsApplied` column gives the position as a percentage and a distance.

The loop matters. 21 defaults to the phase loop (tested L2–L3, no k0) and FLOC to A–G (k0
compensated). Run **both** loops at the same positions if you can: matching phase results with
drifting ground results points at k0 or Z0, not at the relay.

For FLOC read the relay's own reported distance out of its fault record. There is no trip to time
— the element is a measurement, and the `Expected` column is the acceptance window around the
true position.

## 6 · State Sequencer — the four sequences

These are the ones worth building carefully. Filter on `SeqRun` and `SeqState`; each run is one
sequence and the states go in in order.

**79 autoreclose — two runs.** Run 1 is a permanent fault that must spend both shots and reach
lockout; run 2 is a transient that must reclose once and reset. Ten states between them. Drive
the transitions from the relay's own trip and close outputs with the breaker simulated, not from
fixed times — the point of the test is that the relay decides when things happen.

**CLPU cold load pickup — one run, five states.** Everything turns on one current sitting between
the normal pickup (6.000 A) and the lifted pickup (12.000 A): **9.000 A**. It must not trip while
the window is open and must trip once it closes. If it behaves the same in both states the
element is doing nothing. The arming and window timers run to minutes; shorten them in the relay
for the test and record as-found and as-left.

**50BF breaker failure — assemble from its five steps.** Listed as points but only meaningful in
order: detector above, detector below, retrip timing, backup timing, and the reset check. Timers
start from the BFI edge on binary output 3, not from the current step. The reset check is the one
that matters in service — a slow detector reset trips the bus on every successful clearance.

**68 power swing blocking — assemble from its four steps.** The static points only locate the two
characteristics. The discrimination is the transit time between them: step 1 → 2 → 3 with more
than 30 ms between transitions should block, and a step straight from 1 to 4 must not.

## 7 · Before you inject

Two things in the sample configuration are worth resolving first, and both will show up in your
own data too:

- **50P at 8 ×CT is 40 A secondary**, past the 32 A channel limit. Either drop the test multiple
  and note it, or prove the pickup at a reduced multiple and the timing separately. The tool
  flags this per-row; the CSV carries the values regardless, so check the `Magnitude` column
  before building the module.
- **51P timing at higher multiples** climbs quickly. Confirm each row against the channel limit
  rather than discovering it mid-run.

## 8 · After the first build

Save as a template with the test object detached, so the next 850 is: open template → point at
the new test object → re-run the generator → paste. The module structure, binary map and
sequence shapes do not change between feeders. Only the numbers do.
