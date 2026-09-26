import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildProject } from '../../extendscript-toolchain/src/build.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const PROJECT = join(ROOT, '..');

// Build the Illustrator-only probe glue through the same compatibility and
// final-artifact gate as production ES* bundles. The probe sources are test
// infrastructure rather than a separately typed product surface, so host
// typecheck/source-lint stay off here; the emitted JSX still receives ESTC's
// esbuild-helper guard, strict removal, ES3 normalization, and final check.
export async function buildLiveProbe(outfile) {
  return buildProject({
    cwd: PROJECT,
    entry: join(ROOT, 'probe-glue.ts'),
    outfile,
    target: 'illustrator',
    requireTarget: false,
    sourceLint: false,
    typecheck: false,
    normalize: true,
    compatibilityTransforms: ['esbuild'],
    compatibilityShims: [],
    allowedMissingBuiltins: [],
    allowedGlobalPatches: [],
    prelude: [],
    footer: [],
    allowJson: false,
    allowIncludes: false,
    live: false,
    liveLaunch: false
  });
}