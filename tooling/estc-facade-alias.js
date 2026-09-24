// ESARR public reserved-name alias. `with` is an ES3 reserved word, so the
// bundler namespace cannot carry it as an export binding; the safe export is
// `withMethod` and the documented public `ESARR.with` is attached here by
// bracket notation. Runs before the vendor installer footer, which installs
// `Array.prototype["with"]` from `ESARR["with"]`.
(function () {
  if (typeof ESARR !== "object" || !ESARR) return;
  if (typeof ESARR.withMethod === "function" && typeof ESARR["with"] !== "function") {
    ESARR["with"] = ESARR.withMethod;
  }
})();
