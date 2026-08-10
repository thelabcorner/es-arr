// ESARR test vectors — shared between the Node harness and the live-verify
// battery. Array-likes are described by a small protocol the runners rebuild:
//   { t: 'array', dense: [...] }          dense array
//   { t: 'sparse', len: n, set: {idx: v} } array with holes
//   { t: 'string', s: '...' }              string array-like
//   { t: 'like', len: n, set: {idx: v} }   plain object array-like
//   { t: 'null' }                          null input (TypeError expected)
// Callback behavior is selected by cbMode (see tests/callbacks.ts for the
// canonical implementation shared by the Node harness and the live probe).
// For MUTATING ops (sort/reverse/splice/push/pop/shift/unshift/fill/
// copyWithin), the optional 8th argument is the expected POST-MUTATION state
// of the input (same protocol as `expect`); the harness verifies both the
// return value and the state.
export var VECTORS: any[] = [];

function v(desc: string, input: any, op: string, cbMode: string, args: any[], expect: any, expectError?: string, expectState?: any): void {
  VECTORS[VECTORS.length] = {
    desc: desc, input: input, op: op, cbMode: cbMode, args: args,
    expect: expect, expectError: expectError, expectState: expectState
  };
}

var dense = { t: 'array', dense: [1, 2, 3, 4, 5] };
var dense3 = { t: 'array', dense: ['a', 'b', 'c'] };
var mixed = { t: 'array', dense: [1, 'two', null, undefined, 5] };
var sparse = { t: 'sparse', len: 6, set: { '1': 'x', '4': 'y' } };
var allSparse = { t: 'sparse', len: 4, set: {} };
var single = { t: 'array', dense: [42] };
var withUndef = { t: 'array', dense: [undefined, undefined, 3] };
var empty = { t: 'array', dense: [] };
var strLike = { t: 'string', s: 'abc' };
var like = { t: 'like', len: 3, set: { '0': 10, '1': 20, '2': 30 } };
var likeHole = { t: 'like', len: 4, set: { '0': 10, '2': 30 } };

// ---- forEach ----
v('forEach sums dense', dense, 'forEach', 'sum', [], 15);
v('forEach sparse visits only present', sparse, 'forEach', 'count', [], 2);
v('forEach visits undefined elements', withUndef, 'forEach', 'count', [], 3);
v('forEach over string chars', strLike, 'forEach', 'concatIdx', [], 'a1b2c3');
v('forEach over array-like object', like, 'forEach', 'sum', [], 60);
v('forEach thisArg bound', dense, 'forEach', 'thisTag', [{ tag: 'T' }], 'T@4');
v('forEach(null) throws TypeError', { t: 'null' }, 'forEach', 'count', [], null, 'TypeError');
v('forEach non-callable throws', dense, 'forEach', 'number', [5], null, 'TypeError');

// ---- map ----
v('map doubles', dense, 'map', 'double', [], [2, 4, 6, 8, 10]);
v('map preserves holes', sparse, 'map', 'bang', [], { t: 'sparse', len: 6, set: { '1': 'x!', '4': 'y!' } });
v('map skips undefined cleanly', withUndef, 'map', 'doubleSkipUndef', [], [void 0, void 0, 6]);
v('map over string', strLike, 'map', 'idx', [], ['a1', 'b2', 'c3']);
v('map over array-like', like, 'map', 'plus1', [], [11, 21, 31]);
v('map empty returns []', empty, 'map', 'double', [], []);
v('map thisArg bound', dense3, 'map', 'thisTagMap', [{ tag: 'T' }], ['Ta0', 'Tb1', 'Tc2']);
v('map(null) throws TypeError', { t: 'null' }, 'map', 'double', [], null, 'TypeError');
v('map non-callable throws', dense, 'map', 'number', [5], null, 'TypeError');

// ---- filter ----
v('filter evens', dense, 'filter', 'even', [], [2, 4]);
v('filter preserves holes', sparse, 'filter', 'truthy', [], ['x', 'y']);
v('filter truthy on undefined', withUndef, 'filter', 'truthy', [], [3]);
v('filter array-like', like, 'filter', 'gt15', [], [20, 30]);
v('filter(null) throws TypeError', { t: 'null' }, 'filter', 'truthy', [], null, 'TypeError');

