import { build } from 'esbuild';

await build({
  entryPoints: ['login.js'],
  outfile: 'dist/dist/login.js',
  bundle: true,
  minify: true,
});

await build({
  entryPoints: ['server.js'],
  outfile: 'dist/index.mjs',
  platform: 'node',
  target: 'node24',
  format: 'esm',
  bundle: true,
  minify: true,
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});
