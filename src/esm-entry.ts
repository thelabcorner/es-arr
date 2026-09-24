// ESM-only entry (dist/esarr-core.esm.mjs). `with` is an ES3 reserved word, so
// the shared implementation (src/index.ts) exports the safe name `withMethod`
// and the JSX path attaches the public ESARR["with"] alias by bracket notation
// (tooling/estc-facade-alias.js). This entry preserves the modern ESM named
// export `with` that Node consumers may import, alongside `withMethod`.
export * from './index';
export { withMethod as with } from './array-es6';