// ---- every / some ----
v('every all > 0', dense, 'every', 'gt0', [], true);
v('every fails at index 3', dense, 'every', 'failAt3', [], false);
v('some finds 4', dense, 'some', 'eq', [4], true);
v('some misses 99', dense, 'some', 'eq', [99], false);
v('some on sparse skips holes', sparse, 'some', 'truthy', [], true);
v('every(null) throws TypeError', { t: 'null' }, 'every', 'gt0', [], null, 'TypeError');

// ---- indexOf ----
v('indexOf hit', dense, 'indexOf', '', [3], 2);
v('indexOf miss', dense, 'indexOf', '', [99], -1);
v('indexOf from 3', dense, 'indexOf', '', [5, 3], 4);
v('indexOf from -2', dense, 'indexOf', '', [4, -2], 3);
v('indexOf from -Infinity', dense, 'indexOf', '', [1, -Infinity], 0);
v('indexOf from +Infinity', dense, 'indexOf', '', [1, Infinity], -1);
v('indexOf from NaN', dense, 'indexOf', '', [2, NaN], 1);
v('indexOf from undefined', dense, 'indexOf', '', [2, void 0], 1);
v('indexOf fractional 2.9', dense, 'indexOf', '', [4, 2.9], 3);
v('indexOf fractional 3.7 truncates', dense, 'indexOf', '', [5, 3.7], 4);
v('indexOf negative fractional', dense, 'indexOf', '', [1, -2.9], -1);
v('indexOf string fromIndex', dense, 'indexOf', '', [2, '1'], 1);
v('indexOf from len', dense, 'indexOf', '', [5, 5], -1);
v('indexOf from len+5', dense, 'indexOf', '', [5, 10], -1);
v('indexOf from -len-5', dense, 'indexOf', '', [1, -10], 0);
v('indexOf strict no coercion', dense, 'indexOf', '', ['1'], -1);
v('indexOf finds undefined element', withUndef, 'indexOf', '', [void 0], 0);
v('indexOf hole is not undefined', sparse, 'indexOf', '', [void 0], -1);
v('indexOf empty', empty, 'indexOf', '', [1], -1);
v('indexOf null not present', dense, 'indexOf', '', [null], -1);
v('indexOf(null) throws TypeError', { t: 'null' }, 'indexOf', '', [1], null, 'TypeError');
v('indexOf mixed values', mixed, 'indexOf', '', [null], 2);

// ---- lastIndexOf ----
v('lastIndexOf hit', dense, 'lastIndexOf', '', [3], 2);
v('lastIndexOf picks last duplicate', dense, 'lastIndexOf', '', [3, 9], 2);
v('lastIndexOf from -2', dense, 'lastIndexOf', '', [2, -2], 1);
v('lastIndexOf from 2', dense, 'lastIndexOf', '', [5, 2], -1);
v('lastIndexOf absent fromIndex', dense, 'lastIndexOf', '', [5], 4);
v('lastIndexOf from len clamps', dense, 'lastIndexOf', '', [5, 5], 4);
v('lastIndexOf from +Infinity', dense, 'lastIndexOf', '', [5, Infinity], 4);
v('lastIndexOf from -Infinity', dense, 'lastIndexOf', '', [1, -Infinity], -1);
v('lastIndexOf from NaN', dense, 'lastIndexOf', '', [2, NaN], -1);
v('lastIndexOf from 0', dense, 'lastIndexOf', '', [1, 0], 0);
v('lastIndexOf from -1', dense, 'lastIndexOf', '', [5, -1], 4);
v('lastIndexOf from -len-1', dense, 'lastIndexOf', '', [1, -6], -1);
v('lastIndexOf fractional 3.9', dense, 'lastIndexOf', '', [2, 3.9], 1);
v('lastIndexOf finds undefined element', withUndef, 'lastIndexOf', '', [void 0], 1);
v('lastIndexOf hole is not undefined', sparse, 'lastIndexOf', '', [void 0], -1);
v('lastIndexOf empty', empty, 'lastIndexOf', '', [1], -1);
v('lastIndexOf mixed values', mixed, 'lastIndexOf', '', [null], 2);

