# Relay Test-Value Calculators — publisher repository

Six relay test-value calculators, each mapping a relay's settings to **Omicron
CMC 356** injection values, plus the generators that turn them into Test Universe
build guides, test-plan CSVs and Excel workbooks. This repository builds the
shippable product, issues licences, and holds the customer documentation.

**One pipeline, licensed tool by tool.** `products.json` is the single gate: a
tool is built into `dist/` and can be licensed only when it is `released`, and it
is released only after the calculation review the 845 had. All six tools are now
reviewed and released.

| Tool | Relay | Reviewed | Released |
|---|---|---|---|
| `src/845-vec.html` | GE Multilin 845 transformer | ✅ | ✅ sellable |
| `src/850-fdr.html` | GE Multilin 850 feeder | ✅ [record](docs/reviews/850-FDR.md) | ✅ sellable |
| `src/869-mtr.html` | GE Multilin 869 motor | ✅ [record](docs/reviews/869-MTR.md) | ✅ sellable |
| `src/889-gen.html` | GE Multilin 889 generator | ✅ [record](docs/reviews/889-GEN.md) | ✅ sellable |
| `src/7sj85-sip.html` | Siemens SIPROTEC 5 7SJ85 | ✅ [record](docs/reviews/7SJ85-SIP.md) | ✅ sellable |
| `src/7sd82-dif.html` | Siemens SIPROTEC 5 7SD82 line differential | ✅ [record](docs/reviews/7SD82-DIF.md) | ✅ sellable |

The product itself is a single self-contained HTML file. No installer, no
account, no activation, no network access — it works on a machine that has never
been online, which is the environment it is actually used in.

---

## Layout

| Path | What it is |
|---|---|
| `products.json` | The release manifest. Which tools may be built and licensed. |
| `src/845-vec.html` | The 845 — the released product source. |
| `src/<tool>.html` | The other five, imported from the suite with history; unreleased. |
| `omicron/` | Test-plan generators, build guides, CSVs and `xlsx/` workbooks (see its README). |
| `static/` | Generated no-script editions of each tool. Regenerate; do not edit. |
| `site/index.html` | The suite landing page. |
| `src/fonts.css` | Generated. Bundled woff2 faces so the tool renders identically offline. |
| `tools/ed25519-verify.cjs` | Signature verification. Inlined into every build **and** used by the licence tool to self-check. One implementation, two consumers. |
| `tools/make-keys.mjs` | Generates your signing keypair. Run once, ever. |
| `tools/make-licence.mjs` | Mints one signed licence and writes that customer's file. |
| `tools/fetch-fonts.mjs` | Re-downloads and re-inlines the fonts. |
| `build.mjs` | Produces `dist/845-VEC-unlicensed.html` and the customer guide. |
| `tests/` | 97 checks: crypto correctness, licence behaviour, and the calculations. |
| `docs/install-guide.src.html` | The customer-facing setup guide. |
| `desktop/` | Tauri project for native Windows/macOS installers. **Not built here** — see its README. |
| `keys/public-key.b64` | The public half. Committed — every build embeds it. |
| `keys/signing-key.pem` | The private half. Git-ignored. Never commit it. |
| `licences/register.csv` | Who holds which licence. Git-ignored. |

---

## First-time setup

```bash
node tools/make-keys.mjs     # once, ever — then back the private key up offline
                             # and COMMIT keys/public-key.b64 so CI builds embed your real key
node tools/fetch-fonts.mjs   # once, or when you want to refresh the faces
node build.mjs
node tests/run.mjs
```

> **The signing key is the business.** Lose `keys/signing-key.pem` and you cannot
> issue or renew a licence for any existing customer. Leak it and anyone can mint
> licences in your name. Back it up offline, in two places, today.

## Promoting a tool

A tool moves from imported to sellable only through these steps, in order.
Skipping the first is how a wrong injection value reaches a substation.

