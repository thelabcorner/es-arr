// Live-probe glue: bundled together with callbacks.ts into a single IIFE
// (global PROBECORE) that the generated engine probe evalFiles. All ES3-safe.
import { runVector } from './callbacks';

// JSON transport markers (vectors contain NaN/Infinity/undefined, which JSON
// cannot carry; the Node side encodes them, the probe revives them here).
export function revive(v: any): any {
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

export function runVec(vec: any, core: any): any {
  return runVector(revive(vec), core);
}
