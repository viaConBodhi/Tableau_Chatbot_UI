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

The user confirmed on October 13, 2026 that Settings > Build offers Production
and Previews Base, with Builds for Preview branches enabled. This Worker uses
the newer Worker Previews model. The reported Preview command had the typo
`npx wrander preview`, and its Build command was blank.

Select Previews Base, edit its build configuration, and save:

| Setting | Value |
| --- | --- |
| Build command | `npm run build` |
| Preview command | `npx wrangler preview` |
| Root directory | `/` |
| Builds for Preview branches | Enabled |

Production retains branch `main`, build `npm run build`, and deploy
`npx wrangler deploy`. The user confirmed these settings were saved on
October 13, 2026. Create `dev` from the verified bootstrap revision; that local
branch already exists. Push it only after publication review/approval.

On October 13, 2026, the owner confirmed the SDK licensing review was complete
and approved committing/pushing the prepared `dev` changes to trigger the
Cloudflare development preview build. Production publication remains a separate
checkpoint.

For an approved manual publication from `dev`, the branch-guarded helper is:

```sh
npm run deploy:dev
```

This helper invokes `wrangler preview --name dev`. The CI command defaults its
Preview name to the branch. Both use Worker Previews, without promoting a version
to production. The required empty `previews` block is in `wrangler.jsonc`;
assets and compatibility settings remain at the top level. There are no runtime
secrets or backend bindings in this diagnostic.

The originally planned Version URL
<https://dev-tableau-chatbot-ui.algo-alert-cramer.workers.dev/> is unverified.
After the first successful preview build, record its actual stable Preview URL,
update `scripts/manifests.mjs` if it differs, regenerate the manifests, and
verify the exact SHA before Tableau Server testing. Keep the unique deployment
URL as release evidence. Never run `wrangler deploy` against the production
Worker from non-production builds.

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
| Local resize diagnostic | Passed: 21 tests, production build, Worker dry run, full asset verification, and Chrome 155 browser smoke |
| Rollback and recovery rehearsal | Pending |
| Development alias | Pending |
| Desktop resize gate | Core interaction checks passed by user report on October 13, 2026; remaining evidence and keyboard/layout checks in `RESIZE_SPIKE.md` |
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
