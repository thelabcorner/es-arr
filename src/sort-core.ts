// ESARR sort core — shared merge-sort machinery for Array.prototype.sort
// (ES5.1 §15.4.4.11) and Array.prototype.toSorted (ES2023 §23.1.3.33).
//
// Sort items are `[present, value]` pairs: present=false marks a hole. The
// two specs order holes/undefined differently:
//   - ES5.1 sort:      hole < undefined < values   (hole sorts FIRST)
//   - ES2023 toSorted: hole > undefined > values   (hole sorts LAST, and
//                       holes are not written back — they stay holes)
// Both defer to comparefn (when provided) or the ToString comparison for
// ordinary values, and neither ever passes undefined/holes to comparefn.
//
// Merge sort is O(n log n) with a stable result (the ES5.1 spec does not
// require stability; stable matches V8/SpiderMonkey's modern behavior and
// makes the differential oracle deterministic). ES3-clean output.

export interface SortItem {
  present: boolean;
  value: any;
}

function defaultCompare(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

// ES5.1 §15.4.4.11 SortCompare(j, k) — holes and undefined both sort AFTER
// values; holes after undefined (spec: "If hasj is false, return 1"; note:
// "undefined property values always sort to the end of the result, followed
// by non-existent property values"). Order: value < undefined < hole.
// Identical ordering to ES2023's toSorted SortIndexedProperties, hence the
// shared es2023SortCompare below (the spec text changed shape between 5.1
// and ES2015 but the total order did not).
export function es5SortCompare(x: SortItem, y: SortItem, fn?: any): number {
  return es2023SortCompare(x, y, fn);
}

// ES2023 §23.1.3.33 SortIndexedProperties comparison (skip-holes): holes
// sort AFTER everything (including undefined); undefined after values.
export function es2023SortCompare(x: SortItem, y: SortItem, fn?: any): number {
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

// In-place stable merge sort over the items array; cmp is the comparator.
export function mergeSortItems(items: SortItem[], cmp: (a: SortItem, b: SortItem) => number): void {
  var n = items.length;
  if (n <= 1) return;
  var tmp: SortItem[] = new Array(n);
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
