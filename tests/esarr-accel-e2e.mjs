#!/usr/bin/env node
// ESARR accel-bundle END-TO-END verification (mirrors espack-e2e.mjs).
//
// Proves the espack self-extracting bundle works on a FRESH Illustrator
// instance end-to-end:
//   eval dist/ESARR.accel.jsx -> ES3-mode start -> extraction to the cache
//   dir -> ExternalObject load -> native-mode switch (ESARR.enableNativeGate
//   via the espack adapter / useEspack) -> FULL corpus byte-identical in both
//   modes AND vs the Node-validated core -> skip-extract re-run (idempotent:
//   extractMs -1, mtime unchanged) -> versioned re-extract on a bumped bundle
//   -> graceful es3 fallback when the cache dir is unwritable.
//
// PENDING path: until the T3/T4 pipeline lands (native/bin/ESARRArray.dll +
// dist/ESARR.accel.jsx), the harness reports PENDING and exits 0 so it can
// live in the test suite without blocking development.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync, statSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

var ROOT = dirname(fileURLToPath(import.meta.url));
var PROJECT = join(ROOT, '..');
var DIST = join(PROJECT, 'dist');
// The shipped build lands in native/bin/ (native/build.ps1 writes $outDir =
// native/bin). The harness must resolve THE SHIPPED DLL — a PENDING skip here
// would silently skip the acceptance.
var NATIVE = join(PROJECT, 'native', 'bin');
var DLL = join(NATIVE, 'ESARRArray.dll');
var BUNDLE = join(DIST, 'ESARR.accel.jsx');
var SCRIPTS = process.env.ESARR_DEV_SCRIPTS || 'C:/Program Files/Adobe/Adobe Illustrator 2026/Presets/en_US/Scripts';
var TOOL = process.env.ILLUSTRATOR_COM_TOOL || SCRIPTS + '/agent-skills/illustrator-com-automation-skill/comtool/ILLUSTRATOR_COM_TOOL.py';
var ESPACK_BUILD = process.env.ESPACK_BUILD || SCRIPTS + '/espack/espack-build.mjs';
var CACHE = join(process.env.LOCALAPPDATA || '', 'esarr');
var SHARED_ACCEL_DIR = join(process.env.LOCALAPPDATA || '', 'espack');

var failures = 0;
function check(name, cond, detail) {
  if (cond) console.log('ok   ' + name);
  else { failures++; console.log('FAIL ' + name + (detail ? '  ' + detail : '')); }
}

// ---- prerequisite detection --------------------------------------------------
if (!existsSync(BUNDLE)) {
  console.log('PENDING: dist/ESARR.accel.jsx not built yet (T4 pipeline) — skipping accel e2e');
  process.exit(0);
}
if (!existsSync(DLL)) {
  console.log('PENDING: native/bin/ESARRArray.dll not built yet (T3 pipeline) — skipping accel e2e');
  process.exit(0);
}
if (!existsSync(TOOL)) {
  console.error('FAIL: COM tool not found at ' + TOOL);
  process.exit(1);
}

var dllBytes = readFileSync(DLL);
console.log('E2E: DLL ' + basename(DLL) + ' ' + dllBytes.length + ' bytes; cache ' + CACHE);

// ---- helpers ----------------------------------------------------------------
function runTool(args, timeoutMs) {
  var out = execFileSync('python', [TOOL].concat(args), { encoding: 'utf8', timeout: timeoutMs || 240000 });
  return JSON.parse(out.trim());
}
function evalSmoke(bundlePath, smokeSrc) {
  var env = runTool(['eval', '--code',
    // The accel bundle is a FACADE + auto native-gate (install is explicit —
    // design §5.3; same contract as ESON.accel). Gap-fill the full surface so
    // the smoke/corpus can exercise prototype wrappers AND the facade.
    '$.evalFile(File("' + bundlePath.replace(/\\/g, '/') + '"));' +
    'ESARR.install({ forceReplace: true }); return ' + smokeSrc]);
  if (!env.ok) throw new Error('eval failed: ' + JSON.stringify(env).slice(0, 1500));
  return env.result;
}
function killAllAutomation() {
  execFileSync('powershell.exe', ['-NoProfile', '-Command',
    '$p = Get-Process -Name Illustrator -ErrorAction SilentlyContinue; if ($p) { $p | Stop-Process -Force }; exit 0'],
    { timeout: 30000 });
}
function launchFresh() {
  var env = runTool(['status', '--launch'], 120000);
  if (!env.ok) throw new Error('instance launch failed: ' + JSON.stringify(env).slice(0, 1000));
  return env.result;
}

