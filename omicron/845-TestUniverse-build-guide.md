# Building the 845 OCC in Test Universe

Assembles `845-VEC-steps.csv` and `845-VEC-channels.csv` into one Test Universe document —
21 elements, 91 steps. Build it once and save it as a template; the next transformer is a
re-point of the test object.

Values below are for the tool's **sample** transformer: 20 MVA, 115 / 13.8 kV, **Dyn1**,
60 Hz, W1 CT 150:5 wye, W2 CT 1200:5 wye, ground CT 200:5, VT 13800:120 wye on W2, REF on
W2. Enter your real transformer in `index.html` and re-run the generator.

---

## 1 · The vector group is the test

Everything difficult about a transformer differential comes from the fact that the two
windings do not see the same thing, and almost every false result comes from getting that
wrong on the test set rather than in the relay.

The sample is **Dyn1**: W2 lags W1 by 30°. The plan handles it by injecting the W2 triple
at **150°**, so a through condition lands on the relay's own internal compensation and
nets to zero differential. If you build the W2 triple at 180° — the intuitive
"opposed" answer that is correct for a generator or a line — every through-current step
will show a standing differential of about 0.518 pu and look exactly like a wiring fault.

Check three things before anything else:

1. **The vector group in the relay** matches the nameplate and matches what the tool is
   set to. `Dyn1` and `Dyn11` differ by 60° and both are common.
2. **Which winding the relay compensates.** The plan assumes the relay does the
   compensation internally and the CTs are wye on both sides. If the CTs are delta on one
   side the compensation is already in the wiring and applying it again doubles it.
3. **Per unit is per winding.** One per unit is 3.347 A secondary on W1 and 3.486 A on W2.
   They are deliberately different numbers, because the CT ratios do not match the turns
   ratio exactly — which is the normal case. A test built on one number for both windings
   is wrong on one of them.

## 2 · Test object

| Field | Sample value | Where it comes from |
|-------|--------------|---------------------|
| Nominal voltage, secondary | 120 V L–L (69.282 V L–N) | VT 13800 : 120, on W2 |
| Nominal current, secondary | 5 A | CT secondary, both windings |
| VT ratio | 115 : 1 | |
| CT ratio, W1 | 30 : 1 | 150 : 5 |
| CT ratio, W2 | 240 : 1 | 1200 : 5 |
| CT ratio, ground | 40 : 1 | 200 : 5 |
| Nominal frequency | 60 Hz | |
| Vector group | Dyn1 — W2 30° behind W1 | nameplate |

Rated currents, which every per-unit value in the plan is referred to:

| Winding | Primary | Secondary |
|---|---:|---:|
| W1 (115 kV) | 100.4 A | **3.347 A** |
| W2 (13.8 kV) | 836.7 A | **3.486 A** |

The VT is on **W2**. Every voltage-dependent element in the plan — 27, 59, 24, 32, 59N,
25 — measures the W2 side, and the tool follows the winding you select rather than
assuming W1. If your VT is on the other side, change it in the tool, not in your head.

## 3 · Hardware configuration

**Amplifier mode: 6 × 12.5 A, two triples.** `I A-*` is W1, `I B-*` is W2. The
differential and REF both need two triples; nothing else does. See §7 — the 12.5 A cap
this buys you is the plan's main constraint.

**V 4 does two different jobs** and cannot do both at once:

| Used by | V 4 carries |
|---|---|
| 59N | Broken-delta 3V0 input |
| 25 | Line side, at 60.120 Hz for the slip case |

That is a re-patch at the terminal block between two groups of steps, not a software
change. Section 4 orders the modules so it happens once.

Declare V 4 as an independent generator rather than a copy of V L1 — the synchrocheck slip
case needs it running at its own frequency.

### Binary I/O

| CMC | Direction | To / from the relay |
|-----|-----------|---------------------|
| Bin. in 1 | in | Trip / 86 lockout — the timing reference for every operate time |
| Bin. in 2 | in | Close permissive — 25 |
| Bin. in 3 | in | Alarm, on the elements that alarm before they trip |
| Bin. out 1 | out | 52a |
| Bin. out 2 | out | 52b |
| Bin. out 3 | out | Breaker-failure initiate |

## 4 · Module map

Filter `845-VEC-steps.csv` on `TU_Module`. Ordered so the V 4 patch changes once and the
two-triple work is grouped:

| Order | Module | Elements | Steps |
|------:|--------|----------|------:|
| 1 | Overcurrent — pickup + time | 50P, 50G, 50N, 50_2 | 12 |
| 2 | Overcurrent — characteristic | 51P, 51G, 51N, 46, 49 | 24 |
| 3 | Voltage | 27, 59 | 7 |
| 4 | Ramping | 67 | 6 |
| 5 | State Sequencer | 50BF (assembled from 5 steps) | 5 |
| — | *V 4 to broken delta* | | |
| 6 | Quick CMC | 59N, 24, 81, 32 | 15 |
| — | *V 4 to line side* | | |
| 7 | Synchronizer | 25 | 7 |
| 8 | Differential | 87T, 87G | 11 |
| 9 | Harmonics | 87T-H | 4 |

## 5 · The Differential module — 87T and 87G

