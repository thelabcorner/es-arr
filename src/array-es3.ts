// ESARR ES3-set — the Array methods ExtendScript already provides natively
// (slice concat join push pop shift unshift splice sort reverse toString),
// as spec-exact pure functions. install() only overrides these with
// `forceReplace: true` (the default gap-fill leaves the working natives
// alone); they also serve as the JSX fallback lane for the native-
// accelerated builds (see native-lane.ts).
//
// Semantics: ES5.1 §15.4.4 (the ES3 natives are specified identically for
// the slice/concat/join/push/pop/shift/unshift/splice/sort/reverse/toString
// algorithms; sort uses §15.4.4.11 with the full hole/undefined ordering).
// Same facade style as array-core.ts: pure functions, array first:
//   ESARR.slice(array, begin, end)
//   ESARR.concat(array, item1, item2, ...)
//   ...
// Variadic methods read `arguments` directly (no rest-param materialization).
import { isArray } from './array-core';
import { es5SortCompare, mergeSortItems, SortItem } from './sort-core';

// ToInteger with the +0 fast path used by indexOf: NaN/undefined/null -> 0.
function toInteger(v: any): number {
  var n = +v;
  if (n !== n) return 0;
  if (n === 0) return 0;
  return n < 0 ? Math.ceil(n) : Math.floor(n);
}

export function slice(array: any, begin?: any, end?: any): any[] {
  if (array === void 0 || array === null) { throw new TypeError('Array.prototype.slice called on null or undefined'); }
  var O = Object(array);
  var len = O.length >>> 0;
  var rs = toInteger(begin);
  var k = rs < 0 ? Math.max(len + rs, 0) : Math.min(rs, len);
  var re: number;
  if (end === void 0) {
    re = len;
  } else {
    re = toInteger(end);
  }
  var fin = re < 0 ? Math.max(len + re, 0) : Math.min(re, len);
  // The result carries the RANGE length (modern spec: ArraySpeciesCreate(O,
  // max(final-k, 0))) — holes stay holes, and an all-hole range yields a
  // length-(fin-k) sparse array, exactly like Node (ES5.1's bare `new
  // Array()` lost the length on all-hole ranges).
  var rangeLen = fin > k ? fin - k : 0;
  var A: any[] = new Array(rangeLen);
  var n = 0;
  for (; k < fin; k++) {
    if (k in O) {
      A[n] = O[k];
    }
    n++;
  }
  return A;
}

// concat(array, item1, item2, ...): `this`-style receiver is arguments[0],
// both in the facade (ESARR.concat(arr, ...)) and the prototype wrapper
// (which forwards [this, ...args] via apply). Per ES5.1 the receiver is
// prepended to the item list and each array element spreads with hole
// skipping (n advances even for holes, so holes shrink the result).
export function concat(array: any): any[] {
  if (array === void 0 || array === null) { throw new TypeError('Array.prototype.concat called on null or undefined'); }
  var O = Object(array);
  var A: any[] = [];
  var n = 0;
  var count = arguments.length;
  var a = 0;
  for (a = 0; a < count; a++) {
    var E: any = a === 0 ? O : arguments[a];
    if (isArray(E)) {
      var elen = E.length >>> 0;
      var k = 0;
      for (k = 0; k < elen; k++) {
        if (k in E) {
          A[n] = E[k];
        }
        n++;
      }
    } else {
      A[n] = E;
      n++;
    }
  }
  // ES5.1 step 7: the result length is n — which advances past holes in the
  // sources — so an all-hole source yields a length-n sparse array exactly
  // like Node (a bare `new Array()` without this finalization lost it).
  A.length = n;
  return A;
}

