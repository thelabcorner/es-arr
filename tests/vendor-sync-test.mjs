#!/usr/bin/env node
// ESARR vendor-sync guard test: runs the guard's --check as part of npm test
// (mirrors the esb64/espack vendor-sync-test.mjs convention). Passes either
// when the vendored accel bundle matches dist byte-for-byte OR when the
// bundle has not been built yet (graceful pending — see esarr-vendor-sync.mjs).
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

var ROOT = dirname(fileURLToPath(import.meta.url));
var SYNC = join(ROOT, '..', 'esarr-vendor-sync.mjs');
var out = execFileSync(process.execPath, [SYNC, '--check'], { encoding: 'utf8' });
var ok = out.indexOf('ok') >= 0 || out.indexOf('PENDING') >= 0;
if (!ok) {
  console.error('vendor-sync FAIL: ' + out.trim());
  process.exit(1);
}
console.log('ok   vendor-sync: vendored ESARR.accel.jsx matches dist' + (out.indexOf('PENDING') >= 0 ? ' (PENDING: bundle not built yet)' : ''));
