# Building the 7SJ85 test plan in Test Universe

Assembles `7SJ85-SIP-steps.csv` and `7SJ85-SIP-channels.csv` into one Test Universe
document — 26 functions, 125 steps. Build it once and save it as a template.

Values below are for the tool's **sample** feeder: 20 kV, 50 Hz, **resonant earthed**
(Petersen coil), 180 A load at 0.9 pf, 12 km overhead at 0.12 Ω/km ∠72° positive and
0.38 Ω/km ∠68° zero sequence, phase CT 400:1, core-balance CT 60:1, VT 20000:100 wye with
3V0 from a broken-delta winding. Enter your real feeder in `7SJ85.html` and re-run the
generator.

---

## 1 · It is a SIPROTEC, not a Multilin

Three differences change how you build the document, and none of them are cosmetic.

**Function groups, not element numbers.** The device organises settings under function
groups; the ANSI numbers in this plan are the tool's labels for them. Each step's `FG`
reference in the tool names the group the setting actually lives in — carry that into the
test document's step names so a technician can find the setting in DIGSI without guessing.

**Ground-fault compensation is RE/RL and XE/XL, not k0.** The device wants two real
numbers, not one complex one. The sample line gives:

| Quantity | Value |
|---|---|
| RE/RL | 0.9463 |
| XE/XL | 0.6957 |
| k0, for cross-checking | 0.7234 ∠−5.84° |

The tool computes all three from the same line constants so you can check the pair in
DIGSI against the k0 you would have set on a North American relay. If they disagree, the
line constants are wrong, not the conversion.

**The earthing decides which ground-fault function is real.** On a resonant-earthed network
the Petersen coil cancels the capacitive current and what is left on the faulted feeder is
a small **watt-metric** component. That is 67Ns, it works in milliamps, and it is the
function this device is usually bought for. Sections 5 and 6 are about it.

## 2 · Test object

| Field | Sample value | Where it comes from |
|-------|--------------|---------------------|
| Nominal voltage, secondary | 100 V L–L (57.735 V L–N) | VT 20000 : 100 |
| Nominal current, secondary | 1 A | CT 400 : 1 |
| VT ratio | 200 : 1 | |
| CT ratio, phase | 400 : 1 | |
| CT ratio, core balance | 60 : 1 | separate input |
| Nominal frequency | 50 Hz | |
| Line angle | 72° | Z1 angle |
| Z1 secondary, whole line | 2.880 Ω | `z1m · len · CTR/VTR` |
| Z0 secondary, whole line | 9.120 Ω | same conversion |
| RE/RL, XE/XL | 0.9463 / 0.6957 | from Z0 and Z1 |

Note the **1 A** secondary. Every current in this plan is small by North American habit,
and the ground-fault work is smaller still. Confirm the relay is a 1 A unit before you
wire anything.

## 3 · Hardware configuration

**Amplifier mode: 3 × 32 A**, and it is not close — the largest current anywhere in the
plan is 16.000 A, on the 50-2 timing shot. Nothing here needs a second triple and nothing
comes near a channel limit. That is worth knowing up front, because it means you can build
the whole document in one hardware configuration.

Four analogue connections, and two of them are shared:

| Channel | Carries | Used by |
|---|---|---|
| V L1–L3 | Phase voltages | most functions |
| I L1–L3 | Phase currents | most functions |
| **I aux** | Core-balance residual, 3I0 | 67Ns, 50N-*, 51N |
| **V 4** | Broken-delta 3V0 **or** synchrocheck line side | 67Ns, 59N — and 25 |

**V 4 cannot serve both jobs at once.** The 67Ns and 59N steps drive it as the
broken-delta displacement voltage at 180°; the 25 steps drive it as the line-side voltage
near 0° with its own frequency. That is a re-patch at the terminal block, not a software
change, so build the plan in two blocks with the change between them and say so in the
document. Section 4 orders the modules accordingly.

`I aux` is a separate physical input from the phase currents. Injecting the residual into
a phase CT proves nothing about a core-balance function, and a reversed core-balance CT
turns every forward 67Ns point into a reverse one — which looks exactly like a threshold
problem and is not one.

### Binary I/O

| CMC | Direction | To / from the relay |
|-----|-----------|---------------------|
| Bin. in 1 | in | Trip — timing reference for every operate time |
| Bin. in 2 | in | Close output — 79 and the 25 permissive |
| Bin. in 3 | in | Pickup / start indication |
| Bin. out 1 | out | 52a breaker simulation |
| Bin. out 2 | out | 52b breaker simulation |
| Bin. out 3 | out | Breaker-failure initiate |

The 52a/52b pair is required for the 79 sequence: the scheme tracks breaker position to
know whether its close took, and without it the reclose declares a close failure part-way
through and the later shots never run.

## 4 · Module map

Filter `7SJ85-SIP-steps.csv` on `TU_Module`. Ordered so V 4 is patched once, in the middle:

