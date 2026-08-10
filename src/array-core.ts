// ESARR core — ES5 Array methods, spec-exact, tuned to the measured behavior
// of the Adobe ExtendScript engine (SpiderMonkey ES3, Illustrator 30.6.0 /
// ExtendScript 4.5.6).
//
// Engine facts the implementation is built around (all measured live, see
// README "Benchmarks" / tests/benchmark.mjs):
//   - Loop control costs ~0.07 us/iter; array READS with a variable index cost
//     ~7.5e-4 us x (distinct indices accessed so far) — a superlinear trap on
//     long traversals. There is no dodge (|0/>>>0 coercion, string keys,
//     for-in, for-each-in all measured equal or worse), so each method does
//     exactly ONE read per element and nothing else in the hot loop.
//   - The `k in O` sparse guard shares the read's resolution cost: `in`+read
//     measured identical to read alone. The guard is therefore free insurance
//     for spec-exact hole handling (HasProperty semantics, including
//     inherited index properties).
//   - `hasOwnProperty` is ~8x slower than `in` — never used here.
//   - Function.prototype.call aliased to a local and invoked bare CRASHES
//     ("Function.call() cannot work with instances of this class") — always
//     call the method directly.
//   - A direct callback invocation is measurably cheaper than
//     `callback.call(thisArg, ...)` (~0.5 us/element). ES5.1 says: when
//     thisArg is absent, `this` is undefined, and a non-strict engine binds
//     the global object — EXACTLY what a plain call does. ExtendScript has no
//     strict mode, so the no-thisArg lane uses plain calls (spec-exact here,
//     and in Node for both strict and sloppy callbacks — the differential
//     oracle verifies this). The thisArg-present lane keeps `.call`.
//   - for-each-in costs ~7.6 us/element and has unspecified order — never used.
//   - Result arrays: `new Array(len)` + index writes beats push by ~20-40%
//     (map); push for unknown-length results (filter).
//   - `Array.isArray`: __class__ check is the fast path in ExtendScript, but
//     HOST objects throw on `__class__` access ("No such element", uncatchable),
//     so the check is exception-guarded with an Object.prototype.toString
//     fallback that never throws (also keeps the identical bundle correct in
//     Node, where __class__ does not exist).
//   - ExtendScript reports name: "Error" for every error type — instanceof is
//     the only reliable discriminator (consumers' concern, not ours).
//
// All methods are pure functions taking the array-like first (facade style):
//   ESARR.forEach(array, callback, thisArg)
// install() attaches prototype wrappers that forward `this` (see index.ts).

export function isArray(arg: any): boolean {
  if (arg === null || typeof arg !== 'object') {
    return false;
  }
  // `__class__` is the fast ExtendScript check, but host objects (e.g.
  // Illustrator collections, DOM items) THROW on it ("No such element");
  // fall back to the toString tag, which never throws. Array.isArray must
  // never throw on any input.
  try {
    if (arg.__class__ === 'Array') {
      return true;
    }
  } catch (e) {
    // fall through to the toString check
  }
  return Object.prototype.toString.call(arg) === '[object Array]';
}

export function forEach(array: any, callback: any, thisArg?: any): void {
  if (array === void 0 || array === null) { throw new TypeError('Array.prototype.forEach called on null or undefined'); }
  if (typeof callback !== 'function') { throw new TypeError(callback + ' is not a function'); }
  var O = Object(array);
  var len = O.length >>> 0;
  var T = thisArg;
  var k = 0;
  if (T === void 0) {
    for (k = 0; k < len; k++) {
      if (k in O) {
        callback(O[k], k, O);
      }
    }
  } else {
    for (k = 0; k < len; k++) {
      if (k in O) {
        callback.call(T, O[k], k, O);
      }
    }
  }
}

export function map(array: any, callback: any, thisArg?: any): any[] {
  if (array === void 0 || array === null) { throw new TypeError('Array.prototype.map called on null or undefined'); }
  if (typeof callback !== 'function') { throw new TypeError(callback + ' is not a function'); }
  var O = Object(array);
  var len = O.length >>> 0;
  var T = thisArg;
  var A = new Array(len);
  var k = 0;
  if (T === void 0) {
    for (k = 0; k < len; k++) {
      if (k in O) {
        A[k] = callback(O[k], k, O);
      }
    }
  } else {
    for (k = 0; k < len; k++) {
      if (k in O) {
        A[k] = callback.call(T, O[k], k, O);
      }
    }
  }
  return A;
}

export function filter(array: any, callback: any, thisArg?: any): any[] {
  if (array === void 0 || array === null) { throw new TypeError('Array.prototype.filter called on null or undefined'); }
  if (typeof callback !== 'function') { throw new TypeError(callback + ' is not a function'); }
  var O = Object(array);
  var len = O.length >>> 0;
  var T = thisArg;
  var A: any[] = [];
  var v: any;
  var k = 0;
  if (T === void 0) {
    for (k = 0; k < len; k++) {
      if (k in O) {
        v = O[k];
        if (callback(v, k, O)) {
          A.push(v);
        }
      }
    }
  } else {
    for (k = 0; k < len; k++) {
      if (k in O) {
        v = O[k];
        if (callback.call(T, v, k, O)) {
          A.push(v);
        }
      }
    }
  }
  return A;
}