**87T percent differential**, eight points across four restraint values, with the
characteristic entered once: pickup 0.20 pu, slope 1 25 % to a breakpoint of 2.0 pu, slope
2 60 % beyond 6.0 pu, restraint taken as max(|IW1|,|IW2|).

Confirm the **restraint definition** in the relay before trusting a slope point. Sum,
maximum and average put the device at different places on the characteristic for the same
pair of currents, and a mismatch produces points that are all plausible and all wrong.

Two things the plan does that are easy to undo by hand:

- **W2 is injected at 150°, not 180°.** That is the Dyn1 compensation. See §1.
- **The two windings carry different magnitudes for the same per unit** — 3.347 A against
  3.486 A. That is not a rounding error, it is the CT ratio mismatch, and it is what the
  relay's own per-winding scaling is there to remove.

The through-current step is worth more than every threshold in the module. It proves the
vector-group compensation, both CT ratios and both polarities at once, and it is the one
that fails when something is genuinely wrong.

**87G restricted earth fault**, on W2. Pickup 0.500 A secondary, 20.0 A primary. The phase
CTs are 1200:5 and the ground CT is 200:5, so the stability injection is scaled for that
difference — both inputs see the same primary amperes. Do not "correct" the two channels
back to the same secondary value.

REF is a polarity test as much as a level test. If the stability point operates, the
ground CT or one phase CT is reversed. Chase the wiring; do not touch the slope.

## 6 · Harmonic inhibit — the only test that proves inrush restraint

`87T-H` puts the fundamental and the harmonic on the **same physical output**,
superimposed. Build it in the Harmonics module, or as a superimposed signal in State
Sequencer.

| Component | At the setting |
|---|---:|
| Fundamental | 3.347 A |
| 2nd harmonic, 20 % | 0.669 A |
| 5th harmonic, 30 % | 1.004 A |

**Energise one winding only.** Leave the other triple at zero so the relay sees full
unrestrained differential and the harmonic content is the only thing deciding the outcome.
A balanced through-injection with harmonics added proves nothing, because there is no
differential to inhibit.

An ordinary differential test contains no harmonics and always releases the element. If
the only inrush evidence on the record is that the differential operated on a clean
injection, inrush restraint has not been tested.

## 7 · Before you inject — the amplifier conflict

The differential needs two triples, which caps every channel at 12.5 A. One per unit on W1
is 3.347 A, so the highest restraint reachable is 12.5 / 3.347 = **3.73 pu**:

| Restraint point | W1 current | 6 × 12.5 A |
|---|---:|---|
| 0.50 pu | 1.6735 A | fine |
| 1.50 pu | 5.0204 A | fine |
| 3.00 pu | 10.0409 A | fine |
| 7.00 pu | 23.4287 A | out of reach |

Drop the top restraint point to something the amplifier can produce and record the range
the slope was actually proved over, or add a second amplifier. Do not raise the number and
hope.

**Nine single-triple steps also exceed 12.5 A** and need the amplifier changed to
3 × 32 A, or 1 × 64 A for the largest. Two on 51P, two on 49, one each on 46 and 50_2, and
three on 50P:

| Step | Current | Reachable in |
|---|---:|---|
| 46 and 50_2 timing at their top multiple | 15.000 A | 3 × 32 A |
| 49 operate at 3 × and 5 × thermal setting | 15.750 / 26.250 A | 3 × 32 A |
| 51P timing at 3 × and 5 × pickup | 18.000 / 30.000 A | 3 × 32 A |
| 50P pickup pair | 42.000 / 38.000 A | 1 × 64 A, single phase |
| **50P timing at 2 × pickup** | **80.000 A** | **not by a CMC 356 in any mode** |

The 87G stability step at 20.000 A is over the cap too, and it needs the second triple —
so it moves with 87T, not with the single-triple group. Run it at a reduced through
current and say so; the polarity finding it exists for does not depend on the level.

50P is set at 8 × CT, which is 40.000 A secondary before any test multiple is applied.
Prove the pickup pair in the 1 × 64 A arrangement and time the element at a lower multiple
— 1.5 × pickup is 60.0 A and still reachable there. Record the multiple you used rather
than dropping the timing test.

## 8 · Two more things the plan already handles

**Negative-sequence rows carry the ×3.** A single-phase injection produces I2 = I/3, so
50_2 and 46 are listed at three times the setting: 50_2 at 7.500 A for a 2.500 A setting,
46 at three times its 1.000 A pickup. **Do not apply the factor again.** If you would
rather inject a balanced set in reverse rotation, I2 = I instead and the ×3 must come back
out — the tool says so per element.

**49 is a thermal replica with memory.** It uses the IEC 60255-8 form
`t = τ · ln[(I² − Ip²) / (I² − (k·Ib)²)]` with τ = 5 min, and the times in the plan assume
the replica starts at the stated prior load. After a point that reached trip it needs
several time constants to return — around 25 minutes here. Confirm the relay uses this
form and not a discrete-step model before relying on the predicted times, and record the
starting state with every result.

## 9 · After the first build

Save as a template with the test object detached. The vector-group angle, the V 4 re-patch
point, the module order and the amplifier conflict carry across transformers unchanged;
the ratings, ratios and thresholds come out of the generator.

Two things this plan deliberately will not do: it will not inject W2 at 180° because that
is what "opposed" looks like, and it will not let a clean-injection differential trip
stand as evidence that harmonic inhibit works.
