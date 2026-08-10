// ESARR ES6+ set — the post-ES5 Array additions, as spec-exact pure
// functions in the array-core facade style:
//   find findIndex includes at copyWithin fill flat flatMap
//   from of keys values entries toSorted toReversed with
//   findLast findLastIndex
// ES3-clean output, two-lane callback invocation (plain call when thisArg is
// absent — spec-exact in this non-strict engine — .call when present),
// one element read per hot-loop pass. length uses ToLength semantics
// (spec ES6+) via toLength().
//
// HOLE SEMANTICS (spec-critical, verified against Node natives): find /
// findIndex / findLast / findLastIndex / includes / values / entries have
// NO HasProperty check — holes read as undefined and are visited (ES2015
// §22.1.3.8, §22.1.3.11, §22.1.5.2.1). flat / flatMap / copyWithin /
// toSorted / toReversed / with / keys DO keep the `k in O` guard.
import { isArray } from './array-core';
import { es2023SortCompare, mergeSortItems, SortItem } from './sort-core';

// ToLength: ToIntegerOrInfinity clamped to [0, 2^32-1]. ES3 arrays cannot
// exceed uint32 anyway; array-likes beyond 2^32 are never traversable in
// practice, so the 2^53-1 spec cap is immaterial (ASSUMPTION: capped at
// 4294967295 — an identical observable result on any runnable input).
function toLength(v: any): number {
  var l = +v;
  if (l !== l || l < 0) {
    return 0;
  }
  if (l > 4294967295) {
    l = 4294967295;
  }
  return l >>> 0;
}

// ToIntegerOrInfinity with the +0 fast path (NaN/undefined/null -> 0).
function toInteger(v: any): number {
  var n = +v;
  if (n !== n) return 0;
  if (n === 0) return 0;
  return n < 0 ? Math.ceil(n) : Math.floor(n);
}

export function find(array: any, callback: any, thisArg?: any): any {
  if (array === void 0 || array === null) { throw new TypeError('Array.prototype.find called on null or undefined'); }
  if (typeof callback !== 'function') { throw new TypeError(callback + ' is not a function'); }
  var O = Object(array);
  var len = toLength(O.length);
  var T = thisArg;
  var k = 0;
  var v: any;
  // NOTE: find/findIndex have NO HasProperty check (ES2015 §22.1.3.8 —
  // holes read as undefined and ARE visited, unlike forEach/map). Verified
  // against Node natives: [1,,3].find(x => x === undefined) visits the hole.
  if (T === void 0) {
    for (k = 0; k < len; k++) {
      v = O[k];
      if (callback(v, k, O)) {
        return v;
      }
    }
  } else {
    for (k = 0; k < len; k++) {
      v = O[k];
      if (callback.call(T, v, k, O)) {
        return v;
      }
    }
  }
  return void 0;
}

export function findIndex(array: any, callback: any, thisArg?: any): number {
  if (array === void 0 || array === null) { throw new TypeError('Array.prototype.findIndex called on null or undefined'); }
  if (typeof callback !== 'function') { throw new TypeError(callback + ' is not a function'); }
  var O = Object(array);
  var len = toLength(O.length);
  var T = thisArg;
  var k = 0;
  var v: any;
  if (T === void 0) {
    for (k = 0; k < len; k++) {
      v = O[k];
      if (callback(v, k, O)) {
        return k;
      }
    }
  } else {
    for (k = 0; k < len; k++) {
      v = O[k];
      if (callback.call(T, v, k, O)) {
        return k;
      }
    }
  }
  return -1;
}

export function findLast(array: any, callback: any, thisArg?: any): any {
  if (array === void 0 || array === null) { throw new TypeError('Array.prototype.findLast called on null or undefined'); }
  if (typeof callback !== 'function') { throw new TypeError(callback + ' is not a function'); }
  var O = Object(array);
  var len = toLength(O.length);
  var T = thisArg;
  var k = len - 1;
  var v: any;
  if (T === void 0) {
    for (; k >= 0; k--) {
      v = O[k];
      if (callback(v, k, O)) {
        return v;
      }
    }
  } else {
    for (; k >= 0; k--) {
      v = O[k];
      if (callback.call(T, v, k, O)) {
        return v;
      }
    }
  }
  return void 0;
}

