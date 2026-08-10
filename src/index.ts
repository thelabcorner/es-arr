// ESARR facade — the FULL Array surface for ExtendScript (ES3):
//
//   ES3 native set  slice concat join push pop shift unshift splice sort
//                   reverse toString        (override with forceReplace)
//   ES5 set         forEach map filter every some indexOf lastIndexOf
//                   reduce reduceRight isArray
//   ES6+ set        find findIndex includes at copyWithin fill flat flatMap
//                   from of keys values entries toSorted toReversed with
//                   findLast findLastIndex
//
// Pure-function API (array first) so the identical bundle runs in Node:
//   ESARR.forEach(array, callback, thisArg)
//   ESARR.sort(array, comparefn)
//   ESARR.concat(array, item1, item2, ...)
//   ... etc (43 methods + capabilities()/install()/benchmark()/gate API)
//
// Native gate (mirrors ESON): ESARR.enableNativeGate({lib, dllPath}) wires
// the hot scalar lanes (sort reverse join indexOf lastIndexOf includes) to
// the ESARRArray ExternalObject DLL when available; every call falls back to
// the pure-JSX path on any mismatch (see native-lane.ts). The callback
// methods (forEach/map/filter/every/some/reduce/reduceRight/find/findIndex/
// findLast/findLastIndex/flatMap/from) and the read-bound lanes (concat/
// slice/at) are ALWAYS JSX.
import {
  BenchItem, CapabilityReport, EsarrNativeCaps, InstallOptions, NativeGateOptions
} from './types';
import * as core from './array-core';
import * as es3 from './array-es3';
import * as es6 from './array-es6';
import * as disp from './native-dispatch';
import {
  enableNativeGateState, disableNativeGateState, nativeGateSnapshot,
  nativeBands, setNativeBands
} from './native-lane';

// ---- export surface (functions only — no exported var bindings; see the
// esbuild var-export getter quirk in the README) ----

// ES5 set: callback methods + isArray are pure (no native lane).
export { every, filter, forEach, isArray, map, reduce, reduceRight, some } from './array-core';
// Native-backed methods (dispatched through the gate).
export { indexOf, lastIndexOf, includes } from './native-dispatch';
export { join, reverse, sort } from './native-dispatch';
export { toReversed, toSorted } from './native-dispatch';
// Pack-once public API (round-2/3 — the measured pack-once win; spec §5.2):
// pack/unpack amortize the JSX wire across repeated native ops on ONE dense
// int32 array; packRun/scanPacked run DLL ops directly on packed channels;
// pipe auto-routes multi-op pipelines (native [6k,48k], engine otherwise).
export { pack, unpack, unpackInto, packRun, scanPacked, pipe } from './native-dispatch';
// ES3 set: concat/slice are read-bound (engine-native wins) — pure exports.
export { concat, pop, push, shift, slice, splice, toString, unshift } from './array-es3';
// ES6+ set (all pure JSX).
export { at, copyWithin, entries, fill, find, findIndex, findLast, findLastIndex,
  flat, flatMap, from, keys, of, values,
  withMethod as with } from './array-es6';

function globalObject(): any {
  if (typeof $ !== 'undefined' && $.global) {
    try { return $.global; } catch (e) { /* ignore */ }
  }
  try {
    return Function('return this')();
  } catch (e2) {
    return null;
  }
}

// Full census order: ES3 natives first (present in ExtendScript), then the
// ES5 set, then the ES6+ set. install() gap-fills whatever is missing and
// forceReplaces everything when asked.
var PROTOTYPE_NAMES: string[] = [
  'slice', 'concat', 'join', 'push', 'pop', 'shift', 'unshift', 'splice',
  'sort', 'reverse', 'toString',
  'forEach', 'map', 'filter', 'every', 'some', 'indexOf', 'lastIndexOf',
  'reduce', 'reduceRight',
  'find', 'findIndex', 'includes', 'at', 'copyWithin', 'fill', 'flat',
  'flatMap', 'keys', 'values', 'entries', 'toSorted', 'toReversed', 'with',
  'findLast', 'findLastIndex'
];

var STATIC_NAMES: string[] = ['isArray', 'from', 'of'];

