import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { build } from 'vite';
import { repositoryRoot, writeBuildInfo } from './build-info.mjs';
import { MANIFESTS, makeManifest, validateManifest } from './manifests.mjs';

const source = await readFile(new URL('src/assets/robot.svg', repositoryRoot), 'utf8');
const artwork = await sharp(Buffer.from(source.replace('stroke="currentColor"', 'stroke="#ffffff"'))).resize(54, 54).png().toBuffer();
const icon = await sharp({ create: { width: 70, height: 70, channels: 4, background: '#243447' } }).composite([{ input: artwork, left: 8, top: 8 }]).png().toBuffer();

for (const configuration of MANIFESTS) {
  const xml = makeManifest(configuration, icon.toString('base64'));
  validateManifest(xml, configuration);
  await writeFile(new URL(`public/${configuration.file}`, repositoryRoot), xml);
}

const vendor = JSON.parse(await readFile(new URL('vendor/tableau-extensions-api.json', repositoryRoot), 'utf8'));
const library = await readFile(new URL('public/lib/tableau.extensions.1.17.0.js', repositoryRoot));
if (createHash('sha256').update(library).digest('hex') !== vendor.files['lib/tableau.extensions.1.17.0.js']) {
  throw new Error('The vendored Tableau SDK no longer matches its recorded upstream checksum.');
}
const license = await readFile(new URL('public/licenses/tableau-extensions-api.LICENSE.txt', repositoryRoot));
if (createHash('sha256').update(license).digest('hex') !== vendor.files['LICENSE.txt']) {
  throw new Error('The Tableau SDK license notice no longer matches its upstream checksum.');
}
for (const packageName of ['react', 'react-dom']) {
  const notice = await readFile(new URL(`node_modules/${packageName}/LICENSE`, repositoryRoot));
  await writeFile(new URL(`public/licenses/${packageName}.LICENSE.txt`, repositoryRoot), notice);
}

await build({ root: fileURLToPath(repositoryRoot) });
const metadata = await writeBuildInfo(fileURLToPath(new URL('dist/', repositoryRoot)));
console.log(`Built Tableau resize diagnostic for ${metadata.branch} at ${metadata.commit}.`);
