import * as core from '../tests/core-adapter';
import { runVector, runNativeVector, deepStrictEquals } from './callbacks';

var NATIVE: any = { sort: Array.prototype.sort };

// diff[121]: input=[null,null,null,null,"1",null,5,null,null,0.5] — but JSON
// can't distinguish null/undefined/NaN/holes. Reproduce with each variant:
function probe(tag, input) {
  var vec = { op: 'sort', cbMode: '', args: [], input: input };
  var ours = runVector(vec, core.PURE);
  var theirs = runNativeVector(vec, NATIVE);
  var eq = deepStrictEquals(ours.result, theirs.result) && deepStrictEquals(ours.state, theirs.state);
  console.log(tag + ': equal=' + eq);
  if (!eq) {
    var a = ours.result, b = theirs.result;
    for (var i = 0; i < Math.max(a.length, b.length); i++) {
      var ha = i in a, hb = i in b;
      if (ha !== hb) { console.log('  idx ' + i + ': PRESENCE ours=' + ha + ' native=' + hb); }
      else if (ha && !Object.is(a[i], b[i])) { console.log('  idx ' + i + ': value ours=' + String(a[i]) + ' (' + typeof a[i] + ') native=' + String(b[i]) + ' (' + typeof b[i] + ') is-0 ours=' + Object.is(a[i], -0) + ' native=' + Object.is(b[i], -0)); }
    }
    console.log('  lengths ours=' + a.length + ' native=' + b.length);
    console.log('  ours holes: ' + (function () { var s = []; for (var j = 0; j < a.length; j++) { s.push(j in a ? (a[j] === undefined ? 'undef' : String(a[j])) : 'HOLE'); } return s.join(','); })());
    console.log('  native holes: ' + (function () { var s = []; for (var j = 0; j < b.length; j++) { s.push(j in b ? (b[j] === undefined ? 'undef' : String(b[j])) : 'HOLE'); } return s.join(','); })());
  }
}

probe('dense nulls', { t: 'array', dense: [null, null, null, null, '1', null, 5, null, null, 0.5] });
probe('sparse variant', { t: 'sparse', len: 10, set: { '4': '1', '6': 5, '9': 0.5 } });
probe('NaN variant', { t: 'array', dense: [NaN, NaN, NaN, NaN, '1', NaN, 5, NaN, NaN, 0.5] });
probe('undefined variant', { t: 'array', dense: [undefined, undefined, undefined, undefined, '1', undefined, 5, undefined, undefined, 0.5] });
