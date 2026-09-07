#!/usr/bin/env node
/* Build the shippable single file.

   Produces dist/845-VEC-unlicensed.html — a complete, self-contained page with
   no external requests at all. tools/make-licence.mjs then stamps a signed
   licence into a copy of it, per customer.

   Everything is inlined on purpose. The customer opens one file from their own
   disk, in a substation, with no network. Anything that has to be fetched is a
   way for the tool to look broken on the day it matters.
*/
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const VERSION = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
const BUILD = new Date().toISOString().slice(0, 10);

let html = fs.readFileSync('src/845-vec.html', 'utf8');

/* -- fonts ---------------------------------------------------------------- */
const fontsPath = 'src/fonts.css';
if (!fs.existsSync(fontsPath)) {
  console.error('Missing src/fonts.css. Run:  node tools/fetch-fonts.mjs');
  process.exit(1);
}
html = html.replace('/*__FONTS__*/', fs.readFileSync(fontsPath, 'utf8'));

/* -- signature verifier --------------------------------------------------- */
html = html.replace('/*__ED25519__*/', fs.readFileSync('tools/ed25519-verify.cjs', 'utf8'));

/* -- public key ----------------------------------------------------------- */
const pubPath = path.join('keys', 'public-key.b64');
if (!fs.existsSync(pubPath)) {
  console.error(`Missing ${pubPath}. Run:  node tools/make-keys.mjs`);
  process.exit(1);
}
const pub = fs.readFileSync(pubPath, 'utf8').trim();
if (!/^[A-Za-z0-9+/]{43}=$/.test(pub)) {
  console.error(`${pubPath} does not look like a 32-byte base64 key.`); process.exit(1);
}
html = html.replace('__PUBKEY__', pub);

/* -- version -------------------------------------------------------------- */
html = html.replaceAll('__VERSION__', VERSION).replaceAll('__BUILD__', BUILD);

/* -- guards --------------------------------------------------------------- */
const leftovers = html.match(/__[A-Z0-9]+__/g);
if (leftovers) { console.error('Unfilled build slots: ' + [...new Set(leftovers)].join(', ')); process.exit(1); }
for (const bad of ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs', 'unpkg', 'jsdelivr']) {
  if (html.includes(bad)) { console.error(`Build still references ${bad} — it must be fully offline.`); process.exit(1); }
}
if (!html.includes('{"p":"","s":""}')) { console.error('Licence slot missing from build.'); process.exit(1); }

fs.mkdirSync('dist', { recursive: true });
const out = 'dist/845-VEC-unlicensed.html';
fs.writeFileSync(out, html);


/* -- customer setup guide -------------------------------------------------- */
const guideSrc = 'docs/install-guide.src.html';
if (fs.existsSync(guideSrc)) {
  let g = fs.readFileSync(guideSrc, 'utf8')
    .replace('/*__FONTS__*/', fs.readFileSync(fontsPath, 'utf8'))
    .replaceAll('__VERSION__', 'v' + VERSION)
    .replaceAll('__BUILD__', BUILD);
  const gl = g.match(/__[A-Z0-9]+__/g);
  if (gl) { console.error('Guide has unfilled slots: ' + [...new Set(gl)].join(', ')); process.exit(1); }
  /* Artifact-ready fragment (the host supplies doctype/head/body) ... */
  fs.writeFileSync('dist/845-VEC-setup-guide.fragment.html', g);
  /* ... and a standalone file that can simply be emailed. */
  fs.writeFileSync('dist/845-VEC-setup-guide.html',
    '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    g.replace(/^<title>/m, '<title>') + '\n</html>\n');
  console.log(`dist/845-VEC-setup-guide.html   ${(g.length / 1024).toFixed(0)} KB`);
}

const sha = crypto.createHash('sha256').update(html).digest('hex');
console.log(`${out}`);
console.log(`  version  ${VERSION}   build ${BUILD}`);
console.log(`  size     ${(html.length / 1024).toFixed(0)} KB`);
console.log(`  sha256   ${sha}`);
console.log(`  key      ${pub.slice(0, 12)}…`);
console.log(`\nNext:  node tools/make-licence.mjs --org "Customer" --seats 10`);
