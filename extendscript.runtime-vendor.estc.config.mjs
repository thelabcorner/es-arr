// ESARR runtime vendor (dist/vendor-esarr-runtime.js): methods-only facade +
// the same documented gap-fill installer footer (single source:
// tooling/estc-vendor-footer.js). install()/capabilities()/benchmark()/gate
// API are tree-shaken out by the runtime entry.
export default {
  host: 'illustrator',
  hostTypes: 'Illustrator/2022',
  additionalTypes: ['./src/globals.d.ts'],
  entry: 'src/runtime.ts',
  outfile: 'dist/vendor-esarr-runtime.js',
  globalName: 'ESARR',
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
  footer: [
    { file: 'tooling/estc-facade-alias.js' },
    { file: 'tooling/estc-vendor-footer.js' }
  ],
  allowJson: false,
  allowIncludes: false,
  live: false,
  liveLaunch: false
};
