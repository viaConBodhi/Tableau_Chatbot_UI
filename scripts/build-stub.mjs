import { cp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { repositoryRoot, writeBuildInfo } from './build-info.mjs';

const publicDirectory = new URL('public/', repositoryRoot);
const outputDirectory = fileURLToPath(new URL('dist/', repositoryRoot));
await rm(outputDirectory, { recursive: true, force: true });
await cp(publicDirectory, outputDirectory, { recursive: true });
const metadata = await writeBuildInfo(outputDirectory);
console.log(`Built hosting placeholder for ${metadata.branch} at ${metadata.commit}.`);