export function join(array: any, separator?: any): string {
  if (array === void 0 || array === null) { throw new TypeError('Array.prototype.join called on null or undefined'); }
  var O = Object(array);
  var len = O.length >>> 0;
  var sep = separator === void 0 ? ',' : String(separator);
  if (len === 0) {
    return '';
  }
  var R = '';
  var k = 0;
  var v: any;
  // undefined/null elements join as the empty string (spec step 8); the
  // separator follows every element but the last.
  for (; k < len - 1; k++) {
    if (k in O) {
      v = O[k];
      if (v !== void 0 && v !== null) {
        R += String(v);
      }
    }
    R += sep;
  }
  if (k in O) {
    v = O[k];
    if (v !== void 0 && v !== null) {
      R += String(v);
    }
  }
  return R;
}

export function push(array: any): number {
  if (array === void 0 || array === null) { throw new TypeError('Array.prototype.push called on null or undefined'); }
  var O = Object(array);
  var n = O.length >>> 0;
  var a = 1;
  for (a = 1; a < arguments.length; a++) {
    O[n] = arguments[a];
    n++;
  }
  O.length = n;
  return n;
}

export function pop(array: any): any {
  if (array === void 0 || array === null) { throw new TypeError('Array.prototype.pop called on null or undefined'); }
  var O = Object(array);
  var n = O.length >>> 0;
  if (n === 0) {
    O.length = 0;
    return void 0;
  }
  n--;
  var v = O[n];
  delete O[n];
  O.length = n;
  return v;
}

export function shift(array: any): any {
  if (array === void 0 || array === null) { throw new TypeError('Array.prototype.shift called on null or undefined'); }
  var O = Object(array);
  var len = O.length >>> 0;
  if (len === 0) {
    O.length = 0;
    return void 0;
  }
  var first = O[0];
  var k = 1;
  for (; k < len; k++) {
    if (k in O) {
      O[k - 1] = O[k];
    } else {
      delete O[k - 1];
    }
  }
  delete O[len - 1];
  O.length = len - 1;
  return first;
}

export function unshift(array: any): number {
  if (array === void 0 || array === null) { throw new TypeError('Array.prototype.unshift called on null or undefined'); }
  var O = Object(array);
  var len = O.length >>> 0;
  var argCount = arguments.length - 1;
  if (argCount > 0) {
    var k = len;
    for (; k > 0; k--) {
      var from = k - 1;
      if (from in O) {
        O[k + argCount - 1] = O[from];
      } else {
        delete O[k + argCount - 1];
      }
    }
    var j = 0;
    for (j = 0; j < argCount; j++) {
      O[j] = arguments[j + 1];
    }
  }
  O.length = len + argCount;
  return O.length;
}

// splice(array, start, deleteCount, item1, item2, ...): items are
// arguments[3..]. deleteCount === undefined (absent OR explicit undefined)
// deletes to the end (ES5.1 "absent" == modern "undefined" here).
export function splice(array: any, start?: any, deleteCount?: any): any[] {
  if (array === void 0 || array === null) { throw new TypeError('Array.prototype.splice called on null or undefined'); }
  var O = Object(array);
  var len = O.length >>> 0;
  var rs = toInteger(start);
  var actualStart = rs < 0 ? Math.max(len + rs, 0) : Math.min(rs, len);
  var actualDeleteCount: number;
  // deleteCount is ARITY-based (ES5.1 "absent"): only a call with fewer
  // than 3 args (splice(arr, start)) deletes to the end. An EXPLICIT
  // undefined/null deleteCount is a real value -> ToInteger -> 0 (verified
  // live on Node v22: [5,-7].splice(0, undefined) -> deletes nothing;
  // [5,-7].splice(0) -> deletes to the end). The prototype wrapper forwards
  // [this, ...arguments], so arity survives.
  if (arguments.length <= 2) {
    actualDeleteCount = len - actualStart;
  } else {
    var dc = toInteger(deleteCount);
    actualDeleteCount = Math.min(Math.max(dc, 0), len - actualStart);
  }
  var A: any[] = new Array(actualDeleteCount);
  var k = 0;
  for (k = 0; k < actualDeleteCount; k++) {
    var from0 = actualStart + k;
    if (from0 in O) {
      A[k] = O[from0];
    }
  }
  // items are arguments[3..]; a call with fewer than 3 args (splice(arr,
  // start) or splice(arr, start, deleteCount)) has NO items — clamp, never
  // negative (a negative itemCount corrupted the shift loops below and set
  // O.length = -1, throwing RangeError).
  var itemCount = arguments.length > 3 ? arguments.length - 3 : 0;
  if (itemCount < actualDeleteCount) {
    for (k = actualStart; k < len - actualDeleteCount; k++) {
      var from1 = k + actualDeleteCount;
      if (from1 in O) {
        O[k + itemCount] = O[from1];
      } else {
        delete O[k + itemCount];
      }
    }
    var endLen = len - actualDeleteCount + itemCount;
    for (k = len; k > endLen; k--) {
      delete O[k - 1];
    }
  } else if (itemCount > actualDeleteCount) {
    for (k = len - actualDeleteCount; k > actualStart; k--) {
      var from2 = k + actualDeleteCount - 1;
      if (from2 in O) {
        O[k + itemCount - 1] = O[from2];
      } else {
        delete O[k + itemCount - 1];
      }
    }
  }
  for (k = 0; k < itemCount; k++) {
    O[actualStart + k] = arguments[k + 3];
  }
  O.length = len - actualDeleteCount + itemCount;
  return A;
}

