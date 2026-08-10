var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/index.ts
var src_exports = {};
__export(src_exports, {
  at: () => at,
  benchmark: () => benchmark,
  capabilities: () => capabilities,
  concat: () => concat,
  copyWithin: () => copyWithin,
  disableNativeGate: () => disableNativeGate,
  enableNativeGate: () => enableNativeGate,
  entries: () => entries,
  every: () => every,
  fill: () => fill,
  filter: () => filter,
  find: () => find,
  findIndex: () => findIndex,
  findLast: () => findLast,
  findLastIndex: () => findLastIndex,
  flat: () => flat,
  flatMap: () => flatMap,
  forEach: () => forEach,
  from: () => from,
  includes: () => includes2,
  indexOf: () => indexOf2,
  install: () => install,
  isArray: () => isArray,
  join: () => join2,
  keys: () => keys,
  lastIndexOf: () => lastIndexOf2,
  map: () => map,
  nativeGateState: () => nativeGateState,
  of: () => of,
  pop: () => pop,
  push: () => push,
  reduce: () => reduce,
  reduceRight: () => reduceRight,
  reverse: () => reverse2,
  shift: () => shift,
  slice: () => slice,
  some: () => some,
  sort: () => sort2,
  splice: () => splice,
  toReversed: () => toReversed,
  toSorted: () => toSorted,
  toString: () => toString,
  unshift: () => unshift,
  values: () => values,
  with: () => withMethod
});

