// ESARR runtime core (dist/ESARR-runtime.jsx): methods-only bundle for per-eval
// injection; build intermediate (no installer footer, not standalone-loadable).
export default {
  host: 'illustrator',
  hostTypes: 'Illustrator/2022',
  additionalTypes: ['./src/globals.d.ts'],
  entry: 'src/jsx-runtime-entry.ts',
  outfile: 'dist/ESARR-runtime.jsx',
  globalName: '__ESARR_RUNTIME_ENTRY__',
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