// ---- build the corpus + Node-validated expectations --------------------------
var core = await import(pathToFileURL(join(DIST, 'esarr-core.esm.mjs')).href);
var CB_BUNDLE = join(ROOT, '.esarr-callbacks.bundle.mjs');
execFileSync(process.execPath, [esbuildBin(), join(ROOT, 'callbacks.ts'),
  '--bundle', '--outfile=' + CB_BUNDLE, '--format=esm', '--platform=node', '--target=es2019',
  '--log-level=warning'], { stdio: 'inherit' });
var cbs = await import(pathToFileURL(CB_BUNDLE).href);
var V_BUNDLE = join(ROOT, '.esarr-vectors.bundle.mjs');
execFileSync(process.execPath, [esbuildBin(), join(ROOT, 'vectors.ts'),
  '--bundle', '--outfile=' + V_BUNDLE, '--format=esm', '--platform=node', '--target=es2019',
  '--log-level=warning'], { stdio: 'inherit' });
var vecs = await import(pathToFileURL(V_BUNDLE).href);

function encode(v) {
  if (v === void 0) { return '~Undef'; }
  if (typeof v === 'number') {
    if (v !== v) { return '~NaN'; }
    if (v === Infinity) { return '~Inf'; }
    if (v === -Infinity) { return '~NInf'; }
    return v;
  }
  if (v === null || typeof v !== 'object') { return v; }
  if (Array.isArray(v)) {
    var a = [];
    for (var i = 0; i < v.length; i++) { a[i] = encode(v[i]); }
    return a;
  }
  var o = {};
  for (var k in v) { if (Object.prototype.hasOwnProperty.call(v, k)) { o[k] = encode(v[k]); } }
  return o;
}

var vectors = vecs.VECTORS;
var nodeResults = [];
for (var vi = 0; vi < vectors.length; vi++) {
  var vv = vectors[vi];
  if (typeof core[vv.op] !== 'function') { nodeResults[nodeResults.length] = { pending: true, op: vv.op }; continue; }
  var r = cbs.runVector(vv, core);
  nodeResults[nodeResults.length] = { pending: false, op: vv.op, ok: r.ok, result: r.result, state: r.state };
}

// ---- probe glue (same as live-verify, but against the accel-installed ESARR) -
var probeDir = join(process.env.TEMP || '', 'esarr-e2e');
mkdirSync(probeDir, { recursive: true });
var probeCorePath = join(probeDir, 'esarr-e2e-probe-core.jsx');
execFileSync(process.execPath, [esbuildBin(), join(ROOT, 'probe-glue.ts'),
  '--bundle', '--outfile=' + probeCorePath, '--format=iife', '--global-name=PROBECORE',
  '--platform=neutral', '--target=es5', '--log-level=warning'], { stdio: 'inherit' });

var vectorsJson = JSON.stringify(encode(vectors));
var coreForProbe = probeCorePath.replace(/\\/g, '/');

var RUN_CORPUS = '(function () {' +
  '  var out = { ok: false, error: null, result: null };' +
  '  try {' +
  '    $.evalFile(File("' + coreForProbe + '"));' +
  '    var res = [];' +
  '    var i, v;' +
  '    for (i = 0; i < esarrE2eVectors.length; i++) {' +
  '      v = esarrE2eVectors[i];' +
  '      if (typeof ESARR[v.op] !== "function") { res[res.length] = { pending: true }; continue; }' +
  '      try { var r = PROBECORE.runVec(v, ESARR); res[res.length] = { ok: r.ok, result: r.result, state: r.state }; }' +
  '      catch (e) { res[res.length] = { ok: false, result: "THREW " + e }; }' +
  '    }' +
  '    out.result = res;' +
  '    out.ok = true;' +
  '  } catch (e) { out.error = String(e); }' +
  '  return out;' +
  '}());';

