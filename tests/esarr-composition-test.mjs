#!/usr/bin/env node
// ESPACK v2 release-artifact contract: the root bundle owns its dependency
// closure and every library artifact is byte-provenanced by its manifest.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

var ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
var DIST = join(ROOT, 'dist');
var manifest = JSON.parse(readFileSync(join(DIST, 'ESARR.manifest.json'), 'utf8'));
var root = readFileSync(join(DIST, 'ESARR.accel.jsx'), 'utf8');
var pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
var libs = manifest.libraries;

assert.equal(manifest.version, 2, 'composition manifest schema is v2');
assert.deepEqual(libs.map(function (lib) { return lib.id; }), ['esb64', 'esarr'],
  'dependency closure is ordered dependency-first');
assert.equal(libs[0].version, '1.3.0', 'ESB64 dependency is pinned to the released line');
assert.equal(libs[1].version, pkg.version, 'ESARR identity uses the package version');
assert.deepEqual(libs[1].requires, [{ id: 'esb64', range: '^1.3.0', optional: false }]);

for (var i = 0; i < libs.length; i++) {
  var lib = libs[i];
  var bytes = Buffer.from(lib.artifact.b64, 'base64');
  assert.equal(bytes.length, lib.artifact.len, lib.id + ' UTF-8 byte length matches provenance');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), lib.artifact.sha256,
    lib.id + ' artifact SHA-256 matches provenance');
  assert.equal(Buffer.from(bytes.toString('utf8'), 'utf8').compare(bytes), 0,
    lib.id + ' artifact is canonical UTF-8');
  assert.ok(lib.activation.global && lib.activation.type && lib.activation.contract.length,
    lib.id + ' declares an activation contract');
  assert.ok(root.includes(bytes.toString('utf8')),
    lib.id + ' source is embedded in the root accelerator artifact');
}

assert.equal(manifest.accel.name, 'ESB64Native', 'shared ESB64 accelerator is explicit');
assert.ok(manifest.payloads.some(function (payload) { return payload.name === 'ESARRArray'; }),
  'ESARRArray payload is owned by the composition');
assert.ok(manifest.capabilities.some(function (cap) {
  return cap.id === 'esarr.native' && cap.provider === 'esarr' &&
    cap.payloads.indexOf('ESARRArray') >= 0;
}), 'ESARR native capability is explicit');
assert.ok(root.includes('owned: false'), 'ESARR borrows the ESPACK-owned native object');
assert.ok(!root.includes('ESPAK.load(0)'), 'payload access does not depend on unstable index ordering');
assert.ok(!root.includes('ESPACK library esb64') || root.indexOf('ESPACK library esb64') < root.indexOf('ESPACK library esarr'),
  'root source activation is dependency-first');

console.log('ESARR ESPACK v2 composition: schema, closure, provenance, activation, and root-only embedding passed');
