if (typeof Function.prototype.bind !== "function") {
  Function.prototype.bind = function (thisArg) {
    var fn = this;
    var args = Array.prototype.slice.call(arguments, 1);
    return function () {
      return fn.apply(thisArg, args.concat(Array.prototype.slice.call(arguments)));
    };
  };
}

var ESARR = (function() {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = function(target, all) {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = function(to, from2, except, desc) {
    if (from2 && typeof from2 === "object" || typeof from2 === "function")
      for (var keys2 = __getOwnPropNames(from2), i = 0, n = keys2.length, key; i < n; i++) {
        key = keys2[i];
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: function(k) {
            return from2[k];
          }.bind(null, key), enumerable: !(desc = __getOwnPropDesc(from2, key)) || desc.enumerable });
      }
    return to;
  };
  var __toCommonJS = function(mod) {
    return __copyProps(__defProp({}, "__esModule", { value: true }), mod);
  };

  // src/index.ts
  var index_exports = {};
  __export(index_exports, {
    at: function() {
      return at;
    },
    bands: function() {
      return bands;
    },
    benchmark: function() {
      return benchmark;
    },
    capabilities: function() {
      return capabilities;
    },
    concat: function() {
      return concat;
    },
    copyWithin: function() {
      return copyWithin;
    },
    disableNativeGate: function() {
      return disableNativeGate;
    },
    enableNativeGate: function() {
      return enableNativeGate;
    },
    entries: function() {
      return entries;
    },
    every: function() {
      return every;
    },
    fill: function() {
      return fill;
    },
    filter: function() {
      return filter;
    },
    find: function() {
      return find;
    },
    findIndex: function() {
      return findIndex;
    },
    findLast: function() {
      return findLast;
    },
    findLastIndex: function() {
      return findLastIndex;
    },
    flat: function() {
      return flat;
    },
    flatMap: function() {
      return flatMap;
    },
    forEach: function() {
      return forEach;
    },
    from: function() {
      return from;
    },
    includes: function() {
      return includes;
    },
    indexOf: function() {
      return indexOf2;
    },
    install: function() {
      return install;
    },
    isArray: function() {
      return isArray;
    },
    join: function() {
      return join2;
    },
    keys: function() {
      return keys;
    },
    lastIndexOf: function() {
      return lastIndexOf2;
    },
    map: function() {
      return map;
    },
    nativeGateState: function() {
      return nativeGateState;
    },
    of: function() {
      return of;
    },
    pop: function() {
      return pop;
    },
    push: function() {
      return push;
    },
    reduce: function() {
      return reduce;
    },
    reduceRight: function() {
      return reduceRight;
    },
    reverse: function() {
      return reverse2;
    },
    setBands: function() {
      return setBands;
    },
    shift: function() {
      return shift;
    },
    slice: function() {
      return slice;
    },
    some: function() {
      return some;
    },
    sort: function() {
      return sort2;
    },
    splice: function() {
      return splice;
    },
    toReversed: function() {
      return toReversed2;
    },
    toSorted: function() {
      return toSorted2;
    },
    toString: function() {
      return toString;
    },
    unshift: function() {
      return unshift;
    },
    values: function() {
      return values;
    },
    "with": function() {
      return withMethod;
    }
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
    if (arguments.length <= 2) {
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
    if (len <= 1) {
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
      if (items[j].present) {
        O[j] = items[j].value;
      } else {
        delete O[j];
      }
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
      if (v === searchElement) {
        return true;
      }
      if (v !== v && searchElement !== searchElement) {
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

  // src/lane-wire.ts
  function unpackInt32At(s, i) {
    var v = s.charCodeAt(i) - 1 << 24 | s.charCodeAt(i + 1) - 1 << 16 | s.charCodeAt(i + 2) - 1 << 8 | s.charCodeAt(i + 3) - 1;
    return v | 0;
  }

  // src/native-lane.ts
  function isLaneInt(v) {
    return typeof v === "number" && v === v && Math.floor(v) === v && v >= -2147483648 && v <= 2147483647;
  }
  var DEFAULT_BANDS = {
    sort: [1, 0],
    // disengaged: engine builtin wins at all measured n
    toSorted: [1, 48e3],
    // engaged: no builtin exists; native ~19x vs JSX
    reverse: [1, 0],
    // disengaged: engine reverse is linear-cheap
    toReversed: [1, 48e3],
    // engaged: no builtin exists; native ~19x vs JSX
    join: [1, 0]
    // disengaged: engine join wins at all measured n
  };
  var WEDGE_CAP = 48e3;
  var state = {
    present: false,
    active: false,
    reason: "",
    lib: null,
    dll: "",
    dllVersion: "",
    lanes: null,
    activeNames: [],
    certified: 0,
    bands: DEFAULT_BANDS
  };
  function packLanePass(O, len) {
    var s = "";
    var k = 0;
    for (k = 0; k < len; k++) {
      if (!(k in O)) return void 0;
      var v = O[k];
      if (!isLaneInt(v)) return void 0;
      var n = v < 0 ? v + 4294967296 : v;
      s += String.fromCharCode((n >>> 24 & 255) + 1, (n >>> 16 & 255) + 1, (n >>> 8 & 255) + 1, (n & 255) + 1);
    }
    return s;
  }
  function unpackLaneInto(target, channel, len) {
    var k = 0;
    for (k = 0; k < len; k++) {
      target[k] = unpackInt32At(channel, k * 4);
    }
    return target;
  }
  function makeSortLane(lib, mutate) {
    return function(array) {
      var O = Object(array);
      var len = O.length >>> 0;
      var packed = packLanePass(O, len);
      if (packed === void 0) return void 0;
      try {
        var out = lib.arrSort(packed, len);
        if (typeof out !== "string") return void 0;
        if (mutate) {
          return unpackLaneInto(O, out, len);
        }
        return unpackLaneInto(new Array(len), out, len);
      } catch (e) {
        return void 0;
      }
    };
  }
  function makeReverseLane(lib, mutate) {
    return function(array) {
      var O = Object(array);
      var len = O.length >>> 0;
      var packed = packLanePass(O, len);
      if (packed === void 0) return void 0;
      try {
        var out = lib.arrReverse(packed, len);
        if (typeof out !== "string") return void 0;
        if (mutate) {
          return unpackLaneInto(O, out, len);
        }
        return unpackLaneInto(new Array(len), out, len);
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
      var packed = packLanePass(O, len);
      if (packed === void 0) return void 0;
      try {
        var out = lib.arrJoin(packed, len, sep);
        if (typeof out !== "string") return void 0;
        return out;
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
    // mandatory ToString-order vectors (design doc §4.3)
    ["sort", sort, [10, 9, 1, 2], [], [1, 10, 2, 9]],
    ["sort", sort, [1e3, 100, 10, 1], [], [1, 10, 100, 1e3]],
    // surrogate-window byte values (verifier-mandated): bytes 0xD7-0xDE map
    // to units 0xD8-0xDF under a byte+1 wire (dropped at the UTF-8 boundary) —
    // the 8-nibble wire packs these safely, and the corpus must exercise them
    // so a broken wire self-disqualifies at enable. Values are SIGNED int32
    // (0xD7000000 as a JS literal is +3607101440, outside int32; the signed
    // form -687865856 carries the same 0xD7 byte in the top position).
    ["sort", sort, [55040, 1, 2], [], [1, 2, 55040]],
    ["sort", sort, [14090240, -1, 5], [], [-1, 5, 14090240]],
    ["sort", sort, [-687865856, 0, 3], [], [-687865856, 0, 3]],
    ["sort", sort, [2147483607, -2, 9], [], [-2, 9, 2147483607]],
    ["sort", sort, [-3e6, 1, 7], [], [-3e6, 1, 7]],
    ["reverse", reverse, [1, 2, 3], [], [3, 2, 1]],
    ["reverse", reverse, [5], [], [5]],
    ["toSorted", toSorted, [3, 1, 2], [], [1, 2, 3]],
    ["toSorted", toSorted, [10, 9, 1, 2], [], [1, 10, 2, 9]],
    ["toReversed", toReversed, [1, 2, 3], [], [3, 2, 1]],
    ["join", join, [1, 2, 3], [], "1,2,3"],
    ["join", join, [], [], ""],
    ["join", join, [1, 2, 3], ["-"], "1-2-3"],
    ["join", join, [-5, 0, 7], [","], "-5,0,7"]
  ];
  var LANE_BUILDERS = {
    sort: function(lib) {
      return makeSortLane(lib, true);
    },
    toSorted: function(lib) {
      return makeSortLane(lib, false);
    },
    reverse: function(lib) {
      return makeReverseLane(lib, true);
    },
    toReversed: function(lib) {
      return makeReverseLane(lib, false);
    },
    join: makeJoinLane
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
        laneOut = laneFn.apply(null, [input.slice(0)].concat(args));
      } catch (e) {
        laneOut = void 0;
      }
      try {
        jsxOut = jsxFn.apply(null, [input.slice(0)].concat(args));
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
    var names = ["sort", "toSorted", "reverse", "toReversed", "join"];
    var n2 = 0;
    for (n2 = 0; n2 < names.length; n2++) {
      if (lanes2[names[n2]] !== null && lanes2[names[n2]] !== void 0) {
        activeNames[activeNames.length] = names[n2];
      }
    }
    return { lanes: lanes2, activeNames: activeNames, certified: certified, failures: failures };
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
    var ver = "";
    var ping = -1;
    var expectedPing = opts.ping === void 0 ? 42 : opts.ping;
    try {
      ver = String(lib.version(0));
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
  function setNativeBands(bands2) {
    var b = bands2 || {};
    var lo;
    var hi;
    var keys2 = ["sort", "toSorted", "reverse", "toReversed", "join"];
    var i = 0;
    for (i = 0; i < keys2.length; i++) {
      var pair = b[keys2[i]];
      if (pair && typeof pair[0] === "number" && typeof pair[1] === "number") {
        lo = pair[0] < 0 ? 0 : pair[0];
        hi = pair[1] > WEDGE_CAP ? WEDGE_CAP : pair[1];
        if (hi <= lo) {
          continue;
        }
        state.bands[keys2[i]] = [lo, hi];
      }
    }
  }
  function nativeBands() {
    return state.bands;
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
    state.dllVersion = "";
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
      present: present,
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
  function inBand(name, len) {
    var bands2 = nativeBands();
    var pair = bands2[name];
    if (!pair) {
      return false;
    }
    return len >= pair[0] && len <= pair[1];
  }
  function sort2(array, comparefn) {
    if (comparefn === void 0) {
      var l = lanes();
      if (l && l.sort && inBand("sort", array === null || array === void 0 ? 0 : Object(array).length >>> 0)) {
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
    if (l && l.reverse && inBand("reverse", array === null || array === void 0 ? 0 : Object(array).length >>> 0)) {
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
    if (l && l.join && inBand("join", array === null || array === void 0 ? 0 : Object(array).length >>> 0)) {
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
  function toSorted2(array, comparefn) {
    if (comparefn === void 0) {
      var l = lanes();
      if (l && l.toSorted && inBand("toSorted", array === null || array === void 0 ? 0 : Object(array).length >>> 0)) {
        try {
          var r = l.toSorted(array);
          if (r !== void 0) {
            return r;
          }
        } catch (e) {
        }
      }
    }
    return toSorted(array, comparefn);
  }
  function toReversed2(array) {
    var l = lanes();
    if (l && l.toReversed && inBand("toReversed", array === null || array === void 0 ? 0 : Object(array).length >>> 0)) {
      try {
        var r = l.toReversed(array);
        if (r !== void 0) {
          return r;
        }
      } catch (e) {
      }
    }
    return toReversed(array);
  }
  function indexOf2(array, searchElement, fromIndex) {
    if (arguments.length > 2) {
      return indexOf(array, searchElement, fromIndex);
    }
    return indexOf(array, searchElement);
  }
  function lastIndexOf2(array, searchElement, fromIndex) {
    if (arguments.length > 2) {
      return lastIndexOf(array, searchElement, fromIndex);
    }
    return lastIndexOf(array, searchElement);
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
    return { engine: engine, nativeList: nativeList, missing: missing, "native": nativeGateSnapshot() };
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
        return includes;
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
  function bands() {
    return nativeBands();
  }
  function setBands(bands2) {
    setNativeBands(bands2);
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
      n: n,
      iterations: iterations,
      medianUs: medianUs,
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
      includes(arr, size - 1, void 0);
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
  return __toCommonJS(index_exports);
})();

(function () {
  var g = null;
  try { if (typeof $ !== "undefined" && $.global) { g = $.global; } } catch (e1) {}
  if (!g) { try { g = (function () { return this; })(); } catch (e2) {} }
  if (!g || !g.Array || !g.Array.prototype) return;
  var p = g.Array.prototype;
  if (typeof p["slice"] !== "function") {
    p["slice"] = function (a, b, c) { return ESARR["slice"](this, a, b, c); };
  }
  if (typeof p["concat"] !== "function") {
    p["concat"] = function () {
      var a = [this];
      var i = 0;
      for (i = 0; i < arguments.length; i++) { a[a.length] = arguments[i]; }
      return ESARR["concat"].apply(null, a);
    };
  }
  if (typeof p["join"] !== "function") {
    p["join"] = function (a, b, c) { return ESARR["join"](this, a, b, c); };
  }
  if (typeof p["push"] !== "function") {
    p["push"] = function () {
      var a = [this];
      var i = 0;
      for (i = 0; i < arguments.length; i++) { a[a.length] = arguments[i]; }
      return ESARR["push"].apply(null, a);
    };
  }
  if (typeof p["pop"] !== "function") {
    p["pop"] = function (a, b, c) { return ESARR["pop"](this, a, b, c); };
  }
  if (typeof p["shift"] !== "function") {
    p["shift"] = function (a, b, c) { return ESARR["shift"](this, a, b, c); };
  }
  if (typeof p["unshift"] !== "function") {
    p["unshift"] = function () {
      var a = [this];
      var i = 0;
      for (i = 0; i < arguments.length; i++) { a[a.length] = arguments[i]; }
      return ESARR["unshift"].apply(null, a);
    };
  }
  if (typeof p["splice"] !== "function") {
    p["splice"] = function () {
      var a = [this];
      var i = 0;
      for (i = 0; i < arguments.length; i++) { a[a.length] = arguments[i]; }
      return ESARR["splice"].apply(null, a);
    };
  }
  if (typeof p["sort"] !== "function") {
    p["sort"] = function (a, b, c) { return ESARR["sort"](this, a, b, c); };
  }
  if (typeof p["reverse"] !== "function") {
    p["reverse"] = function (a, b, c) { return ESARR["reverse"](this, a, b, c); };
  }
  if (typeof p["toString"] !== "function") {
    p["toString"] = function (a, b, c) { return ESARR["toString"](this, a, b, c); };
  }
  if (typeof p["forEach"] !== "function") {
    p["forEach"] = function (a, b, c) { return ESARR["forEach"](this, a, b, c); };
  }
  if (typeof p["map"] !== "function") {
    p["map"] = function (a, b, c) { return ESARR["map"](this, a, b, c); };
  }
  if (typeof p["filter"] !== "function") {
    p["filter"] = function (a, b, c) { return ESARR["filter"](this, a, b, c); };
  }
  if (typeof p["every"] !== "function") {
    p["every"] = function (a, b, c) { return ESARR["every"](this, a, b, c); };
  }
  if (typeof p["some"] !== "function") {
    p["some"] = function (a, b, c) { return ESARR["some"](this, a, b, c); };
  }
  if (typeof p["indexOf"] !== "function") {
    p["indexOf"] = function (a, b, c) { return ESARR["indexOf"](this, a, b, c); };
  }
  if (typeof p["lastIndexOf"] !== "function") {
    p["lastIndexOf"] = function (a, b) {
      if (arguments.length > 1) { return ESARR["lastIndexOf"](this, a, b); }
      return ESARR["lastIndexOf"](this, a);
    };
  }
  if (typeof p["reduce"] !== "function") {
    p["reduce"] = function (a, b) {
      if (arguments.length > 1) { return ESARR["reduce"](this, a, b); }
      return ESARR["reduce"](this, a);
    };
  }
  if (typeof p["reduceRight"] !== "function") {
    p["reduceRight"] = function (a, b) {
      if (arguments.length > 1) { return ESARR["reduceRight"](this, a, b); }
      return ESARR["reduceRight"](this, a);
    };
  }
  if (typeof p["find"] !== "function") {
    p["find"] = function (a, b, c) { return ESARR["find"](this, a, b, c); };
  }
  if (typeof p["findIndex"] !== "function") {
    p["findIndex"] = function (a, b, c) { return ESARR["findIndex"](this, a, b, c); };
  }
  if (typeof p["includes"] !== "function") {
    p["includes"] = function (a, b, c) { return ESARR["includes"](this, a, b, c); };
  }
  if (typeof p["at"] !== "function") {
    p["at"] = function (a, b, c) { return ESARR["at"](this, a, b, c); };
  }
  if (typeof p["copyWithin"] !== "function") {
    p["copyWithin"] = function (a, b, c) { return ESARR["copyWithin"](this, a, b, c); };
  }
  if (typeof p["fill"] !== "function") {
    p["fill"] = function (a, b, c) { return ESARR["fill"](this, a, b, c); };
  }
  if (typeof p["flat"] !== "function") {
    p["flat"] = function (a, b, c) { return ESARR["flat"](this, a, b, c); };
  }
  if (typeof p["flatMap"] !== "function") {
    p["flatMap"] = function (a, b, c) { return ESARR["flatMap"](this, a, b, c); };
  }
  if (typeof p["keys"] !== "function") {
    p["keys"] = function (a, b, c) { return ESARR["keys"](this, a, b, c); };
  }
  if (typeof p["values"] !== "function") {
    p["values"] = function (a, b, c) { return ESARR["values"](this, a, b, c); };
  }
  if (typeof p["entries"] !== "function") {
    p["entries"] = function (a, b, c) { return ESARR["entries"](this, a, b, c); };
  }
  if (typeof p["toSorted"] !== "function") {
    p["toSorted"] = function (a, b, c) { return ESARR["toSorted"](this, a, b, c); };
  }
  if (typeof p["toReversed"] !== "function") {
    p["toReversed"] = function (a, b, c) { return ESARR["toReversed"](this, a, b, c); };
  }
  if (typeof p["with"] !== "function") {
    p["with"] = function (a, b, c) { return ESARR["with"](this, a, b, c); };
  }
  if (typeof p["findLast"] !== "function") {
    p["findLast"] = function (a, b, c) { return ESARR["findLast"](this, a, b, c); };
  }
  if (typeof p["findLastIndex"] !== "function") {
    p["findLastIndex"] = function (a, b, c) { return ESARR["findLastIndex"](this, a, b, c); };
  }
  if (typeof g.Array.isArray !== "function") { g.Array.isArray = ESARR.isArray; }
  if (typeof g.Array.from !== "function") {
    g.Array.from = function (items, mf, ta) { return ESARR.from(items, mf, ta, this); };
  }
  if (typeof g.Array.of !== "function") { g.Array.of = ESARR.of; }
})();