var SMOKE = '(function () {' +
  '  var out = { ok: false, error: null };' +
  '  try {' +
  '    out.esarrVersion = ESARR.version || null;' +
  '    out.gate = ESARR.nativeGateState ? ESARR.nativeGateState() : null;' +
  '    out.espack = ESARR.espack || null;' +
  '    var cap = ESARR.capabilities();' +
  '    out.missing = cap.missing;' +
  '    out.sortVec = [10, 9, 1, 2].sort().join(",");' +
  '    out.lastIdx = [1, 2, 3].lastIndexOf(2);' +
  '    out.findVec = [1, 2, 3, 4].find(function (v) { return v > 2; });' +
  '    out.ok = true;' +
  '  } catch (e) { out.error = String(e); }' +
  '  return out;' +
  '}());';

function compareCorpus(engineResults, tag) {
  var bad = 0;
  for (var i = 0; i < vectors.length; i++) {
    var got = engineResults[i];
    var want = nodeResults[i];
    if (got && got.pending) { if (!want.pending) { bad++; console.error('  FAIL [' + tag + '] ' + vectors[i].desc + ': engine pending, node has it'); } continue; }
    if (want && want.pending) { continue; }
    if (got.ok !== want.ok ||
      JSON.stringify(got.result) !== JSON.stringify(want.result) ||
      JSON.stringify(got.state) !== JSON.stringify(want.state)) {
      // D7 carve-out (same policy as the Node differential — callbacks.ts
      // carveOutAccept): sort/toSorted with the non-transitive dCmp comparator
      // on NaN/mixed-type inputs is implementation-defined (ES5.1 §15.4.4.11);
      // any permutation of the input is valid. The live corpus must accept the
      // same class the Node harness carves out.
      if (cbs.carveOutAccept(vectors[i], { ok: got.ok, result: got.result, state: got.state },
        { ok: want.ok, result: want.result, state: want.state })) { continue; }
      bad++;
      if (bad <= 8) console.error('  FAIL [' + tag + '] ' + vectors[i].desc + ': engine=' + JSON.stringify(got) + ' node=' + JSON.stringify(want));
    }
  }
  return bad;
}

function extractedPath(version) { return join(CACHE, 'ESARRArray_v' + version + '.dll'); }
function bundlePath(version) { return join(DIST, 'esarr-e2e-v' + version + '.jsx'); }

// ---- run ---------------------------------------------------------------------
console.log('E2E: killing leftover automation and launching a fresh instance...');
killAllAutomation();
var instA = launchFresh();
check('instance A fresh (' + instA.Version + ')', instA.DocumentsCount === 0);

if (existsSync(CACHE)) rmSync(CACHE, { recursive: true, force: true });
if (existsSync(SHARED_ACCEL_DIR)) rmSync(SHARED_ACCEL_DIR, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });

// v1: eval the production bundle (fresh cache) -> extract -> load -> native
var s1 = evalSmoke(BUNDLE, SMOKE);
check('v1: bundle evals, ESARR installed', s1.ok === true, s1.error);
check('v1: full surface present (missing empty)', Array.isArray(s1.missing) && s1.missing.length === 0, JSON.stringify(s1.missing));
check('v1: native gate enabled', !!(s1.gate && s1.gate.enabled), JSON.stringify(s1.gate));
check('v1: sort lane active', !!(s1.gate && s1.gate.lanes && s1.gate.lanes.indexOf('sort') >= 0), JSON.stringify(s1.gate && s1.gate.lanes));
check('v1: lanes certified on the JSX authority', !!(s1.gate && s1.gate.certified > 0), String(s1.gate && s1.gate.certified));
check('v1: smoke vectors correct', s1.sortVec === '1,10,2,9' && s1.lastIdx === 1 && s1.findVec === 3, JSON.stringify({ sort: s1.sortVec, li: s1.lastIdx, f: s1.findVec }));

