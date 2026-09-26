// ESARR runtime ExtendScript entry — side-effect-only, methods-only facade for
// per-eval injection (install/capabilities/benchmark/gate API are pruned
// here). Mirrors src/jsx-entry.ts: named imports only (never `import * as`),
// explicit facade object, assigned to $.global['ESARR']. The ESTC configs use
// a dummy globalName (`__ESARR_RUNTIME_ENTRY__`) so no module-helper is ever
// emitted.
import {
  at, concat, copyWithin, entries, every, fill, filter, find, findIndex,
  findLast, findLastIndex, flat, flatMap, forEach, from, indexOf, includes,
  isArray, join, keys, lastIndexOf, map, of, pop, push, reduce, reduceRight,
  reverse, shift, slice, some, sort, splice, toReversed, toSorted, toString,
  unshift, values, withMethod
} from './index';

function makeRuntimeFacade(): any {
  return {
    forEach: forEach,
    map: map,
    filter: filter,
    every: every,
    some: some,
    reduce: reduce,
    reduceRight: reduceRight,
    isArray: isArray,
    indexOf: indexOf,
    lastIndexOf: lastIndexOf,
    includes: includes,
    join: join,
    reverse: reverse,
    sort: sort,
    toReversed: toReversed,
    toSorted: toSorted,
    concat: concat,
    pop: pop,
    push: push,
    shift: shift,
    slice: slice,
    splice: splice,
    toString: toString,
    unshift: unshift,
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
    'with': withMethod
  };
}

var __esarrRuntimeGlobal: any = null;
try { if (typeof $ !== 'undefined' && $.global) { __esarrRuntimeGlobal = $.global; } } catch (e) { /* ignore */ }
if (!__esarrRuntimeGlobal) {
  try { __esarrRuntimeGlobal = (Function as any)('return this')(); } catch (e2) { /* ignore */ }
}
if (__esarrRuntimeGlobal) {
  __esarrRuntimeGlobal['ESARR'] = makeRuntimeFacade();
}