export function findLastIndex(array: any, callback: any, thisArg?: any): number {
  if (array === void 0 || array === null) { throw new TypeError('Array.prototype.findLastIndex called on null or undefined'); }
  if (typeof callback !== 'function') { throw new TypeError(callback + ' is not a function'); }
  var O = Object(array);
  var len = toLength(O.length);
  var T = thisArg;
  var k = len - 1;
  var v: any;
  if (T === void 0) {
    for (; k >= 0; k--) {
      v = O[k];
      if (callback(v, k, O)) {
        return k;
      }
    }
  } else {
    for (; k >= 0; k--) {
      v = O[k];
      if (callback.call(T, v, k, O)) {
        return k;
      }
    }
  }
  return -1;
}

// includes: SameValueZero equality (NaN matches NaN, -0 matches +0). No
// HasProperty check (ES2016 §22.1.3.11 — holes read as undefined and match
// an undefined searchElement: [1,,3].includes(undefined) === true).
export function includes(array: any, searchElement: any, fromIndex?: any): boolean {
  if (array === void 0 || array === null) { throw new TypeError('Array.prototype.includes called on null or undefined'); }
  var O = Object(array);
  var len = toLength(O.length);
  if (len === 0) {
    return false;
  }
  var n = toInteger(fromIndex);
  var k: number;
  if (n >= 0) {
    k = n;
  } else {
    k = len + n;
    if (k < 0) {
      k = 0;
    }
  }
  var v: any;
  for (; k < len; k++) {
    v = O[k];
    // NOTE: never combine `||` with `&&` in one expression — esbuild strips
    // the (ES5-redundant) parens during bundling, and the ExtendScript engine
    // evaluates `a || b && c` as `(a || b) && c` (equal precedence, left to
    // right). Split the SameValueZero checks into separate conditions so the
    // emitted bundle is engine-safe regardless of paren elision.
    if (v === searchElement) { return true; }
    if (v !== v && searchElement !== searchElement) { return true; }
  }
  return false;
}

export function at(array: any, index?: any): any {
  if (array === void 0 || array === null) { throw new TypeError('Array.prototype.at called on null or undefined'); }
  var O = Object(array);
  var len = toLength(O.length);
  var ri = toInteger(index);
  var k = ri >= 0 ? ri : len + ri;
  if (k < 0 || k >= len) {
    return void 0;
  }
  return O[k];
}

export function copyWithin(array: any, target: any, start?: any, end?: any): any {
  if (array === void 0 || array === null) { throw new TypeError('Array.prototype.copyWithin called on null or undefined'); }
  var O = Object(array);
  var len = toLength(O.length);
  var rt = toInteger(target);
  var to = rt < 0 ? Math.max(len + rt, 0) : Math.min(rt, len);
  var rs = toInteger(start);
  var from = rs < 0 ? Math.max(len + rs, 0) : Math.min(rs, len);
  var re: number;
  if (end === void 0) {
    re = len;
  } else {
    re = toInteger(end);
  }
  var fin = re < 0 ? Math.max(len + re, 0) : Math.min(re, len);
  var count = Math.min(fin - from, len - to);
  if (count <= 0) {
    return O;
  }
  var direction = 1;
  if (from < to && to < from + count) {
    direction = -1;
    from = from + count - 1;
    to = to + count - 1;
  }
  while (count > 0) {
    if (from in O) {
      O[to] = O[from];
    } else {
      delete O[to];
    }
    from += direction;
    to += direction;
    count--;
  }
  return O;
}

export function fill(array: any, value: any, start?: any, end?: any): any {
  if (array === void 0 || array === null) { throw new TypeError('Array.prototype.fill called on null or undefined'); }
  var O = Object(array);
  var len = toLength(O.length);
  var rs = toInteger(start);
  var k = rs < 0 ? Math.max(len + rs, 0) : Math.min(rs, len);
  var re: number;
  if (end === void 0) {
    re = len;
  } else {
    re = toInteger(end);
  }
  var fin = re < 0 ? Math.max(len + re, 0) : Math.min(re, len);
  for (; k < fin; k++) {
    O[k] = value;
  }
  return O;
}

