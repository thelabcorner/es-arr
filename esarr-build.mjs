#!/usr/bin/env node
// ESARR build — ESTC is the canonical ExtendScript emission path.
//
//   dist/ESARR.jsx                - bannerless IIFE (COM-eval / $.evalFile safe),
//                                   defines var ESARR (the facade). ESTC build:
//                                   src/index.ts -> ES3-normalized bundle with
//                                   bundle-local esbuild helpers (no host-global
//                                   mutation, no Function.prototype.bind shim).
//   dist/vendor-esarr.js          - production drop-in: facade + installer footer
//                                   (tooling/estc-vendor-footer.js) that gap-fills
//                                   the FULL Array surface (ES3 set + ES5 set +
//                                   ES6+ set + statics) when absent (true polyfill)
//   dist/vendor-esarr-runtime.js  - slim methods-only vendor (per-eval injection),
//                                   same gap-fill footer
//   dist/ESARR-runtime.jsx        - build intermediate (bare bundle, no footer -
//                                   not standalone-loadable)
//   dist/esarr-core.esm.mjs       - ESM bundle of the core for Node harnesses
//   dist/ESARR.accel.jsx          - (--accel) self-extracting single-file bundle:
//                                   espack (ESARRArray.dll payload + the CURRENT
//                                   ESTC-built esb64 runtime + shared ESB64Native
//                                   accelerator) + ESARR facade + espack adapter
//                                   (auto native-gate enable)
//   dist/ESARR.accel.min.jsx      - (--accel) minified via the
//                                   adobe-extendscript-minification skill
//                                   (conservative config, banner preserved)
//   dist/ESARR.manifest.json      - (--accel) espack merge-spec manifest sidecar
//   dist/ESARR.facade.jsx         - (--accel) loader-free facade for espack-merge
//                                   composers
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

var ROOT = dirname(fileURLToPath(import.meta.url));
var DIST = join(ROOT, 'dist');
// ESM entry keeps the modern `with` named export (src/esm-entry.ts); the JSX
// builds use src/index.ts, whose boundary-safe `withMethod` export plus the
// facade-alias footer produce ESARR.with without a reserved export binding.
var ESM_ENTRY = join(ROOT, 'src', 'esm-entry.ts');
var ESTC = join(ROOT, '..', 'extendscript-toolchain', 'bin', 'estc.mjs');
// Composition pins: the CURRENT ESTC-built esb64 runtime (never espack's stale
// vendored copy) and the CURRENT sibling ESB64Native accelerator DLL.
var ESB64_RUNTIME = join(ROOT, '..', 'esb64', 'dist', 'vendor-esb64-runtime.js');
var ESB64_ACCEL = join(ROOT, '..', 'esb64', 'native', 'bin', 'ESB64Native.dll');

