# Relay test-value calculators

Single-file tools that turn protective-relay settings into **Omicron CMC 356** injection
values: magnitude, angle and frequency, per output channel, ready to type into Test Universe.

| File | Relay | Scope |
|------|-------|-------|
| `index.html` | **Multilin 845** transformer protection | 21 elements, two-winding differential with vector-group compensation |
| `889.html` | **Multilin 889** generator protection | 27 elements, machine differential plus the impedance plane |
| `850.html` | **Multilin 850** feeder protection | 27 elements, autoreclose sequences, distance zones and fault location |
| `869.html` | **Multilin 869** motor protection | 20 elements, thermal model checked against the motor's own damage curve |
| `7SJ85.html` | **Siemens 7SJ85** SIPROTEC 5 overcurrent | 26 functions, compensated-network directional ground fault |
| `7SD82.html` | **Siemens 7SD82** SIPROTEC 5 line differential | 16 functions, two-ended, with the staging that decides what a test proves |

Open any of them in any browser. No install, no network, no dependencies beyond a web font
that falls back cleanly when there is no connection — they work on a locked-down field laptop.
All six share the same core, the same conventions and the same layout. The four GE tools differ
by accent colour so they are never confused on screen — 845 teal, 889 indigo, 850 plum, 869 copper
— and the two Siemens ones are deliberately achromatic, which is both a nod to SIPROTEC's austere
hardware and a way of marking them as a different platform rather than more Multilins.

`omicron/` holds the generated Test Universe test plans, built from these tools rather than
typed alongside them.

---

# 845-VEC — transformer protection

## What it does

**Elements tab.** Pick an ANSI device from the rail, enter the settings exactly as they read
in EnerVista, and get the test points: pickup bracketed either side of the threshold, timing
points at chosen multiples with predicted operate times, directional boundaries, differential
slope points. Selecting a test point loads its CMC channel table underneath.

Covered: 87T, 87T harmonic inhibit, 87G/64REF, 50P, 51P, 50G, 51G, 50N, 51N, 50_2, 46, 67P/67N,
27, 59, 59N, 24, 81U/81O, 32, 49, 50BF, 25.

**Vector calculator.** Enter voltage and current magnitude and angle per phase for both
windings and read back symmetrical components, differential and restraint per phase with the
vector-group compensation applied, power, and apparent impedance — with a live phasor diagram.
Fault presets seed realistic conditions.

**Test sheet.** Collect points from any number of elements into one tab-separated block,
ready to paste into a test record.

**Method tab.** Every equation the tool uses, written out so the arithmetic can be checked
by hand.

## The calculation

All applied quantities are **secondary**, at the relay terminals. All angles are against
V L1 at 0°, counter-clockwise positive — the same convention as the CMC's own phasor display.

```
V L-N nominal   = VT secondary / √3                     (wye)
I rated primary = MVA / (√3 · kV)
I(pu)           = I secondary · CTR / I rated primary
I diff          = | IW1(pu) + IW2(pu) · 1∠(−shift) |
I rest          = max( |IW1(pu)| , |IW2(pu)| )          (selectable)

IEEE C37.112    t = TDM · [ A / (M^p − 1) + B ]
IEC 60255       t = TDM · [ K / (M^E − 1) ]
IAC / ANSI      t = TDM · [ A + B/(M−C) + D/(M−C)² + E/(M−C)³ ]
Thermal 49      t = τ · ln[ (I² − Ip²) / (I² − (k·Ib)²) ]
Volts per hertz V required = (V/Hz)pu · V base · f test / f nominal
```

Per-unit is referred to each winding's own rated current, which is why the two secondary
currents in an 87T test come out different — that difference is the relay's magnitude
compensation, not an error. The W2 triple is injected at 180° plus the vector-group shift,
so through current lands on the relay's internal compensation and nets to zero differential.
That is also why the 87T tests need the CMC's 6 × 12.5 A arrangement: a phase-shifting
transformer cannot be slope-tested correctly with a single-phase injection.

## Verify before you rely on it

Three places where a firmware revision will show up first:

1. **Curve constants.** Run one timing point and compare with the relay's own predicted
   operate time. If they agree, the constants here match your firmware.
2. **Restraint definition.** The 87T restraint selector offers max, average and sum. Confirm
   which one your revision uses.
3. **ECA sign.** Directional angles assume ECA is the angle by which the operating current
   *lags* its polarising reference at maximum forward torque. Prove forward and reverse once
   and the four boundary points follow.

Then run the 87T through-fault point and confirm the relay reads near-zero differential —
that single test proves the vector group, the CT ratios and the compensation at once.

