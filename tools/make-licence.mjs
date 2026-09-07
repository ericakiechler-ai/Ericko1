#!/usr/bin/env node
/* Mint one signed site/team licence and write the personalised build.

   Usage:
     node tools/make-licence.mjs --org "Acme Power Services" \
                                 --site "Calgary Operations" \
                                 --seats 12 \
                                 [--maint 2027-09-07]     maintenance end; default 12 months from today
                                 [--no-maint]             perpetual with no update entitlement
                                 [--expires 2027-09-07]   hard expiry (trial / subscription only)
                                 [--id LIC-2026-0007]
                                 [--template dist/845-VEC-unlicensed.html]

   The model is PERPETUAL + MAINTENANCE. The right to use never expires; `maint`
   is the date up to which the customer is entitled to new builds. Renewal =
   mint a fresh file with a later --maint (keep the same --id) and send it.
   Use --expires only for a trial or a subscription seat.

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
const isoDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d);
if (!org || !seats) {
  console.error('Required: --org "Company Name" --seats <n>\nOptional: --site "Location"  --maint YYYY-MM-DD | --no-maint  --expires YYYY-MM-DD  --id LIC-...  --template file');
  process.exit(1);
}
if (expires && !isoDate(expires)) { console.error('--expires must be YYYY-MM-DD'); process.exit(1); }
const plusOneYear = () => { const d = new Date(); d.setUTCFullYear(d.getUTCFullYear() + 1); return d.toISOString().slice(0, 10); };
const maint = argv.includes('--no-maint') ? null : arg('maint', plusOneYear());
if (maint && !isoDate(maint)) { console.error('--maint must be YYYY-MM-DD'); process.exit(1); }

const keyPath = path.join(process.cwd(), 'keys', 'signing-key.pem');
if (!fs.existsSync(keyPath)) {
  console.error(`No signing key at ${keyPath}. Run:  node tools/make-keys.mjs`); process.exit(1);
}
const privateKey = crypto.createPrivateKey(fs.readFileSync(keyPath));

const issued = new Date().toISOString().slice(0, 10);
const id = arg('id', 'LIC-' + issued.slice(0, 4) + '-' + crypto.randomBytes(3).toString('hex').toUpperCase());

/* Canonical JSON: keys sorted, no whitespace. Both signer and verifier must
   produce byte-identical input, so the ordering is not left to chance. */
const payload = { expires: expires || null, id, issued, maint: maint || null, org, product: '845-VEC', seats, site, type: 'site', v: 2 };
const canon = JSON.stringify(payload, Object.keys(payload).sort());
const msg = Buffer.from(canon, 'utf8');
const sig = crypto.sign(null, msg, privateKey);

/* Self-check with the same verifier the customer's copy will run. A licence
   that does not verify here would be a dead file in a customer's hands. */
const pubRaw = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'der' }).subarray(-32);
const ok = await ED.verify(new Uint8Array(sig), new Uint8Array(msg), new Uint8Array(pubRaw));
if (!ok) { console.error('FATAL: the licence just signed does not verify. Not writing a file.'); process.exit(1); }

const block = JSON.stringify({ p: msg.toString('base64'), s: sig.toString('base64') });

const tpl = path.resolve(arg('template', path.join('dist', '845-VEC-unlicensed.html')));
if (!fs.existsSync(tpl)) { console.error(`Build first:  node build.mjs`); process.exit(1); }
let html = fs.readFileSync(tpl, 'utf8');
const buildDate = (html.match(/const BUILD_DATE = '(\d{4}-\d{2}-\d{2})'/) || [])[1];
if (maint && buildDate && buildDate > maint) {
  console.error(`This template was built ${buildDate}, after the maintenance end ${maint}.\n` +
                `The customer's copy would run as evaluation. Use --maint on or after ${buildDate}, or an older template.`);
  process.exit(1);
}
const MARK = '{"p":"","s":""}';
if (!html.includes(MARK)) { console.error('Template has no licence slot — rebuild.'); process.exit(1); }
html = html.replace(MARK, block);

const slug = org.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const out = path.join(process.cwd(), 'dist', `845-VEC-${slug}.html`);
fs.writeFileSync(out, html);

fs.mkdirSync('licences', { recursive: true });
const reg = 'licences/register.csv';
if (!fs.existsSync(reg)) fs.writeFileSync(reg, 'licence_id,issued,org,site,seats,maint,expires,build,file\n');
fs.appendFileSync(reg, [id, issued, JSON.stringify(org), JSON.stringify(site), seats, maint || '', expires || '', buildDate || '', path.basename(out)].join(',') + '\n');

console.log(`Licence  ${id}`);
console.log(`Issued   ${issued}   use: ${expires ? 'expires ' + expires : 'perpetual'}   maintenance: ${maint ? 'to ' + maint : 'none'}`);
console.log(`Org      ${org}${site ? '  /  ' + site : ''}   ${seats} seats`);
console.log(`File     ${out}`);
console.log(`Register ${reg}`);