1. **Calculation review.** Read every `compute()` the way the 845 was read:
   trace each injected quantity from setting to channel, with real ratios, and
   check the notes say what the code does. Fix, test, commit.
2. **Wire the product slots** into its source: the `<style>/*__FONTS__*/</style>`
   slot, the licence bar markup, `<script>/*__ED25519__*/</script>`, the `LIC`
   runtime, `VERSION`/`BUILD_DATE`, and the station save/load — copy them from
   `src/845-vec.html`. The `product` check in `LIC.boot` must match the tool's tag.
3. **Tests.** Add a suite under `tests/` that drives the built file from `file://`
   with the network blocked, checks the licence states, and asserts at least one
   computed value per element group.
4. Set `reviewed: true`, then `released: true` in `products.json`.
5. `node build.mjs --tool <id>` and `node tools/make-licence.mjs --tool <id> …`.

## Releasing

```bash
node build.mjs      # rebuild the released 845 from src/ (--tool <id> for another released tool)
node tests/run.mjs  # 233 checks — a build that fails these must not ship
```

`tests/run.mjs` is the gate. It verifies the Ed25519 implementation against RFC
8032 vectors and 200 round-trips against Node's own signer, then drives the built
file in a real browser with **all network blocked** to confirm the licence
verifies from `file://`, that tampering is rejected, and that the calculations
produce the expected values.

## Issuing a licence

```bash
node tools/make-licence.mjs \
  --org    "Northgate Power Services" \
  --site   "Calgary Operations" \
  --seats  12 \
  --maint  2027-09-07          # maintenance end; defaults to 12 months from today
```

Writes `dist/845-VEC-northgate-power-services.html` — the file that customer
downloads — and appends a row to `licences/register.csv`.

### The model: perpetual + maintenance

| Field | Meaning | Lapses → |
|---|---|---|
| *(none)* | The right to use. **Never expires.** | — |
| `maint` | Date up to which the customer is entitled to new builds. | Bar notes *maintenance lapsed*; the copy stays **fully licensed** and exports are still stamped Licensed. A build dated **after** `maint` runs as evaluation until they renew. |
| `expires` | Hard expiry. Trials and subscription seats only. | Evaluation. |

`make-licence.mjs` refuses to mint a file whose build date is after the
`--maint` you give it, since the customer's copy would open as evaluation.

**Renewal** is: mint a fresh file from the current build with a later `--maint`,
keeping the same `--id`, and send it. **Perpetual with no updates** is `--no-maint`.

---

## How the licensing actually works, and what it does not do

The licence is an **Ed25519 signature over a canonical JSON payload**, verified in
the browser against a public key embedded at build time. Your private key never
leaves your machine, so a licence naming an organisation cannot be forged.

Three decisions worth understanding before you price or market this:

**1. Verification never changes a computed value.** An unlicensed copy performs
exactly the same arithmetic as a licensed one. Degrading numbers in a tool whose
output is injected into live protection equipment would be dangerous, and no
commercial argument outweighs that. What the licence controls is *provenance* —
what the page says about itself, and what every exported test sheet is stamped
with.

**2. Verification fails safe, not closed.** If the licence is absent, damaged,
expired, or the browser cannot do SHA-512, the tool still runs, as a clearly
marked evaluation copy. A licensed engineer in a substation with no signal must
never be locked out of their own tool by a check that could not complete.

**3. This is attribution, not DRM.** Anyone who can open developer tools can
remove the check, and your customers can. That is fine, and chasing it would be
wasted effort. What actually protects the product is that the licensee's
organisation is printed on **every test sheet the tool exports**. An engineer
will not put a commissioning record in front of a client with someone else's
company name on it. The watermark does the enforcement; the signature just makes
it unforgeable and gives you provenance in a support conversation.

---

## Selling it