export function every(array: any, callback: any, thisArg?: any): boolean {
  if (array === void 0 || array === null) { throw new TypeError('Array.prototype.every called on null or undefined'); }
  if (typeof callback !== 'function') { throw new TypeError(callback + ' is not a function'); }
  var O = Object(array);
  var len = O.length >>> 0;
  var T = thisArg;
  var k = 0;
  if (T === void 0) {
    for (k = 0; k < len; k++) {
      if (k in O) {
        if (!callback(O[k], k, O)) {
          return false;
        }
      }
    }
  } else {
    for (k = 0; k < len; k++) {
      if (k in O) {
        if (!callback.call(T, O[k], k, O)) {
          return false;
        }
      }
    }
  }
  return true;
}

export function some(array: any, callback: any, thisArg?: any): boolean {
  if (array === void 0 || array === null) { throw new TypeError('Array.prototype.some called on null or undefined'); }
  if (typeof callback !== 'function') { throw new TypeError(callback + ' is not a function'); }
  var O = Object(array);
  var len = O.length >>> 0;
  var T = thisArg;
  var k = 0;
  if (T === void 0) {
    for (k = 0; k < len; k++) {
      if (k in O) {
        if (callback(O[k], k, O)) {
          return true;
        }
      }
    }
  } else {
    for (k = 0; k < len; k++) {
      if (k in O) {
        if (callback.call(T, O[k], k, O)) {
          return true;
        }
      }
    }
  }
  return false;
}

export function indexOf(array: any, searchElement: any, fromIndex?: any): number {
  if (array === void 0 || array === null) { throw new TypeError('Array.prototype.indexOf called on null or undefined'); }
  var o = Object(array);
  var len = o.length >>> 0;
  if (len === 0) {
    return -1;
  }
  // ToInteger(fromIndex): NaN/undefined/0 -> +0 (the common case — skip the
  // truncation Math calls entirely); +/-Infinity preserved (spec step 5:
  // +Inf -> -1 via n >= len).
  var n = +fromIndex || 0;
  if (n !== 0) {
    n = n < 0 ? Math.ceil(n) : Math.floor(n);
  }
  if (n >= len) {
    return -1;
  }
  var k = n < 0 ? Math.max(len + n, 0) : n;
  for (; k < len; k++) {
    if (k in o && o[k] === searchElement) {
      // ES5.1-exact: k is returned as computed (ToInteger(-0.5) is -0, so a
      // hit at index 0 returns -0 — Node normalizes to +0; D3 carve-out per
      // design doc §4.5, verifier trap-pinned).
      return k;
    }
  }
  return -1;
}

export function lastIndexOf(array: any, searchElement: any, fromIndex?: any): number {
  if (array === void 0 || array === null) { throw new TypeError('Array.prototype.lastIndexOf called on null or undefined'); }
  var o = Object(array);
  var len = o.length >>> 0;
  if (len === 0) {
    return -1;
  }
  var n: number;
  if (arguments.length > 2) {
    // fromIndex present (spec: an explicit `undefined` means +0 here, not
    // len-1 — the prototype wrapper preserves this by call arity).
    n = +fromIndex || 0;
    if (n !== 0) {
      n = n < 0 ? Math.ceil(n) : Math.floor(n);
    }
  } else {
    // fromIndex not present -> start at the end (spec 15.4.4.15 step 5).
    n = len - 1;
  }
  var k = n >= 0 ? Math.min(n, len - 1) : len + n;
  if (k < 0) {
    return -1;
  }
  for (; k >= 0; k--) {
    if (k in o && o[k] === searchElement) {
      // ES5.1-exact: -0 index returned as computed (D3 carve-out, see
      // indexOf); search comparison is strict === (-0 never matches +0).
      return k;
    }
  }
  return -1;
}

export function reduce(array: any, callback: any, initialValue?: any): any {
  if (array === void 0 || array === null) { throw new TypeError('Array.prototype.reduce called on null or undefined'); }
  if (typeof callback !== 'function') { throw new TypeError(callback + ' is not a function'); }
  var O = Object(array);
  var len = O.length >>> 0;
  var k = 0;
  var value: any;
  if (arguments.length > 2) {
    // initialValue present — including an explicit `undefined` (the wrapper
    // preserves this by call arity; spec 15.4.4.21).
    value = initialValue;
  } else {
    while (k < len && !(k in O)) {
      k++;
    }
    if (k >= len) {
      throw new TypeError('Reduce of empty array with no initial value');
    }
    value = O[k++];
  }
  // reduce has no thisArg per spec; `this` is undefined in the callback, so
  // plain calls are spec-exact (and faster than `.call`).
  for (; k < len; k++) {
    if (k in O) {
      value = callback(value, O[k], k, O);
    }
  }
  return value;
}

export function reduceRight(array: any, callback: any, initialValue?: any): any {
  if (array === void 0 || array === null) { throw new TypeError('Array.prototype.reduceRight called on null or undefined'); }
  if (typeof callback !== 'function') { throw new TypeError(callback + ' is not a function'); }
  var O = Object(array);
  var len = O.length >>> 0;
  var k = len - 1;
  var value: any;
  if (arguments.length > 2) {
    value = initialValue;
  } else {
    while (k >= 0 && !(k in O)) {
      k--;
    }
    if (k < 0) {
      throw new TypeError('Reduce of empty array with no initial value');
    }
    value = O[k--];
  }
  for (; k >= 0; k--) {
    if (k in O) {
      value = callback(value, O[k], k, O);
    }
  }
  return value;
}