// sort(array, comparefn): ES5.1 §15.4.4.11. Holes sort to the END (spec
// SortCompare: hole > undefined > values — "undefined property values
// always sort to the end of the result, followed by non-existent property
// values") and STAY HOLES in the result (verified live on Node v22:
// `a=[];a.length=4;a[0]=3;a[2]=1;a.sort()` -> [1,3,hole,hole], hasOwn
// 2 === false — the spec's Delete write-back). comparefn is never called on
// holes or undefined elements. Stable merge sort (spec permits any order
// for equal keys; stability matches modern engines and keeps the oracle
// deterministic).
export function sort(array: any, comparefn?: any): any {
  if (array === void 0 || array === null) { throw new TypeError('Array.prototype.sort called on null or undefined'); }
  if (comparefn !== void 0 && typeof comparefn !== 'function') {
    throw new TypeError(comparefn + ' is not a function');
  }
  var O = Object(array);
  var len = O.length >>> 0;
  if (len <= 1) {
    return O;
  }
  var items: SortItem[] = new Array(len);
  var i = 0;
  for (i = 0; i < len; i++) {
    if (i in O) {
      items[i] = { present: true, value: O[i] };
    } else {
      items[i] = { present: false, value: null };
    }
  }
  mergeSortItems(items, function (a: SortItem, b: SortItem): number {
    return es5SortCompare(a, b, comparefn);
  });
  var j = 0;
  for (j = 0; j < len; j++) {
    if (items[j].present) {
      O[j] = items[j].value;
    } else {
      delete O[j];
    }
  }
  return O;
}

export function reverse(array: any): any {
  if (array === void 0 || array === null) { throw new TypeError('Array.prototype.reverse called on null or undefined'); }
  var O = Object(array);
  var len = O.length >>> 0;
  var lower = 0;
  var upper = len - 1;
  while (lower < upper) {
    var lowerExists = lower in O;
    var upperExists = upper in O;
    if (lowerExists && upperExists) {
      var tmp = O[lower];
      O[lower] = O[upper];
      O[upper] = tmp;
    } else if (lowerExists) {
      O[upper] = O[lower];
      delete O[lower];
    } else if (upperExists) {
      O[lower] = O[upper];
      delete O[upper];
    }
    lower++;
    upper--;
  }
  return O;
}

export function toString(array: any): string {
  if (array === void 0 || array === null) { throw new TypeError('Array.prototype.toString called on null or undefined'); }
  var O = Object(array);
  var fn = O.join;
  if (typeof fn === 'function') {
    return fn.call(O);
  }
  return Object.prototype.toString.call(O);
}
