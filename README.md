# CCTR Tableau AI Guide

AI Guide will provide a chat panel inside a Tableau dashboard. Phase 1 uses
in-memory mock responses; it does not connect to AWS or collect user identity.

This revision is the hosting bootstrap. It publishes a placeholder through the
existing Cloudflare Worker before the Tableau extension is built.

## Hosting

Production: <https://tableau-chatbot-ui.algo-alert-cramer.workers.dev/>

Planned development alias:
<https://dev-tableau-chatbot-ui.algo-alert-cramer.workers.dev/>

Use **Cloudflare Workers Builds**, not Pages:

| Setting | Value |
| --- | --- |
| Production branch | `main` |
| Root directory | Repository root |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Assets directory | `./dist`, configured in `wrangler.jsonc` |

Wrangler is pinned in `package.json` and `package-lock.json`. Cloudflare supplies
the build authentication; credentials do not belong in this repository.

## Local verification

Use Node 22.12 or later; `.nvmrc` selects the planned Node 22 deployment runtime.

```sh
npm ci
npm run build
npm run preview
```

In another terminal, verify the locally served placeholder:

```sh
npm run verify:deploy -- http://localhost:8787/
```

Verify a hosted deployment against the current checkout's commit:

```sh
npm run verify:deploy -- https://tableau-chatbot-ui.algo-alert-cramer.workers.dev/
```

You can supply a full expected commit SHA as the second argument. Verification
checks the HTML body, deployment revision, headers, and missing-file behavior;
an HTTP 200 alone does not prove a correct deployment.

See [deployment instructions](docs/DEPLOYMENT.md) and the
[Phase 1 requirements](docs/PHASE_1_PLAN.md).

## License

The existing GPLv2 license is preserved. Before bundling the Tableau SDK and
copying the Forge UI, confirm licensing and retain upstream notices. No Tableau
SDK or Forge application code is included in this bootstrap.
