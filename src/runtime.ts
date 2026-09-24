// Runtime-only ESARR entry: the full method surface only (install/
// capabilities/benchmark are pruned by the bundler's tree-shaking). Used for
// per-eval injection: a smaller vendor instead of the full one. The
// native-backed methods ship as the dispatched versions (gate-aware; pure
// JSX when the gate is off).
export { every, filter, forEach, isArray, map, reduce, reduceRight, some } from './array-core';
export { indexOf, lastIndexOf, includes, join, reverse, sort } from './native-dispatch';
export { concat, pop, push, shift, slice, splice, toString, unshift } from './array-es3';
export { at, copyWithin, entries, fill, find, findIndex, findLast, findLastIndex,
  flat, flatMap, from, keys, of, toReversed, toSorted, values,
  withMethod } from './array-es6';