// ---- reduce ----
v('reduce sum with init', dense, 'reduce', 'sum', [0], 15);
v('reduce sum no init', dense, 'reduce', 'sum', [], 15);
v('reduce product', dense, 'reduce', 'prod', [1], 120);
v('reduce concat strings', dense3, 'reduce', 'concat', ['+'], '+abc');
v('reduce no init skips holes', sparse, 'reduce', 'concat', [], 'xy');
v('reduce with init on sparse', sparse, 'reduce', 'concat', ['z'], 'zxy');
v('reduce single element no init', single, 'reduce', 'sum', [], 42);
v('reduce empty with init', empty, 'reduce', 'sum', [7], 7);
v('reduce empty no init throws', empty, 'reduce', 'sum', [], null, 'TypeError');
v('reduce all-sparse no init throws', allSparse, 'reduce', 'sum', [], null, 'TypeError');
v('reduce undefined-first element no init', withUndef, 'reduce', 'sum', [], NaN);
v('reduce(null) throws TypeError', { t: 'null' }, 'reduce', 'sum', [], null, 'TypeError');
v('reduce non-callable throws', dense, 'reduce', 'number', [5], null, 'TypeError');

// ---- reduceRight ----
v('reduceRight order', dense3, 'reduceRight', 'concat', [''], 'cba');
v('reduceRight sum', dense, 'reduceRight', 'sum', [0], 15);
v('reduceRight no init', dense, 'reduceRight', 'sum', [], 15);
v('reduceRight sparse no init', sparse, 'reduceRight', 'concat', [], 'yx');
v('reduceRight empty throws', empty, 'reduceRight', 'sum', [], null, 'TypeError');
v('reduceRight empty with init', empty, 'reduceRight', 'sum', [7], 7);

// ---- isArray ----
v('isArray true on array', dense, 'isArray', '', [], true);
v('isArray false on array-like', like, 'isArray', '', [], false);
v('isArray false on string', strLike, 'isArray', '', [], false);
v('isArray false on null', { t: 'null' }, 'isArray', '', [], false);
v('isArray false on number 7', dense, 'isArray', '', [7], false);
v('isArray false on undefined', dense, 'isArray', '', [void 0], false);
v('isArray false on arguments-like', { t: 'like', len: 2, set: { '0': 1, '1': 2 } }, 'isArray', '', [], false);

// ---- misc ----
v('every no thisArg', dense, 'every', 'gt0', [], true);
v('some with object elements', { t: 'array', dense: [{}, [], null] }, 'some', 'truthy', [], true);

// ============================================================================
// FULL-SURFACE vectors (ES3 + ES6+ additions). Each op is dispatched by the
// shared runners; ops not yet landed in the core are reported as PENDING by
// the harnesses (see docs/verification-report.md for the landed matrix).
// ============================================================================

// ---- concat (ES3) ----
v('concat flattens one level', dense, 'concat', '', [[6, 7]], [1, 2, 3, 4, 5, 6, 7]);
v('concat scalars appended', { t: 'array', dense: [1, 2] }, 'concat', '', [3, [4, 5]], [1, 2, 3, 4, 5]);
v('concat empty receiver', { t: 'array', dense: [] }, 'concat', '', [[1]], [1]);
v('concat on array-like appends object (spec: no spread of array-likes)', like, 'concat', '', [], { t: 'array', dense: [{ length: 3, 0: 10, 1: 20, 2: 30 }] });
v('concat does not deep flatten', { t: 'array', dense: [1] }, 'concat', '', [[[2]]], [1, [2]]);
v('concat null and undefined elements', { t: 'array', dense: [1, null] }, 'concat', '', [[undefined]], [1, null, undefined]);
v('concat no args returns copy', dense, 'concat', '', [], [1, 2, 3, 4, 5]);
v('concat(null) throws TypeError', { t: 'null' }, 'concat', '', [], null, 'TypeError');

