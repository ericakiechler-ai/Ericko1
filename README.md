# 845-VEC — vector and test-value calculator

A single-file tool that turns **GE Multilin 845** relay settings into **Omicron CMC 356**
injection values: magnitude, angle and frequency, per output channel, ready to type into
Test Universe.

Open `index.html` in any browser. No install, no network, no dependencies beyond a web font
that falls back cleanly when there is no connection — it works on a locked-down field laptop.

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
