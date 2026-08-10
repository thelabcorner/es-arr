#!/usr/bin/env node
// ESARR build: bundles the TypeScript core into
//   dist/ESARR.jsx                - bannerless IIFE (COM-eval / $.evalFile safe),
//                                   defines var ESARR (the facade)
//   dist/vendor-esarr.js          - production drop-in: facade + install footer
//                                   that gap-fills the FULL Array surface
//                                   (ES3 set + ES5 set + ES6+ set + statics)
//                                   when absent (true polyfill)
//   dist/vendor-esarr-runtime.js  - slim methods-only vendor (per-eval
//                                   injection), same gap-fill footer
//   dist/ESARR-runtime.jsx        - build intermediate (bare bundle, no shim,
//                                   no footer - not standalone-loadable)
//   dist/esarr-core.esm.mjs       - ESM bundle of the core for Node harnesses
//   dist/ESARR.accel.jsx          - (--accel) self-extracting single-file
//                                   bundle: espack (ESARRArray.dll payload +
//                                   shared esb64 accelerator) + ESARR facade +
//                                   espack adapter (auto native-gate enable)
//   dist/ESARR.accel.min.jsx      - (--accel) minified via the
//                                   adobe-extendscript-minification skill
//                                   (conservative config, banner preserved)
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

var ROOT = dirname(fileURLToPath(import.meta.url));
var DIST = join(ROOT, 'dist');
var ENTRY = join(ROOT, 'src', 'index.ts');

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

function jsxBuild(entry, outfile) {
  execFileSync(process.execPath, [
    findEsbuild(), entry, '--bundle', '--outfile=' + outfile,
    '--format=iife', '--global-name=ESARR', '--platform=neutral', '--target=es5',
    '--log-level=warning'
  ], { stdio: 'inherit' });
}

mkdirSync(DIST, { recursive: true });

// 1. ESM core bundle (Node harnesses import this).
esmBuild(ENTRY, join(DIST, 'esarr-core.esm.mjs'));

// 2. JSX bundle with the ES3 shim prepended. ExtendScript (SpiderMonkey 2014)
//    lacks nothing esbuild's ES5 export helpers need here EXCEPT
//    Function.prototype.bind on some hosts (probed present on 4.5.6); the
//    shim below keeps the bundle loadable everywhere.
var jsx = join(DIST, 'ESARR.jsx');
jsxBuild(ENTRY, jsx);

var shim = [
  'if (typeof Function.prototype.bind !== "function") {',
  '  Function.prototype.bind = function (thisArg) {',
  '    var fn = this;',
  '    var args = Array.prototype.slice.call(arguments, 1);',
  '    return function () {',
  '      return fn.apply(thisArg, args.concat(Array.prototype.slice.call(arguments)));',
  '    };',
  '  };',
  '}',
  ''
].join('\n');

// ES3-ification pass on the bundled IIFE: esbuild emits the export map with
// unquoted keys (`with: function() {...}`), which is legal ES5 but an
// ILLEGAL reserved-word object key in ExtendScript's ES3 parser — the bundle
// would fail at eval ("SyntaxError: Illegal use of reserved word 'with'").
// Quote the reserved-word export keys. The pure function is named
// `withMethod`, so the only `with: function` occurrence is the export map.
function es3ify(bundleText) {
  return bundleText.replace(/\n(\s*)with: function/g, '\n$1"with": function');
}

var finalJsx = shim + readFileSync(jsx, 'utf8');
finalJsx = finalJsx.replace(/"use strict";?/g, '');
finalJsx = es3ify(finalJsx);
writeFileSync(jsx, finalJsx);

// 3. Generated full-surface gap-fill footer. Method table: [name, arity]:
//    'plain'    -> wrapper forwards (a, b, c)
//    'omit2'    -> 2nd argument omitted when absent (call-arity semantics:
//                  reduce/reduceRight initialValue, lastIndexOf fromIndex)
//    'variadic' -> wrapper forwards [this, ...arguments] via apply
//    All property names use bracket notation ('with' is a reserved word in
//    ES3 source). The ES3 native set (slice..toString) is skipped by the
//    typeof guard when the host provides it (forceReplace overrides via
//    ESARR.install). The ESARR facade is always available as the global
//    `ESARR`.
var METHODS = [
  ['slice', 'plain'], ['concat', 'variadic'], ['join', 'plain'], ['push', 'variadic'],
  ['pop', 'plain'], ['shift', 'plain'], ['unshift', 'variadic'], ['splice', 'variadic'],
  ['sort', 'plain'], ['reverse', 'plain'], ['toString', 'plain'],
  ['forEach', 'plain'], ['map', 'plain'], ['filter', 'plain'], ['every', 'plain'], ['some', 'plain'],
  ['indexOf', 'plain'], ['lastIndexOf', 'omit2'], ['reduce', 'omit2'], ['reduceRight', 'omit2'],
  ['find', 'plain'], ['findIndex', 'plain'], ['includes', 'plain'], ['at', 'plain'],
  ['copyWithin', 'plain'], ['fill', 'plain'], ['flat', 'plain'], ['flatMap', 'plain'],
  ['keys', 'plain'], ['values', 'plain'], ['entries', 'plain'], ['toSorted', 'plain'],
  ['toReversed', 'plain'], ['with', 'plain'], ['findLast', 'plain'], ['findLastIndex', 'plain']
];
var STATICS = ['isArray', 'from', 'of'];

