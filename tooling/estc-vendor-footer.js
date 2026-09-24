// ESARR vendor installer footer (gap-fill only; documented polyfill contract).
// Appended by the ESTC vendor/runtime-vendor builds. Mutates Array.prototype
// and the Array statics ONLY where the host is missing the method;
// ESARR.install({ forceReplace: true }) is the explicit override surface.
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
