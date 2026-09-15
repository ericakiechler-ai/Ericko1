# Building the 7SD82 test plan in Test Universe

A differential plan is not a list of thresholds. Almost everything a line
differential scheme fails on in service — a CT ratio entered at one end only,
a star point reversed, a fibre routed the long way round — is invisible to a
threshold test and shows up the moment current flows through the line. So the
plan is organised around **staging** first and functions second.

Read this next to the two CSV pairs:

| File | Staging | Steps | Not reachable |
|---|---|---|---|
| `7SD82-DIF-steps.csv` / `-channels.csv` | local end only | 69 | 12 |
| `7SD82-DIF-loopback-steps.csv` / `-channels.csv` | loop-back at the local end | 69 | 0 |

The injections are identical in both. Only the `Reachable` column changes.
Build from the loop-back pair if you have the second current triple; build
from the local pair if you do not, and carry the twelve unreachable steps
forward as untested rather than quietly dropping them.

---

## 1 · Decide the staging before you open Test Universe

Three arrangements, and they prove different things.

**Local end only.** One CMC 356 at end A, the remote device quiescent.
Reaches the local measurement path, 87L minimum pickup, 87N sensitivity,
every backup function and all the binary work. Does **not** reach the slope,
through-current stability, or CT ratio and polarity agreement between the
ends — with end B carrying nothing the operating point can only move along
Idiff = Irest, so every "slope" point you run is just the pickup test again
under a different name. Twelve steps in the plan say so.

**Loop-back at the local end.** One CMC 356 driving both current triples, the
second triple wired into the remote device's CT inputs (or into a loop that
returns to the local device where the scheme is arranged that way). This is
the practical single-set arrangement and it reaches every step in the plan.
It proves the differential characteristic and the sign convention across the
protection interface. It does not prove the field CT wiring at the remote
station, because that wiring is not in the loop.

**True end to end.** A test set at each station, GPS-synchronised, one triple
each. The only arrangement that proves the whole scheme including both sets
of field CTs. Needs two crews, two sets and a clock, so it is normally kept
for commissioning and for after a CT or fibre change.

Set the staging on the tool's Line setup tab before generating, and the plan
re-labels itself.

## 2 · Test object

Build the device from `Reachable`-independent data first — it does not change
with staging.

| Field | Value from the sample | Where it comes from |
|---|---|---|
| Nominal voltage, secondary | 100 V L–L, 57.735 V L–N | VT 110000 : 100 |
| Nominal current, secondary | 1 A | CT 600 : 1, both ends |
| Nominal frequency | 50 Hz | |
| VT ratio | 1100 : 1 | |
| CT ratio, end A | 600 : 1 | |
| CT ratio, end B | 600 : 1 | must match what is set in the far device |
| Reference current | 600 A primary = 1 pu | the base every pu value in the plan uses |

Enter the **end B CT ratio as it is set in the remote device**, not as the
nameplate at the remote switchyard reads. If those two disagree the scheme is
already wrong and the through-current step is what will tell you.

## 3 · Hardware configuration

Current amplifier: **6 × 12.5 A, two triples**. This is not optional for the
loop-back plan — every step with a value in `I_B_L1` needs a second triple.
The largest current in the plan is 8.0 A per phase per triple (the
through-current stability step), comfortably inside 12.5 A.

| Test set output | Goes to | Plan columns |
|---|---|---|
| I A / triple 1 | local device CT inputs | `I_L1`, `I_L2`, `I_L3` |
| I B / triple 2 | remote device CT inputs | `I_B_L1`, `I_B_L2`, `I_B_L3` |
| V 1–3 | local device VT inputs | `V_L1`, `V_L2`, `V_L3` |
| V 4 | synchrocheck line side | `V_4` — 25 only |

**Polarity is the test.** Wire triple 2 so that a through condition subtracts.
The plan expresses this as end B at 180° for a through current and at 0° for
an internal fault; if you get zero differential on the internal-fault step and
full differential on the stability step, triple 2 is reversed. Fix the wiring,
not the plan.

### Binary I/O

| Signal | Direction | Used by |
|---|---|---|
| 87L trip, local | input | 87L, 87N, Ich |
| Intertrip receive | input | 85 |
| Intertrip send | input | 85 |
| Backup trip | input | 50-1, 51, 50N-1, Stub |
| Breaker-failure trip | input | 50BF |
| BF initiate | output | 50BF |
| Isolator auxiliary, stub release | output | Stub |
| 52a / 52b | output | 79, 50BF, 25 |
| Protection interface healthy | input | PI, and the release for 50-1 |

