// MDN-style pure-function baseline (the "stock polyfill" competitor): the
// classic MDN implementations adapted to pure (array, ...) signatures so they
// can be measured alongside ESARR without prototype-install conflicts.
// This mirrors the widely-distributed extendscript-es5-shim / MDN code shapes.
export function mdnForEach(array: any, callback: any, thisArg: any): void {
  if (array === void 0 || array === null) {
    throw new TypeError('Array.prototype.forEach called on null or undefined');
  }
  if (typeof callback !== 'function') {
    throw new TypeError(callback + ' is not a function');
  }
  var O = Object(array);
  var len = O.length >>> 0;
  var T = thisArg;
  for (var k = 0; k < len; k++) {
    if (k in O) {
      callback.call(T, O[k], k, O);
    }
  }
}

export function mdnMap(array: any, callback: any, thisArg: any): any[] {
  if (array === void 0 || array === null) {
    throw new TypeError('Array.prototype.map called on null or undefined');
  }
  if (typeof callback !== 'function') {
    throw new TypeError(callback + ' is not a function');
  }
  var O = Object(array);
  var len = O.length >>> 0;
  var A = new Array(len);
  for (var k = 0; k < len; k++) {
    if (k in O) {
      A[k] = callback.call(thisArg, O[k], k, O);
    }
  }
  return A;
}

export function mdnFilter(array: any, callback: any, thisArg: any): any[] {
  if (array === void 0 || array === null) {
    throw new TypeError('Array.prototype.filter called on null or undefined');
  }
  if (typeof callback !== 'function') {
    throw new TypeError(callback + ' is not a function');
  }
  var O = Object(array);
  var len = O.length >>> 0;
  var res: any[] = [];
  for (var k = 0; k < len; k++) {
    if (k in O) {
      var val = O[k];
      if (callback.call(thisArg, val, k, O)) {
        res.push(val);
      }
    }
  }
  return res;
}

export function mdnEvery(array: any, callback: any, thisArg: any): boolean {
  if (array === void 0 || array === null) {
    throw new TypeError('Array.prototype.every called on null or undefined');
  }
  if (typeof callback !== 'function') {
    throw new TypeError(callback + ' is not a function');
  }
  var O = Object(array);
  var len = O.length >>> 0;
  for (var k = 0; k < len; k++) {
    if (k in O) {
      if (!callback.call(thisArg, O[k], k, O)) {
        return false;
      }
    }
  }
  return true;
}

export function mdnSome(array: any, callback: any, thisArg: any): boolean {
  if (array === void 0 || array === null) {
    throw new TypeError('Array.prototype.some called on null or undefined');
  }
  if (typeof callback !== 'function') {
    throw new TypeError(callback + ' is not a function');
  }
  var O = Object(array);
  var len = O.length >>> 0;
  for (var k = 0; k < len; k++) {
    if (k in O) {
      if (callback.call(thisArg, O[k], k, O)) {
        return true;
      }
    }
  }
  return false;
}

export function mdnIndexOf(array: any, searchElement: any, fromIndex: any): number {
  if (array === void 0 || array === null) {
    throw new TypeError('Array.prototype.indexOf called on null or undefined');
  }
  var o = Object(array);
  var len = o.length >>> 0;
  if (len === 0) {
    return -1;
  }
  var n = +fromIndex || 0;
  if (Math.abs(n) === Infinity) {
    n = 0;
  }
  var k = Math.max(n >= 0 ? n : len - Math.abs(n), 0);
  while (k < len) {
    if (k in o && o[k] === searchElement) {
      return k;
    }
    k++;
  }
  return -1;
}

export function mdnLastIndexOf(array: any, searchElement: any, fromIndex: any): number {
  if (array === void 0 || array === null) {
    throw new TypeError('Array.prototype.lastIndexOf called on null or undefined');
  }
  var t = Object(array);
  var len = t.length >>> 0;
  if (len === 0) {
    return -1;
  }
  var n: number;
  if (arguments.length > 2) {
    n = Number(arguments[2]);
    if (n !== n) { n = 0; }
    else if (n !== 0 && n !== Infinity && n !== -Infinity) {
      n = (n > 0 ? 1 : -1) * Math.floor(Math.abs(n));
    }
  } else {
    n = len - 1;
  }
  for (var k = n >= 0 ? Math.min(n, len - 1) : len - Math.abs(n); k >= 0; k--) {
    if (k in t && t[k] === searchElement) {
      return k;
    }
  }
  return -1;
}

export function mdnReduce(array: any, callback: any, initialValue: any): any {
  if (array === void 0 || array === null) {
    throw new TypeError('Array.prototype.reduce called on null or undefined');
  }
  if (typeof callback !== 'function') {
    throw new TypeError(callback + ' is not a function');
  }
  var t = Object(array);
  var len = t.length >>> 0;
  var k = 0;
  var value: any;
  if (arguments.length > 2) {
    value = initialValue;
  } else {
    while (k < len && !(k in t)) {
      k++;
    }
    if (k >= len) {
      throw new TypeError('Reduce of empty array with no initial value');
    }
    value = t[k++];
  }
  for (; k < len; k++) {
    if (k in t) {
      value = callback(value, t[k], k, t);
    }
  }
  return value;
}

export function mdnReduceRight(array: any, callback: any, initialValue: any): any {
  if (array === void 0 || array === null) {
    throw new TypeError('Array.prototype.reduceRight called on null or undefined');
  }
  if (typeof callback !== 'function') {
    throw new TypeError(callback + ' is not a function');
  }
  var t = Object(array);
  var len = t.length >>> 0;
  var k = len - 1;
  var value: any;
  if (arguments.length > 2) {
    value = initialValue;
  } else {
    while (k >= 0 && !(k in t)) {
      k--;
    }
    if (k < 0) {
      throw new TypeError('Reduce of empty array with no initial value');
    }
    value = t[k--];
  }
  for (; k >= 0; k--) {
    if (k in t) {
      value = callback(value, t[k], k, t);
    }
  }
  return value;
}
