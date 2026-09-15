# Building the 889 OCC in Test Universe

Assembles `889-GEN-steps.csv` and `889-GEN-channels.csv` into one Test Universe document —
27 elements, 137 steps. Build it once, save it as a template, and the next machine is a
re-point of the test object.

Values below are for the tool's **sample** machine: 100 MVA, 13.8 kV, 0.85 pf, 60 Hz,
two-pole, Xd 1.8 / X'd 0.25 / X"d 0.18 / X2 0.20 pu, terminal and neutral CTs 5000:5,
ground CT 200:5, VT 13800:120 wye, neutral grounding transformer 7970:240,
high-resistance grounded. Enter your real machine in `889.html`, re-run the generator,
and every number below moves. The header comment in each CSV records which configuration
produced it.

---

## 1 · Read section 7 first

A generator plan has an amplifier problem that a feeder plan does not, and it decides how
you build the document. Two elements in this plan cannot share a hardware configuration
with the rest. Settle that before you spend an hour assembling modules.

## 2 · Test object

| Field | Sample value | Where it comes from |
|-------|--------------|---------------------|
| Nominal voltage, secondary | 120 V L–L (69.282 V L–N) | VT 13800 : 120 |
| Nominal current, secondary | 5 A | CT 5000 : 5 |
| VT ratio | 115 : 1 | |
| CT ratio, terminal and neutral | 1000 : 1 | both ends of the machine |
| CT ratio, ground | 40 : 1 | 200 : 5 |
| NGT ratio | 33.2 : 1 | 7970 : 240 |
| Nominal frequency | 60 Hz | |
| Rated stator current | 4183.7 A primary = 4.1837 A secondary | `MVA / (√3 · kV)` |
| Base impedance, secondary | 16.56 Ω | `Zbp · CTR / VTR` |

**Rated stator current is the unit everything else is quoted in.** The differential, the
impedance elements and the capability curve are all in per unit of it, and 1 pu is
4.1837 A secondary. Get that one number wrong and the whole plan is wrong by the same
factor while still looking sensible.

Two derived machine impedances are worth writing on the test object as reference values
even though Test Universe has no field for them — they are what the loss-of-excitation
characteristic is checked against:

| Quantity | Sample value |
|---|---|
| X'd / 2 | 2.07 Ω secondary |
| Xd | 29.81 Ω secondary |

A zone 1 offset far from the first, or a zone 2 diameter far from the second, means the
setting was not derived from this machine.

## 3 · Hardware configuration

Two configurations, not one. See §7 for why.

**Configuration A — differential, 6 × 12.5 A.** Two current triples: `I A-*` is the
terminal end, `I B-*` the neutral end. Used by 87G and the 87GN stability point. Nothing
else in the plan needs a second triple.

**Configuration B — everything else, 3 × 32 A.** One triple, and the headroom that the
overcurrent elements need.

Voltage in both: three phases plus **V 4**, and V 4 does three different jobs across the
plan. It is not one connection:

| Used by | V 4 carries | Range in the plan |
|---|---|---|
| 59N | Grounding-transformer secondary | up to 239.9 V |
| 27TN | Third harmonic at the neutral input | 180 Hz |
| 25 | Line side, independent frequency | 60.06 Hz for the slip case |

Declare V 4 as an independent generator, not a copy of V L1 — the synchrocheck slip test
and the third-harmonic test both need it running at its own frequency. And note the
239.9 V figure: it is inside the 300 V channel limit, but only just, and a machine with a
lower NGT ratio will exceed it.

### Binary I/O

| CMC | Direction | To / from the relay |
|-----|-----------|---------------------|
| Bin. in 1 | in | Trip / 86 lockout — the timing reference for every operate time |
| Bin. in 2 | in | Close permissive — 25 |
| Bin. in 3 | in | Alarm, on the elements that alarm before they trip |
| Bin. out 1 | out | 52a generator breaker |
| Bin. out 2 | out | 52b generator breaker |
| Bin. out 3 | out | Field breaker auxiliary, where 40 or 50/27 uses it |

The 52a/52b pair is what makes 50/27 testable at all — the scheme arms on a machine at
standstill with the breaker open and disarms when it closes, so the position contacts are
the input the whole sequence turns on.

## 4 · Module map

Filter `889-GEN-steps.csv` on `TU_Module`. This order puts the single-triple work first,
so you build every module in configuration B and change the amplifier arrangement once,
at the end, rather than twice.

| Order | Module | Elements | Steps |
|------:|--------|----------|------:|
| 1 | Overcurrent — pickup + time | 50P, 50G, 50N | 9 |
| 2 | Overcurrent — characteristic | 46, 49, 51P, 51G, 51N | 25 |
| 3 | Voltage | 27, 59 | 7 |
| 4 | Quick CMC | 87GN, 59N, 32, 51V, 24, 55, 47, 81 | 43 |
| 5 | Harmonics | 27TN | 4 |
| 6 | Ramping | 67 (6 points), 81R (3 ramps) | 9 |
| 7 | Synchronizer | 25 | 6 |
| 8 | Advanced Distance | 40, 21, 78 | 20 |
| 9 | State Sequencer | 50/27 (assembled from 6 steps) | 6 |
| 10 | Differential | 87G | 8 |