// src/array-core.ts
function isArray(arg) {
  if (arg === null || typeof arg !== "object") {
    return false;
  }
  try {
    if (arg.__class__ === "Array") {
      return true;
    }
  } catch (e) {
  }
  return Object.prototype.toString.call(arg) === "[object Array]";
}
function forEach(array, callback, thisArg) {
  if (array === void 0 || array === null) {
    throw new TypeError("Array.prototype.forEach called on null or undefined");
  }
  if (typeof callback !== "function") {
    throw new TypeError(callback + " is not a function");
  }
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
function map(array, callback, thisArg) {
  if (array === void 0 || array === null) {
    throw new TypeError("Array.prototype.map called on null or undefined");
  }
  if (typeof callback !== "function") {
    throw new TypeError(callback + " is not a function");
  }
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
function filter(array, callback, thisArg) {
  if (array === void 0 || array === null) {
    throw new TypeError("Array.prototype.filter called on null or undefined");
  }
  if (typeof callback !== "function") {
    throw new TypeError(callback + " is not a function");
  }
  var O = Object(array);
  var len = O.length >>> 0;
  var T = thisArg;
  var A = [];
  var v;
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
function every(array, callback, thisArg) {
  if (array === void 0 || array === null) {
    throw new TypeError("Array.prototype.every called on null or undefined");
  }
  if (typeof callback !== "function") {
    throw new TypeError(callback + " is not a function");
  }
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
function some(array, callback, thisArg) {
  if (array === void 0 || array === null) {
    throw new TypeError("Array.prototype.some called on null or undefined");
  }
  if (typeof callback !== "function") {
    throw new TypeError(callback + " is not a function");
  }
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
function indexOf(array, searchElement, fromIndex) {
  if (array === void 0 || array === null) {
    throw new TypeError("Array.prototype.indexOf called on null or undefined");
  }
  var o = Object(array);
  var len = o.length >>> 0;
  if (len === 0) {
    return -1;
  }
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
      if (k === 0) {
        k = 0;
      }
      return k;
    }
  }
  return -1;
}
function lastIndexOf(array, searchElement, fromIndex) {
  if (array === void 0 || array === null) {
    throw new TypeError("Array.prototype.lastIndexOf called on null or undefined");
  }
  var o = Object(array);
  var len = o.length >>> 0;
  if (len === 0) {
    return -1;
  }
  var n;
  if (arguments.length > 2) {
    n = +fromIndex || 0;
    if (n !== 0) {
      n = n < 0 ? Math.ceil(n) : Math.floor(n);
    }
  } else {
    n = len - 1;
  }
  var k = n >= 0 ? Math.min(n, len - 1) : len + n;
  if (k < 0) {
    return -1;
  }
  for (; k >= 0; k--) {
    if (k in o && o[k] === searchElement) {
      if (k === 0) {
        k = 0;
      }
      return k;
    }
  }
  return -1;
}
function reduce(array, callback, initialValue) {
  if (array === void 0 || array === null) {
    throw new TypeError("Array.prototype.reduce called on null or undefined");
  }
  if (typeof callback !== "function") {
    throw new TypeError(callback + " is not a function");
  }
  var O = Object(array);
  var len = O.length >>> 0;
  var k = 0;
  var value;
  if (arguments.length > 2) {
    value = initialValue;
  } else {
    while (k < len && !(k in O)) {
      k++;
    }
    if (k >= len) {
      throw new TypeError("Reduce of empty array with no initial value");
    }
    value = O[k++];
  }
  for (; k < len; k++) {
    if (k in O) {
      value = callback(value, O[k], k, O);
    }
  }
  return value;
}
function reduceRight(array, callback, initialValue) {
  if (array === void 0 || array === null) {
    throw new TypeError("Array.prototype.reduceRight called on null or undefined");
  }
  if (typeof callback !== "function") {
    throw new TypeError(callback + " is not a function");
  }
  var O = Object(array);
  var len = O.length >>> 0;
  var k = len - 1;
  var value;
  if (arguments.length > 2) {
    value = initialValue;
  } else {
    while (k >= 0 && !(k in O)) {
      k--;
    }
    if (k < 0) {
      throw new TypeError("Reduce of empty array with no initial value");
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

// src/array-es3.ts
var array_es3_exports = {};
__export(array_es3_exports, {
  concat: () => concat,
  join: () => join,
  pop: () => pop,
  push: () => push,
  reverse: () => reverse,
  shift: () => shift,
  slice: () => slice,
  sort: () => sort,
  splice: () => splice,
  toString: () => toString,
  unshift: () => unshift
});

// src/sort-core.ts
function defaultCompare(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}
function es5SortCompare(x, y, fn) {
  return es2023SortCompare(x, y, fn);
}
function es2023SortCompare(x, y, fn) {
  var xp = x.present;
  var yp = y.present;
  if (!xp && !yp) return 0;
  if (!xp) return 1;
  if (!yp) return -1;
  var xv = x.value;
  var yv = y.value;
  if (xv === void 0 && yv === void 0) return 0;
  if (xv === void 0) return 1;
  if (yv === void 0) return -1;
  if (fn !== void 0) {
    var v = fn(xv, yv);
    if (v < 0) return -1;
    if (v > 0) return 1;
    return 0;
  }
  return defaultCompare(String(xv), String(yv));
}
function mergeSortItems(items, cmp) {
  var n = items.length;
  if (n <= 1) return;
  var tmp = new Array(n);
  var width = 1;
  while (width < n) {
    var left = 0;
    while (left < n) {
      var mid = left + width;
      if (mid > n) mid = n;
      var right = mid + width;
      if (right > n) right = n;
      var i = left;
      var j = mid;
      var t = left;
      while (i < mid && j < right) {
        if (cmp(items[i], items[j]) <= 0) {
          tmp[t] = items[i];
          i++;
        } else {
          tmp[t] = items[j];
          j++;
        }
        t++;
      }
      while (i < mid) {
        tmp[t] = items[i];
        i++;
        t++;
      }
      while (j < right) {
        tmp[t] = items[j];
        j++;
        t++;
      }
      left = right;
    }
    var c = 0;
    for (c = 0; c < n; c++) {
      items[c] = tmp[c];
    }
    width *= 2;
  }
}

// src/array-es3.ts
function toInteger(v) {
  var n = +v;
  if (n !== n) return 0;
  if (n === 0) return 0;
  return n < 0 ? Math.ceil(n) : Math.floor(n);
}
function slice(array, begin, end) {
  if (array === void 0 || array === null) {
    throw new TypeError("Array.prototype.slice called on null or undefined");
  }
  var O = Object(array);
  var len = O.length >>> 0;
  var rs = toInteger(begin);
  var k = rs < 0 ? Math.max(len + rs, 0) : Math.min(rs, len);
  var re;
  if (end === void 0) {
    re = len;
  } else {
    re = toInteger(end);
  }
  var fin = re < 0 ? Math.max(len + re, 0) : Math.min(re, len);
  var rangeLen = fin > k ? fin - k : 0;
  var A = new Array(rangeLen);
  var n = 0;
  for (; k < fin; k++) {
    if (k in O) {
      A[n] = O[k];
    }
    n++;
  }
  return A;
}
function concat(array) {
  if (array === void 0 || array === null) {
    throw new TypeError("Array.prototype.concat called on null or undefined");
  }
  var O = Object(array);
  var A = [];
  var n = 0;
  var count = arguments.length;
  var a = 0;
  for (a = 0; a < count; a++) {
    var E = a === 0 ? O : arguments[a];
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
  A.length = n;
  return A;
}
function join(array, separator) {
  if (array === void 0 || array === null) {
    throw new TypeError("Array.prototype.join called on null or undefined");
  }
  var O = Object(array);
  var len = O.length >>> 0;
  var sep = separator === void 0 ? "," : String(separator);
  if (len === 0) {
    return "";
  }
  var R = "";
  var k = 0;
  var v;
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
function push(array) {
  if (array === void 0 || array === null) {
    throw new TypeError("Array.prototype.push called on null or undefined");
  }
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
function pop(array) {
  if (array === void 0 || array === null) {
    throw new TypeError("Array.prototype.pop called on null or undefined");
  }
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
function shift(array) {
  if (array === void 0 || array === null) {
    throw new TypeError("Array.prototype.shift called on null or undefined");
  }
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
function unshift(array) {
  if (array === void 0 || array === null) {
    throw new TypeError("Array.prototype.unshift called on null or undefined");
  }
  var O = Object(array);
  var len = O.length >>> 0;
  var argCount = arguments.length - 1;
  if (argCount > 0) {
    var k = len;
    for (; k > 0; k--) {
      var from2 = k - 1;
      if (from2 in O) {
        O[k + argCount - 1] = O[from2];
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
function splice(array, start, deleteCount) {
  if (array === void 0 || array === null) {
    throw new TypeError("Array.prototype.splice called on null or undefined");
  }
  var O = Object(array);
  var len = O.length >>> 0;
  var rs = toInteger(start);
  var actualStart = rs < 0 ? Math.max(len + rs, 0) : Math.min(rs, len);
  var actualDeleteCount;
  if (deleteCount === void 0) {
    actualDeleteCount = len - actualStart;
  } else {
    var dc = toInteger(deleteCount);
    actualDeleteCount = Math.min(Math.max(dc, 0), len - actualStart);
  }
  var A = new Array(actualDeleteCount);
  var k = 0;
  for (k = 0; k < actualDeleteCount; k++) {
    var from0 = actualStart + k;
    if (from0 in O) {
      A[k] = O[from0];
    }
  }
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
function sort(array, comparefn) {
  if (array === void 0 || array === null) {
    throw new TypeError("Array.prototype.sort called on null or undefined");
  }
  if (comparefn !== void 0 && typeof comparefn !== "function") {
    throw new TypeError(comparefn + " is not a function");
  }
  var O = Object(array);
  var len = O.length >>> 0;
  if (len === 1) {
    if (!(0 in O)) {
      O[0] = void 0;
    }
    return O;
  }
  if (len === 0) {
    return O;
  }
  var items = new Array(len);
  var i = 0;
  for (i = 0; i < len; i++) {
    if (i in O) {
      items[i] = { present: true, value: O[i] };
    } else {
      items[i] = { present: false, value: null };
    }
  }
  mergeSortItems(items, function(a, b) {
    return es5SortCompare(a, b, comparefn);
  });
  var j = 0;
  for (j = 0; j < len; j++) {
    O[j] = items[j].present ? items[j].value : void 0;
  }
  return O;
}
function reverse(array) {
  if (array === void 0 || array === null) {
    throw new TypeError("Array.prototype.reverse called on null or undefined");
  }
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
function toString(array) {
  if (array === void 0 || array === null) {
    throw new TypeError("Array.prototype.toString called on null or undefined");
  }
  var O = Object(array);
  var fn = O.join;
  if (typeof fn === "function") {
    return fn.call(O);
  }
  return Object.prototype.toString.call(O);
}

// src/array-es6.ts
var array_es6_exports = {};
__export(array_es6_exports, {
  at: () => at,
  copyWithin: () => copyWithin,
  entries: () => entries,
  fill: () => fill,
  find: () => find,
  findIndex: () => findIndex,
  findLast: () => findLast,
  findLastIndex: () => findLastIndex,
  flat: () => flat,
  flatMap: () => flatMap,
  from: () => from,
  includes: () => includes,
  keys: () => keys,
  of: () => of,
  toReversed: () => toReversed,
  toSorted: () => toSorted,
  values: () => values,
  withMethod: () => withMethod
});
function toLength(v) {
  var l = +v;
  if (l !== l || l < 0) {
    return 0;
  }
  if (l > 4294967295) {
    l = 4294967295;
  }
  return l >>> 0;
}
function toInteger2(v) {
  var n = +v;
  if (n !== n) return 0;
  if (n === 0) return 0;
  return n < 0 ? Math.ceil(n) : Math.floor(n);
}
function find(array, callback, thisArg) {
  if (array === void 0 || array === null) {
    throw new TypeError("Array.prototype.find called on null or undefined");
  }
  if (typeof callback !== "function") {
    throw new TypeError(callback + " is not a function");
  }
  var O = Object(array);
  var len = toLength(O.length);
  var T = thisArg;
  var k = 0;
  var v;
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
function findIndex(array, callback, thisArg) {
  if (array === void 0 || array === null) {
    throw new TypeError("Array.prototype.findIndex called on null or undefined");
  }
  if (typeof callback !== "function") {
    throw new TypeError(callback + " is not a function");
  }
  var O = Object(array);
  var len = toLength(O.length);
  var T = thisArg;
  var k = 0;
  var v;
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
function findLast(array, callback, thisArg) {
  if (array === void 0 || array === null) {
    throw new TypeError("Array.prototype.findLast called on null or undefined");
  }
  if (typeof callback !== "function") {
    throw new TypeError(callback + " is not a function");
  }
  var O = Object(array);
  var len = toLength(O.length);
  var T = thisArg;
  var k = len - 1;
  var v;
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
function findLastIndex(array, callback, thisArg) {
  if (array === void 0 || array === null) {
    throw new TypeError("Array.prototype.findLastIndex called on null or undefined");
  }
  if (typeof callback !== "function") {
    throw new TypeError(callback + " is not a function");
  }
  var O = Object(array);
  var len = toLength(O.length);
  var T = thisArg;
  var k = len - 1;
  var v;
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
function includes(array, searchElement, fromIndex) {
  if (array === void 0 || array === null) {
    throw new TypeError("Array.prototype.includes called on null or undefined");
  }
  var O = Object(array);
  var len = toLength(O.length);
  if (len === 0) {
    return false;
  }
  var n = toInteger2(fromIndex);
  var k;
  if (n >= 0) {
    k = n;
  } else {
    k = len + n;
    if (k < 0) {
      k = 0;
    }
  }
  var v;
  for (; k < len; k++) {
    v = O[k];
    if (v === searchElement || searchElement !== searchElement && v !== v) {
      return true;
    }
  }
  return false;
}
function at(array, index) {
  if (array === void 0 || array === null) {
    throw new TypeError("Array.prototype.at called on null or undefined");
  }
  var O = Object(array);
  var len = toLength(O.length);
  var ri = toInteger2(index);
  var k = ri >= 0 ? ri : len + ri;
  if (k < 0 || k >= len) {
    return void 0;
  }
  return O[k];
}
function copyWithin(array, target, start, end) {
  if (array === void 0 || array === null) {
    throw new TypeError("Array.prototype.copyWithin called on null or undefined");
  }
  var O = Object(array);
  var len = toLength(O.length);
  var rt = toInteger2(target);
  var to = rt < 0 ? Math.max(len + rt, 0) : Math.min(rt, len);
  var rs = toInteger2(start);
  var from2 = rs < 0 ? Math.max(len + rs, 0) : Math.min(rs, len);
  var re;
  if (end === void 0) {
    re = len;
  } else {
    re = toInteger2(end);
  }
  var fin = re < 0 ? Math.max(len + re, 0) : Math.min(re, len);
  var count = Math.min(fin - from2, len - to);
  if (count <= 0) {
    return O;
  }
  var direction = 1;
  if (from2 < to && to < from2 + count) {
    direction = -1;
    from2 = from2 + count - 1;
    to = to + count - 1;
  }
  while (count > 0) {
    if (from2 in O) {
      O[to] = O[from2];
    } else {
      delete O[to];
    }
    from2 += direction;
    to += direction;
    count--;
  }
  return O;
}
function fill(array, value, start, end) {
  if (array === void 0 || array === null) {
    throw new TypeError("Array.prototype.fill called on null or undefined");
  }
  var O = Object(array);
  var len = toLength(O.length);
  var rs = toInteger2(start);
  var k = rs < 0 ? Math.max(len + rs, 0) : Math.min(rs, len);
  var re;
  if (end === void 0) {
    re = len;
  } else {
    re = toInteger2(end);
  }
  var fin = re < 0 ? Math.max(len + re, 0) : Math.min(re, len);
  for (; k < fin; k++) {
    O[k] = value;
  }
  return O;
}
function flattenInto(target, source, sourceLen, start, depth) {
  var targetIndex = start;
  var sourceIndex = 0;
  var element;
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
function flat(array, depth) {
  if (array === void 0 || array === null) {
    throw new TypeError("Array.prototype.flat called on null or undefined");
  }
  var O = Object(array);
  var sourceLen = toLength(O.length);
  var depthNum = depth === void 0 ? 1 : toInteger2(depth);
  if (depthNum < 0) {
    depthNum = 0;
  }
  var A = [];
  flattenInto(A, O, sourceLen, 0, depthNum);
  return A;
}
function flatMap(array, callback, thisArg) {
  if (array === void 0 || array === null) {
    throw new TypeError("Array.prototype.flatMap called on null or undefined");
  }
  if (typeof callback !== "function") {
    throw new TypeError(callback + " is not a function");
  }
  var O = Object(array);
  var sourceLen = toLength(O.length);
  var T = thisArg;
  var A = [];
  var targetIndex = 0;
  var sourceIndex = 0;
  var mapped;
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
function from(arrayLike, mapFn, thisArg, C) {
  if (arrayLike === void 0 || arrayLike === null) {
    throw new TypeError("Array.from requires an array-like object");
  }
  if (mapFn !== void 0 && typeof mapFn !== "function") {
    throw new TypeError(mapFn + " is not a function");
  }
  var items = Object(arrayLike);
  var len = toLength(items.length);
  var A;
  var ctor = C === void 0 ? Array : C;
  try {
    A = new ctor(len);
  } catch (e) {
    A = new Array(len);
  }
  var T = thisArg;
  var k = 0;
  var kValue;
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
function of() {
  var len = arguments.length;
  var A = new Array(len);
  var k = 0;
  for (k = 0; k < len; k++) {
    A[k] = arguments[k];
  }
  return A;
}
function keys(array) {
  if (array === void 0 || array === null) {
    throw new TypeError("Array.prototype.keys called on null or undefined");
  }
  var O = Object(array);
  var idx = 0;
  return {
    next: function() {
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
function values(array) {
  if (array === void 0 || array === null) {
    throw new TypeError("Array.prototype.values called on null or undefined");
  }
  var O = Object(array);
  var idx = 0;
  return {
    next: function() {
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
function entries(array) {
  if (array === void 0 || array === null) {
    throw new TypeError("Array.prototype.entries called on null or undefined");
  }
  var O = Object(array);
  var idx = 0;
  return {
    next: function() {
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
function toSorted(array, comparefn) {
  if (array === void 0 || array === null) {
    throw new TypeError("Array.prototype.toSorted called on null or undefined");
  }
  if (comparefn !== void 0 && typeof comparefn !== "function") {
    throw new TypeError(comparefn + " is not a function");
  }
  var O = Object(array);
  var len = toLength(O.length);
  var A = new Array(len);
  if (len <= 1) {
    var k0 = 0;
    for (k0 = 0; k0 < len; k0++) {
      A[k0] = k0 in O ? O[k0] : void 0;
    }
    return A;
  }
  var items = new Array(len);
  var i = 0;
  for (i = 0; i < len; i++) {
    if (i in O) {
      items[i] = { present: true, value: O[i] };
    } else {
      items[i] = { present: false, value: null };
    }
  }
  mergeSortItems(items, function(a, b) {
    return es2023SortCompare(a, b, comparefn);
  });
  var j = 0;
  for (j = 0; j < len; j++) {
    A[j] = items[j].present ? items[j].value : void 0;
  }
  return A;
}
function toReversed(array) {
  if (array === void 0 || array === null) {
    throw new TypeError("Array.prototype.toReversed called on null or undefined");
  }
  var O = Object(array);
  var len = toLength(O.length);
  var A = new Array(len);
  var k = 0;
  for (k = 0; k < len; k++) {
    var from2 = len - 1 - k;
    A[k] = from2 in O ? O[from2] : void 0;
  }
  return A;
}
function withMethod(array, index, value) {
  if (array === void 0 || array === null) {
    throw new TypeError("Array.prototype.with called on null or undefined");
  }
  var O = Object(array);
  var len = toLength(O.length);
  var ri = toInteger2(index);
  var k = ri >= 0 ? ri : len + ri;
  if (k < 0 || k >= len) {
    throw new RangeError("Index " + String(index) + " is out of range");
  }
  var A = new Array(len);
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

// src/native-dispatch.ts
var native_dispatch_exports = {};
__export(native_dispatch_exports, {
  includes: () => includes2,
  indexOf: () => indexOf2,
  join: () => join2,
  lastIndexOf: () => lastIndexOf2,
  reverse: () => reverse2,
  sort: () => sort2
});

// src/lane-wire.ts
function packInt32(v) {
  var n = v < 0 ? v + 4294967296 : v;
  return String.fromCharCode((n >>> 24 & 255) + 1, (n >>> 16 & 255) + 1, (n >>> 8 & 255) + 1, (n & 255) + 1);
}
function unpackInt32At(s, i) {
  var v = s.charCodeAt(i) - 1 << 24 | s.charCodeAt(i + 1) - 1 << 16 | s.charCodeAt(i + 2) - 1 << 8 | s.charCodeAt(i + 3) - 1;
  return v | 0;
}
function packArray(values2, len) {
  var parts = new Array(len);
  var i = 0;
  for (i = 0; i < len; i++) {
    parts[i] = packInt32(values2[i]);
  }
  return parts.join("");
}
function unpackArray(channel, len) {
  var out = new Array(len);
  var i = 0;
  for (i = 0; i < len; i++) {
    out[i] = unpackInt32At(channel, i * 4);
  }
  return out;
}

// src/native-lane.ts
function isLaneInt(v) {
  return typeof v === "number" && v === v && Math.floor(v) === v && v >= -2147483648 && v <= 2147483647;
}
var state = {
  present: false,
  active: false,
  reason: "",
  lib: null,
  dll: "",
  dllVersion: 0,
  lanes: null,
  activeNames: [],
  certified: 0
};
function makeSortLane(lib) {
  return function(array) {
    var O = Object(array);
    var len = O.length >>> 0;
    var vals = new Array(len);
    var k = 0;
    for (k = 0; k < len; k++) {
      if (!(k in O)) return void 0;
      var v = O[k];
      if (!isLaneInt(v)) return void 0;
      vals[k] = v;
    }
    try {
      var out = lib.arrSort(packArray(vals, len), len);
      if (typeof out !== "string") return void 0;
      var res = unpackArray(out, len);
      return res;
    } catch (e) {
      return void 0;
    }
  };
}
function makeReverseLane(lib) {
  return function(array) {
    var O = Object(array);
    var len = O.length >>> 0;
    var vals = new Array(len);
    var k = 0;
    for (k = 0; k < len; k++) {
      if (!(k in O)) return void 0;
      var v = O[k];
      if (!isLaneInt(v)) return void 0;
      vals[k] = v;
    }
    try {
      var out = lib.arrReverse(packArray(vals, len), len);
      if (typeof out !== "string") return void 0;
      var res = unpackArray(out, len);
      return res;
    } catch (e) {
      return void 0;
    }
  };
}
function makeJoinLane(lib) {
  return function(array, separator) {
    var O = Object(array);
    var len = O.length >>> 0;
    var sep = separator === void 0 ? "," : String(separator);
    var vals = new Array(len);
    var k = 0;
    for (k = 0; k < len; k++) {
      if (!(k in O)) return void 0;
      var v = O[k];
      if (!isLaneInt(v)) return void 0;
      vals[k] = v;
    }
    try {
      var out = lib.arrJoin(packArray(vals, len), len, sep);
      if (typeof out !== "string") return void 0;
      return out;
    } catch (e) {
      return void 0;
    }
  };
}
function makeIndexOfLane(lib, last) {
  return function(array, searchElement, fromIndex) {
    if (!isLaneInt(searchElement)) return void 0;
    var O = Object(array);
    var len = O.length >>> 0;
    var n;
    if (fromIndex === void 0) {
      n = last ? len - 1 : 0;
    } else {
      n = +fromIndex || 0;
      if (n !== 0) {
        n = n < 0 ? Math.ceil(n) : Math.floor(n);
      }
    }
    var kStart;
    var kEnd;
    if (last) {
      kEnd = n >= 0 ? Math.min(n, len - 1) : len + n;
      if (kEnd < 0) {
        return -1;
      }
      kStart = 0;
    } else {
      kStart = n < 0 ? Math.max(len + n, 0) : Math.min(n, len);
      if (kStart >= len) {
        return -1;
      }
      kEnd = len - 1;
    }
    var count = kEnd - kStart + 1;
    var vals = new Array(count);
    var k = 0;
    var idx = 0;
    for (k = kStart; k <= kEnd; k++) {
      if (!(k in O)) return void 0;
      var v = O[k];
      if (!isLaneInt(v)) return void 0;
      vals[idx] = v;
      idx++;
    }
    try {
      var method = last ? lib.arrLastIndexOf : lib.arrIndexOf;
      var out = method(packArray(vals, count), count, searchElement);
      var num = typeof out === "number" ? out : Number(out);
      if (num !== num) return void 0;
      if (num >= 1e4) return void 0;
      if (last) {
        return num;
      }
      if (num < 0) {
        return -1;
      }
      return num + kStart;
    } catch (e) {
      return void 0;
    }
  };
}
function makeIncludesLane(lib) {
  return function(array, searchElement, fromIndex) {
    if (!isLaneInt(searchElement)) return void 0;
    var O = Object(array);
    var len = O.length >>> 0;
    var n;
    if (fromIndex === void 0) {
      n = 0;
    } else {
      n = +fromIndex || 0;
      if (n !== 0) {
        n = n < 0 ? Math.ceil(n) : Math.floor(n);
      }
    }
    var kStart = n < 0 ? Math.max(len + n, 0) : n;
    if (kStart >= len) {
      return false;
    }
    var count = len - kStart;
    var vals = new Array(count);
    var k = 0;
    var idx = 0;
    for (k = kStart; k < len; k++) {
      if (!(k in O)) return void 0;
      var v = O[k];
      if (!isLaneInt(v)) return void 0;
      vals[idx] = v;
      idx++;
    }
    try {
      var out = lib.arrIncludes(packArray(vals, count), count, searchElement);
      var num = typeof out === "number" ? out : Number(out);
      if (num !== num) return void 0;
      if (num >= 1e4) return void 0;
      return num === 0 ? false : true;
    } catch (e) {
      return void 0;
    }
  };
}
function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  var i = 0;
  for (i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
var CORPUS = [
  ["sort", sort, [3, 1, 2], [], [1, 2, 3]],
  ["sort", sort, [-5, 0, 7, 4], [], [-5, 0, 4, 7]],
  ["sort", sort, [2, 2, 1, 1], [], [1, 1, 2, 2]],
  // default sort is ToString-lexicographic — "-1" < "-5" (a numeric sort
  // would give [-5,-1] and must be disqualified)
  ["sort", sort, [-1, -5, 3], [], [-1, -5, 3]],
  ["reverse", reverse, [1, 2, 3], [], [3, 2, 1]],
  ["reverse", reverse, [5], [], [5]],
  ["join", join, [1, 2, 3], [], "1,2,3"],
  ["join", join, [], [], ""],
  ["join", join, [1, 2, 3], ["-"], "1-2-3"],
  ["indexOf", indexOf, [1, 2, 3, 2], [2, 0], 1],
  ["indexOf", indexOf, [1, 2, 3], [9, 0], -1],
  ["indexOf", indexOf, [1, 2, 3, 2], [2, 2], 3],
  ["lastIndexOf", lastIndexOf, [1, 2, 3, 2], [2, 9], 3],
  ["lastIndexOf", lastIndexOf, [1, 2, 3], [1, 0], 0],
  ["includes", includes, [1, 2, 3], [2], true],
  ["includes", includes, [1, 2, 3], [9], false],
  ["includes", includes, [1, 2, 3, 2], [2, 2], true]
];
var LANE_BUILDERS = {
  sort: makeSortLane,
  reverse: makeReverseLane,
  join: makeJoinLane,
  indexOf: makeIndexOfLane,
  lastIndexOf: function(lib) {
    return makeIndexOfLane(lib, true);
  },
  includes: makeIncludesLane
};
function certifyLanes(lib) {
  var lanes2 = {};
  var activeNames = [];
  var certified = 0;
  var failures = [];
  var i = 0;
  for (i = 0; i < CORPUS.length; i++) {
    var name = CORPUS[i][0];
    if (lanes2[name] === void 0) {
      var built = null;
      try {
        built = LANE_BUILDERS[name](lib);
      } catch (e) {
        built = null;
      }
      if (!built) {
        failures[failures.length] = name + ": lane builder failed";
        lanes2[name] = null;
        continue;
      }
      lanes2[name] = built;
    }
    var laneFn = lanes2[name];
    if (laneFn === null) continue;
    var jsxFn = CORPUS[i][1];
    var input = CORPUS[i][2];
    var args = CORPUS[i][3];
    var expected = CORPUS[i][4];
    var laneOut;
    var jsxOut;
    try {
      laneOut = laneFn.apply(null, [input].concat(args));
    } catch (e) {
      laneOut = void 0;
    }
    try {
      jsxOut = jsxFn.apply(null, [input].concat(args));
    } catch (e) {
      jsxOut = void 0;
    }
    var ok = false;
    if (laneOut !== void 0 && jsxOut !== void 0) {
      if (typeof laneOut === "string" && typeof jsxOut === "string") {
        ok = laneOut === jsxOut;
      } else if (typeof laneOut === "number" && typeof jsxOut === "number") {
        ok = laneOut === jsxOut;
      } else if (typeof laneOut === "boolean" && typeof jsxOut === "boolean") {
        ok = laneOut === jsxOut;
      } else if (laneOut.length !== void 0 && jsxOut.length !== void 0) {
        ok = arraysEqual(laneOut, jsxOut);
      }
    }
    if (ok) {
      certified++;
    } else {
      failures[failures.length] = name + ': corpus case "' + String(expected) + '" -> native ' + String(laneOut) + " jsx " + String(jsxOut);
      lanes2[name] = null;
    }
  }
  var names = ["sort", "reverse", "join", "indexOf", "lastIndexOf", "includes"];
  var n2 = 0;
  for (n2 = 0; n2 < names.length; n2++) {
    if (lanes2[names[n2]] !== null && lanes2[names[n2]] !== void 0) {
      activeNames[activeNames.length] = names[n2];
    }
  }
  return { lanes: lanes2, activeNames, certified, failures };
}
function enableNativeGateState(options) {
  disableNativeGateState();
  var opts = options || {};
  var present = false;
  if (!opts.provideLib && !opts.lib) {
    try {
      present = typeof ExternalObject !== "undefined" && ExternalObject !== null;
    } catch (e) {
      present = false;
    }
  } else {
    present = true;
  }
  state.present = present;
  if (!present) {
    state.reason = "ExternalObject not available in this engine";
    return snapshot();
  }
  var lib = null;
  if (opts.lib) {
    lib = opts.lib;
    state.dll = opts.dllPath || "external";
  } else if (opts.provideLib) {
    try {
      lib = opts.provideLib();
    } catch (e) {
      lib = null;
    }
  } else {
    try {
      var dir = opts.dir || "";
      if (dir.length > 0) {
        ExternalObject.searchFolders = dir + ";" + (ExternalObject.searchFolders || "");
      }
      var libName = opts.libName || "ESARRArray";
      lib = new ExternalObject("lib:" + libName);
      state.dll = libName;
    } catch (e) {
      lib = null;
      state.dll = opts.libName || "ESARRArray";
    }
  }
  if (!lib) {
    state.reason = "ESARRArray DLL failed to load (is it built? native/bin/ESARRArray.dll)";
    return snapshot();
  }
  state.lib = lib;
  var ver = -1;
  var ping = -1;
  var expectedPing = opts.ping === void 0 ? 42 : opts.ping;
  try {
    ver = Number(lib.version(0));
    ping = Number(lib.ping(0));
  } catch (e) {
    state.reason = "smoke failed: " + String(e);
    return teardown();
  }
  if (ping !== expectedPing) {
    state.reason = "smoke failed: ping returned " + String(ping) + " (wrong DLL?)";
    return teardown();
  }
  state.dllVersion = ver;
  var cert = certifyLanes(lib);
  if (cert.activeNames.length === 0) {
    state.reason = "no lane certified against the JSX authority (" + cert.failures.length + " failures): " + (cert.failures.length > 0 ? cert.failures[0] : "empty corpus");
    return teardown();
  }
  state.lanes = cert.lanes;
  state.activeNames = cert.activeNames;
  state.certified = cert.certified;
  state.active = true;
  state.reason = "";
  return snapshot();
}
function disableNativeGateState() {
  if (state.lib) {
    try {
      state.lib.unload();
    } catch (e) {
    }
  }
  state.lib = null;
  state.lanes = null;
  state.activeNames = [];
  state.active = false;
  state.reason = "";
  state.dll = "";
  state.dllVersion = 0;
  state.certified = 0;
}
function teardown() {
  try {
    if (state.lib && typeof state.lib.unload === "function") state.lib.unload();
  } catch (e) {
  }
  state.lib = null;
  state.lanes = null;
  state.activeNames = [];
  state.certified = 0;
  return snapshot();
}
function nativeLanes() {
  return state.active ? state.lanes : null;
}
function nativeGateSnapshot() {
  return snapshot();
}
function snapshot() {
  var present = state.present;
  if (!present) {
    try {
      present = typeof ExternalObject !== "undefined" && ExternalObject !== null;
    } catch (e) {
      present = false;
    }
  }
  return {
    present,
    enabled: state.active,
    reason: state.reason,
    dll: state.dll,
    dllVersion: state.dllVersion,
    lanes: state.activeNames.slice(0),
    certified: state.certified
  };
}

// src/native-dispatch.ts
function lanes() {
  try {
    return nativeLanes();
  } catch (e) {
    return null;
  }
}
function sort2(array, comparefn) {
  if (comparefn === void 0) {
    var l = lanes();
    if (l && l.sort) {
      try {
        var r = l.sort(array);
        if (r !== void 0) {
          return r;
        }
      } catch (e) {
      }
    }
  }
  return sort(array, comparefn);
}
function reverse2(array) {
  var l = lanes();
  if (l && l.reverse) {
    try {
      var r = l.reverse(array);
      if (r !== void 0) {
        return r;
      }
    } catch (e) {
    }
  }
  return reverse(array);
}
function join2(array, separator) {
  var l = lanes();
  if (l && l.join) {
    try {
      var r = l.join(array, separator);
      if (r !== void 0) {
        return r;
      }
    } catch (e) {
    }
  }
  return join(array, separator);
}
function indexOf2(array, searchElement, fromIndex) {
  var l = lanes();
  if (l && l.indexOf) {
    try {
      var r = l.indexOf(array, searchElement, fromIndex);
      if (r !== void 0) {
        return r;
      }
    } catch (e) {
    }
  }
  return indexOf(array, searchElement, fromIndex);
}
function lastIndexOf2(array, searchElement, fromIndex) {
  var laneFrom = arguments.length > 2 && fromIndex === void 0 ? 0 : fromIndex;
  var l = lanes();
  if (l && l.lastIndexOf) {
    try {
      var r = l.lastIndexOf(array, searchElement, laneFrom);
      if (r !== void 0) {
        return r;
      }
    } catch (e) {
    }
  }
  if (arguments.length > 2) {
    return lastIndexOf(array, searchElement, fromIndex);
  }
  return lastIndexOf(array, searchElement);
}
function includes2(array, searchElement, fromIndex) {
  var l = lanes();
  if (l && l.includes) {
    try {
      var r = l.includes(array, searchElement, fromIndex);
      if (r !== void 0) {
        return r;
      }
    } catch (e) {
    }
  }
  return includes(array, searchElement, fromIndex);
}

// src/index.ts
function globalObject() {
  if (typeof $ !== "undefined" && $.global) {
    try {
      return $.global;
    } catch (e) {
    }
  }
  try {
    return Function("return this")();
  } catch (e2) {
    return null;
  }
}
var PROTOTYPE_NAMES = [
  "slice",
  "concat",
  "join",
  "push",
  "pop",
  "shift",
  "unshift",
  "splice",
  "sort",
  "reverse",
  "toString",
  "forEach",
  "map",
  "filter",
  "every",
  "some",
  "indexOf",
  "lastIndexOf",
  "reduce",
  "reduceRight",
  "find",
  "findIndex",
  "includes",
  "at",
  "copyWithin",
  "fill",
  "flat",
  "flatMap",
  "keys",
  "values",
  "entries",
  "toSorted",
  "toReversed",
  "with",
  "findLast",
  "findLastIndex"
];
var STATIC_NAMES = ["isArray", "from", "of"];
function makePrototypeWrapper(name, fn) {
  if (name === "reduce" || name === "reduceRight") {
    return function(callback, initialValue) {
      if (arguments.length > 1) {
        return fn(this, callback, initialValue);
      }
      return fn(this, callback);
    };
  }
  if (name === "lastIndexOf") {
    return function(searchElement, fromIndex) {
      if (arguments.length > 1) {
        return fn(this, searchElement, fromIndex);
      }
      return fn(this, searchElement);
    };
  }
  if (name === "concat" || name === "push" || name === "unshift" || name === "splice") {
    return function() {
      var args = [this];
      var i = 0;
      for (i = 0; i < arguments.length; i++) {
        args[args.length] = arguments[i];
      }
      return fn.apply(null, args);
    };
  }
  return function(a, b, c) {
    return fn(this, a, b, c);
  };
}
function capabilities(scope) {
  var g = scope || globalObject();
  var nativeList = [];
  var missing = [];
  var i = 0;
  var proto = g && g.Array && g.Array.prototype ? g.Array.prototype : null;
  for (i = 0; i < PROTOTYPE_NAMES.length; i++) {
    if (proto && typeof proto[PROTOTYPE_NAMES[i]] === "function") {
      nativeList[nativeList.length] = PROTOTYPE_NAMES[i];
    } else {
      missing[missing.length] = PROTOTYPE_NAMES[i];
    }
  }
  for (i = 0; i < STATIC_NAMES.length; i++) {
    if (g && g.Array && typeof g.Array[STATIC_NAMES[i]] === "function") {
      nativeList[nativeList.length] = STATIC_NAMES[i];
    } else {
      missing[missing.length] = STATIC_NAMES[i];
    }
  }
  var engine = "";
  try {
    if (typeof $ !== "undefined" && $.version) {
      engine = String($.version);
    }
  } catch (e) {
  }
  return { engine, nativeList, missing, native: nativeGateSnapshot() };
}
function install(options) {
  var g = globalObject();
  var force = !!(options && options.forceReplace);
  var before = capabilities(g);
  var i = 0;
  if (g && g.Array && g.Array.prototype) {
    var p = g.Array.prototype;
    for (i = 0; i < PROTOTYPE_NAMES.length; i++) {
      var name = PROTOTYPE_NAMES[i];
      if (force || typeof p[name] !== "function") {
        try {
          p[name] = makePrototypeWrapper(name, wrapperOf(name));
        } catch (e) {
        }
      }
    }
    for (i = 0; i < STATIC_NAMES.length; i++) {
      var sname = STATIC_NAMES[i];
      if (force || typeof g.Array[sname] !== "function") {
        try {
          g.Array[sname] = staticOf(sname);
        } catch (e) {
        }
      }
    }
  }
  return before;
}
function wrapperOf(name) {
  switch (name) {
    case "forEach":
      return forEach;
    case "map":
      return map;
    case "filter":
      return filter;
    case "every":
      return every;
    case "some":
      return some;
    case "indexOf":
      return indexOf2;
    case "lastIndexOf":
      return lastIndexOf2;
    case "reduce":
      return reduce;
    case "reduceRight":
      return reduceRight;
    case "slice":
      return slice;
    case "concat":
      return concat;
    case "join":
      return join2;
    case "push":
      return push;
    case "pop":
      return pop;
    case "shift":
      return shift;
    case "unshift":
      return unshift;
    case "splice":
      return splice;
    case "sort":
      return sort2;
    case "reverse":
      return reverse2;
    case "toString":
      return toString;
    case "find":
      return find;
    case "findIndex":
      return findIndex;
    case "findLast":
      return findLast;
    case "findLastIndex":
      return findLastIndex;
    case "includes":
      return includes2;
    case "at":
      return at;
    case "copyWithin":
      return copyWithin;
    case "fill":
      return fill;
    case "flat":
      return flat;
    case "flatMap":
      return flatMap;
    case "keys":
      return keys;
    case "values":
      return values;
    case "entries":
      return entries;
    case "toSorted":
      return toSorted;
    case "toReversed":
      return toReversed;
    case "with":
      return withMethod;
    default:
      return forEach;
  }
}
function staticOf(name) {
  if (name === "isArray") {
    return isArray;
  }
  if (name === "from") {
    return function(items, mapFn, thisArg) {
      return from(items, mapFn, thisArg, this);
    };
  }
  return of;
}
function enableNativeGate(options) {
  return enableNativeGateState(options);
}
function disableNativeGate() {
  disableNativeGateState();
  return nativeGateSnapshot();
}
function nativeGateState() {
  return nativeGateSnapshot();
}
function timeLane(fn, iterations) {
  var samples = [];
  var i = 0;
  var d = 0;
  for (i = 0; i < iterations; i++) {
    $.hiresTimer;
    fn();
    d = $.hiresTimer;
    if (d > 0 && d < 1e7) {
      samples[samples.length] = d;
    }
  }
  return samples;
}
function item(laneName, n, iterations, samples) {
  var sorted = samples.slice(0);
  sorted.sort(function(a, b) {
    return a - b;
  });
  var medianUs = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  return {
    lane: laneName,
    n,
    iterations,
    medianUs,
    minUs: sorted.length ? sorted[0] : 0,
    p95Us: sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : 0,
    elemUs: n > 0 ? medianUs / n : 0
  };
}
function benchmark(n, iterations) {
  var size = n || 2e3;
  var it = iterations || 5;
  var arr = [];
  var i = 0;
  for (i = 0; i < size; i++) {
    arr[arr.length] = i;
  }
  var out = [];
  out[out.length] = item("forEach", size, it, timeLane(function() {
    forEach(arr, function(v) {
      return v;
    });
  }, it));
  out[out.length] = item("map", size, it, timeLane(function() {
    map(arr, function(v) {
      return v + 1;
    });
  }, it));
  out[out.length] = item("filter", size, it, timeLane(function() {
    filter(arr, function(v) {
      return v % 2 === 0;
    });
  }, it));
  out[out.length] = item("find", size, it, timeLane(function() {
    find(arr, function(v) {
      return v === size - 1;
    });
  }, it));
  out[out.length] = item("indexOf-hit-last", size, it, timeLane(function() {
    indexOf2(arr, size - 1, void 0);
  }, it));
  out[out.length] = item("lastIndexOf", size, it, timeLane(function() {
    lastIndexOf2(arr, 0, void 0);
  }, it));
  out[out.length] = item("reduce", size, it, timeLane(function() {
    reduce(arr, function(a, b) {
      return a + b;
    }, 0);
  }, it));
  out[out.length] = item("includes-hit-last", size, it, timeLane(function() {
    includes2(arr, size - 1, void 0);
  }, it));
  out[out.length] = item("sort", size, it, timeLane(function() {
    sort2(arr.slice(0));
  }, it));
  out[out.length] = item("join", size, it, timeLane(function() {
    join2(arr, ",");
  }, it));
  out[out.length] = item("slice", size, it, timeLane(function() {
    slice(arr, 0, size);
  }, it));
  out[out.length] = item("reverse-copy", size, it, timeLane(function() {
    reverse2(arr.slice(0));
  }, it));
  return out;
}

// tests/core-adapter.ts
function mergeModules(mods, overrides) {
  var out = {};
  var m = 0;
  var k;
  for (m = 0; m < mods.length; m++) {
    for (k in mods[m]) {
      if (Object.prototype.hasOwnProperty.call(mods[m], k)) {
        if (typeof mods[m][k] === "function") {
          out[k] = mods[m][k];
        }
      }
    }
  }
  for (k in overrides) {
    if (Object.prototype.hasOwnProperty.call(overrides, k)) {
      out[k] = overrides[k];
    }
  }
  return out;
}
var PURE = mergeModules([src_exports, array_es3_exports, array_es6_exports], { with: withMethod });
var DISPATCH = mergeModules([src_exports, array_es3_exports, array_es6_exports, native_dispatch_exports], { with: withMethod });

// tests/surface.ts
var ES3_METHODS = [
  "concat",
  "join",
  "pop",
  "push",
  "reverse",
  "shift",
  "slice",
  "sort",
  "splice",
  "unshift",
  "toString"
];
var ES5_METHODS = [
  "every",
  "filter",
  "forEach",
  "indexOf",
  "isArray",
  "lastIndexOf",
  "map",
  "reduce",
  "reduceRight",
  "some"
];
var ES6PLUS_METHODS = [
  "at",
  "copyWithin",
  "entries",
  "fill",
  "find",
  "findIndex",
  "findLast",
  "findLastIndex",
  "flat",
  "flatMap",
  "from",
  "includes",
  "keys",
  "of",
  "toReversed",
  "toSorted",
  "values",
  "with"
];
var ALL_METHODS = ES3_METHODS.concat(ES5_METHODS).concat(ES6PLUS_METHODS);
var METHOD_SET = {};
(function() {
  var i = 0;
  for (i = 0; i < ES3_METHODS.length; i++) {
    METHOD_SET[ES3_METHODS[i]] = "es3";
  }
  for (i = 0; i < ES5_METHODS.length; i++) {
    METHOD_SET[ES5_METHODS[i]] = "es5";
  }
  for (i = 0; i < ES6PLUS_METHODS.length; i++) {
    METHOD_SET[ES6PLUS_METHODS[i]] = "es6plus";
  }
})();

// tests/opgen.ts
var MUTATING_OPS = [
  "sort",
  "reverse",
  "splice",
  "push",
  "pop",
  "shift",
  "unshift",
  "fill",
  "copyWithin"
];
function isMutating(op) {
  return MUTATING_OPS.indexOf(op) >= 0;
}

// tests/callbacks.ts
function rebuildInput(p) {
  switch (p.t) {
    case "array":
      return p.dense.slice(0);
    case "string":
      return p.s;
    case "null":
      return null;
    case "like": {
      var o = { length: p.len };
      for (var k in p.set) {
        if (Object.prototype.hasOwnProperty.call(p.set, k)) {
          o[k] = p.set[k];
        }
      }
      return o;
    }
    case "sparse": {
      var a = [];
      a.length = p.len;
      for (var j in p.set) {
        if (Object.prototype.hasOwnProperty.call(p.set, j)) {
          a[Number(j)] = p.set[j];
        }
      }
      return a;
    }
    default:
      throw new Error("rebuildInput: unknown protocol " + p.t);
  }
}
function isArrayProtocol(p) {
  return p && typeof p === "object" && typeof p.t === "string";
}
function makeCallback(mode, arg, state2) {
  switch (mode) {
    // ---- existing ES5 modes ----
    case "sum":
      return function(v) {
        return v;
      };
    case "prod":
      return function(v) {
        return v;
      };
    case "concat":
      return function(v) {
        return v;
      };
    case "count":
      return function(v) {
        return v;
      };
    case "concatIdx":
      return function(v) {
        return v;
      };
    case "thisTag":
      return function(v) {
        return v;
      };
    case "double":
      return function(v) {
        return v * 2;
      };
    case "doubleSkipUndef":
      return function(v) {
        return v === void 0 ? void 0 : v * 2;
      };
    case "bang":
      return function(v) {
        return v + "!";
      };
    case "idx":
      return function(v) {
        return v;
      };
    case "plus1":
      return function(v) {
        return v + 1;
      };
    case "thisTagMap":
      return function(v) {
        return v;
      };
    case "even":
      return function(v) {
        return v % 2 === 0;
      };
    case "truthy":
      return function(v) {
        return !!v;
      };
    case "gt15":
      return function(v) {
        return v > 15;
      };
    case "gt0":
      return function(v) {
        return v > 0;
      };
    case "failAt3":
      return function(v) {
        return v > 0 && state2 && state2.count !== 3;
      };
    case "eq":
      return function(v) {
        return v === arg;
      };
    case "number":
      return arg;
    // non-callable placeholder
    // ---- full-surface random modes (differential + fuzz) ----
    case "dCb":
      return function(v, i) {
        return typeof v === "number" ? v + i : String(v) + "|" + i;
      };
    case "dPred":
      return function(v) {
        return typeof v === "number" ? v % 3 === 0 : !!v;
      };
    case "dRed":
      return function(a, b, i) {
        return String(a) + "~" + String(b) + "@" + i;
      };
    case "dCmp":
      return function(a, b) {
        if (typeof a === "number" && typeof b === "number") {
          return a - b;
        }
        var sa = String(a), sb = String(b);
        return sa < sb ? -1 : sa > sb ? 1 : 0;
      };
    case "cmpByK":
      return function(a, b) {
        return a.k - b.k;
      };
    case "dFromMap":
      return function(v, i) {
        return typeof v === "number" ? v * 2 + i : String(v) + i;
      };
    // this-binding probe: 'T' iff `this` is the supplied thisArg. arg = T.
    case "thisDiff":
      return function(v, i) {
        return this === arg ? "T" : "U";
      };
    // ---- fixed-vector modes for the new methods ----
    case "firstEven":
      return function(v) {
        return typeof v === "number" && v % 2 === 0;
      };
    case "big5":
      return function(v) {
        return typeof v === "number" && v > 5;
      };
    case "flatDup":
      return function(v, i) {
        return typeof v === "number" ? [v, v * 10] : [String(v) + i];
      };
    case "flatStr":
      return function(v, i) {
        return [String(v), i];
      };
    case "strIdx":
      return function(v, i) {
        return String(v) + "#" + i;
      };
    default:
      throw new Error("makeCallback: unknown mode " + mode);
  }
}
function snapshot2(v) {
  if (v === null || v === void 0 || typeof v !== "object") {
    return v;
  }
  if (Object.prototype.toString.call(v) === "[object Array]") {
    var len = v.length >>> 0;
    var out = [];
    out.length = len;
    var i = 0;
    for (i = 0; i < len; i++) {
      if (i in v) {
        out[i] = v[i];
      }
    }
    return out;
  }
  var o = {};
  var k;
  for (k in v) {
    if (Object.prototype.hasOwnProperty.call(v, k)) {
      o[k] = v[k];
    }
  }
  return o;
}
function isArrayTag(v) {
  return Object.prototype.toString.call(v) === "[object Array]";
}
function deepStrictEquals(a, b) {
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") {
    if (a !== a && b !== b) {
      return true;
    }
    if (a === 0 && b === 0) {
      return 1 / a === 1 / b;
    }
    return a === b;
  }
  if (isArrayTag(a) !== isArrayTag(b)) {
    return false;
  }
  if (isArrayTag(a)) {
    var la = a.length >>> 0, lb = b.length >>> 0;
    if (la !== lb) {
      return false;
    }
    for (var i = 0; i < la; i++) {
      var ha = i in a, hb = i in b;
      if (ha !== hb) {
        return false;
      }
      if (ha && !deepStrictEquals(a[i], b[i])) {
        return false;
      }
    }
    return true;
  }
  var ka = [], kb = [], k;
  for (k in a) {
    if (Object.prototype.hasOwnProperty.call(a, k)) {
      ka[ka.length] = k;
    }
  }
  for (k in b) {
    if (Object.prototype.hasOwnProperty.call(b, k)) {
      kb[kb.length] = k;
    }
  }
  if (ka.length !== kb.length) {
    return false;
  }
  for (var j = 0; j < ka.length; j++) {
    if (kb.indexOf(ka[j]) < 0) {
      return false;
    }
    if (!deepStrictEquals(a[ka[j]], b[ka[j]])) {
      return false;
    }
  }
  return true;
}
function collectIter(iter) {
  var out = [];
  for (; ; ) {
    var r = iter.next();
    if (r.done) {
      return out;
    }
    out[out.length] = r.value;
  }
}
function nameOf(e) {
  if (e instanceof TypeError) {
    return "TypeError";
  }
  var s = String(e && e.name ? e.name : e);
  if (s.indexOf("TypeError") >= 0) {
    return "TypeError";
  }
  return s;
}
function wrapForTrace(cb, mode, T, state2) {
  return function(v, i, arr) {
    state2.count++;
    state2.lastIdx = i;
    if (mode === "sum") {
      if (typeof v === "number") {
        state2.sum += v;
      }
      state2.out = state2.sum;
    } else if (mode === "count") {
      state2.out = state2.count;
    } else if (mode === "concatIdx") {
      state2.out = (state2.out || "") + v + (i + 1);
    } else if (mode === "thisTag") {
      var bound = T && typeof T === "object" && T.tag === "T";
      state2.out = (bound ? "T" : "U") + "@" + i;
    } else {
      state2.trace[state2.trace.length] = cb(v, i, arr);
    }
  };
}
function wrapForMap(cb, mode, T, state2) {
  return function(v, i, arr) {
    state2.count++;
    state2.lastIdx = i;
    var bound = T && typeof T === "object" && T.tag === "T";
    if (mode === "idx") {
      return v + (i + 1);
    }
    if (mode === "thisTagMap") {
      return (bound ? "T" : "U") + v + i;
    }
    if (mode === "failAt3") {
      return v > 0 && state2.count !== 3;
    }
    return cb(v, i, arr);
  };
}
function wrapReduce(cb, mode, state2) {
  return function(a, b, i, arr) {
    state2.count++;
    state2.lastIdx = i;
    if (mode === "sum") {
      return a + b;
    }
    if (mode === "prod") {
      return a * b;
    }
    if (mode === "concat") {
      return a + b;
    }
    return cb(a, b, i, arr);
  };
}
function makeState() {
  return { count: 0, lastIdx: -1, trace: [], sum: 0, out: null };
}
function needsCb(op, cbMode) {
  switch (op) {
    case "forEach":
    case "map":
    case "filter":
    case "every":
    case "some":
    case "find":
    case "findIndex":
    case "findLast":
    case "findLastIndex":
    case "flatMap":
    case "reduce":
    case "reduceRight":
      return true;
    case "sort":
    case "toSorted":
      return cbMode === "dCmp" || cbMode === "cmpByK";
    case "from":
      return cbMode === "dFromMap" || cbMode === "strIdx";
    default:
      return false;
  }
}
function thisArgOf(vec) {
  var op = vec.op;
  if (op === "forEach" || op === "map" || op === "filter" || op === "every" || op === "some" || op === "find" || op === "findIndex" || op === "findLast" || op === "findLastIndex" || op === "flatMap" || op === "from") {
    return vec.args.length > 0 ? vec.args[0] : void 0;
  }
  return void 0;
}
function buildCb(vec, state2) {
  var arg0 = vec.args.length > 0 ? vec.args[0] : void 0;
  if (!needsCb(vec.op, vec.cbMode)) {
    return null;
  }
  if (vec.cbMode === "number") {
    return 5;
  }
  return makeCallback(vec.cbMode, arg0, state2);
}
function callCore(core, vec, input, cb, T) {
  var op = vec.op;
  var args = vec.args;
  var mode = vec.cbMode;
  var state2 = makeState();
  var i = 0;
  switch (op) {
    // ---- ES3 ----
    case "concat": {
      var ca = [input];
      for (i = 0; i < args.length; i++) {
        ca[ca.length] = args[i];
      }
      return core.concat.apply(null, ca);
    }
    case "join":
      return core.join(input, args.length > 0 ? args[0] : void 0);
    case "pop":
      return core.pop(input);
    case "push": {
      var pa = [input];
      for (i = 0; i < args.length; i++) {
        pa[pa.length] = args[i];
      }
      return core.push.apply(null, pa);
    }
    case "reverse":
      return core.reverse(input);
    case "shift":
      return core.shift(input);
    case "slice":
      return core.slice(input, args.length > 0 ? args[0] : void 0, args.length > 1 ? args[1] : void 0);
    case "sort":
      return core.sort(input, cb === null ? void 0 : cb);
    case "splice": {
      var sp = [input, args[0]];
      if (args.length > 1) {
        sp[sp.length] = args[1];
      }
      for (i = 2; i < args.length; i++) {
        sp[sp.length] = args[i];
      }
      return core.splice.apply(null, sp);
    }
    case "unshift": {
      var ua = [input];
      for (i = 0; i < args.length; i++) {
        ua[ua.length] = args[i];
      }
      return core.unshift.apply(null, ua);
    }
    case "toString":
      return core.toString(input);
    // ---- ES5 ----
    case "forEach":
      core.forEach(input, wrapForTrace(cb, mode, T, state2), T);
      return state2.out !== null ? state2.out : state2.trace;
    case "map":
      return core.map(input, wrapForMap(cb, mode, T, state2), T);
    case "filter":
      return core.filter(input, wrapForMap(cb, mode, T, state2), T);
    case "every":
      return core.every(input, wrapForMap(cb, mode, T, state2), T);
    case "some":
      return core.some(input, wrapForMap(cb, mode, T, state2), T);
    case "indexOf":
      return core.indexOf(input, args.length > 0 ? args[0] : void 0, args.length > 1 ? args[1] : void 0);
    case "lastIndexOf":
      if (args.length > 1) {
        return core.lastIndexOf(input, args[0], args[1]);
      }
      return core.lastIndexOf(input, args[0]);
    case "reduce":
      if (args.length > 0) {
        return core.reduce(input, wrapReduce(cb, mode, state2), args[0]);
      }
      return core.reduce(input, wrapReduce(cb, mode, state2));
    case "reduceRight":
      if (args.length > 0) {
        return core.reduceRight(input, wrapReduce(cb, mode, state2), args[0]);
      }
      return core.reduceRight(input, wrapReduce(cb, mode, state2));
    case "isArray":
      return core.isArray(args.length > 0 ? args[0] : input);
    // ---- ES6+ ----
    case "copyWithin":
      if (args.length > 2) {
        return core.copyWithin(input, args[0], args[1], args[2]);
      }
      if (args.length > 1) {
        return core.copyWithin(input, args[0], args[1]);
      }
      return core.copyWithin(input, args[0]);
    case "fill":
      if (args.length > 2) {
        return core.fill(input, args[0], args[1], args[2]);
      }
      if (args.length > 1) {
        return core.fill(input, args[0], args[1]);
      }
      return core.fill(input, args[0]);
    case "find":
      return core.find(input, wrapForMap(cb, mode, T, state2), T);
    case "findIndex":
      return core.findIndex(input, wrapForMap(cb, mode, T, state2), T);
    case "findLast":
      return core.findLast(input, wrapForMap(cb, mode, T, state2), T);
    case "findLastIndex":
      return core.findLastIndex(input, wrapForMap(cb, mode, T, state2), T);
    case "flat":
      return args.length > 0 ? core.flat(input, args[0]) : core.flat(input);
    case "flatMap":
      return core.flatMap(input, wrapForMap(cb, mode, T, state2), T);
    case "at":
      return core.at(input, args.length > 0 ? args[0] : void 0);
    case "toReversed":
      return core.toReversed(input);
    case "toSorted":
      return core.toSorted(input, cb === null ? void 0 : cb);
    case "with":
      return core.with(input, args.length > 0 ? args[0] : void 0, args.length > 1 ? args[1] : void 0);
    case "includes":
      return core.includes(input, args.length > 0 ? args[0] : void 0, args.length > 1 ? args[1] : void 0);
    case "entries":
      return collectIter(core.entries(input));
    case "keys":
      return collectIter(core.keys(input));
    case "values":
      return collectIter(core.values(input));
    case "from": {
      var fa = [input];
      if (cb !== null) {
        fa[fa.length] = cb;
      }
      if (args.length > 0) {
        fa[fa.length] = args[0];
      }
      return core.from.apply(null, fa);
    }
    case "of":
      return core.of.apply(null, args);
    default:
      throw new Error("callCore: unknown op " + op);
  }
}
function toInput(p, mutating) {
  var raw = isArrayProtocol(p) ? rebuildInput(p) : p;
  if (!mutating) {
    return raw;
  }
  if (raw === null || raw === void 0 || typeof raw !== "object") {
    return raw;
  }
  if (Object.prototype.toString.call(raw) === "[object Array]") {
    var len = raw.length >>> 0;
    var out = [];
    out.length = len;
    for (var i = 0; i < len; i++) {
      if (i in raw) {
        out[i] = raw[i];
      }
    }
    return out;
  }
  var o = {};
  var k;
  for (k in raw) {
    if (Object.prototype.hasOwnProperty.call(raw, k)) {
      o[k] = raw[k];
    }
  }
  return o;
}
function runVector(vec, core) {
  var input = toInput(vec.input, isMutating(vec.op));
  var op = vec.op;
  var T = thisArgOf(vec);
  var state2 = makeState();
  var cb = buildCb(vec, state2);
  if (vec.cbMode === "number") {
    try {
      switch (op) {
        case "forEach":
          core.forEach(input, 5, T);
          break;
        case "map":
          core.map(input, 5, T);
          break;
        case "filter":
          core.filter(input, 5, T);
          break;
        case "every":
          core.every(input, 5, T);
          break;
        case "some":
          core.some(input, 5, T);
          break;
        case "find":
          core.find(input, 5, T);
          break;
        case "findIndex":
          core.findIndex(input, 5, T);
          break;
        case "flatMap":
          core.flatMap(input, 5, T);
          break;
        case "sort":
          core.sort(input, 5);
          break;
        case "reduce":
          core.reduce(input, 5);
          break;
        case "reduceRight":
          core.reduceRight(input, 5);
          break;
        case "from":
          core.from(input, 5, T);
          break;
        default:
          break;
      }
      return { ok: false, result: "NO THROW" };
    } catch (e) {
      return { ok: true, result: nameOf(e) };
    }
  }
  if (vec.expectError) {
    try {
      callCore(core, vec, input, cb, T);
      return { ok: false, result: "NO THROW" };
    } catch (e) {
      return { ok: true, result: nameOf(e) };
    }
  }
  try {
    var out = callCore(core, vec, input, cb, T);
    if (isMutating(op)) {
      return { ok: true, result: out, state: snapshot2(input) };
    }
    return { ok: true, result: out };
  } catch (e) {
    return { ok: false, result: nameOf(e) };
  }
}
function callNative(NATIVE2, vec, input, cb, T) {
  var op = vec.op;
  var args = vec.args;
  var mode = vec.cbMode;
  var state2 = makeState();
  var i = 0;
  switch (op) {
    // ---- ES3 ----
    case "concat":
      return NATIVE2.concat.apply(input, args);
    case "join":
      return NATIVE2.join.call(input, args.length > 0 ? args[0] : void 0);
    case "pop":
      return NATIVE2.pop.call(input);
    case "push":
      return NATIVE2.push.apply(input, args);
    case "reverse":
      return NATIVE2.reverse.call(input);
    case "shift":
      return NATIVE2.shift.call(input);
    case "slice":
      return NATIVE2.slice.call(input, args.length > 0 ? args[0] : void 0, args.length > 1 ? args[1] : void 0);
    case "sort":
      return NATIVE2.sort.call(input, cb === null ? void 0 : cb);
    case "splice":
      return NATIVE2.splice.apply(input, args);
    case "unshift":
      return NATIVE2.unshift.apply(input, args);
    case "toString":
      return NATIVE2.toString.call(input);
    // ---- ES5 ----
    case "forEach":
      NATIVE2.forEach.call(input, wrapForTrace(cb, mode, T, state2), T);
      return state2.out !== null ? state2.out : state2.trace;
    case "map":
      return NATIVE2.map.call(input, wrapForMap(cb, mode, T, state2), T);
    case "filter":
      return NATIVE2.filter.call(input, wrapForMap(cb, mode, T, state2), T);
    case "every":
      return NATIVE2.every.call(input, wrapForMap(cb, mode, T, state2), T);
    case "some":
      return NATIVE2.some.call(input, wrapForMap(cb, mode, T, state2), T);
    case "indexOf":
      return NATIVE2.indexOf.call(input, args.length > 0 ? args[0] : void 0, args.length > 1 ? args[1] : void 0);
    case "lastIndexOf":
      if (args.length > 1) {
        return NATIVE2.lastIndexOf.call(input, args[0], args[1]);
      }
      return NATIVE2.lastIndexOf.call(input, args[0]);
    case "reduce":
      if (args.length > 0) {
        return NATIVE2.reduce.call(input, wrapReduce(cb, mode, state2), args[0]);
      }
      return NATIVE2.reduce.call(input, wrapReduce(cb, mode, state2));
    case "reduceRight":
      if (args.length > 0) {
        return NATIVE2.reduceRight.call(input, wrapReduce(cb, mode, state2), args[0]);
      }
      return NATIVE2.reduceRight.call(input, wrapReduce(cb, mode, state2));
    case "isArray":
      return NATIVE2.isArray(args.length > 0 ? args[0] : input);
    // ---- ES6+ ----
    case "copyWithin":
      if (args.length > 2) {
        return NATIVE2.copyWithin.call(input, args[0], args[1], args[2]);
      }
      if (args.length > 1) {
        return NATIVE2.copyWithin.call(input, args[0], args[1]);
      }
      return NATIVE2.copyWithin.call(input, args[0]);
    case "fill":
      if (args.length > 2) {
        return NATIVE2.fill.call(input, args[0], args[1], args[2]);
      }
      if (args.length > 1) {
        return NATIVE2.fill.call(input, args[0], args[1]);
      }
      return NATIVE2.fill.call(input, args[0]);
    case "find":
      return NATIVE2.find.call(input, wrapForMap(cb, mode, T, state2), T);
    case "findIndex":
      return NATIVE2.findIndex.call(input, wrapForMap(cb, mode, T, state2), T);
    case "findLast":
      return NATIVE2.findLast.call(input, wrapForMap(cb, mode, T, state2), T);
    case "findLastIndex":
      return NATIVE2.findLastIndex.call(input, wrapForMap(cb, mode, T, state2), T);
    case "flat":
      return args.length > 0 ? NATIVE2.flat.call(input, args[0]) : NATIVE2.flat.call(input);
    case "flatMap":
      return NATIVE2.flatMap.call(input, wrapForMap(cb, mode, T, state2), T);
    case "at":
      return NATIVE2.at.call(input, args.length > 0 ? args[0] : void 0);
    case "toReversed":
      return NATIVE2.toReversed.call(input);
    case "toSorted":
      return NATIVE2.toSorted.call(input, cb === null ? void 0 : cb);
    case "with":
      return NATIVE2.with.call(input, args.length > 0 ? args[0] : void 0, args.length > 1 ? args[1] : void 0);
    case "includes":
      return NATIVE2.includes.call(input, args.length > 0 ? args[0] : void 0, args.length > 1 ? args[1] : void 0);
    case "entries":
      return collectIter(NATIVE2.entries.call(input));
    case "keys":
      return collectIter(NATIVE2.keys.call(input));
    case "values":
      return collectIter(NATIVE2.values.call(input));
    case "from": {
      var fa = [input];
      if (cb !== null) {
        fa[fa.length] = cb;
      }
      if (args.length > 0) {
        fa[fa.length] = args[0];
      }
      return Array.from.apply(null, fa);
    }
    case "of":
      return Array.of.apply(null, args);
    default:
      throw new Error("callNative: unknown op " + op);
  }
}
function runNativeVector(vec, NATIVE2) {
  var input = toInput(vec.input, isMutating(vec.op));
  var op = vec.op;
  var T = thisArgOf(vec);
  var state2 = makeState();
  var cb = buildCb(vec, state2);
  if (vec.cbMode === "number") {
    try {
      switch (op) {
        case "forEach":
          NATIVE2.forEach.call(input, 5, T);
          break;
        case "map":
          NATIVE2.map.call(input, 5, T);
          break;
        case "filter":
          NATIVE2.filter.call(input, 5, T);
          break;
        case "every":
          NATIVE2.every.call(input, 5, T);
          break;
        case "some":
          NATIVE2.some.call(input, 5, T);
          break;
        case "find":
          NATIVE2.find.call(input, 5, T);
          break;
        case "findIndex":
          NATIVE2.findIndex.call(input, 5, T);
          break;
        case "flatMap":
          NATIVE2.flatMap.call(input, 5, T);
          break;
        case "sort":
          NATIVE2.sort.call(input, 5);
          break;
        case "reduce":
          NATIVE2.reduce.call(input, 5);
          break;
        case "reduceRight":
          NATIVE2.reduceRight.call(input, 5);
          break;
        case "from":
          Array.from(input, 5, T);
          break;
        default:
          break;
      }
      return { ok: false, result: "NO THROW" };
    } catch (e) {
      return { ok: true, result: nameOf(e) };
    }
  }
  try {
    var outN = callNative(NATIVE2, vec, input, cb, T);
    if (isMutating(op)) {
      return { ok: true, result: outN, state: snapshot2(input) };
    }
    return { ok: true, result: outN };
  } catch (e) {
    return { ok: false, result: nameOf(e) };
  }
}

// tests/.probe-sort.ts
var NATIVE = { sort: Array.prototype.sort };
function probe(tag, input) {
  var vec = { op: "sort", cbMode: "", args: [], input };
  var ours = runVector(vec, PURE);
  var theirs = runNativeVector(vec, NATIVE);
  var eq = deepStrictEquals(ours.result, theirs.result) && deepStrictEquals(ours.state, theirs.state);
  console.log(tag + ": equal=" + eq);
  if (!eq) {
    var a = ours.result, b = theirs.result;
    for (var i = 0; i < Math.max(a.length, b.length); i++) {
      var ha = i in a, hb = i in b;
      if (ha !== hb) {
        console.log("  idx " + i + ": PRESENCE ours=" + ha + " native=" + hb);
      } else if (ha && !Object.is(a[i], b[i])) {
        console.log("  idx " + i + ": value ours=" + String(a[i]) + " (" + typeof a[i] + ") native=" + String(b[i]) + " (" + typeof b[i] + ") is-0 ours=" + Object.is(a[i], -0) + " native=" + Object.is(b[i], -0));
      }
    }
    console.log("  lengths ours=" + a.length + " native=" + b.length);
    console.log("  ours holes: " + (function() {
      var s = [];
      for (var j = 0; j < a.length; j++) {
        s.push(j in a ? a[j] === void 0 ? "undef" : String(a[j]) : "HOLE");
      }
      return s.join(",");
    })());
    console.log("  native holes: " + (function() {
      var s = [];
      for (var j = 0; j < b.length; j++) {
        s.push(j in b ? b[j] === void 0 ? "undef" : String(b[j]) : "HOLE");
      }
      return s.join(",");
    })());
  }
}
probe("dense nulls", { t: "array", dense: [null, null, null, null, "1", null, 5, null, null, 0.5] });
probe("sparse variant", { t: "sparse", len: 10, set: { "4": "1", "6": 5, "9": 0.5 } });
probe("NaN variant", { t: "array", dense: [NaN, NaN, NaN, NaN, "1", NaN, 5, NaN, NaN, 0.5] });
probe("undefined variant", { t: "array", dense: [void 0, void 0, void 0, void 0, "1", void 0, 5, void 0, void 0, 0.5] });