// Prototype wrappers forward `this` into the pure functions. Absent vs
// `undefined` arguments are distinguished by CALL ARITY only where the spec
// demands it (reduce/reduceRight initialValue, lastIndexOf fromIndex — the
// wrappers omit the argument); every other optional argument is
// value-checked (slice end, copyWithin/fill end, flat depth, sort comparefn,
// splice deleteCount are all `=== void 0` tests inside the pure functions,
// exactly as ES5.1/ES6+ dictate).
function makePrototypeWrapper(name: string, fn: any): any {
  if (name === 'reduce' || name === 'reduceRight') {
    return function (this: any, callback: any, initialValue: any): any {
      if (arguments.length > 1) {
        return fn(this, callback, initialValue);
      }
      return fn(this, callback);
    };
  }
  if (name === 'lastIndexOf') {
    return function (this: any, searchElement: any, fromIndex: any): any {
      if (arguments.length > 1) {
        return fn(this, searchElement, fromIndex);
      }
      return fn(this, searchElement);
    };
  }
  if (name === 'concat' || name === 'push' || name === 'unshift' || name === 'splice') {
    return function (this: any): any {
      var args: any[] = [this];
      var i = 0;
      for (i = 0; i < arguments.length; i++) {
        args[args.length] = arguments[i];
      }
      return fn.apply(null, args);
    };
  }
  return function (this: any, a: any, b: any, c: any): any {
    return fn(this, a, b, c);
  };
}

export function capabilities(scope?: any): CapabilityReport {
  var g = scope || globalObject();
  var nativeList: string[] = [];
  var missing: string[] = [];
  var i = 0;
  var proto: any = g && g.Array && g.Array.prototype ? g.Array.prototype : null;
  for (i = 0; i < PROTOTYPE_NAMES.length; i++) {
    if (proto && typeof proto[PROTOTYPE_NAMES[i]] === 'function') {
      nativeList[nativeList.length] = PROTOTYPE_NAMES[i];
    } else {
      missing[missing.length] = PROTOTYPE_NAMES[i];
    }
  }
  for (i = 0; i < STATIC_NAMES.length; i++) {
    if (g && g.Array && typeof g.Array[STATIC_NAMES[i]] === 'function') {
      nativeList[nativeList.length] = STATIC_NAMES[i];
    } else {
      missing[missing.length] = STATIC_NAMES[i];
    }
  }
  var engine = '';
  try {
    if (typeof $ !== 'undefined' && $.version) { engine = String($.version); }
  } catch (e) { /* ignore */ }
  // 'native' is an ES3 RESERVED WORD — the object-literal key MUST be
  // quoted or ExtendScript fails the whole bundle parse ("SyntaxError:
  // Illegal use of reserved word 'native'", caught by VERIFY's live-verify).
  return { engine: engine, nativeList: nativeList, missing: missing, 'native': nativeGateSnapshot() };
}

export function install(options?: InstallOptions): CapabilityReport {
  var g = globalObject();
  var force = !!(options && options.forceReplace);
  var before = capabilities(g);
  var i = 0;
  if (g && g.Array && g.Array.prototype) {
    var p = g.Array.prototype;
    for (i = 0; i < PROTOTYPE_NAMES.length; i++) {
      var name = PROTOTYPE_NAMES[i];
      if (force || typeof p[name] !== 'function') {
        try {
          p[name] = makePrototypeWrapper(name, wrapperOf(name));
        } catch (e) {
          // best-effort per method
        }
      }
    }
    for (i = 0; i < STATIC_NAMES.length; i++) {
      var sname = STATIC_NAMES[i];
      if (force || typeof g.Array[sname] !== 'function') {
        try {
          g.Array[sname] = staticOf(sname);
        } catch (e) {
          // best-effort
        }
      }
    }
  }
  return before;
}

function wrapperOf(name: string): any {
  switch (name) {
    case 'forEach': return core.forEach;
    case 'map': return core.map;
    case 'filter': return core.filter;
    case 'every': return core.every;
    case 'some': return core.some;
    case 'indexOf': return disp.indexOf;
    case 'lastIndexOf': return disp.lastIndexOf;
    case 'reduce': return core.reduce;
    case 'reduceRight': return core.reduceRight;
    case 'slice': return es3.slice;
    case 'concat': return es3.concat;
    case 'join': return disp.join;
    case 'push': return es3.push;
    case 'pop': return es3.pop;
    case 'shift': return es3.shift;
    case 'unshift': return es3.unshift;
    case 'splice': return es3.splice;
    case 'sort': return disp.sort;
    case 'reverse': return disp.reverse;
    case 'toString': return es3.toString;
    case 'find': return es6.find;
    case 'findIndex': return es6.findIndex;
    case 'findLast': return es6.findLast;
    case 'findLastIndex': return es6.findLastIndex;
    case 'includes': return disp.includes;
    case 'at': return es6.at;
    case 'copyWithin': return es6.copyWithin;
    case 'fill': return es6.fill;
    case 'flat': return es6.flat;
    case 'flatMap': return es6.flatMap;
    case 'keys': return es6.keys;
    case 'values': return es6.values;
    case 'entries': return es6.entries;
    case 'toSorted': return es6.toSorted;
    case 'toReversed': return es6.toReversed;
    case 'with': return es6.withMethod;
    default: return core.forEach;
  }
}