// ---- join (ES3) ----
v('join default separator', dense, 'join', '', [], '1,2,3,4,5');
v('join hyphen', dense3, 'join', '', ['-'], 'a-b-c');
v('join empty separator', { t: 'array', dense: ['a', 'b'] }, 'join', '', [''], 'ab');
v('join null and undefined become empty', { t: 'array', dense: [1, null, undefined, 3] }, 'join', '', ['-'], '1---3');
v('join holes become empty', sparse, 'join', '', [], ',x,,,y,');
v('join nested arrays toString', { t: 'array', dense: [1, [2, 3], 4] }, 'join', '', ['-'], '1-2,3-4');
v('join separator 0 is "0"', { t: 'array', dense: [1, 2] }, 'join', '', [0], '102');
v('join empty array', empty, 'join', '', [], '');
v('join multi-char separator', { t: 'array', dense: [1, -2, 3] }, 'join', '', ['::'], '1::-2::3');
v('join negative values (design §4.4)', { t: 'array', dense: [-1, 0, -2147483648] }, 'join', '', [','], '-1,0,-2147483648');
v('join(string) throws TypeError', { t: 'null' }, 'join', '', [], null, 'TypeError');

// ---- pop / push / shift / unshift / reverse (ES3, mutating) ----
v('pop returns last', dense, 'pop', '', [], 5, undefined, { t: 'array', dense: [1, 2, 3, 4] });
v('pop empty returns undefined', empty, 'pop', '', [], undefined, undefined, { t: 'array', dense: [] });
v('push returns new length', { t: 'array', dense: [1, 2] }, 'push', '', [3, 4], 4, undefined, { t: 'array', dense: [1, 2, 3, 4] });
v('push single returns length', empty, 'push', '', [9], 1, undefined, { t: 'array', dense: [9] });
v('shift returns first', dense, 'shift', '', [], 1, undefined, { t: 'array', dense: [2, 3, 4, 5] });
v('shift empty returns undefined', empty, 'shift', '', [], undefined, undefined, { t: 'array', dense: [] });
v('unshift returns length', { t: 'array', dense: [2, 3] }, 'unshift', '', [0, 1], 4, undefined, { t: 'array', dense: [0, 1, 2, 3] });
v('unshift empty', empty, 'unshift', '', [7], 1, undefined, { t: 'array', dense: [7] });
v('reverse mutates and returns same', dense, 'reverse', '', [], [5, 4, 3, 2, 1], undefined, { t: 'array', dense: [5, 4, 3, 2, 1] });
v('reverse empty', empty, 'reverse', '', [], [], undefined, { t: 'array', dense: [] });
v('pop(null) throws TypeError', { t: 'null' }, 'pop', '', [], null, 'TypeError');
v('push(null) throws TypeError', { t: 'null' }, 'push', '', [1], null, 'TypeError');

// ---- slice (ES3) ----
v('slice copies', dense, 'slice', '', [], [1, 2, 3, 4, 5]);
v('slice start/end', dense, 'slice', '', [1, 3], [2, 3]);
v('slice negative start', dense, 'slice', '', [-2], [4, 5]);
v('slice beyond end is empty', dense, 'slice', '', [10], []);
v('slice before start is full copy', dense, 'slice', '', [-10], [1, 2, 3, 4, 5]);
v('slice end negative', dense, 'slice', '', [1, -1], [2, 3, 4]);
v('slice on string array-like', strLike, 'slice', '', [], ['a', 'b', 'c']);
v('slice preserves holes', sparse, 'slice', '', [1, 5], { t: 'sparse', len: 4, set: { '0': 'x', '3': 'y' } });
v('slice(null) throws TypeError', { t: 'null' }, 'slice', '', [], null, 'TypeError');

// ---- sort (ES3, mutating) ----
v('sort default ToString order', { t: 'array', dense: [10, 9, 1, 2] }, 'sort', '', [],
  { t: 'array', dense: [1, 10, 2, 9] }, undefined, { t: 'array', dense: [1, 10, 2, 9] });
