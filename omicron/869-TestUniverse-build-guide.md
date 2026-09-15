# Building the 869 OCC in Test Universe

Assembles `869-MTR-steps.csv` and `869-MTR-channels.csv` into one Test Universe document —
20 elements, 92 steps. Build it once and save it as a template; the next motor is a
re-point of the test object.

Values below are for the tool's **sample** motor: 4.16 kV, 1500 hp induction, FLA 180 A,
service factor 1.15, 0.89 pf, 60 Hz, locked rotor 6 × FLA, LR withstand 20 s cold / 15 s
hot, nameplate acceleration 8 s, 3 starts per hour with 20 minutes between, CT 200:5,
core-balance ground CT 50:5, VT 4160:120 wye, differential by core balance. Enter your
real motor in `869.html` and re-run the generator.

---

## 1 · A motor plan is a thermal plan

Every other relay in this family is tested element by element in whatever order suits the
outage. The 869 is not, because the thermal model remembers. Section 5 is the part of this
guide that saves the day; read it before you build anything.

## 2 · Test object

| Field | Sample value | Where it comes from |
|-------|--------------|---------------------|
| Nominal voltage, secondary | 120 V L–L (69.282 V L–N) | VT 4160 : 120 |
| Nominal current, secondary | 5 A | CT 200 : 5 |
| VT ratio | 34.667 : 1 | |
| CT ratio | 40 : 1 | |
| Ground CT ratio | 10 : 1 | 50 : 5, core balance |
| Nominal frequency | 60 Hz | |

Four derived currents drive the whole plan. Write them where you can see them:

| Quantity | Primary | Secondary |
|---|---:|---:|
| Full load amps | 180 A | **4.500 A** |
| Service-factor amps (1.15) | 207 A | 5.175 A |
| Locked-rotor amps (6 × FLA) | 1080 A | **27.000 A** |
| 50P pickup (8 × FLA) | 1440 A | 36.000 A |

FLA secondary and locked-rotor secondary are the two the plan is written in per unit of.
The tool quotes every thermal point as a multiple of FLA and every start as a multiple of
locked rotor.

## 3 · Hardware configuration

**Amplifier mode: 3 × 32 A.** A motor relay has one CT set, so a second triple gains
nothing, and the 32 A limit is what the start currents need. See §7 — one element still
does not fit.

**No V 4 in this plan.** Nothing in the 869 set uses the auxiliary voltage output. Three
phase voltages and one current triple is the whole analogue picture, and the largest
voltage anywhere is 95.263 V on the 59 timing shot.

Ground current goes **through the core-balance window**, not into a phase CT. Both 50SG
and 87M depend on it, and both have pickups small enough that how the lead is routed
matters more than the setting:

| Element | Pickup, primary | Pickup, secondary |
|---|---:|---:|
| 50SG sensitive ground | 0.50 A | 0.050 A |
| 87M motor differential | 0.200 A | — |

Check the CMC's accuracy at those outputs before treating a marginal result as a relay
fault, and confirm the direction the conductor passes through the window: a lead routed
back the wrong way inverts the answer and looks exactly like a setting error.

### Binary I/O

| CMC | Direction | To / from the relay |
|-----|-----------|---------------------|
| Bin. in 1 | in | Trip contact — the timing reference for every operate time |
| Bin. in 2 | in | Start permissive / close output — 66 blocks here, it does not trip |
| Bin. in 3 | in | Alarm — 49 thermal alarm at 75 % capacity |
| Bin. out 1 | out | 52a / contactor auxiliary |
| Bin. out 2 | out | 52b |
| Bin. out 3 | out | Breaker-failure initiate |

Binary input 2 is not optional. **66 does not trip — it inhibits.** A correct result is a
refused start, which is invisible on the trip contact. If the motor is allowed to start
and the relay then trips, the setting is doing the wrong thing and a trip-only test set-up
will record it as a pass.

## 4 · Module map

Filter `869-MTR-steps.csv` on `TU_Module`. The order below is deliberate and §5 explains
why: everything that does not disturb the thermal model comes first.

| Order | Module | Elements | Steps |
|------:|--------|----------|------:|
| 1 | Voltage | 27, 59 | 8 |
| 2 | Quick CMC | 47, 81, 55, 32, 87M | 17 |
| 3 | Overcurrent — pickup + time | 50P, 50G, 50SG, 51LR, 37 | 17 |
| 4 | State Sequencer | 50BF (assembled from 5 steps) | 5 |
| 5 | Overcurrent — characteristic | 46, 51G, **49** | 17 |
| 6 | Quick CMC | **49TC** | 7 |
| 7 | State Sequencer | 48, 66, 19 (21 sequenced states) | 21 |

Note that the Quick CMC group is split. 49TC is a Quick CMC module like the four in row 2,
but it drives the thermal model and belongs with 49 rather than with the voltage-unbalance
and power checks. Rows 5 to 7 — the thermal characteristic, the capacity readings and the
three start sequences — are last on purpose, and §5 is why.

