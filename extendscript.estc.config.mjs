// ESARR standalone facade (dist/ESARR.jsx): ESTC is the canonical emission
// path. ESTC owns ES3 normalization and keeps esbuild's helper compatibility
// bundle-local instead of mutating host globals (no Function.prototype.bind
// shim, no Object.defineProperty alias leaking to the engine).
export default {
  host: 'illustrator',
  hostTypes: 'Illustrator/2022',
  additionalTypes: ['./src/globals.d.ts'],
  entry: 'src/jsx-entry.ts',
  outfile: 'dist/ESARR.jsx',
  globalName: '__ESARR_ENTRY__',
  target: 'illustrator',
  requireTarget: false,
  sourceLint: true,
  typecheck: true,
  normalize: true,
  compatibilityTransforms: ['esbuild'],
  compatibilityShims: [],
  allowedMissingBuiltins: [],
  allowedGlobalPatches: [],
  prelude: [],
  footer: [{ file: 'tooling/estc-facade-alias.js' }],
  allowJson: false,
  allowIncludes: false,
  live: false,
  liveLaunch: false
};