v('sort powers of 10 mixed with small ints (ToString)', { t: 'array', dense: [100, 1, 10, 1000, 2, 20] }, 'sort', '', [],
  { t: 'array', dense: [1, 10, 100, 1000, 2, 20] }, undefined, { t: 'array', dense: [1, 10, 100, 1000, 2, 20] });
v('sort negative ints mixed with positives (ToString: -2 < -5 < 0 < 10 < 3)', { t: 'array', dense: [-5, -2, 0, 3, 10] }, 'sort', '', [],
  { t: 'array', dense: [-2, -5, 0, 10, 3] }, undefined, { t: 'array', dense: [-2, -5, 0, 10, 3] });
v('sort duplicates', { t: 'array', dense: [2, 2, 1, 1] }, 'sort', '', [],
  { t: 'array', dense: [1, 1, 2, 2] }, undefined, { t: 'array', dense: [1, 1, 2, 2] });
v('sort max/min int32', { t: 'array', dense: [2147483647, -2147483648, 0] }, 'sort', '', [],
  { t: 'array', dense: [-2147483648, 0, 2147483647] }, undefined, { t: 'array', dense: [-2147483648, 0, 2147483647] });
v('sort mixed digit lengths', { t: 'array', dense: [9, 99, 999, 9999, 1] }, 'sort', '', [],
  { t: 'array', dense: [1, 9, 99, 999, 9999] }, undefined, { t: 'array', dense: [1, 9, 99, 999, 9999] });
v('sort numeric compareFn', { t: 'array', dense: [10, 9, 1, 2] }, 'sort', 'dCmp', [],
  { t: 'array', dense: [1, 2, 9, 10] }, undefined, { t: 'array', dense: [1, 2, 9, 10] });
v('sort mixed types ToString', mixed, 'sort', '', [],
  { t: 'array', dense: [1, 5, null, 'two', undefined] }, undefined, { t: 'array', dense: [1, 5, null, 'two', undefined] });
v('sort NaN/Infinity/-0 ToString', { t: 'array', dense: [NaN, 1, Infinity, -Infinity, 0, -0] }, 'sort', '', [],
  { t: 'array', dense: [-Infinity, 0, -0, 1, Infinity, NaN] }, undefined,
  { t: 'array', dense: [-Infinity, 0, -0, 1, Infinity, NaN] });
v('sort sparse: values compact front, holes stay holes at end (V8 verified)', { t: 'sparse', len: 4, set: { '0': 3, '2': 1 } }, 'sort', '', [],
  { t: 'sparse', len: 4, set: { '0': 1, '1': 3 } }, undefined, { t: 'sparse', len: 4, set: { '0': 1, '1': 3 } });
v('sort comparator mixed numbers and strings', { t: 'array', dense: [3, 1, '2', 0] }, 'sort', 'dCmp', [],
  { t: 'array', dense: [0, 1, '2', 3] }, undefined, { t: 'array', dense: [0, 1, '2', 3] });
v('sort comparator stability', { t: 'array', dense: [{ k: 1, id: 0 }, { k: 1, id: 1 }, { k: 0, id: 2 }] }, 'sort', 'cmpByK', [],
  { t: 'array', dense: [{ k: 0, id: 2 }, { k: 1, id: 0 }, { k: 1, id: 1 }] }, undefined,
  { t: 'array', dense: [{ k: 0, id: 2 }, { k: 1, id: 0 }, { k: 1, id: 1 }] });
v('sort comparator NaN pins deterministic order (carve-out D7)', { t: 'array', dense: [3, NaN, 1] }, 'sort', 'dCmp', [],
  { t: 'array', dense: [1, 3, NaN] }, undefined, { t: 'array', dense: [1, 3, NaN] });
v('sort array-like object', { t: 'like', len: 3, set: { '0': 3, '1': 1, '2': 2 } }, 'sort', '', [],
  { t: 'like', len: 3, set: { '0': 1, '1': 2, '2': 3 } }, undefined, { t: 'like', len: 3, set: { '0': 1, '1': 2, '2': 3 } });
v('sort(null) throws TypeError', { t: 'null' }, 'sort', '', [], null, 'TypeError');
v('sort non-callable compareFn throws', dense, 'sort', 'number', [], null, 'TypeError');

