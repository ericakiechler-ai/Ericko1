# Relay test-value calculators

Single-file tools that turn GE Multilin relay settings into **Omicron CMC 356** injection
values: magnitude, angle and frequency, per output channel, ready to type into Test Universe.

| File | Relay | Scope |
|------|-------|-------|
| `index.html` | **Multilin 845** transformer protection | 21 elements, two-winding differential with vector-group compensation |
| `889.html` | **Multilin 889** generator protection | 27 elements, machine differential plus the impedance plane |

Open either in any browser. No install, no network, no dependencies beyond a web font that
falls back cleanly when there is no connection — they work on a locked-down field laptop.
Both share the same core, the same conventions and the same layout; the 889 carries an indigo
accent so the two are never confused on screen.

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