## Scope

Not covered: 60 CT/VT supervision (the logic varies enough between revisions that a generic
model would mislead), relay setting file import/export, CT saturation and burden. Channel
warnings are about the amplifier's limits, not about whether the CT circuit will behave.

The values shown on load are a worked sample — 20 MVA, 115/13.8 kV Dyn1 — not your station.
Enter the real data on the Setup tab first.

---

# 889-GEN — generator protection

Same shell, different machine. Enter the generator nameplate, the machine reactances and the
CT/VT schedule; pick an ANSI device from the rail; get the test points and the CMC channel
table.

Covered: 87G, 87GN/64REF, 59N, 27TN, 40, 46, 32, 21, 78, 50/27, 51V, 24, 55, 49,
50P, 51P, 50G, 51G, 50N, 51N, 67, 27, 59, 47, 81U/81O, 81R, 25.

## What is new versus the 845

**The impedance plane.** 40, 21 and 78 are placed in R–X rather than in amps, so the tool
converts a target impedance into an injection and plots where each point sits against the
characteristic. That conversion is the heart of it:

```
Z base primary   = kV² / MVA
Z base secondary = Z base primary · CTR / VTR
Z(Ω sec)         = X(pu) · Z base secondary

A balanced set with ∠V = 0° and ∠I = −∠Z presents |Z|∠Z to the relay.
  hold current: V = I · |Z|        hold voltage: I = V / |Z|
```

The Setup tab decides which magnitude is held and flags when either channel limit is about to
be crossed. On a generator, holding current is normally right: the impedances of interest run
from a fraction of an ohm to tens of ohms, and holding voltage drives the current past the
amplifier at the small end.

**Loss of excitation.** Offset mho below the R axis — centre at `(0, −(offset + diameter/2))`,
radius `diameter/2`. Zone 1 is conventionally offset by X'd/2 with a 1.0 pu diameter; zone 2
keeps the offset and opens to Xd. The tool shows the machine's own X'd/2 and Xd in secondary
ohms alongside, so a setting that does not match the machine is visible before you test to it.

**Stator ground, both halves.** 59N covers the winding from the terminals down to where the
driving voltage runs out; the tool reports that blind band as a percentage and gives the
relay volts for a fault at any winding position. 27TN covers the rest by watching the
machine's own third-harmonic neutral voltage disappear — the one element on the relay where
*removing* a quantity is what makes it trip, and the channel table carries its supervision
current alongside the harmonic.

**Machine differential.** Terminal-end CTs against neutral-end CTs on the same winding: no
phase shift, no vector group, just a straight 180° opposition with correction for a CT ratio
mismatch between the two ends. The through-fault point is really a neutral-CT polarity test.

**Negative sequence as a machine limit.** `t = K / I2(pu)²`, where K is the generator's
published short-time unbalance capability off the data sheet, not a protection preference.

## Verify before you rely on it

1. **Curve constants** — run one 51 timing point against the relay's own prediction.
2. **40 conventions** — measure the boundary at two angles and check both fit one circle. If
   they do not, the relay's offset and diameter definitions are not the ones assumed here.
3. **51V restraint shape** — modelled as `pickup × clamp(V/Vnom, floor, 1.0)`. Measure the
   pickup at two voltages and check the ratio before accepting the table.
4. **24 inverse curve** — exposed as the general form `t = TD·A/(M−1)^n` with A and n as
   settings, because the published generator V/Hz families differ by product. Fit them to
   your relay, or use definite time.
5. **ECA sign** — prove forward and reverse once; the boundary points follow.

Then run the 87G through-fault point and confirm near-zero differential.

## Scope

