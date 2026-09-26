#!/usr/bin/env node
// ESARR vendor-sync guard — downstream COM-tool copies are explicit integration
// outputs, never ordinary build side effects.
//
//   node esarr-vendor-sync.mjs
//   node esarr-vendor-sync.mjs --check
//   node esarr-vendor-sync.mjs --check --quiet
//
// Once any accelerated dist artifact exists, both the full and minified copies
// are required and enforced byte-for-byte.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

var ROOT = dirname(fileURLToPath(import.meta.url));
var VENDOR_DIR = join(ROOT, '..', 'agent-skills', 'illustrator-com-automation-skill', 'vendor');
var PAIRS = [
  ['ESARR.accel.jsx', join(ROOT, 'dist', 'ESARR.accel.jsx'), join(VENDOR_DIR, 'ESARR.accel.jsx')],
  ['ESARR.accel.min.jsx', join(ROOT, 'dist', 'ESARR.accel.min.jsx'), join(VENDOR_DIR, 'ESARR.accel.min.jsx')]
];

var args = process.argv.slice(2);
var mode = args.indexOf('--check') >= 0 ? 'check' : 'sync';
var quiet = args.indexOf('--quiet') >= 0;

function say(s) {
  if (!quiet) console.log(s);
}

var present = 0;
for (var i = 0; i < PAIRS.length; i++) {
  if (existsSync(PAIRS[i][1])) present++;
}

if (present === 0) {
  say('[esarr-vendor-sync] PENDING: dist/ESARR.accel*.jsx not built yet — ' +
    (mode === 'check' ? 'nothing to verify' : 'nothing to sync'));
  process.exit(0);
}
if (present !== PAIRS.length) {
  console.error('[esarr-vendor-sync] FAIL: partial accel artifact set; rebuild with npm run build:accel before integration');
  process.exit(1);
}
if (!existsSync(VENDOR_DIR)) {
  console.error('[esarr-vendor-sync] FAIL: vendor dir missing: ' + VENDOR_DIR);
  process.exit(1);
}

for (var j = 0; j < PAIRS.length; j++) {
  var label = PAIRS[j][0];
  var dist = PAIRS[j][1];
  var vendor = PAIRS[j][2];
  var distBytes = readFileSync(dist);

  if (mode === 'sync') {
    writeFileSync(vendor, distBytes);
    say('[esarr-vendor-sync] synced ' + label + ' (' + distBytes.length + ' bytes)');
    continue;
  }

  if (!existsSync(vendor)) {
    console.error('[esarr-vendor-sync] FAIL: vendor/' + label + ' is missing — run node esarr-vendor-sync.mjs');
    process.exit(1);
  }

  var vendorBytes = readFileSync(vendor);
  if (distBytes.length !== vendorBytes.length || !distBytes.equals(vendorBytes)) {
    console.error('[esarr-vendor-sync] FAIL: vendor/' + label + ' (' + vendorBytes.length +
      ' bytes) diverges from dist/' + label + ' (' + distBytes.length +
      ' bytes) — run node esarr-vendor-sync.mjs');
    process.exit(1);
  }

  say('[esarr-vendor-sync] ok: vendor/' + label + ' matches dist byte-for-byte (' + distBytes.length + ' bytes)');
}
