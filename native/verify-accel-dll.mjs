#!/usr/bin/env node
// verify-accel-dll.mjs — native-c release verification: proves the DLL
// embedded in the ESARR.accel.jsx bundle is the CANONICAL ESARRArray.dll
// (sha d62dbdd7...) and that the standalone DLL asset is byte-identical.
//
// The espack "1+n" bundle inlines each payload as base64 in a PAYLOADS
// literal: { name: 'ESARRArray', version: '1', len: N, b64: '...' }.
// We extract, decode, re-hash, and compare. No Illustrator needed.
//
// Usage: node native/verify-accel-dll.mjs [bundle.jsx]
//   default bundle: dist/ESARR.accel.jsx; DLL default: native/bin/ESARRArray.dll
//   exit 0 = canonical; exit 1 = mismatch (prints details).

import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..');

const CANONICAL_SHA = 'D62DBDD75EC15239DE9166D3868BB3F5C75FE326C43D939D3EF2E2D1693E7CCC';
const CANONICAL_LEN = 11264;

const bundlePath = process.argv[2] || join(ROOT, 'dist', 'ESARR.accel.jsx');
const dllPath = join(ROOT, 'native', 'bin', 'ESARRArray.dll');

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex').toUpperCase();
}

let fails = 0;

// ---- 1. standalone DLL asset ----
if (!existsSync(dllPath)) {
  console.error('FAIL: DLL asset missing: ' + dllPath);
  process.exit(1);
}
const dllBytes = readFileSync(dllPath);
const dllSha = sha256(dllBytes);
const dllOk = dllSha === CANONICAL_SHA && dllBytes.length === CANONICAL_LEN;
console.log(`DLL asset    ${dllPath}`);
console.log(`  len ${dllBytes.length} (canonical ${CANONICAL_LEN})  sha ${dllSha}`);
console.log(`  canonical d62dbdd7: ${dllOk ? 'YES' : 'NO'}`);
if (!dllOk) fails++;

// ---- 2. embedded payload inside the accel bundle ----
if (!existsSync(bundlePath)) {
  console.error('FAIL: bundle missing: ' + bundlePath);
  process.exit(1);
}
const text = readFileSync(bundlePath, 'utf8');

// find the ESARRArray payload literal in the PAYLOADS array
// (unminified: { name: 'ESARRArray', version: '1', len: N, b64: '...' }
//  minified:   {"name":"ESARRArray","version":"1","len":11264,"b64":"..."})
const m = text.match(/\{\s*["']?name["']?\s*:\s*['"]ESARRArray['"][\s\S]*?\}/);
if (!m) {
  console.error('FAIL: ESARRArray payload literal not found in bundle');
  process.exit(1);
}
const lit = m[0];
const lenM = lit.match(/["']?len["']?\s*:\s*(\d+)/);
const b64M = lit.match(/["']?b64["']?\s*:\s*['"]([^'"]+)['"]/);
if (!lenM || !b64M) {
  console.error('FAIL: payload literal malformed: ' + lit.slice(0, 160));
  process.exit(1);
}
const embLen = Number(lenM[1]);
const embB64 = b64M[1];
const embBytes = Buffer.from(embB64, 'base64');
const embSha = sha256(embBytes);
const embOk = embSha === CANONICAL_SHA && embLen === CANONICAL_LEN && embBytes.length === embLen;
console.log(`Embedded DLL (in ${bundlePath})`);
console.log(`  len ${embLen} (canonical ${CANONICAL_LEN})  sha ${embSha}`);
console.log(`  canonical d62dbdd7: ${embOk ? 'YES' : 'NO'}`);
if (!embOk) fails++;

// ---- 3. embedded === standalone (byte identity) ----
const same = dllSha === embSha;
console.log(`embedded === asset: ${same ? 'YES' : 'NO (mismatch!)'}`);
if (!same) fails++;

console.log(fails === 0
  ? 'VERIFY-ACCEL-DLL: PASS (canonical d62dbdd7 embedded + asset identical)'
  : `VERIFY-ACCEL-DLL: FAIL (${fails} check(s))`);
process.exit(fails === 0 ? 0 : 1);
