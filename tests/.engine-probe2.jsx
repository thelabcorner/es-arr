#target illustrator
$.evalFile(File("C:/Program Files/Adobe/Adobe Illustrator 2026/Presets/en_US/Scripts/esarr/dist/vendor-esarr.js"));
var out = {};
out.loaded = typeof ESARR === 'object';
out.includesType = typeof ESARR.includes;
out.includesCall = ESARR.includes([1, 2, 3, 4, 5], 3);
out.report = out;
out.report;
