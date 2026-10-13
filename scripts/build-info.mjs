import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const repositoryRoot = new URL('../', import.meta.url);

function readGit(args) {
  try {
    return execFileSync('git', args, {
      cwd: repositoryRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

export async function writeBuildInfo(outputDirectory) {
  const commit = process.env.WORKERS_CI_COMMIT_SHA || readGit(['rev-parse', 'HEAD']);
  const branch = process.env.WORKERS_CI_BRANCH || readGit(['branch', '--show-current']) || 'detached';
  if (!commit || !/^(?:[a-f\d]{40}|[a-f\d]{64})$/i.test(commit)) {
    throw new Error('Build identity is unavailable. Build from a Git checkout or set WORKERS_CI_COMMIT_SHA.');
  }
  const metadata = { commit, branch, builtAt: new Date().toISOString() };
  await writeFile(join(outputDirectory, 'build-info.json'), `${JSON.stringify(metadata, null, 2)}\n`);
  return metadata;
}