function footerMethodLines(name, arity) {
  var q = JSON.stringify(name);
  if (arity === 'omit2') {
    return [
      '  if (typeof p[' + q + '] !== "function") {',
      '    p[' + q + '] = function (a, b) {',
      '      if (arguments.length > 1) { return ESARR[' + q + '](this, a, b); }',
      '      return ESARR[' + q + '](this, a);',
      '    };',
      '  }'
    ];
  }
  if (arity === 'variadic') {
    return [
      '  if (typeof p[' + q + '] !== "function") {',
      '    p[' + q + '] = function () {',
      '      var a = [this];',
      '      var i = 0;',
      '      for (i = 0; i < arguments.length; i++) { a[a.length] = arguments[i]; }',
      '      return ESARR[' + q + '].apply(null, a);',
      '    };',
      '  }'
    ];
  }
  return [
    '  if (typeof p[' + q + '] !== "function") {',
    '    p[' + q + '] = function (a, b, c) { return ESARR[' + q + '](this, a, b, c); };',
    '  }'
  ];
}

function buildFooter() {
  var lines = [
    '(function () {',
    '  var g = null;',
    '  try { if (typeof $ !== "undefined" && $.global) { g = $.global; } } catch (e1) {}',
    '  if (!g) { try { g = (function () { return this; })(); } catch (e2) {} }',
    '  if (!g || !g.Array || !g.Array.prototype) return;',
    '  var p = g.Array.prototype;'
  ];
  var i = 0;
  for (i = 0; i < METHODS.length; i++) {
    lines = lines.concat(footerMethodLines(METHODS[i][0], METHODS[i][1]));
  }
  lines = lines.concat([
    '  if (typeof g.Array.isArray !== "function") { g.Array.isArray = ESARR.isArray; }',
    '  if (typeof g.Array.from !== "function") {',
    '    g.Array.from = function (items, mf, ta) { return ESARR.from(items, mf, ta, this); };',
    '  }',
    '  if (typeof g.Array.of !== "function") { g.Array.of = ESARR.of; }',
    '})();',
    ''
  ]);
  return lines.join('\n');
}

var footer = buildFooter();

var vendor = finalJsx + '\n' + footer;
writeFileSync(join(DIST, 'vendor-esarr.js'), vendor);

// 4. Runtime-only vendor: tree-shaken methods core for per-eval injection.
var runtimeJsx = join(DIST, 'ESARR-runtime.jsx');
jsxBuild(join(ROOT, 'src', 'runtime.ts'), runtimeJsx);
var runtimeFinal = shim + readFileSync(runtimeJsx, 'utf8');
runtimeFinal = runtimeFinal.replace(/"use strict";?/g, '');
runtimeFinal = es3ify(runtimeFinal);
var runtimeVendor = runtimeFinal + '\n' + footer;
writeFileSync(join(DIST, 'vendor-esarr-runtime.js'), runtimeVendor);

// 5. Accelerated self-extracting bundle (ESARR.accel.jsx): espack "1 + n" —
//    ESARRArray.dll is the payload, the shared esb64 accelerator is embedded
//    automatically; the native gate enables on the espack-provided lib.
//    Requires: ../espack (espack-build.mjs) + native/bin/ESARRArray.dll
//    (npm run native-build). Skips silently when the inputs are absent.
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
  '    var l = ESPAK.load(0);',
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
  var accelBundle = join(DIST, '.esarr-accel-bundle.jsx');
  execFileSync(process.execPath, [espackBuild, '--embed', dll, '--out', accelBundle,
    '--name', 'esarr', '--quiet'], { stdio: 'inherit' });
  var bundleText = readFileSync(accelBundle, 'utf8');
  var facadeText = readFileSync(join(DIST, 'ESARR.jsx'), 'utf8');
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
  join(DIST, 'vendor-esarr-runtime.js') + ' and ' + join(DIST, 'esarr-core.esm.mjs'));
