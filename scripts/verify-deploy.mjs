import { execFileSync } from 'node:child_process';
import { repositoryRoot } from './build-info.mjs';

const [baseArgument, commitArgument, ...extraArguments] = process.argv.slice(2);

function expectedCommit() {
  if (commitArgument) return commitArgument;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    throw new Error('Supply the expected full Git commit SHA when running outside a Git checkout.');
  }
}

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

async function fetchAsset(base, path) {
  const response = await fetch(new URL(path, base), {
    redirect: 'manual',
    signal: AbortSignal.timeout(15_000),
  });
  requireCondition(response.status < 300 || response.status >= 400, `${path}: unexpected redirect (${response.status}).`);
  return response;
}

function checkApplicationHeaders(response, path) {
  requireCondition(!response.headers.has('x-frame-options'), `${path}: X-Frame-Options would prevent the planned Tableau framing.`);
  const csp = response.headers.get('content-security-policy') || '';
  requireCondition(!/(?:^|;)\s*frame-ancestors\b/i.test(csp), `${path}: unexpected frame-ancestors policy; inspect Tableau compatibility.`);
  requireCondition(response.headers.get('x-content-type-options')?.toLowerCase() === 'nosniff', `${path}: missing X-Content-Type-Options: nosniff.`);
  requireCondition(/\bnoindex\b/i.test(response.headers.get('x-robots-tag') || ''), `${path}: missing X-Robots-Tag: noindex.`);
  requireCondition(/\b(?:no-cache|no-store|must-revalidate)\b/i.test(response.headers.get('cache-control') || ''), `${path}: response does not require cache revalidation.`);
}

async function verify() {
  requireCondition(baseArgument && extraArguments.length === 0, 'Usage: npm run verify:deploy -- <base-url> [expected-full-commit-sha]');
  const base = new URL(baseArgument);
  requireCondition(!base.username && !base.password && !base.search && !base.hash && base.pathname === '/', 'Use a base origin URL without credentials, path, query, or fragment.');
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
  requireCondition(base.protocol === 'https:' || (base.protocol === 'http:' && loopback), 'Use HTTPS for hosted deployments, or HTTP on localhost for local checks.');
  const commit = expectedCommit();
  requireCondition(/^(?:[a-f\d]{40}|[a-f\d]{64})$/i.test(commit), 'Expected commit must be a full Git commit SHA.');

  const results = await Promise.allSettled([
    fetchAsset(base, '/'),
    fetchAsset(base, '/build-info.json'),
    fetchAsset(base, '/definitely-missing.trex'),
  ]);
  const labels = ['/', '/build-info.json', '/definitely-missing.trex'];
  const errors = [];
  for (const [index, result] of results.entries()) {
    if (result.status === 'rejected') errors.push(`${labels[index]}: ${result.reason.message}`);
  }
  requireCondition(errors.length === 0, errors.join('\n'));
  const [root, info, missing] = results.map((result) => result.value);

  requireCondition(root.status === 200, `/: expected 200, received ${root.status}.`);
  requireCondition(/^text\/html\b/i.test(root.headers.get('content-type') || ''), '/: expected an HTML content type.');
  checkApplicationHeaders(root, '/');
  requireCondition((await root.text()).includes('id="root"'), '/: response is missing the application root marker.');
  console.log('PASS application HTML and framing/cache headers');

  requireCondition(info.status === 200, `/build-info.json: expected 200, received ${info.status}.`);
  requireCondition(/^application\/json\b/i.test(info.headers.get('content-type') || ''), '/build-info.json: expected a JSON content type.');
  checkApplicationHeaders(info, '/build-info.json');
  const metadata = await info.json();
  requireCondition(metadata.commit === commit, `Deployment revision mismatch: expected ${commit}, received ${metadata.commit}.`);
  requireCondition(typeof metadata.branch === 'string' && metadata.branch.length > 0, 'Build metadata has no branch.');
  requireCondition(typeof metadata.builtAt === 'string' && Number.isFinite(Date.parse(metadata.builtAt)), 'Build metadata has an invalid build timestamp.');
  console.log(`PASS build identity: ${metadata.branch} / ${metadata.commit}`);

  requireCondition(missing.status === 404, `/definitely-missing.trex: expected 404, received ${missing.status}; disable HTML/SPA fallback.`);
  console.log('PASS missing assets return 404');
  console.log(`Verified ${base.origin} for commit ${commit}.`);
}

try {
  await verify();
} catch (error) {
  console.error(`Deployment verification failed: ${error.message}`);
  process.exitCode = 1;
}