## 4 · Module map

`TU_Module` and `DriveAs` in the CSVs give this per step. Summarised:

| Function | Module | Notes |
|---|---|---|
| 87L | Differential | Enter the characteristic from the settings, then run the ten points as shots. |
| 87N | Quick CMC | Sensitivity on one phase; the stability point still needs both triples. |
| Ich | Quick CMC | Read the standing differential in DIGSI. There is no trip to time. |
| PI | — | Not injection. Link work, in DIGSI and at the patch panel. |
| 85 | State Sequencer | Time from the sending-end initiate to the receiving-end output. |
| 50-1, 51, 50N-1, Stub | Overcurrent | Ordinary pickup and timing. |
| 79 | State Sequencer | Ordered states; never split into separate shots. |
| 50BF | State Sequencer | Initiate is a binary output; time from its edge. |
| 74TC | — | Continuity at the terminal block, evidenced by the device alarm. |
| 25 | Synchronizer | V4 with an independent frequency for the slip case. |
| 27, 59, 81 | Voltage / Quick CMC | Step the frequency for 81; do not ramp it for threshold points. |

## 5 · The Differential module — 87L

Enter the characteristic once: pickup 0.30 pu, slope 1 30 % to a breakpoint of
2.0 pu restraint, slope 2 70 % beyond 6.0 pu.

Then check the **restraint definition** against DIGSI before you trust a single
slope point. The plan's per-end currents are solved from it, and the three
definitions put the device in different places for the same pair of currents:

| Definition | Through 8 pu at each end gives Irest |
|---|---|
| \|IA\| + \|IB\| | 16.0 pu |
| max(\|IA\|,\|IB\|) | 8.0 pu |
| (\|IA\| + \|IB\|) / 2 | 8.0 pu |

Get this wrong and every slope point lands on the wrong part of the
characteristic while still looking plausible. Change it in the tool and
re-generate; do not adjust the numbers by hand.

Run the ten steps in the order given. The order matters:

1. **Minimum pickup, above and below.** End A alone. Reachable at any staging.
2. **Slope at 1.0, 3.0 and 8.0 pu restraint**, above and below each. Both ends.
3. **Through-current stability at 8.0 pu.** Both ends, opposed.
4. **Internal fault at 4.0 pu from each end.** Both ends, in phase.

Step 3 is worth more than all the thresholds together. It is the one that
fails when something is genuinely wrong, and a standing differential there is
a wiring or ratio error, not a setting to be adjusted. Record the measured
differential even when it passes — a small standing value that grows between
visits is a CT going bad.

## 6 · Charging current — before you argue about a standing differential

On the sample 15 km cable the charging current is 25 A primary, which is
0.0417 pu, which is **14 % of the 0.30 pu differential threshold**. It appears
as a permanent differential on a healthy energised line.

The three Ich steps set the difference between the ends deliberately so you
can see compensation working, over-compensating, and switched off. Measure the
line's charging current, do not take it from a cable datasheet, and do not
raise the differential threshold to make a standing value go away.

## 7 · The protection interface

The five PI steps carry no channels on purpose. Injecting current proves
nothing about a fibre.

- Read the measured delay in DIGSI and compare it against the route on the
  drawing. A reading far from expected means the fibre is not going where you
  think it is.
- Read the asymmetry. Ping-pong synchronisation assumes a symmetric path, so
  asymmetry appears directly as a phase error between the ends — which is to
  say, as a false differential.
- Break the link. Confirm 87L blocks **and** that the backup functions
  actually arm. Then inject an internal fault and confirm the backup clears
  it. That last step is the one that proves the fallback is real rather than
  nominal.
- Restore the link and note the resynchronisation time. It is dead time on the
  protection.

## 8 · Before you inject

- Everything in the plan is **secondary at the device terminals**.
- Angles are degrees, counter-clockwise positive, V L1 at 0°.
- End B currents belong to the remote test set when staging is end to end, and
  to triple 2 when it is loop-back.
- The sample configuration is a worked example. Enter the real line, CT and VT
  data in the tool and re-generate before the plan means anything.
- Check `Reachable` on every step you are about to run.

## 9 · After the first build

Save the assembled plan as an OCC and re-use it. The CSVs are re-generated
from the tool whenever settings change, so the sequence of steps stays stable
and only the numbers move — re-import rather than rebuilding.

Two things the plan deliberately does not do: it does not tell you the
scheme is healthy from a local-end test, and it does not treat a standing
differential as a setting problem. Both of those are how differential schemes
get signed off and then fail on the first external fault.
