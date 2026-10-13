import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { repositoryRoot } from './build-info.mjs';

const branch = process.env.WORKERS_CI_BRANCH || execFileSync('git', ['branch', '--show-current'], { cwd: repositoryRoot, encoding: 'utf8' }).trim();
if (branch !== 'dev') {
  console.error('Only the dev branch may publish the reserved dev preview alias.');
  process.exitCode = 1;
} else {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('node_modules/wrangler/bin/wrangler.js', repositoryRoot)), 'versions', 'upload', '--preview-alias', 'dev'], { cwd: repositoryRoot, stdio: 'inherit' });
  if (result.error) console.error(result.error.message);
  process.exitCode = result.status ?? 1;
}
