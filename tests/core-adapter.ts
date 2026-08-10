// Test-side core adapter: merges the landed ESARR modules into the facade
// shape the harnesses expect (array-first pure functions), so the differential
// runs against the FULL landed surface even before src/index.ts is rewired by
// the JSX stream. Mapping of the facade name for the ES2023 `with()`:
// array-es6.ts exports it as `withMethod` (reserved-word safe in the bundle).
//
// PURE     — the JSX authority (array-core + array-es3 + array-es6).
// DISPATCH — the native-gate-routed facade (native-dispatch overrides for the
//            lane methods; gate off in Node -> falls through to the pure JSX,
//            so PURE vs DISPATCH must be byte-identical here).
import * as base from '../src/index';
import * as es3 from '../src/array-es3';
import * as es6 from '../src/array-es6';
import * as dispatch from '../src/native-dispatch';
import * as gate from '../src/native-lane';

function mergeModules(mods: any[], overrides: any): any {
  var out: any = {};
  var m = 0;
  var k: string;
  for (m = 0; m < mods.length; m++) {
    for (k in mods[m]) {
      if (Object.prototype.hasOwnProperty.call(mods[m], k)) {
        if (typeof (mods[m] as any)[k] === 'function') { out[k] = (mods[m] as any)[k]; }
      }
    }
  }
  for (k in overrides) {
    if (Object.prototype.hasOwnProperty.call(overrides, k)) { out[k] = overrides[k]; }
  }
  return out;
}

export var PURE: any = mergeModules([base, es3, es6], { with: es6.withMethod });

export var DISPATCH: any = mergeModules([base, es3, es6, dispatch], { with: es6.withMethod });

/** The NativeGate options surface the live probe uses (engine-side only). */
export var GATE: any = gate;
