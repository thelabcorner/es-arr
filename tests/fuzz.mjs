#!/usr/bin/env node
// ESARR seeded differential fuzz runner (Node natives are the oracle).
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

var ROOT = dirname(fileURLToPath(import.meta.url));
var PROJECT = join(ROOT, '..');
var ENTRY = join(ROOT, 'fuzz-entry.ts');
var BUNDLE = join(ROOT, '.esarr-fuzz.bundle.mjs');
var SEED = process.env.ESARR_FUZZ_SEED ? Number(process.env.ESARR_FUZZ_SEED) : 1337;
var ITERS = process.env.ESARR_FUZZ_ITERS ? Number(process.env.ESARR_FUZZ_ITERS) : 100000;

function findEsbuild() {
  if (process.env.ESBUILD_PATH && existsSync(process.env.ESBUILD_PATH)) return process.env.ESBUILD_PATH;
  var direct = join(PROJECT, 'node_modules', 'esbuild', 'bin', 'esbuild');
  if (existsSync(direct)) return direct;
  var cacheDirs = [
    join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx'),
    join(process.env.USERPROFILE || '', 'AppData', 'Local', 'npm-cache', '_npx')
  ];
  for (var i = 0; i < cacheDirs.length; i++) {
    try {
      var entries = readdirSync(cacheDirs[i]);
      for (var j = 0; j < entries.length; j++) {
        var p = join(cacheDirs[i], entries[j], 'node_modules', 'esbuild', 'bin', 'esbuild');
        if (existsSync(p)) return p;
      }
    } catch (ignore) {}
  }
  return 'npx esbuild';
}

execFileSync(process.execPath, [findEsbuild(),
  ENTRY, '--bundle', '--outfile=' + BUNDLE,
  '--format=esm', '--platform=node', '--target=es2019',
  '--log-level=warning'
], { stdio: 'inherit' });

try {
  var mod = await import(pathToFileURL(BUNDLE).href);
  var res = mod.fuzz(SEED, ITERS);
  var failures = res.failures;
  var carveOuts = res.carveOuts || 0;
  if (failures > 0) {
    console.error('ESARR fuzz: ' + failures + ' divergence(s) at seed ' + SEED);
    process.exit(1);
  }
  console.log('ESARR fuzz: ' + ITERS + ' differential iterations passed (seed ' + SEED + ', ' + carveOuts + ' D7 carve-outs)');
} finally {
  try { rmSync(BUNDLE); } catch (ignore) {}
}
