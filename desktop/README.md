# 845-VEC desktop build

Wraps the **same single HTML file** the browser build produces — no second
implementation of any calculation, so the desktop app cannot drift from the file
your customers already trust.

## Not built or run in this repository's CI sandbox

This project was written against Tauri 2.11 but has **not been compiled here** —
the container has no `webkit2gtk` and cannot cross-compile Windows binaries.
Treat the first `npm run build` on your own machine as the real first build, and
expect to spend an hour on toolchain setup. The GitHub Actions workflow at
`.github/workflows/desktop.yml` is the reliable path: it builds on real Windows
and macOS runners.

## Build it yourself

Prerequisites: [Rust](https://rustup.rs), Node 18+, and for Windows the
"Desktop development with C++" workload from Visual Studio Build Tools.

```bash
# 1. Produce the licensed HTML for this customer
cd ..
node build.mjs
node tools/make-licence.mjs --org "Customer Name" --site "Their Site" --seats 10

# 2. Stage it as the desktop frontend
cp dist/845-VEC-customer-name.html desktop/frontend/index.html

# 3. Generate platform icons (once)
cd desktop && npm install && npm run icons

# 4. Build
npm run build
```

Installers land in `src-tauri/target/release/bundle/`.

## Code signing — do this before you sell

An unsigned Windows installer shows a full-screen SmartScreen warning that says,
in effect, "Windows protected your PC." On a paid engineering tool that costs
you the sale, and it is the single most common reason a customer's IT department
refuses an install.

- **Windows:** an OV code-signing certificate is roughly USD 200–400/year, and
  now requires the key to live on a hardware token or in a cloud HSM. EV
  certificates clear SmartScreen immediately; OV certificates build reputation
  over time.
- **macOS:** an Apple Developer account (USD 99/year), plus notarization. An
  un-notarized `.dmg` is blocked outright on current macOS.

Put the certificate in GitHub Actions secrets and the workflow will sign
automatically — see the commented block in `desktop.yml`.