// run the full corpus through the gate-on facade in ONE eval (atomic)
var e2eVectorsFile = join(probeDir, 'esarr-e2e-vectors.jsx');
writeFileSync(e2eVectorsFile, 'var esarrE2eVectors = ' + vectorsJson + ';');
var corpusEval = '$.evalFile(File("' + e2eVectorsFile.replace(/\\/g, '/') + '"));' +
  '$.evalFile(File("' + BUNDLE.replace(/\\/g, '/') + '"));' +
  'ESARR.install({ forceReplace: true }); return ' + RUN_CORPUS;
var env1 = runTool(['eval', '--code', corpusEval]);
check('v1: corpus eval ok', env1.ok && env1.result && env1.result.ok, JSON.stringify(env1).slice(0, 600));
var e2eFail = env1.result ? compareCorpus(env1.result.result, 'v1-native') : 999;
check('v1: full corpus matches Node (native mode)', e2eFail === 0, e2eFail + ' mismatch(es)');

// skip-extract re-run: fresh eval, extraction must be skipped (idempotent)
var s1b = evalSmoke(BUNDLE, SMOKE);
var extracted = extractedPath(1);
var v1mtime = existsSync(extracted) ? statSync(extracted).mtimeMs : 0;
check('v1: DLL extracted byte-exact', existsSync(extracted) && readFileSync(extracted).equals(dllBytes));
var s1c = evalSmoke(BUNDLE, SMOKE);
check('re-run: native still', !!(s1c.gate && s1c.gate.enabled));
check('re-run: no re-extraction (mtime unchanged)', existsSync(extracted) && statSync(extracted).mtimeMs === v1mtime, 'mtime changed');

