// ESARRArray probe — smoke + per-method vector test for the ESARR native
// DLL, run inside Illustrator 2026 (COM DoJavaScript). Mirrors the local
// ABI test (native/dll-test.c) through the REAL host boundary: load,
// version, ping, byte+1 wire round-trips, each method against known
// vectors (the design doc §4.3 ToString-order cases), error paths, unload.
// Result: a JSON-ish report via toSource (file-logged by the COM tool).
#target illustrator
(function () {
    var out = { loaded: false, error: null, checks: 0, fails: 0, failures: [] };

    // ---- byte+1 wire (FINAL wire, decisions/wire-final v3) ----
    function packInt32(v) {
        var n = v < 0 ? v + 4294967296 : v; // >>> 0
        return String.fromCharCode(
            ((n >>> 24) & 255) + 1,
            ((n >>> 16) & 255) + 1,
            ((n >>> 8) & 255) + 1,
            (n & 255) + 1
        );
    }
    function packArray(vals) {
        var s = "", i;
        for (i = 0; i < vals.length; i++) {
            s += packInt32(vals[i]); // direct += concat (doc §10b, v1 pattern)
        }
        return s;
    }
    function unpackInt32At(s, i) {
        var c0 = s.charCodeAt(i), c1 = s.charCodeAt(i + 1);
        var c2 = s.charCodeAt(i + 2), c3 = s.charCodeAt(i + 3);
        var n = ((c0 - 1) << 24) | ((c1 - 1) << 16) | ((c2 - 1) << 8) | (c3 - 1);
        return n >= 2147483648 ? n - 4294967296 : n;
    }
    function unpackArray(s, len) {
        var a = new Array(len), i;
        for (i = 0; i < len; i++) {
            a[i] = unpackInt32At(s, i * 4);
        }
        return a;
    }
    function arraysEqual(a, b) {
        if (a.length !== b.length) return false;
        var i;
        for (i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
    }

    function check(cond, what) {
        out.checks++;
        if (!cond) {
            out.fails++;
            out.failures.push(what);
        }
    }

    var dll = "C:/Program Files/Adobe/Adobe Illustrator 2026/Presets/en_US/Scripts/esarr/native/bin/ESARRArray.dll";
    var lib = null;
    try {
        lib = new ExternalObject("lib:" + dll);
        out.loaded = true;
        out.version = Number(lib.version(0));
        out.ping = Number(lib.ping(0));
        out.banner = String(lib.version(0));

        check(out.ping === 42, "ping(0) === 42");
        check(String(out.banner).indexOf("ESARRArray") === 0, "version(0) is the ESARRArray banner");

        // ---- arrSort (ToString order, doc §4) ----
        check(arraysEqual(unpackArray(lib.arrSort(packArray([3, 1, 2]), 3), 3), [1, 2, 3]),
              "arrSort [3,1,2] -> [1,2,3]");
        check(arraysEqual(unpackArray(lib.arrSort(packArray([10, 9, 1, 2]), 4), 4), [1, 10, 2, 9]),
              "arrSort [10,9,1,2] -> [1,10,2,9] (ToString order)");
        check(arraysEqual(unpackArray(lib.arrSort(packArray([-5, 0, 7, 4]), 4), 4), [-5, 0, 4, 7]),
              "arrSort [-5,0,7,4] -> [-5,0,4,7]");
        check(arraysEqual(unpackArray(lib.arrSort(packArray([-9, -10, -11]), 3), 3), [-10, -11, -9]),
              "arrSort [-9,-10,-11] -> [-10,-11,-9]");
        check(arraysEqual(unpackArray(lib.arrSort(packArray([1000, 7, 100, 8]), 4), 4), [100, 1000, 7, 8]),
              "arrSort [1000,7,100,8] -> [100,1000,7,8] (power-of-10 mix)");
        check(arraysEqual(unpackArray(lib.arrSort(packArray([2147483647, -2147483648, 0]), 3), 3),
                          [-2147483648, 0, 2147483647]),
              "arrSort int32 bounds");
        check(arraysEqual(unpackArray(lib.arrSort(packArray([2, 2, 1, 1]), 4), 4), [1, 1, 2, 2]),
              "arrSort [2,2,1,1] -> [1,1,2,2]");

        // ---- arrReverse ----
        check(arraysEqual(unpackArray(lib.arrReverse(packArray([1, 2, 3]), 3), 3), [3, 2, 1]),
              "arrReverse [1,2,3] -> [3,2,1]");
        check(arraysEqual(unpackArray(lib.arrReverse(packArray([5]), 1), 1), [5]),
              "arrReverse [5] -> [5]");

        // ---- arrJoin (packed, len, sep) ----
        check(lib.arrJoin(packArray([1, 2, 3]), 3, ",") === "1,2,3", "arrJoin [1,2,3] ',' -> '1,2,3'");
        check(lib.arrJoin(packArray([-1, 0, 1]), 3, "") === "-101", "arrJoin [-1,0,1] '' -> '-101'");
        check(lib.arrJoin(packArray([-2147483648, 2147483647]), 2, " | ") === "-2147483648 | 2147483647",
              "arrJoin int32 bounds multi-char sep");
        check(lib.arrJoin(packArray([]), 0, ",") === "", "arrJoin [] -> ''");

        // ---- indexOf family (packed, len, search) ----
        check(lib.arrIndexOf(packArray([1, 2, 3, 2]), 4, 2) === 1, "arrIndexOf [1,2,3,2] 2 -> 1");
        check(lib.arrLastIndexOf(packArray([1, 2, 3, 2]), 4, 2) === 3, "arrLastIndexOf -> 3");
        check(lib.arrIncludes(packArray([1, 2, 3, 2]), 4, 2) === 1, "arrIncludes 2 -> 1");
        check(lib.arrIndexOf(packArray([1, 2, 3]), 3, 9) === -1, "arrIndexOf missing -> -1");
        check(lib.arrIncludes(packArray([1, 2, 3]), 3, 9) === 0, "arrIncludes missing -> 0");
        check(lib.arrIndexOf(packArray([]), 0, 0) === -1, "arrIndexOf empty -> -1");

        // ---- error paths (catchable; lane falls back) ----
        try {
            lib.arrSort(packArray([1, 2, 3]), 2); // len mismatch -> 10001
            check(false, "arrSort len mismatch should throw");
        } catch (e) {
            check(e.number === 10001, "arrSort len mismatch -> Error #10001");
        }
        try {
            lib.arrSort("XYZ", 1); // malformed payload
            check(false, "arrSort malformed should throw");
        } catch (e2) {
            check(e2.number === 10001, "arrSort malformed -> Error #10001");
        }

        try {
            lib.unload();
            out.unloaded = true;
        } catch (e3) {
            out.unloadError = String(e3);
        }
    } catch (e) {
        out.error = String(e);
        out.errorNumber = e.number;
    }
    out.ok = out.fails === 0 && out.error === null;
    return out.toSource ? out.toSource() : JSON.stringify(out);
}());
