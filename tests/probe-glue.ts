// Live-probe glue: bundled together with callbacks.ts into a side-effect-only
// IIFE that publishes $.global.PROBECORE for the generated engine probe.
//
// IMPORTANT: this Illustrator boundary must export NOTHING. Exporting revive /
// runVec and asking esbuild for --global-name recreates the same
// __export/__defProp module-helper family that the production ES* migration
// intentionally removed.
import { runVector } from './callbacks';

// JSON transport markers (vectors contain NaN/Infinity/undefined, which JSON
// cannot carry; the Node side encodes them, the probe revives them here).
function revive(v: any): any {
  if (typeof v === 'string') {
    if (v === '~Undef') { return undefined; }
    if (v === '~NaN') { return NaN; }
    if (v === '~Inf') { return Infinity; }
    if (v === '~NInf') { return -Infinity; }
    return v;
  }
  if (v === null || typeof v !== 'object') { return v; }
  if (v.__class__ === 'Array' || Object.prototype.toString.call(v) === '[object Array]') {
    var a: any[] = [];
    var i = 0;
    for (i = 0; i < v.length; i++) { a[i] = revive(v[i]); }
    return a;
  }
  var o: any = {};
  var k: string;
  for (k in v) {
    if (Object.prototype.hasOwnProperty.call(v, k)) { o[k] = revive(v[k]); }
  }
  return o;
}

function runVec(vec: any, core: any): any {
  return runVector(revive(vec), core);
}

var __probeCoreGlobal: any = null;
try {
  if (typeof $ !== 'undefined' && $.global) {
    __probeCoreGlobal = $.global;
  }
} catch (e1) {}
if (!__probeCoreGlobal) {
  try { __probeCoreGlobal = (Function as any)('return this')(); } catch (e2) {}
}
if (__probeCoreGlobal) {
  __probeCoreGlobal.PROBECORE = {
    revive: revive,
    runVec: runVec
  };
}