// FlattenIntoArray (ES2019 §22.1.3.10.1): holes are skipped; nested arrays
// recurse when depth > 0 and the element IsArray (never array-likes).
function flattenInto(target: any[], source: any, sourceLen: number, start: number, depth: number): number {
  var targetIndex = start;
  var sourceIndex = 0;
  var element: any;
  while (sourceIndex < sourceLen) {
    if (sourceIndex in source) {
      element = source[sourceIndex];
      if (depth > 0 && isArray(element)) {
        var elen = toLength(element.length);
        targetIndex = flattenInto(target, element, elen, targetIndex, depth === Infinity ? Infinity : depth - 1);
      } else {
        target[targetIndex] = element;
        targetIndex++;
      }
    }
    sourceIndex++;
  }
  return targetIndex;
}

export function flat(array: any, depth?: any): any[] {
  if (array === void 0 || array === null) { throw new TypeError('Array.prototype.flat called on null or undefined'); }
  var O = Object(array);
  var sourceLen = toLength(O.length);
  var depthNum = depth === void 0 ? 1 : toInteger(depth);
  if (depthNum < 0) {
    depthNum = 0;
  }
  var A: any[] = [];
  flattenInto(A, O, sourceLen, 0, depthNum);
  return A;
}

export function flatMap(array: any, callback: any, thisArg?: any): any[] {
  if (array === void 0 || array === null) { throw new TypeError('Array.prototype.flatMap called on null or undefined'); }
  if (typeof callback !== 'function') { throw new TypeError(callback + ' is not a function'); }
  var O = Object(array);
  var sourceLen = toLength(O.length);
  var T = thisArg;
  var A: any[] = [];
  var targetIndex = 0;
  var sourceIndex = 0;
  var mapped: any;
  if (T === void 0) {
    for (sourceIndex = 0; sourceIndex < sourceLen; sourceIndex++) {
      if (sourceIndex in O) {
        mapped = callback(O[sourceIndex], sourceIndex, O);
        if (isArray(mapped)) {
          targetIndex = flattenInto(A, mapped, toLength(mapped.length), targetIndex, 0);
        } else {
          A[targetIndex] = mapped;
          targetIndex++;
        }
      }
    }
  } else {
    for (sourceIndex = 0; sourceIndex < sourceLen; sourceIndex++) {
      if (sourceIndex in O) {
        mapped = callback.call(T, O[sourceIndex], sourceIndex, O);
        if (isArray(mapped)) {
          targetIndex = flattenInto(A, mapped, toLength(mapped.length), targetIndex, 0);
        } else {
          A[targetIndex] = mapped;
          targetIndex++;
        }
      }
    }
  }
  return A;
}

// from(arrayLike, mapFn, thisArg, C?): the array-like lane (no iterables —
// ExtendScript has no Symbol.iterator, so Set/Map/string-iterable inputs are
// out of scope; ASSUMPTION: string array-likes still work via index access,
// exactly like the ES5 methods). The constructor C defaults to Array; the
// installed Array.from static forwards `this` so subclass constructors are
// honored. Unlike the ES5 methods, from() does NOT skip holes (Get directly,
// spec ES6 §22.1.2.1 — hole reads yield undefined).
export function from(arrayLike: any, mapFn?: any, thisArg?: any, C?: any): any[] {
  if (arrayLike === void 0 || arrayLike === null) { throw new TypeError('Array.from requires an array-like object'); }
  if (mapFn !== void 0 && typeof mapFn !== 'function') { throw new TypeError(mapFn + ' is not a function'); }
  var items = Object(arrayLike);
  var len = toLength(items.length);
  var A: any;
  var ctor: any = C === void 0 ? Array : C;
  try {
    A = new ctor(len);
  } catch (e) {
    A = new Array(len);
  }
  var T = thisArg;
  var k = 0;
  var kValue: any;
  if (mapFn === void 0) {
    for (k = 0; k < len; k++) {
      A[k] = items[k];
    }
  } else if (T === void 0) {
    for (k = 0; k < len; k++) {
      kValue = items[k];
      A[k] = mapFn(kValue, k);
    }
  } else {
    for (k = 0; k < len; k++) {
      kValue = items[k];
      A[k] = mapFn.call(T, kValue, k);
    }
  }
  return A;
}

// of(...items): always constructs a plain Array (ASSUMPTION: ExtendScript
// Array subclassing is pathological and the species/`this`-constructor honor
// is omitted; the installed Array.of static is Array.of = ESARR.of).
export function of(): any[] {
  var len = arguments.length;
  var A: any[] = new Array(len);
  var k = 0;
  for (k = 0; k < len; k++) {
    A[k] = arguments[k];
  }
  return A;
}

