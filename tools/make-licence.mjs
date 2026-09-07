#!/usr/bin/env node
/* Mint one signed site/team licence and write the personalised build.

   Usage:
     node tools/make-licence.mjs --org "Acme Power Services" \
                                 --site "Calgary Operations" \
                                 --seats 12 \
                                 [--expires 2027-09-07] \
                                 [--id LIC-2026-0007]

   Writes  dist/845-VEC-<slug>.html  — the file the customer downloads.
   Appends a row to  licences/register.csv  so you have a record of who has what.
*/
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ED = require('./ed25519-verify.cjs');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };

const org = arg('org');
const site = arg('site', '');
const seats = parseInt(arg('seats', '0'), 10);
const expires = arg('expires', null);
if (!org || !seats) {
  console.error('Required: --org "Company Name" --seats <n>\nOptional: --site "Location"  --expires YYYY-MM-DD  --id LIC-...');
  process.exit(1);
}
if (expires && !/^\d{4}-\d{2}-\d{2}$/.test(expires)) {
  console.error('--expires must be YYYY-MM-DD'); process.exit(1);
}

const keyPath = path.join(process.cwd(), 'keys', 'signing-key.pem');
if (!fs.existsSync(keyPath)) {
  console.error(`No signing key at ${keyPath}. Run:  node tools/make-keys.mjs`); process.exit(1);
}
const privateKey = crypto.createPrivateKey(fs.readFileSync(keyPath));

const issued = new Date().toISOString().slice(0, 10);
const id = arg('id', 'LIC-' + issued.slice(0, 4) + '-' + crypto.randomBytes(3).toString('hex').toUpperCase());

/* Canonical JSON: keys sorted, no whitespace. Both signer and verifier must
   produce byte-identical input, so the ordering is not left to chance. */
const payload = { expires: expires || null, id, issued, org, product: '845-VEC', seats, site, type: 'site', v: 1 };
const canon = JSON.stringify(payload, Object.keys(payload).sort());
const msg = Buffer.from(canon, 'utf8');
const sig = crypto.sign(null, msg, privateKey);

/* Self-check with the same verifier the customer's copy will run. A licence
   that does not verify here would be a dead file in a customer's hands. */
const pubRaw = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'der' }).subarray(-32);
const ok = await ED.verify(new Uint8Array(sig), new Uint8Array(msg), new Uint8Array(pubRaw));
if (!ok) { console.error('FATAL: the licence just signed does not verify. Not writing a file.'); process.exit(1); }

const block = JSON.stringify({ p: msg.toString('base64'), s: sig.toString('base64') });

const tpl = path.join(process.cwd(), 'dist', '845-VEC-unlicensed.html');
if (!fs.existsSync(tpl)) { console.error(`Build first:  node build.mjs`); process.exit(1); }
let html = fs.readFileSync(tpl, 'utf8');
const MARK = '{"p":"","s":""}';
if (!html.includes(MARK)) { console.error('Template has no licence slot — rebuild.'); process.exit(1); }
html = html.replace(MARK, block);

const slug = org.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const out = path.join(process.cwd(), 'dist', `845-VEC-${slug}.html`);
fs.writeFileSync(out, html);

fs.mkdirSync('licences', { recursive: true });
const reg = 'licences/register.csv';
if (!fs.existsSync(reg)) fs.writeFileSync(reg, 'licence_id,issued,org,site,seats,expires,file\n');
fs.appendFileSync(reg, [id, issued, JSON.stringify(org), JSON.stringify(site), seats, expires || '', path.basename(out)].join(',') + '\n');

console.log(`Licence  ${id}`);
console.log(`Issued   ${issued}${expires ? '  expires ' + expires : '  perpetual'}`);
console.log(`Org      ${org}${site ? '  /  ' + site : ''}   ${seats} seats`);
console.log(`File     ${out}`);
console.log(`Register ${reg}`);