// ---- splice (ES3, mutating) ----
v('splice removes range', { t: 'array', dense: [1, 2, 3, 4] }, 'splice', '', [1, 2], [2, 3], undefined, { t: 'array', dense: [1, 4] });
v('splice inserts', { t: 'array', dense: [1, 2, 3] }, 'splice', '', [1, 0, 'a', 'b'], [], undefined, { t: 'array', dense: [1, 'a', 'b', 2, 3] });
v('splice negative start', { t: 'array', dense: [1, 2, 3] }, 'splice', '', [-1, 1], [3], undefined, { t: 'array', dense: [1, 2] });
v('splice absent deleteCount deletes to end', { t: 'array', dense: [1, 2, 3] }, 'splice', '', [1], [2, 3], undefined, { t: 'array', dense: [1] });
v('splice replace', { t: 'array', dense: [1, 2, 3] }, 'splice', '', [1, 1, 9], [2], undefined, { t: 'array', dense: [1, 9, 3] });
v('splice empty', empty, 'splice', '', [0, 0, 'x'], [], undefined, { t: 'array', dense: ['x'] });
v('splice(null) throws TypeError', { t: 'null' }, 'splice', '', [0], null, 'TypeError');

// ---- toString (ES3) ----
v('toString joins with comma', dense, 'toString', '', [], '1,2,3,4,5');
v('toString nested arrays', { t: 'array', dense: [[1], [2, 3]] }, 'toString', '', [], '1,2,3');
v('toString undefined becomes empty', { t: 'array', dense: [1, undefined, 2] }, 'toString', '', [], '1,,2');
v('toString on plain object falls back to Object tag', like, 'toString', '', [], '[object Object]');
v('toString(null) throws TypeError', { t: 'null' }, 'toString', '', [], null, 'TypeError');

// ---- find / findIndex (ES6+) ----
v('find first even', dense, 'find', 'firstEven', [], 2);
v('find missing returns undefined', dense, 'find', 'big5', [], undefined);
v('find on sparse skips holes', sparse, 'find', 'truthy', [], 'x');
v('find on array-like', like, 'find', 'gt15', [], 20);
v('find(null) throws TypeError', { t: 'null' }, 'find', 'truthy', [], null, 'TypeError');
v('find non-callable throws', dense, 'find', 'number', [], null, 'TypeError');
v('findIndex first even', dense, 'findIndex', 'firstEven', [], 1);
v('findIndex missing returns -1', dense, 'findIndex', 'big5', [], -1);
v('findIndex on sparse skips holes', sparse, 'findIndex', 'truthy', [], 1);
v('findIndex(null) throws TypeError', { t: 'null' }, 'findIndex', 'truthy', [], null, 'TypeError');
v('findIndex non-callable throws', dense, 'findIndex', 'number', [], null, 'TypeError');

// ---- fill (ES6+, mutating) ----
v('fill all', { t: 'array', dense: [1, 2, 3] }, 'fill', '', [0], [0, 0, 0], undefined, { t: 'array', dense: [0, 0, 0] });
v('fill from start', { t: 'array', dense: [1, 2, 3] }, 'fill', '', [0, 1], [1, 0, 0], undefined, { t: 'array', dense: [1, 0, 0] });
v('fill range', { t: 'array', dense: [1, 2, 3] }, 'fill', '', [0, 1, 2], [1, 0, 3], undefined, { t: 'array', dense: [1, 0, 3] });
v('fill negative start', { t: 'array', dense: [1, 2, 3] }, 'fill', '', [0, -2], [1, 0, 0], undefined, { t: 'array', dense: [1, 0, 0] });
v('fill end before start noop', { t: 'array', dense: [1, 2, 3] }, 'fill', '', [0, 2, 1], [1, 2, 3], undefined, { t: 'array', dense: [1, 2, 3] });
v('fill NaN start is 0', { t: 'array', dense: [1, 2, 3] }, 'fill', '', [9, NaN], [9, 9, 9], undefined, { t: 'array', dense: [9, 9, 9] });
v('fill fills holes', { t: 'sparse', len: 3, set: {} }, 'fill', '', [7], [7, 7, 7], undefined, { t: 'array', dense: [7, 7, 7] });
v('fill explicit undefined end is treated as len', { t: 'array', dense: [1, 2, 3] }, 'fill', '', [0, 1, undefined], [1, 0, 0], undefined, { t: 'array', dense: [1, 0, 0] });
v('fill(null) throws TypeError', { t: 'null' }, 'fill', '', [0], null, 'TypeError');