// keys()/values()/entries() return ES6-style iterator objects exposing
// next(): { value, done }. There is no Symbol.iterator in ES3, so the
// objects are NOT self-iterable via the symbol protocol (ASSUMPTION:
// consumers call .next() directly, per the MDN ES3 polyfill pattern).
// The iterated length is re-read on each next() call (spec ES6
// §22.1.5.2.1 — mutations are observed). values/entries do NOT skip holes
// (direct Get — a hole yields undefined, verified vs Node natives); keys
// yields every index.
export function keys(array: any): any {
  if (array === void 0 || array === null) { throw new TypeError('Array.prototype.keys called on null or undefined'); }
  var O = Object(array);
  var idx = 0;
  return {
    next: function (): any {
      var len = toLength(O.length);
      if (idx < len) {
        var v = idx;
        idx++;
        return { value: v, done: false };
      }
      return { value: void 0, done: true };
    }
  };
}

export function values(array: any): any {
  if (array === void 0 || array === null) { throw new TypeError('Array.prototype.values called on null or undefined'); }
  var O = Object(array);
  var idx = 0;
  return {
    next: function (): any {
      var len = toLength(O.length);
      if (idx < len) {
        var v = O[idx];
        idx++;
        return { value: v, done: false };
      }
      return { value: void 0, done: true };
    }
  };
}

export function entries(array: any): any {
  if (array === void 0 || array === null) { throw new TypeError('Array.prototype.entries called on null or undefined'); }
  var O = Object(array);
  var idx = 0;
  return {
    next: function (): any {
      var len = toLength(O.length);
      if (idx < len) {
        var pair = [idx, O[idx]];
        idx++;
        return { value: pair, done: false };
      }
      return { value: void 0, done: true };
    }
  };
}

// toSorted(comparefn): ES2023 — returns a NEW sorted array; the original is
// untouched. Holes sort to the END (after undefined) and stay holes in the
// result; undefined elements sort after defined values.
export function toSorted(array: any, comparefn?: any): any[] {
  if (array === void 0 || array === null) { throw new TypeError('Array.prototype.toSorted called on null or undefined'); }
  if (comparefn !== void 0 && typeof comparefn !== 'function') {
    throw new TypeError(comparefn + ' is not a function');
  }
  var O = Object(array);
  var len = toLength(O.length);
  var A: any[] = new Array(len);
  if (len <= 1) {
    // copy present elements; holes materialize as undefined (Node behavior)
    var k0 = 0;
    for (k0 = 0; k0 < len; k0++) {
      A[k0] = k0 in O ? O[k0] : void 0;
    }
    return A;
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
    return es2023SortCompare(a, b, comparefn);
  });
  var j = 0;
  for (j = 0; j < len; j++) {
    // Node materializes holes as UNDEFINED in the result (all indices
    // present — hasOwnProperty true); holes sort last per SortIndexedProperties.
    A[j] = items[j].present ? items[j].value : void 0;
  }
  return A;
}

export function toReversed(array: any): any[] {
  if (array === void 0 || array === null) { throw new TypeError('Array.prototype.toReversed called on null or undefined'); }
  var O = Object(array);
  var len = toLength(O.length);
  var A: any[] = new Array(len);
  var k = 0;
  for (k = 0; k < len; k++) {
    var from = len - 1 - k;
    // Node materializes holes as undefined (hasOwnProperty true on every
    // index of the result).
    A[k] = from in O ? O[from] : void 0;
  }
  return A;
}

// with(index, value): returns a NEW array with index replaced; holes
// elsewhere are materialized as undefined (Node behavior — every result
// index present). Out-of-range index throws RangeError (ES2023).
export function withMethod(array: any, index: any, value: any): any[] {
  if (array === void 0 || array === null) { throw new TypeError('Array.prototype.with called on null or undefined'); }
  var O = Object(array);
  var len = toLength(O.length);
  var ri = toInteger(index);
  var k = ri >= 0 ? ri : len + ri;
  if (k < 0 || k >= len) {
    throw new RangeError('Index ' + String(index) + ' is out of range');
  }
  var A: any[] = new Array(len);
  var i = 0;
  for (i = 0; i < len; i++) {
    if (i === k) {
      A[i] = value;
    } else {
      A[i] = i in O ? O[i] : void 0;
    }
  }
  return A;
}