function findEsbuild() {
  if (process.env.ESBUILD_PATH && existsSync(process.env.ESBUILD_PATH)) return process.env.ESBUILD_PATH;
  var direct = join(ROOT, 'node_modules', 'esbuild', 'bin', 'esbuild');
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

function esmBuild(entry, outfile) {
  execFileSync(process.execPath, [
    findEsbuild(), entry, '--bundle', '--outfile=' + outfile,
    '--format=esm', '--platform=node', '--target=es2019',
    '--log-level=warning'
  ], { stdio: 'inherit' });
}

function estcBuild(config) {
  execFileSync(process.execPath, [ESTC, 'build', '--config', config], {
    cwd: ROOT,
    stdio: 'inherit'
  });
}

mkdirSync(DIST, { recursive: true });

// 1. ESM core bundle (Node harnesses import this).
esmBuild(ESM_ENTRY, join(DIST, 'esarr-core.esm.mjs'));

// 2. Canonical ExtendScript facade + vendors. ESTC owns ES3 normalization and
//    keeps esbuild's helper compatibility bundle-local instead of mutating
//    host globals; the gap-fill installer footer is a checked-in source
//    (tooling/estc-vendor-footer.js) applied by the vendor builds.
estcBuild('./extendscript.estc.config.mjs');
estcBuild('./extendscript.vendor.estc.config.mjs');
estcBuild('./extendscript.runtime.estc.config.mjs');
estcBuild('./extendscript.runtime-vendor.estc.config.mjs');

// 3. Accelerated self-extracting bundle (ESARR.accel.jsx): espack "1 + n" —
//    ESARRArray.dll is the payload; the shared ESB64Native accelerator (current
//    sibling DLL) is embedded and the JSX decode lane is the CURRENT ESTC-built
//    esb64 runtime, passed explicitly so espack's stale vendored copy cannot
//    re-enter the composite. The native gate enables on the espack-provided lib.
//    Requires: ../espack (espack-build.mjs) + ../esb64 (runtime + accel DLL) +
//    native/bin/ESARRArray.dll (npm run native-build). Skips silently when the
//    inputs are absent.
var ACCELERATOR = [
  '',
  '(function () {',
  '  // ESARR espack adapter: ESPAK.load() materializes ESARRArray.dll (natively,',
  '  // via the shared accelerator), then the ExternalObject lane gate enables',
  '  // on the espack-provided lib. Auto-enables on eval; ESARR.useEspack() is',
  '  // the opt-in form (idempotent). ESARR.espack holds the outcome.',
  '  if (typeof ESPAK !== "object" || !ESPAK || typeof ESPAK.load !== "function") return;',
  '  if (typeof ESARR !== "object" || !ESARR || typeof ESARR.enableNativeGate !== "function") return;',
  '  var cached = null;',
  '  function useEspack() {',
  '    // Lane C (merge architecture v1): load by NAME, never load(0) - the',
  '    // merged bundle carries multiple payloads and index 0 is not ESARRArray.',
  '    var l = ESPAK.load("ESARRArray");',
  '    if (!l.ok || l.mode !== "native" || !l.lib) {',
  '      cached = { ok: false, reason: (l && l.error) || "ESPAK load failed" };',
  '      return cached;',
  '    }',
  '    var caps = ESARR.enableNativeGate({ lib: l.lib, dllPath: l.path });',
  '    cached = { ok: caps.enabled === true, caps: caps, path: l.path };',
  '    return cached;',
  '  }',
  '  ESARR.useEspack = useEspack;',
  '  ESARR.espack = useEspack();',
  '  var g = null;',
  '  try { if (typeof $ !== "undefined" && $.global) { g = $.global; } } catch (e1) {}',
  '  if (g) {',
  '    g.ESARR = ESARR;',
  '    g.ESPAK = ESPAK;',
  '  }',
  '}());',
  ''
].join('\n');

function buildAccel() {
  var espackBuild = join(ROOT, '..', 'espack', 'espack-build.mjs');
  var dll = join(ROOT, 'native', 'bin', 'ESARRArray.dll');
  if (!existsSync(espackBuild)) {
    console.log('[esarr-build] accel skipped: espack repo not found at ' + join(ROOT, '..', 'espack'));
    return;
  }
  if (!existsSync(dll)) {
    console.log('[esarr-build] accel skipped: ' + dll + ' missing (run npm run native-build)');
    return;
  }
  if (!existsSync(ESB64_RUNTIME)) {
    console.log('[esarr-build] accel skipped: ESTC-built esb64 runtime not found at ' + ESB64_RUNTIME +
      ' (build ../esb64 first; stale espack vendor runtime must not be used)');
    return;
  }
  if (!existsSync(ESB64_ACCEL)) {
    console.log('[esarr-build] accel skipped: ESB64Native accelerator not found at ' + ESB64_ACCEL +
      ' (build ../esb64 native first)');
    return;
  }
  var accelBundle = join(DIST, '.esarr-accel-bundle.jsx');
  var manifestOut = join(DIST, 'ESARR.manifest.json');
  execFileSync(process.execPath, [espackBuild, '--embed', dll, '--out', accelBundle,
    '--name', 'esarr', '--manifest-out', manifestOut,
    '--accel', ESB64_ACCEL, '--accel-version', '2', '--quiet'], {
    stdio: 'inherit',
    env: Object.assign({}, process.env, {
      ESB64_RUNTIME_PATH: ESB64_RUNTIME
    })
  });
  var bundleText = readFileSync(accelBundle, 'utf8');
  var facadeText = readFileSync(join(DIST, 'ESARR.jsx'), 'utf8');
  // Lane C (merge architecture v1): the manifest sidecar (pinned schema
  // contract/manifest-schema-v1) + the loader-free facade artifact for the
  // composer. The standalone .accel.jsx below is unchanged in composition
  // (bundle + facade + adapter).
  var facadeOut = facadeText + '\n' + ACCELERATOR +
    '// ESARR.facade.jsx - loader-free facade + espack adapter (composer appends to a merged bundle; requires ESPAK on $.global)\n';
  writeFileSync(join(DIST, 'ESARR.facade.jsx'), facadeOut);
  var accelOut = bundleText + '\n' + facadeText + '\n' + ACCELERATOR +
    '// ESARR.accel.jsx - self-extracting single-file bundle (espack 1+n + ESARR + native gate)\n';
  writeFileSync(join(DIST, 'ESARR.accel.jsx'), accelOut);
  // Vendor copy for the COM tool (its session bootstrap can eval this bundle
  // so the tool's session gets the accelerated facade).
  var skillVendor = join(ROOT, '..', 'agent-skills', 'illustrator-com-automation-skill', 'vendor');
  if (existsSync(skillVendor)) {
    writeFileSync(join(skillVendor, 'ESARR.accel.jsx'), accelOut);
    console.log('[esarr-build] vendored ESARR.accel.jsx -> ' + join(skillVendor, 'ESARR.accel.jsx'));
  }
  console.log('[esarr-build] wrote ' + join(DIST, 'ESARR.accel.jsx') + ' (' + accelOut.length + ' bytes)');
  minifyAccel(accelOut, skillVendor);
}

// Minify the accelerated bundle via the adobe-extendscript-minification
// skill's conservative pipeline (UglifyJS + switch repair + directive
// restore + node --check). The espack banner (leading block comment) is
// extracted BEFORE minification and restored after - the conservative
// config strips comments, and the banner identifies the generated artifact.
function minifyAccel(accelOut, skillVendor) {
  var skillDir = join(ROOT, '..', 'agent-skills', 'adobe-extendscript-minification');
  var minifyScript = join(skillDir, 'scripts', 'minify-jsx.py');
  var minifyConfig = join(skillDir, 'configs', 'conservative.json');
  if (!existsSync(minifyScript) || !existsSync(minifyConfig)) {
    console.log('[esarr-build] accel minify skipped: minification skill not found at ' + skillDir);
    return;
  }
  var m = accelOut.match(/^\/\*[\s\S]*?\*\//);
  var banner = m ? m[0] : '';
  var body = m ? accelOut.substring(m[0].length) : accelOut;
  var bodyPath = join(DIST, '.esarr-accel-bundle.body.jsx');
  var minPath = join(DIST, '.esarr-accel-bundle.min.jsx');
  writeFileSync(bodyPath, body, 'utf8');
  execFileSync('python', [minifyScript, '--in', bodyPath, '--config', minifyConfig,
    '--out', minPath], { stdio: 'inherit' });
  var minBody = readFileSync(minPath, 'utf8');
  var minOut = (banner ? banner + '\n' : '') + minBody;
  var minFinal = join(DIST, 'ESARR.accel.min.jsx');
  writeFileSync(minFinal, minOut, 'utf8');
  if (skillVendor && existsSync(skillVendor)) {
    writeFileSync(join(skillVendor, 'ESARR.accel.min.jsx'), minOut);
    console.log('[esarr-build] vendored ESARR.accel.min.jsx -> ' + join(skillVendor, 'ESARR.accel.min.jsx'));
  }
  console.log('[esarr-build] wrote ' + minFinal + ' (' + minOut.length + ' bytes, banner preserved)');
}

if (process.argv.includes('--accel')) {
  buildAccel();
}

console.log('[esarr-build] wrote ' + join(DIST, 'ESARR.jsx') + ', ' + join(DIST, 'vendor-esarr.js') + ', ' +
  join(DIST, 'vendor-esarr-runtime.js') + ', ' + join(DIST, 'ESARR-runtime.jsx') + ' and ' + join(DIST, 'esarr-core.esm.mjs'));