// ---- copyWithin (ES6+, mutating) ----
v('copyWithin basic', { t: 'array', dense: [1, 2, 3, 4, 5] }, 'copyWithin', '', [0, 3], [4, 5, 3, 4, 5], undefined, { t: 'array', dense: [4, 5, 3, 4, 5] });
v('copyWithin range', { t: 'array', dense: [1, 2, 3, 4, 5] }, 'copyWithin', '', [1, 3, 5], [1, 4, 5, 4, 5], undefined, { t: 'array', dense: [1, 4, 5, 4, 5] });
v('copyWithin negative target/start/end', { t: 'array', dense: [1, 2, 3, 4, 5] }, 'copyWithin', '', [-2, -3, -1], [1, 2, 3, 3, 4], undefined, { t: 'array', dense: [1, 2, 3, 3, 4] });
v('copyWithin negative start only', { t: 'array', dense: [1, 2, 3, 4, 5] }, 'copyWithin', '', [0, -2], [4, 5, 3, 4, 5], undefined, { t: 'array', dense: [4, 5, 3, 4, 5] });
v('copyWithin end before start noop', { t: 'array', dense: [1, 2, 3] }, 'copyWithin', '', [0, 2, 1], [1, 2, 3], undefined, { t: 'array', dense: [1, 2, 3] });
v('copyWithin target beyond length noop', { t: 'array', dense: [1, 2, 3] }, 'copyWithin', '', [5, 0], [1, 2, 3], undefined, { t: 'array', dense: [1, 2, 3] });
v('copyWithin(null) throws TypeError', { t: 'null' }, 'copyWithin', '', [0], null, 'TypeError');

// ---- includes (ES6+) ----
v('includes hit', dense, 'includes', '', [3], true);
v('includes miss', dense, 'includes', '', [99], false);
v('includes NaN matches NaN', { t: 'array', dense: [1, NaN, 3] }, 'includes', '', [NaN], true);
v('includes -0 matches 0', { t: 'array', dense: [0] }, 'includes', '', [-0], true);
v('includes no coercion', { t: 'array', dense: ['1', 2] }, 'includes', '', [1], false);
v('includes fromIndex', dense, 'includes', '', [2, 2], false);
v('includes negative fromIndex', { t: 'array', dense: [1, 2, 3] }, 'includes', '', [3, -1], true);
v('includes beyond length', { t: 'array', dense: [1, 2] }, 'includes', '', [1, 5], false);
v('includes finds undefined element', withUndef, 'includes', '', [undefined], true);
v('includes matches holes as undefined (V8 behavior)', sparse, 'includes', '', [undefined], true);
v('includes on string array-like', strLike, 'includes', '', ['b'], true);
v('includes(null) throws TypeError', { t: 'null' }, 'includes', '', [1], null, 'TypeError');

// ---- flat (ES6+/ES2019) ----
v('flat default depth 1', { t: 'array', dense: [1, [2, [3]]] }, 'flat', '', [], [1, 2, [3]]);
v('flat depth 2', { t: 'array', dense: [1, [2, [3, [4]]]] }, 'flat', '', [2], [1, 2, 3, [4]]);
v('flat Infinity', { t: 'array', dense: [1, [2, [3, [4]]]] }, 'flat', '', [Infinity], [1, 2, 3, 4]);
v('flat removes holes', { t: 'sparse', len: 3, set: { '0': 1, '2': 3 } }, 'flat', '', [], [1, 3]);
v('flat depth 0 no flatten', { t: 'array', dense: [1, [2]] }, 'flat', '', [0], [1, [2]]);
v('flat negative depth no flatten', { t: 'array', dense: [1, [2]] }, 'flat', '', [-1], [1, [2]]);
v('flat explicit undefined depth is treated as 1', { t: 'array', dense: [1, [2]] }, 'flat', '', [undefined], [1, 2]);
v('flat(null) throws TypeError', { t: 'null' }, 'flat', '', [], null, 'TypeError');

