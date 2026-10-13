# CCTR Tableau AI Guide — Phase 1

## Decisions and boundaries

Reuse the existing Informatics Forge chat experience as a Tableau dashboard
extension. Phase 1 supplies an in-memory mock and GitHub-to-Cloudflare Workers
delivery. Phase 2 supplies on-prem gateway, SSO, authorization, and AWS.

- Server 2026.2.0 (`20262.26.0603.1643`); Firefox and Chrome.
- Running Desktop confirmed as 2025.1 (`20251.26.0905.0333`), Qt WebEngine
  5.15.18 / Chromium 87.0.4280.144. Build for Chrome 87 and avoid newer-only
  runtime APIs. Desktop 2026.2 is installed but was not the running test process.
- One company pilot workbook, followed by author opt-in.
- Names-only dashboard/worksheet context. No identity, filters, parameters,
  underlying data, or external transmission of chat/context.
- Preserve chat, draft, scroll, and pending replies while toggling; clear on
  reload. Isolate extension instances.
- Require Desktop and hosted Server acceptance before Phase 1 completion.
- Original white-outline robot beside `AI Guide`. Preserve existing license and
  user changes; confirm redistribution terms for Tableau SDK/copied Forge code.
- No gateway, real backend, durable history, streaming, Markdown, feedback,
  or implemented export support in Phase 1.

## Gates and delivery

1. Bootstrap `main`: placeholder, `dist`, pinned Wrangler, build identity,
   verifier, documentation. Publish and verify the exact production revision.
2. Create `dev` only after production verification. Add Vite/React and Tableau
   SDK, then publish the `dev` Worker Preview and verify its stable URL.
3. Prove floating self-resize in Desktop. Hosted Server acceptance remains
   required for release, but its safe-list prerequisite currently delays testing.
4. Port UI and deterministic mocks; run automated/manual acceptance.
5. Review `dev` to `main`, approve merge, and verify production.

On October 13, 2026, the user explicitly requested continuing the chat interface
for Desktop while awaiting the Tableau Server administrator's safe-list entry.
This overrides the earlier requirement to finish hosted resize acceptance before
the UI port. Server layout/browser acceptance remains pending and required before
production release; this change does not authorize production publication.

Retain publication approval checkpoints. Follow `DEPLOYMENT.md` for settings,
URLs, verification, and rollback. Exact-pin compatible dependencies and commit
the lockfile. Use supported Node 22; Vite relative base, localhost:5173, strict
port; locally vendored `tableau.extensions.1.17.0.js` before app initialization.

Generate local/dev/production manifests from one template: distinct names/IDs,
base `com.github.viaconbodhi.cctr.aiguide`, version `0.1.0`, minimum API `1.7`,
CCTR author/organization, required author email (`infoserv@vcu.edu`), HTTPS GitHub
support URL, original 70x70 PNG, and no full-data
permission. UTF-8 XML declaration at byte zero; hosted HTTPS, localhost HTTP.

## Host integration and panel

No supported API was found for a native button beside Data Guide. Use a floating
extension near the upper-right corner. Authors add it per dashboard; expansion
can cover charts. A tiled object shows instructions to use floating placement.

Initialize once with a 10-second bounded wait, explicit error/Retry, stale-attempt
guard, and listener cleanup. Never silently replace a failed integration with a
demo. Local Vite standalone requires `?standalone=1` and a badge; production
ignores it. Direct deployed visits explain that the app runs inside Tableau.

Spike diagnostics: own object ID, floating/visible state, authored geometry,
dashboard size, versions/mode, and last resize outcome.

- Capture authored geometry before expansion. Default button 140x36; preferred
  panel 420x700, 8px margin, bounded by `dashboard.size`, anchored at authored
  right edge where possible.
- Await resize before committing expanded/collapsed UI. Restore exact authored
  geometry when it fits, otherwise clamp to changed dashboard dimensions.