Not covered: **64F field ground** (the 889 detects it by injecting onto the field circuit
through a dedicated coupling module — there is nothing for a CMC to inject, so that test
belongs to the module's own procedure), **60 CT/VT supervision**, setting-file import, and CT
saturation or burden.

Sample on load: 100 MVA, 13.8 kV, Xd 1.8 / X'd 0.25 pu, high-resistance grounded. Not your
machine — enter the real data first.


---

# 850-FDR — feeder protection

Same shell again. Enter the circuit, the line constants and the CT/VT schedule; pick an ANSI
device from the rail; get the test points and the CMC channel table.

Covered: 79, CLPU, FLOC, 50BF, 21, 68, 50P, 51P, 50G, 51G, 50N, 51N, 50SG, 51SG, 50_2, 46,
46BC, 37, 67, 32, 27, 59, 59N, 47, 81U/81O, 81R, 25.

## What is new versus the 845 and 889

The 845's subject is phasors and the 889's is the impedance plane. A feeder relay's subject is
**distance along a line and elapsed time**, so this tool grows two things neither of the others
needed: a reclose timeline and a feeder line diagram.

**Placing a fault on the line.** Every distance and fault-location test is a position, not a
current. A fault a fraction x of the way to the remote end is presented by making the relay's
own measuring loop come out at x·Z1:

```
phase loop    Z = (V L2 − V L3) / (I L2 − I L3)      no k0
ground loop   Z = V L1 / (I L1 + k0 · 3I0)           with k0
k0 = (Z0 − Z1) / (3 · Z1)

hold current: V = I · |Z loop|      angles: ∠V = 0°, ∠I = −∠Z loop
```

A single-phase injection makes 3I0 equal to the phase current, so the ground-loop denominator
becomes I·(1 + k0) and the applied voltage is the line impedance times |1 + k0|. That one
factor is why ground reaches can measure wrong while every phase reach measures right — it is
k0 or Z0 at fault, not the reach setting. The tool computes k0 from the line constants (or
takes an override) and shows the resulting factor on the Setup tab.

**Autoreclose is a sequence, not a magnitude.** Two runs are built and every test point is one
state of one of them: a permanent fault that must spend every shot and reach lockout, and a
transient fault that must reclose once and reset. The timeline shows where the selected state
sits. Reclaim and reset are the usual confusion — reclaim is the window after a successful
close during which a new fault counts as the *next* shot; reset is the longer idle period that
returns the counter to zero.

**Cold load pickup** turns on one current placed between the normal pickup and the lifted one:
it must not trip while the window is open and must trip once it closes. If the relay behaves
the same in both states the element is doing nothing.

**Broken conductor** inverts exactly. Reducing one phase to a fraction f of the other two gives
`I1 = (2+f)/3`, `I2 = (1−f)/3`, so `I2/I1 = (1−f)/(2+f)` and the fraction needed for a target
ratio r is `f = (1−2r)/(1+r)`. A fully open conductor is f = 0, giving 50% — the ceiling for
this method and the most a single break can produce.

**The vector calculator** works the fault backwards: enter V and I and it reports all six
measuring loops plus positive sequence, picks the faulted loop by residual content the way a
phase selector does, and puts the implied fault position on the line diagram.

## Verify before you rely on it

1. **Line constants** — confirm the derived Z1, Z0 and k0 against the line-constants sheet
   *and* against what is actually entered in the relay. Both can be wrong together.
2. **Curve constants** — run one 51P timing point against the relay's own prediction.
3. **k0** — run the fault locator at 25% and 75% for both an A–G and a B–C fault. Matching
   phase results with drifting ground results points at k0, not at the relay.
4. **ECA sign** — prove forward and reverse once; the boundary points follow.

Then run the full permanent-fault reclose sequence with the breaker simulated. An element that
tests fine in isolation and behaves differently inside a reclose cycle is worth finding on a
bench rather than on the circuit.

## Scope

Not covered: coordination (the tool gives operate time at a multiple; whether that sits under
the upstream relay and over every downstream fuse is read off the study), **60 CT/VT
supervision**, non-homogeneous lines, and setting-file import.

Sample on load: 13.8 kV, 8 mile overhead feeder, 0.65 Ω/mi ∠68° positive sequence, solidly
grounded. Not your circuit — enter the real data first.


---

# 869-MTR — motor protection

Same shell again. Enter the motor nameplate, the thermal-limit data and the CT/VT schedule; pick
an ANSI device from the rail; get the test points and the CMC channel table.

Covered: 49, 49TC, 48, 51LR, 66, 19, 46, 37, 87M, 50P, 50G, 51G, 50SG, 50BF, 27, 59, 47, 81,
55, 32.

## What is new versus the other three

A motor relay's subject is **thermal capacity and the start**, so the signature view here is the
log–log time–current curve with the machine's own locked-rotor damage points drawn on it.

**Equivalent heating current.** The one calculation that makes a motor relay different:

```
Ieq = √( I1² + K · I2² )
```

Negative-sequence current induces double-frequency rotor currents that heat several times
harder than balanced current, so K weights them. Every thermal calculation runs on Ieq, not on
the applied current — a modestly unbalanced supply trips far sooner than its measured phase
current suggests.

**The overload curve, fitted rather than assumed.** Published motor overload families differ
between products and firmware revisions, so the constant is exposed instead of guessed. The
honest way to set it is the **fit mode**: read one point off the relay's own curve display — a
current multiple and the time it shows — and the tool solves

```
t = CM · A / (Iⁿ − 1)          A = t · (Iⁿ − 1) / CM
```

Verified: fit mode reproduces its own fit point exactly. Check a second point at a different
multiple afterwards to confirm the exponent as well as the constant. An IEC 60255-8 replica is
offered as an alternative model.

**Thermal capacity has memory.** Capacity accumulates at `100% ÷ t(Ieq)` and decays as
`TCU·e^(−t/τ)`, with separate running and stopped time constants. This is the element that
ruins an unplanned test day — a point run on a warm model reads short, so the tool gives the
decay checkpoints and the notes push you to plan the order and record the starting capacity.

**It checks the settings against the machine.** A motor relay is the one place where the tool
can tell you the protection does not fit, not just that it does not match itself. Three
comparisons run on the Setup tab, and any failing one is a setting finding rather than a test
failure:

1. **Curve under the damage point** — at locked rotor the cold curve must trip before the safe
   stall time, or a stalled rotor burns before the relay operates.
2. **Curve above the start** — if the hot curve is shorter than the acceleration time, a warm
   restart trips before the machine finishes starting.
3. **Short circuit above locked rotor** — a 50P pickup at or below LRA trips on every start.

The sample motor deliberately fails the second one (hot curve 7.49 s against 8.0 s
acceleration) so the check is visible on load.

**Unbalance inverts exactly**, same algebra as the 850's broken-conductor element:
`I2/I1 = (1−f)/(2+f)`, so `f = (1−2r)/(1+r)`. Verified to hit every target ratio to three
decimals, with 50.000% at a fully open phase.

## Verify before you rely on it

1. **Fit the overload curve** from a point off the relay, then confirm with a second point.
2. **Read the Setup checks** before touching the test set — they say whether the settings fit
   the machine.
3. **Plan the thermal run** as one ordered sequence with resets, and write the starting thermal
   capacity next to every recorded time.
4. **Run the start-inhibit points** on 51LR, 37 and 27. The elements that must *not* operate
   during a start are the ones that strand a motor in service.

## Scope

Not covered: **RTD inputs** (tested with resistance boxes, not a current source), **40 loss of
excitation** on synchronous machines (an offset-mho characteristic — the 889 tool in this family
does that arithmetic; the 55 power-factor element here is the coarser substitute), **60 CT/VT
supervision**, and setting-file import.

Sample on load: 1500 hp, 4.16 kV induction motor, 180 A FLA, 6.0 ×FLA locked rotor, 20 s cold
stall. Not your machine — enter the real data first.


---

# 7SJ85-SIP — Siemens SIPROTEC 5 overcurrent

A different platform, not a relabelled Multilin. Settings are entered as DIGSI 5 sees them, each
function carries its function-group path, and the two places Siemens genuinely differs are built
out rather than glossed.

Covered: 67Ns, 59N, 50-1, 50-2, 51, 50N-1, 50N-2, 51N, 46, Inrush, 21, FLOC, 67, 49, 37, 51V,
79, 50BF, 74TC, 25, 27, 59, 47, 81, 81R, 32.

## What is specific to this device

**Directional ground fault on a compensated network — 67Ns.** The signature function, and the one
none of the GE tools have. On an isolated or resonant-earthed system every healthy feeder carries
residual current too, so magnitude says nothing and only the component in phase with the
displacement voltage identifies the faulted circuit:

```
φ        = angle of 3I0 measured against −3V0
active   = |3I0| · cos φ        reactive = |3I0| · sin φ
```

Which component is measured follows the neutral treatment, and getting that pairing wrong is the
commonest setting error on these systems: **cos φ** for resonant earthed, where the Petersen coil
has cancelled the capacitive current and left a small resistive residual; **sin φ** for isolated,
where the residual is capacitive and the faulted feeder carries the sum of every other feeder's
capacitance. The tool checks the pairing against the network type on the Setup tab and says so.

The signature view is a polar plot of 3I₀ against −3V₀ with the operate sector drawn. **The sector
does not close at ±90°** — the component threshold cuts it in first, at `arccos(comp/|3I0|)`, so
with the sample values it runs to ±75.5°. Change the test current and the edge moves. Verified:
every point's stated verdict agrees with an independent recomputation from the generated channel
values.

**RE/RL and XE/XL instead of k0.** Siemens splits the ground return into two separate real ratios
where most devices take one complex factor:

```
RE/RL = (R0 − R1) / (3·R1)      XE/XL = (X0 − X1) / (3·X1)
k0    = (Z0 − Z1) / (3·Z1)
```

The forms agree only when R0/R1 equals X0/X1, which on a real overhead line they rarely do — the
sample gives 0.946 against 0.696. That is the point of the split: it lets the device compensate
resistance and reactance independently. The tool derives all three, shows them side by side and
flags the divergence.

**Inrush restraint, disk-emulation reset, CT star-point direction.** All three change how you
test rather than what you inject, and all three are called out where they bite: a clean
fundamental injection can never prove 2nd-harmonic blocking; disk emulation makes consecutive
timing shots interact; and a star point set the wrong way in DIGSI inverts every directional
decision with no angle adjustment able to compensate.

**74TC trip-circuit supervision** is included with an empty channel table and says why — it is a
DC continuity test at the terminal block, not an injection. It is in the list because it is the
function most often left off a commissioning record.

## Verify before you rely on it

1. **RE/RL, XE/XL and k0** against both the line-constants sheet and DIGSI.
2. **CT star-point direction** in DIGSI against the drawing, before any directional test.
3. **Characteristic constants** — one 51 timing point against the device's own prediction.
4. **67Ns forward and reverse** before spending time on sector edges: a reversed core-balance CT
   fails both and looks like a threshold problem.

## Scope

Not covered: CFC logic charts, transient ground-fault detection (it works on the first
microseconds of the fault, which a steady-state test set cannot reproduce — 67Ns here is the
steady-state directional function), and setting-file import.

Sample on load: 20 kV, 12 km, resonant earthed, 0.12 Ω/km ∠72°, 400:1 CTs, 100 V VT secondary,
50 Hz. Not your feeder — enter the real data first.

---

# 7SD82-DIF — Siemens SIPROTEC 5 line differential

`7SD82.html` — 16 functions, two ends, one test set.

Same core and conventions as the rest, and the same achromatic Siemens identity as the 7SJ85.
What is different is that a differential scheme has two devices and the test set is only ever
at one of them.

## What is specific to this device

**Staging is a setting.** The Line setup tab carries a staging selector — local end only,
loop-back at the local end, or true end to end — and it changes what every test point means
rather than what it injects. With the remote end quiescent the operating point can only move
along Idiff = Irest, so a local-end test finds the minimum pickup and says nothing at all
about the slope. Points that need current at both ends are marked, on screen and in the
generated plan, and stay in the list marked untested rather than quietly disappearing.

**The 87L solver inverts the restraint definition.** To place the device at an exact
(Irest, Idiff) point the tool solves the pair of end currents that produce it, for all three
definitions offered in DIGSI:

| Definition | End A | End B |
|---|---|---|
| \|IA\| + \|IB\| | (Ir + Id) / 2 | (Ir − Id) / 2, opposed |
| max(\|IA\|,\|IB\|) | Ir | Ir − Id, opposed |
| (\|IA\| + \|IB\|) / 2 | Ir + Id / 2 | Ir − Id / 2, opposed |

Where a requested restraint point cannot hold the required differential — |IA + IB| can never
exceed |IA| + |IB| — the point is dropped and the reason given, rather than injected under a
label that does not match what is applied.

**Charging current is treated as a measurement, not a nuisance.** On the sample 15 km cable it
is 0.0417 pu, 14 % of the differential threshold, and it appears as a standing differential on
a healthy energised line. Three points set the difference between the ends deliberately so
compensation can be seen working, over-compensating and switched off.

**The protection interface has no channels.** Its five steps are link work — measured delay,
asymmetry, break, restore, and an injected internal fault while the link is down to prove the
backup actually takes over. Injecting current proves nothing about a fibre, so the tool does
not pretend otherwise.

**Two extra views.** A two-ended line schematic showing what each device measures for the
selected point, and the Idiff/Irest plane with the dual-slope characteristic and every point
plotted on it.

## Verify before you rely on it

1. **The restraint definition** in DIGSI, before any slope point. Get it wrong and every point
   lands on the wrong part of the characteristic while still looking plausible.
2. **Both CT ratios as they are set in both devices**, not as the switchyard nameplates read.
3. **Through-current stability first if you can reach it.** It proves ratio agreement, polarity
   at both ends and the sign convention across the interface at once, and it is the one that
   fails when something is genuinely wrong.
4. **The measured charging current**, not a cable datasheet figure.

## Scope

Not covered: CFC logic charts, distance protection where the 7SD82 is ordered with it, the
setting file itself, and GPS synchronisation of two test sets — the plan says when an end-to-end
test is needed but arranging it is a site matter, not a calculation.

Sample on load: 110 kV, 15 km cable, 600 A reference, 600:1 CTs at both ends, 110000:100 VT,
direct fibre at 0.5 ms, ping-pong synchronisation, staged local-end only. Not your line — enter
the real data first.