| Order | Module | Elements | Steps |
|------:|--------|----------|------:|
| 1 | Overcurrent — pickup + time | 50-1, 50-2, 50N-1, 50N-2, 37 | 16 |
| 2 | Overcurrent — characteristic | 51, 51N, 46, 49 | 19 |
| 3 | Voltage | 27, 59 | 7 |
| 4 | Harmonics | Inrush | 4 |
| 5 | Advanced Distance | 21, FLOC | 11 |
| 6 | Ramping | 67 (6 points), 81R (3 ramps) | 9 |
| 7 | State Sequencer | 79 (10 sequenced) · 50BF (5 assembled) | 15 |
| — | *re-patch V 4 to broken delta* | | |
| 8 | Quick CMC | 67Ns, 59N, 51V, 47, 81, 32 | 34 |
| — | *re-patch V 4 to line side* | | |
| 9 | Synchronizer | 25 | 6 |
| 10 | — (no injection) | 74TC | 4 |

74TC is not an analogue test. It is trip-circuit continuity at the terminal block,
evidenced by the device's own supervision alarm: prove it healthy with the breaker closed,
then open the trip-coil circuit and confirm the alarm. It sits in the plan so it is not
forgotten, not so it can be injected.

## 5 · 67Ns — the function that is not tested at 90°

This is the one worth building carefully, and the one most likely to be recorded wrong.

The sample settings: 3V0 threshold 20.0 V, applied 100.0 V; test residual 60.0 mA;
watt-metric component threshold 15.0 mA; cos φ measurement; 1 s delay.

**The operate sector does not run to ±90° from the characteristic axis.** It runs to where
the measured component falls to its threshold, which is `arccos(component / |3I0|)` — with
these values, **±75.5°**. A point placed at 82° from the axis, which reads as comfortably
inside a 90° sector, will restrain, and it should. The plan's sector-edge points are placed
either side of 75.5°, not 90°, and the tool recomputes the edge when you change either
threshold.

**Everything here is in milliamps.** 60 mA applied against a 15 mA component threshold.
Confirm the amplifier's accuracy at that output before treating a marginal result as a
relay problem, and confirm the core-balance CT ratio and direction before treating a
failed forward point as a threshold.

**Run forward and reverse first.** If both fail, the core-balance CT is reversed or the CT
star point on the tool's Setup tab does not match the drawing. Chase that before spending
an hour on sector edges.

**cos φ or sin φ is a network question, not a preference.** cos φ (watt-metric) belongs on
a resonant-earthed network like this one, where the coil has cancelled the capacitive
current. sin φ (var-metric) belongs on an isolated network, where the capacitive current
is the signal. The tool checks the pairing against the earthing on the Setup tab and says
so; if the network on your job is isolated and the function is set to cos φ, that is a
finding, not a test point.

## 6 · 59N — measures correctly, selects nothing

Displacement voltage appears on **every feeder** on the galvanically connected network,
not only the faulted one. A 59N pass says the device measures 3V0 correctly. It says
nothing about which feeder is faulted, and it should not be recorded as ground-fault
protection. That is 67Ns's job.

The phase voltages in the 59N steps are a real displaced set — the neutral shifted toward
the faulted phase — rather than three independent numbers, so the relay sees a consistent
picture. Coverage in the sample is 20 % of full displacement at the 20.0 V threshold.

## 7 · Inrush restraint — the blocked case is the test

The 2nd harmonic goes on the **same physical channel** as the fundamental, superimposed:
100 Hz on top of 50 Hz. Build it in the Harmonics module, or as a superimposed signal in
State Sequencer.

A clean fundamental injection — which is what every ordinary overcurrent test applies —
contains no 2nd harmonic and always releases the stage. So an overcurrent test passing
proves nothing about inrush restraint. The four steps are: below the ratio threshold
(releases), above it (blocks), the ratio boundary at 15.0 % (450.0 mA of harmonic on
3.0000 A of fundamental), and the **upper-limit release at 8 × In**, where blocking is
withdrawn so a genuine fault during energisation is not held off indefinitely. That last
step is the one people skip and the one that matters at two in the morning.

## 8 · Distance and fault location

21 uses the **phase loop** — (V L2 − V L3)/(I L2 − I L3), no residual term — so RE/RL and
XE/XL play no part in it. FLOC uses the ground loop and they play every part. That
asymmetry is the diagnostic: **phase reaches correct and ground results drifting means the
ground-fault compensation or Z0 is wrong, not the device.**

Reaches are entered as a percentage of the line, so they depend on the line constants as
much as on the relay. Confirm Z1 (2.880 Ω secondary) and the 72° angle against the
line-constants sheet before accepting any zone result.

For FLOC there is no trip to time — read the device's own reported distance out of its
fault record. The acceptance window in the sample is ±0.60 km on a 12.00 km line.

## 9 · Before you inject

- Every quantity is **secondary at the device terminals**; angles in degrees,
  counter-clockwise positive, V L1 at 0°.
- Confirm the device is a **1 A** unit.
- Confirm the **CT star-point direction** in DIGSI against the drawing before any
  directional test — 67, 67Ns and 32 all depend on it and all fail the same way when it is
  wrong.
- Check one 51 timing point against the device's own prediction before accepting the
  rest. Curve constants move between firmware revisions, and if the first point disagrees
  every other time in the table is wrong by the same factor.
- Negative-sequence rows (46) already carry the ×3 a single-phase injection needs. Do not
  apply it again.

## 10 · After the first build

Save as a template with the test object detached. The module order, the V 4 re-patch point
and the binary map carry across feeders unchanged; the line constants, thresholds and the
67Ns sector edge come out of the generator.

Two things this plan deliberately will not do: it will not let a 59N pass stand as
ground-fault protection, and it will not place the 67Ns sector edge at 90° because that is
where the drawing suggests it should be.