- Failed collapse retains panel, Close, and error. Disable toggles during resize.
- Serialize layout events; distinguish authored moves from self-resizes, including
  delayed events. Never capture expanded bounds as collapsed geometry or loop.
- Header/composer stay reachable; message list scrolls independently. Test about
  600x400 and a larger pilot dashboard; useful size warning below support size.
- Conversation state lives above panel visibility; closure cannot discard replies.

Gate for release: Desktop and Server authoring/non-author viewing pass init,
expansion, collapse/restoration, layouts, and small/large tests. The Desktop UI
port may proceed while Server safe-list approval is pending, as authorized above.
If necessary, validate native Show/Hide over a floating container and agree
on the changed interaction before continuing.

## Chat and API seam

Port Forge bubbles, labels, sources/excerpts, loading/errors, New conversation,
2000-character composer, and submit/race guards. Remove bridge/profile/router,
Atlassian reset, fixed heights, and storage IDs. Use `You`, local CSS, React 18
`createRoot`, safe external links, and always-visible
`Phase 1 demo — no backend connected`. Enter is newline; reject blank messages.

Adapter: `startConversation()`,
`sendMessage({conversationId, requestId, message, context})`, and
`resetConversation({conversationId})`. Reset returns replacement only on
success; failure retains current conversation/draft. Remove startup list/get:
fresh reload and no history list. Reset makes no durable deletion promise.

Retain `{ok, code, message, ...}` and conversation ID/messages with IDs, roles,
string `text`, optional sources. Validate before state updates; malformed replies
become `BACKEND_BAD_RESPONSE`. Do not require top-level `answer`. Future HTTP,
auth, signing, and AWS formats stay behind the gateway adapter.

Secure random request IDs; freeze message and names-only context per new send.
Retry reuses the same ID/payload; editing makes a new request; success clears
retry state. Deduplicate completed IDs and ignore stale/disposed responses.
Sending/reset cannot conflict, but panel closure remains available.

Host `getDashboardContext()` returns `{dashboardName, worksheetNames}` or
`null` standalone. Mocks may echo the name locally.

## Scenarios and acceptance

Mocks: `ok`, `slow`, `sources`, `send-fail-once`, `send-fail-always`, `reset-fail`,
`malformed`. Local and explicitly enabled hosted `dev` allow `?mock=<scenario>`;
production ignores overrides. Include completed processing followed by transport
failure to prove duplicate-safe retry.

Vitest/React Testing Library: duplicate submits; newline/limit/blank; retry
ID/context and deduplication; stale response; reset preservation; malformed
response; pending reply on close; resize failure/loops; unsafe sources; isolation.

Manual: local standalone scenarios, Desktop manifest, Server authoring and
non-author viewing, Firefox/Chrome, exact production SHA/manifest smoke test.
Verify exact safe-list entries, consent, and Download Summary Data. Desktop
publication is a pilot path; separately document available web-authoring steps.

Exports are observation only. API 1.17 adds Server/Cloud 2026.2 export support;
do not claim extensions invariably export blank.

## Release and Phase 2 handoff

Required release evidence: passing checks/build, deployed SHA, Desktop/Server/
browser outcomes, reviewed PR, approved merge, production smoke test, rehearsed
Workers rollback. Record IDs, URLs, tested versions/sizes, results, exports,
limitations, and recovery.

Prerequisites: correct Worker/account, compatible Desktop, editable/publishable
pilot, site administrator, publication approvals, licensing review. The static
mock is publicly reachable; intended internal use does not imply authenticated
hosting. No credential or patient data goes into code, metadata, or logs.

Phase 2 assesses connectivity, iframe SSO/cookies/CORS, trusted placement mapping,
effective authenticated site and workbook/view permissions, gateway signing,
ownership/reset/retention/audit. Names/browser IDs are hints, not authorization.
A company frontend domain does not automatically solve iframe cookie issues.
On-prem gateway is primary; Forge pop-outs/web triggers need separate validation
and do not themselves supply both docking and Tableau authorization.
