# Cloudflare Workers deployment

## Bootstrap configuration

The existing project is Worker `tableau-chatbot-ui` under the
`algo-alert-cramer` workers.dev subdomain. Confirm these details in Cloudflare
before publication. The earlier build failed because Wrangler could not find
static assets. This revision builds `dist` and declares it in `wrangler.jsonc`.
It requires no Worker application code or runtime secrets.

In **Settings > Build**, use:

| Setting | Value |
| --- | --- |
| Repository | `viaConBodhi/Tableau_Chatbot_UI` |
| Production branch | `main` |
| Root directory | Repository root (blank or `/` in the UI) |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Node version | Node 22.23.3; respect `.nvmrc` or explicitly configure it |

There is no Pages framework preset or Pages output-directory setting. Assets
come from Wrangler configuration. The build must run before deploy: `dist` is
not committed. Locally use `npm ci`. Confirm dependency installation from the
lockfile in the first Cloudflare build log.

## Verify the exact revision

After the approved push, inspect the newly triggered build, not the original
failed commit. Match the intended full Git SHA and active production version.

```sh
npm run verify:deploy -- https://tableau-chatbot-ui.algo-alert-cramer.workers.dev/
```

When using the development verifier against the production bootstrap, add
`--bootstrap` (the stub has no extension manifests or scripts).

The optional second argument is the full expected SHA. Without it the verifier
uses local HEAD. It checks HTML content, revision, headers, redirects, and
missing-file 404s. `build-info.json` contains only commit, branch, and UTC build
time. Workers Builds supplies `WORKERS_CI_COMMIT_SHA` and `WORKERS_CI_BRANCH`;
local builds use Git. Do not put secrets or Tableau context in metadata.

**Gate passed:** production bootstrap `830ce9101206d3b78538079d38369864b858fac5`
was verified on October 13, 2026. The new development verifier also validates XML,
environment URLs, application assets, and the SDK checksum.

## Development publishing (after the bootstrap gate)

Create `dev` from the verified bootstrap revision. Enable non-production builds
and configure their command:

```sh
npm run deploy:dev
```

This script enforces the `dev` branch and invokes
`wrangler versions upload --preview-alias dev`. It uses a Worker Version URL,
updating the development alias without
promoting that version to production. Preserve this model; do not switch to a
different Cloudflare preview model while following these instructions.

Development: <https://dev-tableau-chatbot-ui.algo-alert-cramer.workers.dev/>

Only `dev` may update that alias. Additional branches need separate aliases or
a branch guard. Never run `wrangler deploy` against the production Worker from
non-production builds.

## Headers and missing files

`public/_headers` is copied to `dist`: `nosniff`, `noindex`, revalidation for
HTML/metadata/manifests, and no frame restriction. Inspect the successful
application response: an undeployed Worker's error-page headers do not describe
the eventual app. Leave SPA fallback disabled so missing `.trex` or JavaScript
files cannot return an HTML 200.

## Rollback rehearsal and release

Rehearse once using two identifiable bootstrap versions, with approval before
production publication:

1. Record the commit and Worker version IDs for both versions.
2. Use the Worker's deployment UI to roll production back to the first version.
3. Verify using that version's expected SHA as the second verifier argument.
4. Redeploy the intended current revision and verify its SHA again.
5. Record the outcome. A lasting rollback also requires a Git revert so the next
   `main` build does not restore the unwanted change.

For the extension release, review and merge `dev` into `main` after acceptance.
Verify production and the pilot dashboard after merge. A version rollback
normally retains manifest/safe-list URLs, but reload and check compatibility
with the manifest already in the workbook.

## Evidence record

| Check | Status |
| --- | --- |
| Clean lockfile installation | Passed with `npm ci` |
| Local bootstrap build and Wrangler dry run | Passed on Node 22.23.3 and 24.21.0 / Wrangler 4.149.0 |
| Local HTTP verification and failure detection | Passed; correct revision, headers, body, 404, and rejection fixtures |
| Production bootstrap deployment | Passed: `830ce91`, October 13, 2026; HTML, revision, framing/cache headers, and 404 behavior |
| Local resize diagnostic | Passed: 20 tests, production build, Worker dry run, full asset verification, and Chrome 155 browser smoke |
| Rollback and recovery rehearsal | Pending |
| Development alias | Pending |
| Desktop resize gate | Pending |
| Server authoring/viewing resize gate | Pending |
| Firefox and Chrome acceptance | Pending |
| Production extension release | Pending |

For each release, record tested SHA, Worker version, URLs, Desktop/Server/browser
versions, dashboard dimensions, outcomes, and export observations. Mark a check
complete only when its evidence exists.

## References

- [Workers Builds](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)
- [Static assets](https://developers.cloudflare.com/workers/static-assets/)
- [Version aliases](https://developers.cloudflare.com/workers/versions-and-deployments/version-urls/)
- [Rollbacks](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)