// Static installers: Array.isArray / Array.from / Array.of. `from` forwards
// the constructor (`this`) so Array.from === plain, subclass constructors
// are honored via `new C(len)`. `of` and `isArray` are assigned directly.
function staticOf(name: string): any {
  if (name === 'isArray') {
    return core.isArray;
  }
  if (name === 'from') {
    return function (this: any, items: any, mapFn: any, thisArg: any): any {
      return es6.from(items, mapFn, thisArg, this);
    };
  }
  return es6.of; // 'of'
}

// ---- native gate (ESON pattern) ------------------------------------------

export function enableNativeGate(options?: NativeGateOptions): EsarrNativeCaps {
  return enableNativeGateState(options);
}

export function disableNativeGate(): EsarrNativeCaps {
  disableNativeGateState();
  return nativeGateSnapshot();
}

export function nativeGateState(): EsarrNativeCaps {
  return nativeGateSnapshot();
}

// Win bands (design doc §6): configurable per-lane n thresholds driven by
// the BENCH tables. The wedge cap (48k) is a hard upper bound and can never
// be raised. ESARR.bands returns the live bands; ESARR.setBands overrides.
export function bands(): any {
  return nativeBands();
}

export function setBands(bands: any): void {
  setNativeBands(bands);
}

// ---- in-module quick benchmark (hires timer when present) -----------------

function nowUs(): number {
  if (typeof $ !== 'undefined' && $.hiresTimer) {
    return $.hiresTimer;
  }
  return Date.now() * 1000;
}

function timeLane(fn: () => void, iterations: number): number[] {
  var samples: number[] = [];
  var i = 0;
  var d = 0;
  for (i = 0; i < iterations; i++) {
    // $.hiresTimer returns microseconds SINCE ITS PREVIOUS ACCESS: prime it
    // immediately before the measured op, read once afterward (the read IS
    // the duration). Reject wrap-corrupted samples (signed 32-bit counter,
    // ~35.8 min wrap).
    $.hiresTimer;
    fn();
    d = $.hiresTimer;
    if (d > 0 && d < 10000000) {
      samples[samples.length] = d;
    }
  }
  return samples;
}

function item(laneName: string, n: number, iterations: number, samples: number[]): BenchItem {
  var sorted = samples.slice(0);
  sorted.sort(function (a: number, b: number): number { return a - b; });
  var medianUs = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  return {
    lane: laneName,
    n: n,
    iterations: iterations,
    medianUs: medianUs,
    minUs: sorted.length ? sorted[0] : 0,
    p95Us: sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : 0,
    elemUs: n > 0 ? medianUs / n : 0
  };
}

export function benchmark(n?: number, iterations?: number): BenchItem[] {
  var size = n || 2000;
  var it = iterations || 5;
  var arr: number[] = [];
  var i = 0;
  for (i = 0; i < size; i++) {
    arr[arr.length] = i;
  }
  var out: BenchItem[] = [];
  out[out.length] = item('forEach', size, it, timeLane(function (): void { core.forEach(arr, function (v: number): number { return v; }); }, it));
  out[out.length] = item('map', size, it, timeLane(function (): void { core.map(arr, function (v: number): number { return v + 1; }); }, it));
  out[out.length] = item('filter', size, it, timeLane(function (): void { core.filter(arr, function (v: number): boolean { return v % 2 === 0; }); }, it));
  out[out.length] = item('find', size, it, timeLane(function (): void { es6.find(arr, function (v: number): boolean { return v === size - 1; }); }, it));
  out[out.length] = item('indexOf-hit-last', size, it, timeLane(function (): void { disp.indexOf(arr, size - 1, void 0); }, it));
  out[out.length] = item('lastIndexOf', size, it, timeLane(function (): void { disp.lastIndexOf(arr, 0, void 0); }, it));
  out[out.length] = item('reduce', size, it, timeLane(function (): void { core.reduce(arr, function (a: number, b: number): number { return a + b; }, 0); }, it));
  out[out.length] = item('includes-hit-last', size, it, timeLane(function (): void { disp.includes(arr, size - 1, void 0); }, it));
  out[out.length] = item('sort', size, it, timeLane(function (): void { disp.sort(arr.slice(0)); }, it));
  out[out.length] = item('join', size, it, timeLane(function (): void { disp.join(arr, ','); }, it));
  out[out.length] = item('slice', size, it, timeLane(function (): void { es3.slice(arr, 0, size); }, it));
  out[out.length] = item('reverse-copy', size, it, timeLane(function (): void { disp.reverse(arr.slice(0)); }, it));
  return out;
}