**Do not put this on the Apple or Google app stores.** Your buyer is a protection
engineer with a CMC 356, finding tools through LinkedIn, relay conferences and
colleagues — not App Store search. You would pay 15–30% and accept a real
rejection risk under Apple's minimum-functionality guideline to reach an audience
that is not there. Apple also mandates in-app purchase for digital goods, so you
could not use this licensing at all.

Sell direct. Use **Lemon Squeezy** or **Paddle** rather than Stripe alone: both act
as merchant of record and handle VAT and sales tax worldwide, which matters
immediately for international B2B software, and both produce the proper invoice
your customer needs to expense it.

Delivery at your likely volume is manual and that is fine: order arrives → run
`make-licence.mjs` → email the file and `dist/845-VEC-setup-guide.html`. A site
licence is a handful of customers, not a thousand. Automate it when the volume
justifies it, not before.

On packaging the offer: a site licence is usually an easier sell into a utility
or EPC than individual seats, because it clears one approval instead of twelve.

---

## What changed in v1.1.0

**Two calculation fixes.** Both affect numbers a technician would inject.

- **87G through-fault stability was scaled wrongly.** The ground injection used
  the CT *secondary ratings* instead of the full CT *ratios*, so it silently
  cancelled whenever both CTs were 5 A and mis-scaled badly when they were not.
  On the shipped sample (phase 1200:5, ground 200:5, 4×CT) it produced 20 A where
  the correct same-primary-amperes figure is 120 A — a stability test that would
  read as a false failure and send a technician chasing a CT polarity fault that
  does not exist. The accompanying note also claimed a scaling the code did not
  perform. Both are corrected, and the element now tells you the largest
  through-current the CT pair can actually be tested at with your amplifier.
- **87T no longer mislabels an unrealisable point.** Where the required
  differential exceeded the restraint level, W2 was clamped to zero and the point
  was still labelled OPERATE, though the relay would restrain. It is now marked
  NOT TESTABLE.

**Made sellable.** Signed site/team licensing with an offline check and a
provenance stamp on every export; fonts bundled so it renders identically with no
network; version and build date on screen and on every test sheet.

**Station files.** Setup can now be saved to and loaded from a `.json` file.
Previously the station lived only in browser storage, so clearing browsing data
erased it and it could not move between the seats a site licence covers.

---

## Known gaps

Honest list, in the order I would tackle them.

0. **Open items from the reviews.** Each record under `docs/reviews/` ends with
   the points that could not be settled offline and need the relay manual: the
   IAC Extremely Inverse E constant carried by the GE tools, the form of slope 2
   above Break 2 on the 845 and 889 differentials, the 869 thermal I_M and 32
   power base, the 7SJ85 67Ns sign convention, and the 7SD82 restraint model.
   None changes a default-setting test point; all are called out in the tool.

1. **No native installer yet.** `desktop/` holds a complete Tauri project and
   `.github/workflows/desktop.yml` builds real installers on real runners, but
   neither has been compiled — this repository's sandbox has no `webkit2gtk` and
   cannot cross-compile Windows binaries. Budget an hour for toolchain setup, and
   get a code-signing certificate before you ship one: an unsigned installer
   throws a SmartScreen warning that will lose you sales.
2. **One relay, one test set.** The architecture generalises — elements are
   registered into a list and the channel mapper is separate — but every element
   currently assumes the 845 and the CMC 356.
3. **Curve constants are not firmware-versioned.** The tool warns about this and
   the guide tells the customer to verify the first timing point, which is the
   right mitigation, but a firmware selector would be better.
4. **No CSV or XRIO file export.** The test sheet is copy-paste only.
5. **The test sheet does not carry measured-value columns back in.** It is a
   one-way export, not a record you complete in the tool.

---

© 2026 Eric Kiechler. All rights reserved. Multilin is a trademark of GE Vernova;
CMC and Test Universe are trademarks of OMICRON electronics GmbH. Independent
work, not affiliated with or endorsed by either.