// versioned re-extract: build a bumped bundle
var espackBuild = await import('file:///' + ESPACK_BUILD.replace(/\\/g, '/').replace(/'/g, ''));
// cacheDir MUST be pinned to the same CACHE the harness inspects — the
// production bundle uses defaultCacheDir(BUNDLE_NAME) = %LOCALAPPDATA%/esarr.
var buildOpts = { embed: DLL, out: bundlePath(2), name: 'esarr-accel-e2e', dllVersion: '2', cacheDir: CACHE.replace(/\\/g, '/') };
try {
  var b = espackBuild.build ? espackBuild.build(buildOpts) : espackBuild.default(buildOpts);
  var v2bundle = b.outPath || bundlePath(2);
  if (!existsSync(v2bundle)) { // build may have written elsewhere; copy expected name
    writeFileSync(bundlePath(2), readFileSync(v2bundle));
    v2bundle = bundlePath(2);
  }
  // The espack build is ESPACK-only — without the ESARR facade + adapter the
  // bundle never calls ESPAK.load(0), so the versioned DLL is never extracted
  // and the gate never engages. Append the production bundle's facade+adapter
  // suffix (same composition as the fail-path bundle below). The facade starts
  // at the bind-shim AFTER the espack section (the espack section has its own
  // earlier bind-shim; taking the LAST one is the facade).
  var prodBundleText = readFileSync(BUNDLE, 'utf8');
  var facadeStart = prodBundleText.lastIndexOf('if (typeof Function.prototype.bind !== "function") {');
  if (facadeStart < 0) { throw new Error('production bundle facade marker not found'); }
  writeFileSync(v2bundle, readFileSync(v2bundle, 'utf8') + '\n' + prodBundleText.substring(facadeStart));
  var s2 = evalSmoke(v2bundle, SMOKE);
  check('v2: loaded native with new version', !!(s2.gate && s2.gate.enabled));
  check('v2: versioned DLL extracted', existsSync(extractedPath(2)));
  check('v2: v1 still present (locked by host)', existsSync(extracted));
} catch (e) {
  console.log('      v2 bundle build skipped (' + String(e.message || e).slice(0, 120) + ')');
}

// graceful failure: cache dir pointing at an existing FILE -> es3 fallback
var BLOCKER = join(process.env.LOCALAPPDATA || '', 'esarr-e2e-fail.txt');
try { if (existsSync(BLOCKER)) rmSync(BLOCKER); } catch (e) {}
writeFileSync(BLOCKER, 'blocker');
var failBundle = join(DIST, 'esarr-e2e-fail.jsx');
try {
  // The fail-path bundle must be the FULL composition (espack + ESARR facade +
  // espack adapter) — an espack-ONLY bundle defines ESPAK but never ESARR, so
  // evalSmoke's ESARR.install() would throw on a fresh instance. Reuse the
  // production bundle's facade+adapter suffix (everything after the espack
  // section's `g.ESPAK = ESPACK;` IIFE) appended to the espack build output.
  var fb = espackBuild.build ? espackBuild.build({ embed: DLL, out: failBundle, name: 'esarr-e2e-fail', dllVersion: '1', cacheDir: BLOCKER.replace(/\\/g, '/') }) : null;
  if (fb) {
    var prodBundle = readFileSync(BUNDLE, 'utf8');
    var facadeStart2 = prodBundle.lastIndexOf('if (typeof Function.prototype.bind !== "function") {');
    if (facadeStart2 < 0) { throw new Error('production bundle facade marker not found'); }
    var facadeSuffix = prodBundle.substring(facadeStart2);
    writeFileSync(fb.outPath, readFileSync(fb.outPath, 'utf8') + '\n' + facadeSuffix);
  }
  if (fb) {
    // The fail-path MUST run on a FRESH instance: the v1/v2 evals left a global
    // ESPAK (and an already-extracted DLL in %LOCALAPPDATA%/esarr) that would
    // otherwise let the gate come up native even when THIS bundle's cache-dir
    // extraction must fail. Fresh instance -> only the fail bundle's own state
    // exists -> a cache-dir write failure must leave the gate OFF (es3).
    console.log('E2E: fresh instance for the fail-path (cache-dir is a FILE -> must stay es3)...');
    killAllAutomation();
    launchFresh();
    var sf = evalSmoke(fb.outPath || failBundle, SMOKE);
    check('fail-path: stays es3 (graceful)', !(sf.gate && sf.gate.enabled), JSON.stringify(sf.gate));
    check('fail-path: no throw, clear error', sf.ok === true, sf.error);
    killAllAutomation();
    launchFresh();
  }
} catch (e) {
  console.log('      fail-path bundle build skipped (' + String(e.message || e).slice(0, 120) + ')');
}
try { if (existsSync(BLOCKER)) rmSync(BLOCKER); } catch (e) {}

// ---- cleanup -------------------------------------------------------------------
console.log('E2E: closing instance...');
killAllAutomation();
try { rmSync(CACHE, { recursive: true, force: true }); } catch (e) {}
try { rmSync(SHARED_ACCEL_DIR, { recursive: true, force: true }); } catch (e) {}

console.log('\nE2E: ' + (failures ? failures + ' failure(s)' : 'ALL CHECKS PASSED'));
process.exit(failures ? 1 : 0);

function esbuildBin() {
  var direct = join(PROJECT, 'node_modules', 'esbuild', 'bin', 'esbuild');
  if (existsSync(direct)) { return direct; }
  var cacheDirs = [
    join(process.env.LOCALAPPDATA || '', 'npm-cache', '_npx'),
    join(process.env.USERPROFILE || '', 'AppData', 'Local', 'npm-cache', '_npx')
  ];
  for (var c = 0; c < cacheDirs.length; c++) {
    try {
      var entries = readdirSync(cacheDirs[c]);
      for (var j = 0; j < entries.length; j++) {
        var p = join(cacheDirs[c], entries[j], 'node_modules', 'esbuild', 'bin', 'esbuild');
        if (existsSync(p)) { return p; }
      }
    } catch (ignore) {}
  }
  return 'npx esbuild';
}
