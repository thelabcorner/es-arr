// ESARR ExtendScript entry — side-effect-only. This boundary must NOT export
// any binding: exporting makes esbuild synthesize the module namespace helpers
// (__export/__defProp/__toCommonJS) that require Object.defineProperty /
// getOwnPropertyDescriptor, which legacy Adobe ExtendScript engines do not
// provide. Instead we import the public surface by NAME (never `import * as`,
// which reintroduces the same helpers) and assemble the facade object
// explicitly, then assign it to $.global['ESARR'].
//
// All public members are re-exported by src/index.ts, so we named-import from
// there; the flattened bundle carries the implementations with zero module
// helpers. The ESTC config uses a dummy globalName (`__ESARR_ENTRY__`) and the
// facade-alias + vendor-installer footers resolve the unqualified `ESARR`
// global through $.global.
import {
  at, benchmark, bands, capabilities, concat, copyWithin, disableNativeGate,
  enableNativeGate, entries, every, fill, filter, find, findIndex, findLast,
  findLastIndex, flat, flatMap, forEach, from, indexOf, includes, install,
  isArray, join, keys, lastIndexOf, map, nativeGateState, of, pack, packRun,
  pipe, pop, push, reduce, reduceRight, reverse, scanPacked, setBands, shift,
  slice, some, sort, splice, toReversed, toSorted, toString, unshift, unpack,
  unpackInto, values, withMethod
} from './index';

function makeFacade(): any {
  return {
    // ES5 callback set + isArray (pure JSX).
    forEach: forEach,
    map: map,
    filter: filter,
    every: every,
    some: some,
    reduce: reduce,
    reduceRight: reduceRight,
    isArray: isArray,
    // Native-gated scalar lanes.
    indexOf: indexOf,
    lastIndexOf: lastIndexOf,
    includes: includes,
    join: join,
    reverse: reverse,
    sort: sort,
    toReversed: toReversed,
    toSorted: toSorted,
    // Pack-once native pipeline API.
    pack: pack,
    unpack: unpack,
    unpackInto: unpackInto,
    packRun: packRun,
    scanPacked: scanPacked,
    pipe: pipe,
    // ES3 read/engine set.
    concat: concat,
    pop: pop,
    push: push,
    shift: shift,
    slice: slice,
    splice: splice,
    toString: toString,
    unshift: unshift,
    // ES6+ pure set.
    at: at,
    copyWithin: copyWithin,
    entries: entries,
    fill: fill,
    find: find,
    findIndex: findIndex,
    findLast: findLast,
    findLastIndex: findLastIndex,
    flat: flat,
    flatMap: flatMap,
    from: from,
    keys: keys,
    of: of,
    values: values,
    // `with` is an ES3 reserved word; attach by bracket key, never as a binding.
    'with': withMethod,
    // Orchestration / gate / benchmark surface.
    capabilities: capabilities,
    install: install,
    enableNativeGate: enableNativeGate,
    disableNativeGate: disableNativeGate,
    nativeGateState: nativeGateState,
    bands: bands,
    setBands: setBands,
    benchmark: benchmark
  };
}

// Side-effect install: publish the facade on the global object so COM-eval /
// $.evalFile consumers resolve `ESARR` unqualified.
var __esarrGlobal: any = null;
try { if (typeof $ !== 'undefined' && $.global) { __esarrGlobal = $.global; } } catch (e) { /* ignore */ }
if (!__esarrGlobal) {
  try { __esarrGlobal = (Function as any)('return this')(); } catch (e2) { /* ignore */ }
}
if (__esarrGlobal) {
  __esarrGlobal['ESARR'] = makeFacade();
}
