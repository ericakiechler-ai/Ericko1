# 7SJ85-SIP — calculation review and QC record

**Tool:** `src/7sj85-sip.html` — Siemens SIPROTEC 5 7SJ85 overcurrent protection × Omicron CMC 356
**Scope:** every `compute()`, the displaced-set and fault-placement models, the
ground-fault direction plane, the channel mapper, the limit checks, the vector calculator,
the presets and the sample configuration. Each injected quantity was traced from setting
to channel with the sample ratios (400:1 phase CT, 60:1 core-balance CT, 20000:100 VT,
100 V broken delta, 12 km at 0.120 Ω/km ∠72° / 0.380 Ω/km ∠68°, secondary-ohm factor 2),
and the notes were checked against what the code actually does.
**Outcome:** released. One medium finding and four low ones fixed; one item left open.

## Findings

| # | Severity | Finding | Fix |
|---|---|---|---|
| 1 | Medium | **50N / 51N ignored the Setup choice of where 3I0 comes from.** The ground stages always converted through the phase CT and injected into one phase CT, while the Setup tab (and 67Ns) already distinguish *3I0 measured on the core-balance input* from *3I0 calculated from the phase CTs*. With the sample's measured configuration the default 0.40 ×In read as 160 A primary instead of 24 A on the 60:1 core-balance CT, and the injection went to the wrong input. | `gndRoute()` follows the Setup choice: measured → threshold in the core-balance input's In, primary through its ratio, injected on the core-balance channel (the same output 67Ns uses); calculated → single-phase into one phase CT as before. Readout names the CT; the note says which. |
| 2 | Low | **21 / FLOC phase-to-phase loop carried 3V0 = full L-N voltage** (Vb = Vm∠0, Vc = Vm∠180 with Va = N∠90). The loop was right; the injection put 57.7 V of zero sequence on the VTs during every L2–L3 test, which 59N (calculated source) and 67Ns would both see. | Same construction as the 850 and 889: Vb, Vc collapse symmetrically about −Va/2 along the prefault Vbc direction. Loop unchanged, V0 = 0, rotation honoured. Sheet reports the actual L2 phasor. |
| 3 | Low | **32 directional power over-injected by 1/cos(MTA)** (no error at the 0° default). | I = P/(3V) at −θ (180° − θ reverse). |
| 4 | Low | **Phase rotation hardcoded** outside `P3()`: `displaced()` (which feeds 67Ns, 59N, 67N and four presets), the L1–G fault set, the 27/59 single-phase sets, the 47 sets, the load and reverse-rotation presets and `seq()`. | `rotS()`/`rotA()`/`P3rev()` helpers everywhere; `seq()` exchanges p and n under ACB. |
| 5 | Low | Duplicate `inputmode`; no Setup-first on a fresh load. | Fixed. |

## Open — needs the 7SJ85 manual

1. **67Ns sin φ sign convention.** The tool takes the reactive-component forward axis at
   +90° from −3V0 (3I0 leading the reference) with a direction setting to flip it, and
   tells the tester to prove forward and reverse first. Siemens' sign convention for the
   isolated-network case should be confirmed against the manual and the CT star-point
   entry in DIGSI; the tool's forward/reverse pair is what proves it on the bench either
   way.
2. **Display resolution at small impedances.** With the default 1 A held current on a
   short feeder the phase-to-phase loop voltage is about 2 V, reconstructed from two 29 V
   phasors shown to 0.01 V and 0.1°; the values as displayed reproduce the loop impedance
   to about 1%. Raising the held current on Setup tightens it. Noted, not changed.

## Verified correct (no change)

Secondary-ohm factor CTR/VTR; the complex k0 and Siemens' RE/RL, XE/XL from the same Z1
and Z0 (with the note that they agree only when R0/R1 = X0/X1); the ground loop
V/(I·(1+k0)) for single-phase injection; the displaced set V_Lk = Vn∠θk − f·Vn and its
3V0 = 3·f·Vn (re-derived, and checked in the test through an independent sequence
calculation); 67Ns's component solve, the sector edge at acos(threshold / test current)
rather than 90°, the −3V0 reference on V4 and the cos/sin pairing against the network
earthing; 59N by both sources and its reset check; the IEC 60255 and ANSI curve constants;
the ×3 negative-sequence factor; the inrush test's two rows on one output and the
upper-limit release; 49's IEC replica with preload; 37, 51V, 50BF, 74TC, 79 sequencing and
25 including the dead-line case; 27/59 phase logic; 81 and 81R; the channel-limit and
milliamp-accuracy checks.

## Accepted simplifications (documented, not changed)

- The core-balance CT input is assumed to have the secondary rating entered for it; no
  burden or accuracy-class correction.
- 67 (phase) uses V L1 at 0° as the angle reference with the rotation angle taken as the
  lag of current behind its polarising reference; the note tells the tester to prove
  forward and reverse before the boundary points.

## Verification

`tests/7sj85.test.mjs` — 34 checks. Builds the tool, mints a licence, drives it from
`file://` with all network blocked, renders all 26 functions, and checks 50-1, 50N-1 by
both 3I0 sources, 46, 51, 67Ns (magnitude, sector edge and an independent 3V0 of the
displaced set), 59N, the 21 ground loop with (1+k0), the 21 phase loop via an independent
(Vb−Vc)/(Ib−Ic) and 3V0 calculation under ABC and ACB, 32 with and without a
characteristic angle, 49, 27 and the rotation behaviour against an independent
implementation written in the test from the sample constants. Licence, evaluation, forged
and Setup-first states, decimal entry and sheet provenance are covered as for the other
tools.
