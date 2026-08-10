#target illustrator
// VERIFY engine probe: includes + mixed-type sort behavior
$.evalFile(File("C:/Program Files/Adobe/Adobe Illustrator 2026/Presets/en_US/Scripts/esarr/dist/vendor-esarr.js"));
ESARR.install({ forceReplace: true });
var out = {};
out.includesType = typeof ESARR.includes;
out.esarrIncludes = ESARR.includes([1, 2, 3, 4, 5], 3);
out.protoIncludes = [1, 2, 3, 4, 5].includes(3);
out.includesUndefArg = ESARR.includes([1, 2, 3, 4, 5], 3, void 0);
out.includesNaN = ESARR.includes([1, NaN, 3], NaN);
out.lenOf = [1, 2, 3, 4, 5].length;
var cmp = function (a, b) {
  if (typeof a === 'number' && typeof b === 'number') { return a - b; }
  var sa = String(a), sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
};
out.sortMixed = ESARR.sort([3, 1, '2', 0], cmp);
out.sortMixedProto = [3, 1, '2', 0].sort(cmp);
out.strCmp = ('1' < '2') + '|' + ('2' < '3');
out.numType = typeof 3;
out.strType = typeof '2';
out.stringOf1 = String(1);
out.stringOf2 = String('2');
out.report = out;
out.report;
