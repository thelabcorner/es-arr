#!/usr/bin/env node
// ESARR vendor-sync guard — the vendored accelerator artifact
// (agent-skills/illustrator-com-automation-skill/vendor/ESARR.accel.jsx) must
// match the upstream dist build byte-for-byte, or every consumer of the skill
// vendor embeds a stale bundle. Mirrors the esb64/espack family convention.
//
// Usage:
//   node esarr-vendor-sync.mjs            # sync: copy dist -> vendor
//   node esarr-vendor-sync.mjs --check    # verify byte-identical (fail on mismatch)
//   node esarr-vendor-sync.mjs --check --quiet
//
// Graceful-pending rule: the accel bundle is produced by the build pipeline
// (espack embed of native/build/ESARRArray.dll). Until the first bundle
// exists, --check reports PENDING (exit 0, warning) so `npm test` stays
// green during development; once the artifact exists it is enforced STRICT.
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

var ROOT = dirname(fileURLToPath(import.meta.url));
var DIST = join(ROOT, 'dist', 'ESARR.accel.jsx');
var VENDOR_DIR = join(ROOT, '..', 'agent-skills', 'illustrator-com-automation-skill', 'vendor');
var VENDOR = join(VENDOR_DIR, 'ESARR.accel.jsx');

var args = process.argv.slice(2);
var mode = args.indexOf('--check') >= 0 ? 'check' : 'sync';
var quiet = args.indexOf('--quiet') >= 0;

function say(s) {
  if (!quiet) { console.log(s); }
}

if (!existsSync(DIST)) {
  say('[esarr-vendor-sync] PENDING: dist/ESARR.accel.jsx not built yet (no accel bundle) — ' +
    (mode === 'check' ? 'nothing to verify' : 'nothing to sync'));
  process.exit(0);
}
if (!existsSync(VENDOR_DIR)) {
  say('[esarr-vendor-sync] ERROR: vendor dir missing: ' + VENDOR_DIR);
  process.exit(1);
}

var distBytes = readFileSync(DIST);
var vendorBytes = existsSync(VENDOR) ? readFileSync(VENDOR) : null;

if (mode === 'sync') {
  writeFileSync(VENDOR, distBytes);
  say('[esarr-vendor-sync] synced ' + distBytes.length + ' bytes -> ' + VENDOR);
  process.exit(0);
}

// --check
if (vendorBytes === null) {
  console.error('[esarr-vendor-sync] FAIL: vendor/ESARR.accel.jsx is missing while dist has a bundle — run node esarr-vendor-sync.mjs');
  process.exit(1);
}
if (distBytes.length !== vendorBytes.length || !distBytes.equals(vendorBytes)) {
  console.error('[esarr-vendor-sync] FAIL: vendor/ESARR.accel.jsx (' + vendorBytes.length + ' bytes) diverges from ' +
    'dist/ESARR.accel.jsx (' + distBytes.length + ' bytes) — run node esarr-vendor-sync.mjs');
  process.exit(1);
}
say('[esarr-vendor-sync] ok: vendor/ESARR.accel.jsx matches dist byte-for-byte (' + distBytes.length + ' bytes)');
process.exit(0);