## 5 · Advanced Distance — three elements, three different jobs

All three place the device somewhere on the R–X plane, and it is easy to build them as
one module and then misread the results.

**40 loss of excitation.** Two offset mho circles, entered as shots. The `WhatIsApplied`
column gives the impedance. Undervoltage supervision at 0.80 × VT (55.4 V) has to stay
satisfied throughout, so the tool holds current and lets the terminal voltage follow the
impedance rather than the other way round. On losing field the machine draws VARs from
the system and the apparent impedance swings from the first quadrant into the fourth —
if your points are landing in the first quadrant, the characteristic is entered inverted.

**21 distance backup.** Phase-to-phase loop, reach 19.87 Ω secondary at 85°, no k0. Off
the characteristic angle the circle closes in by the cosine of the offset: at ±30° the
boundary is 86.6 % of the reach, not the reach. Points placed at the reach off-angle will
fail and the element will be fine.

**78 out of step.** The four impedances only locate the blinders. The discrimination is
the **transit time** between them, which means a sequence, and the direction of travel
matters — right to left is a pole slip, the same impedances in another order are not. The
static points in this plan sit at X = 0; real swings cross nearer the electrical centre,
so raise the locus height in the tool's test options if the relay is fussy about it.

## 6 · Stator ground — 59N and 27TN are one scheme

Do not test them separately and sign them off separately.

59N covers the winding from the terminals down. A solid terminal fault puts 239.9 V on
V 4 and the 5.00 V pickup leaves the bottom **2.1 %** of the winding uncovered. That blind
zone is exactly what 27TN exists for, so a 59N pass on its own does not mean the stator is
protected.

27TN is the one element on the relay where **removing** a quantity makes it trip. Build
its four steps so the third harmonic starts healthy at 180 Hz and steps down, and keep the
forward-power and positive-sequence voltage supervision satisfied throughout — without
them nothing happens no matter what you do to the neutral input.

The 27TN pickup is normally set from the machine's own measured third-harmonic profile at
several load points, not from a calculation. A bench-verified threshold is a bench-verified
threshold; it is not evidence that the setting suits this machine.

## 7 · Before you inject — the amplifier conflict

This is the section to read before building anything.

**87G needs two triples, which caps the current at 12.5 A per channel.** One per unit is
4.1837 A, so the highest restraint the 6 × 12.5 A arrangement can reach is
12.5 / 4.1837 = **2.99 pu**. The sample plan's restraint points are 0.5, 1.0, 3.0 and 7.0 pu:

| Restraint point | Terminal-end current | 6 × 12.5 A |
|---|---:|---|
| 0.50 pu | 2.0918 A | fine |
| 1.00 pu | 4.1837 A | fine |
| 3.00 pu | 12.5511 A | 0.4 % over the limit — it will clip |
| 7.00 pu | 29.2859 A | far out of reach |

Three ways out, in order of preference: drop the restraint points to something the
amplifier can reach and say on the record that the slope was proved over 0.5–2.9 pu;
add a second amplifier (a CMS 356 gives you 6 × 32 A and every point becomes reachable);
or prove the slope on the bench at reduced currents and the stability point at rated. Do
not raise the numbers and hope.

**50P cannot be tested in the differential configuration at all.** Its pickup is 4 × CT,
which is 20.000 A secondary — already past 12.5 A — and the timing shot at 2 × pickup is
**40.000 A**. In 3 × 32 A the pickup is reachable and the timing shot is not. The 40 A shot
needs the **1 × 64 A** arrangement, which parallels the three current outputs into a single
phase. That is a third hardware configuration and one shot, so run it deliberately at the
end of the day rather than discovering it mid-module.

**87GN has the same problem in miniature.** Its through-fault stability step drives the
phase and ground inputs in opposition at 20.000 A, so it needs the second triple and it is
over the 12.5 A cap. Run it at a reduced through current and record the level used — the
polarity finding it exists for does not depend on the magnitude, and a reversed CT fails
it just as clearly at 10 A.

**Everything else sits inside 3 × 32 A with room to spare.** The largest current outside
87G, 87GN and 50P is 27.5 A, on the 51P timing shot at 5 × pickup. Four more steps — one
on 49, one on 51V and two on 51P — sit between 12.5 and 32 A, which is another reason to
build the whole document in configuration B and change the amplifier once, at the end.

## 8 · After the first build

Save as a template with the test object detached. The module structure, the binary map,
the V 4 re-patching and the amplifier conflict do not change between machines — only the
numbers do, and those come out of the generator.

Two things this plan deliberately will not do: it will not let a 59N pass stand as
evidence that the whole stator is protected, and it will not pretend the differential
slope was tested at a restraint the amplifier could not produce.