## 5 · The thermal model — plan the order or lose the day

The 49 model accumulates capacity and decays slowly. Numbers from the sample motor:

| Quantity | Value |
|---|---|
| Accumulation rate at 6 × FLA | 10.01 % per second |
| Trip time at 6 × FLA, cold | 9.99 s |
| Trip time at 6 × FLA, hot | 7.49 s |
| Running time constant | 15 min |
| Stopped time constant | 30 min |
| **Full decay from 100 %** | **150 min** |

Two and a half hours to cool from a single trip, if you wait it out. Nobody waits it out,
which is why the usual outcome is a string of short operate times that all look like the
relay is fast.

Three rules:

1. **Reset thermal capacity in the relay between every thermal point**, and record the
   starting value with each result. A point taken from an unknown capacity is not a
   measurement.
2. **Read capacity used off the relay's own display** during an accumulation run rather
   than waiting for a trip. It is faster, and it tells you the shape of the model instead
   of one point on it. That is what the 49TC steps are for.
3. **Run every thermal point in one deliberate order**, then the sequences, then stop
   injecting. Going back to a thermal point after the start sequences means resetting
   again.

The model is not the phase current. It runs on **Ieq = √(I1² + K·I2²)** with K = 6.0, so
an unbalanced injection trips sooner than its magnitude suggests, and the 46 unbalance
points feed the thermal model as well as the unbalance element. Expect the two to interact
and do not treat an early thermal trip during an unbalance test as a fault.

## 6 · The three sequences

Filter on `SeqRun` and `SeqState`. Each run is one sequence; the states go in in order.

**48 acceleration / incomplete sequence.** Start current 27.000 A at 85 % of nominal
voltage — a real start pulls the terminal voltage down, and if the relay has voltage-
dependent start supervision it will notice. Two timers race here: the acceleration timer
expires at 10.0 s and the cold thermal curve at 9.99 s. Whichever is shorter is what trips,
so record which element the relay reports, not just that it tripped.

**The sample motor deliberately fails its hot start.** The hot curve reaches trip at
7.49 s and the motor needs 8.00 s to accelerate. That is not a test-set problem and it is
not a modelling artefact — it is the finding, and it is the kind that shows up on a real
motor as "trips on the second start" months after commissioning. If your own data does
this, raise it before you tune the relay to hide it.

**66 starts per hour.** A rolling-hour counter cannot be shortcut on the test set. Either
reduce the settings for the test and restore them afterwards — recording as-found and
as-left — or accept that a full test takes an hour of wall clock. Three separate limits
can each block a start (starts per hour, time between starts, restart delay after a stop);
provoke them one at a time or you will not know which one answered.

**19 reduced-voltage start transition.** At the 65 % tap the motor draws 17.550 A, which
is 3.90 × FLA instead of 6.00 — starting current follows voltage roughly in proportion,
while torque falls with its square. The transition is set at 13.500 A. Run 2 is the one
worth doing carefully: an autotransformer tap left energised past its short-time rating is
what this element exists to catch, and a transition that simply works proves very little.
Note that at 3.90 × FLA the cold thermal curve reaches trip at 24.6 s, so check which
element the relay reports when the tap limit and the thermal model land close together.

## 7 · Before you inject

**50P does not fit in 3 × 32 A.** Its pickup is 8 × FLA = **36.000 A secondary**, and the
timing shot at 2 × pickup is **72.000 A**.

| Step | Current | Reachable |
|---|---:|---|
| Pickup — above threshold | 37.800 A | only in 1 × 64 A, single phase |
| Pickup — below threshold | 34.200 A | only in 1 × 64 A, single phase |
| Timing at 2.0 × pickup | 72.000 A | **not by a CMC 356 in any mode** |

Prove the pickup pair in the **1 × 64 A** arrangement, which parallels the three current
outputs into one phase, and time the element at a lower multiple — 1.5 × pickup is 54.0 A
and still reachable there. Record the multiple you actually used. Do not quietly drop the
timing test, and do not reduce the relay's pickup to make the shot fit.

While you are there: the tool flags that 50P at 36.000 A sits above the locked-rotor
current of 27.000 A, which is the right relationship. A short-circuit element set below
locked rotor trips on every start, and that is the single most common motor-relay setting
error.

**Everything else fits.** The next largest currents are 37.8 A (50P pickup, above) and
27.0 A on the start and thermal points, which the 32 A channels carry.

## 8 · After the first build

Save as a template with the test object detached. The module order, the binary map and the
thermal discipline carry across motors unchanged — only FLA, locked rotor and the timers
move, and those come out of the generator.

Two things this plan will not do: it will not let a thermal point taken from an unknown
starting capacity count as a measurement, and it will not record a 66 test as passed off
the trip contact, because a correct 66 never operates the trip contact at all.
