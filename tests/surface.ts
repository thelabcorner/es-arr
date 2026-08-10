// ESARR FULL-SURFACE manifest — the canonical method contract shared by every
// verification harness (Node differential, seeded fuzz, live engine parity,
// mode-switch differential, accel-bundle e2e).
//
// The ESARR polyfill targets the ENTIRE Array surface the ES3 ExtendScript
// engine is missing or gets wrong: the ES3 built-ins (present natively in
// ExtendScript but re-implemented spec-exact), the ES5 additions (the current
// ten), and the ES6+ additions (ES2015/2016/2019 + the ES2023 immutables).
// Each harness auto-detects which methods have LANDED in the core (typeof
// core[op] === 'function') and validates exactly those — so this manifest
// stays stable while the implementation lands method-by-method, and the
// coverage report shows what is still pending.
//
// toLocaleString is deliberately excluded: locale-dependent, not part of the
// spec-exact polyfill contract (documented in verification-report.md).
//
// ASSUMPTION: surface mirrors the standard full Array method set; if the
// native-acceleration design doc (docs/native-acceleration-design.md)
// excludes or adds methods, update ALL_METHODS here — the harnesses pick the
// change up automatically.

export var ES3_METHODS: string[] = [
  'concat', 'join', 'pop', 'push', 'reverse', 'shift', 'slice', 'sort',
  'splice', 'unshift', 'toString'
];

export var ES5_METHODS: string[] = [
  'every', 'filter', 'forEach', 'indexOf', 'isArray', 'lastIndexOf', 'map',
  'reduce', 'reduceRight', 'some'
];

export var ES6PLUS_METHODS: string[] = [
  'at', 'copyWithin', 'entries', 'fill', 'find', 'findIndex', 'findLast',
  'findLastIndex', 'flat', 'flatMap', 'from', 'includes', 'keys', 'of',
  'toReversed', 'toSorted', 'values', 'with'
];

export var ALL_METHODS: string[] =
  ES3_METHODS.concat(ES5_METHODS).concat(ES6PLUS_METHODS);

export var METHOD_SET: any = {};
(function (): void {
  var i = 0;
  for (i = 0; i < ES3_METHODS.length; i++) { METHOD_SET[ES3_METHODS[i]] = 'es3'; }
  for (i = 0; i < ES5_METHODS.length; i++) { METHOD_SET[ES5_METHODS[i]] = 'es5'; }
  for (i = 0; i < ES6PLUS_METHODS.length; i++) { METHOD_SET[ES6PLUS_METHODS[i]] = 'es6plus'; }
})();

/**
 * Which of the surface methods have actually landed in `core` (the ESM bundle
 * in Node, the ESARR facade in the engine). Shared by every harness so the
 * landed set is computed identically on both sides.
 */
export function landedOps(core: any): string[] {
  var out: string[] = [];
  var i = 0;
  for (i = 0; i < ALL_METHODS.length; i++) {
    if (core && typeof core[ALL_METHODS[i]] === 'function') {
      out[out.length] = ALL_METHODS[i];
    }
  }
  return out;
}

export function coreHas(op: string, core: any): boolean {
  return !!(core && typeof core[op] === 'function');
}
