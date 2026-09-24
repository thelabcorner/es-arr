// ESARR full vendor (dist/vendor-esarr.js): facade + the documented gap-fill
// installer footer. The footer mutates Array.prototype / Array statics ONLY
// where the method is absent — that is ESARR's public polyfill contract, and
// the mutations happen through the captured global object (never a raw
// core-built-in assignment), so no ESTC global-patch allowance is needed.
export default {
  host: 'illustrator',
  hostTypes: 'Illustrator/2022',
  additionalTypes: ['./src/globals.d.ts'],
  entry: 'src/index.ts',
  outfile: 'dist/vendor-esarr.js',
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