// ---- flatMap (ES6+/ES2019) ----
v('flatMap expands', dense, 'flatMap', 'flatDup', [], [1, 10, 2, 20, 3, 30, 4, 40, 5, 50]);
v('flatMap scalar pairs', { t: 'array', dense: [1, 2] }, 'flatMap', 'flatStr', [], ['1', 0, '2', 1]);
v('flatMap empty', empty, 'flatMap', 'flatDup', [], []);
v('flatMap(null) throws TypeError', { t: 'null' }, 'flatMap', 'flatDup', [], null, 'TypeError');
v('flatMap non-callable throws', dense, 'flatMap', 'number', [], null, 'TypeError');

// ---- from (ES6+, static) ----
v('from string', strLike, 'from', '', [], ['a', 'b', 'c']);
v('from array-like with mapFn', { t: 'like', len: 3, set: { '0': 1, '1': 2, '2': 3 } }, 'from', 'strIdx', [], ['1#0', '2#1', '3#2']);
v('from preserves holes as undefined elements (Node behavior)', { t: 'like', len: 3, set: { '0': 1, '2': 3 } }, 'from', 'strIdx', [],
  { t: 'array', dense: ['1#0', 'undefined#1', '3#2'] });
v('from without mapFn copies holes as undefined elements', { t: 'like', len: 3, set: { '0': 1, '2': 3 } }, 'from', '', [],
  { t: 'array', dense: [1, undefined, 3] });
v('from empty', { t: 'like', len: 0, set: {} }, 'from', '', [], []);
v('from(null) throws TypeError', { t: 'null' }, 'from', '', [], null, 'TypeError');

// ---- of (ES6+, static) ----
v('of empty', empty, 'of', '', [], []);
v('of values', empty, 'of', '', [1, 'a', null], [1, 'a', null]);
v('of single undefined is an element', empty, 'of', '', [undefined], [undefined]);
v('of sparse-ish spread of values', empty, 'of', '', [1, [2], 3], [1, [2], 3]);

// ---- entries / keys / values (ES6+) ----
v('entries sequence', dense3, 'entries', '', [], [[0, 'a'], [1, 'b'], [2, 'c']]);
v('entries yields undefined for holes', { t: 'sparse', len: 2, set: {} }, 'entries', '', [], [[0, undefined], [1, undefined]]);
v('entries on array-like', like, 'entries', '', [], [[0, 10], [1, 20], [2, 30]]);
v('entries on string', strLike, 'entries', '', [], [[0, 'a'], [1, 'b'], [2, 'c']]);
v('keys sequence', dense3, 'keys', '', [], [0, 1, 2]);
v('keys yields all indices for holes', { t: 'sparse', len: 2, set: {} }, 'keys', '', [], [0, 1]);
v('values sequence', dense3, 'values', '', [], ['a', 'b', 'c']);
v('values yields undefined for holes', { t: 'sparse', len: 2, set: {} }, 'values', '', [], [undefined, undefined]);

// ---- indexOf / lastIndexOf spec edges ----
v('indexOf -0 matches 0 by strict equality', { t: 'array', dense: [0] }, 'indexOf', '', [-0], 0);
v('indexOf NaN never found (strict)', { t: 'array', dense: [NaN] }, 'indexOf', '', [NaN], -1);
v('lastIndexOf from -0.5 returns -0 (ES5.1-exact, carve-out D3)', dense, 'lastIndexOf', '', [1, -0.5], -0);
v('lastIndexOf from -0 returns +0 (matches Node; || 0 fast path)', dense, 'lastIndexOf', '', [1, -0], 0);
v('lastIndexOf from 0.5 truncates to 0 and scans down', dense, 'lastIndexOf', '', [2, 0.5], -1);
