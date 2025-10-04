import { build } from 'esbuild';

build({
  entryPoints: ['./lambda/lambdaCode.mjs'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  outfile: './dist/lambdaCode.js',
  external: ['aws-sdk'],
}).catch(() => process.exit(1));
