# Tableau resize diagnostic acceptance

The resize spike is Step 1 of the agreed plan. It is not the chat UI. Do not port
the chat until the Desktop and hosted Server gates below are recorded as passed.

## What is ready locally

- White-outline AI Guide button and expandable diagnostic panel.
- Authored geometry restoration; bounded sizing for a 600 × 400 dashboard.
- Error handling, retry, duplicate-toggle lock, and listener cleanup.
- Delayed-event guards so acknowledged resizes do not create a layout loop.
- Text, probe count, and scroll state survive toggling. Reload clears them.
- Explicit standalone simulation; production ignores `?standalone=1`.
- Three generated manifests, original PNG/SVG artwork, and vendored SDK notices.
- Unit/UI tests and a verifier for deployment identity, XML, assets, and SDK hash.

Pinned toolchain: Node 22.23.3, React 18.3.1, Vite 8.3.4, React plugin 6.1.2,
Vitest 5.0.4, and Wrangler 4.149.0. The SDK is Tableau Extensions API 1.17.0;
upstream revision/checksums are in `vendor/tableau-extensions-api.json`.

## Local browser

Run `npm run dev`, then <http://localhost:5173/?standalone=1>. This checks in-page
behavior; it cannot confirm that Tableau resizes or preserves an actual iframe.

Chrome 155.0.8059.40 smoke test passed on October 13, 2026: toggle, draft/probe
persistence, visible controls in the smaller layout, production rejecting the
standalone flag, and no page errors. Screenshots are local ignored artifacts,
not company dashboard data. Firefox acceptance remains pending.

## Desktop gate

1. Run `npm run build` to generate manifests, then keep `npm run dev` running.
2. Open the company pilot dashboard. Add Objects → Extension as **floating**.
3. Choose Access Local Extensions and load `public/AIGuide.local.trex`.
4. Confirm initialization succeeds, diagnostics show the actual version/mode,
   and own object ID and authored geometry are populated.
5. While collapsed, position it near the upper-right corner and set authored
   dimensions to about 140 × 36. Expand and compare actual/diagnostic dimensions.
6. Type test text and increment the probe. Close/reopen repeatedly. Both values
   and scroll must survive. Collapse must restore the authored rectangle.
7. Repeat on a large dashboard and about 600 × 400. Change dashboard dimensions
   while open. Close/test text remain visible; no repeated-resize loop occurs.
8. Reload the extension and confirm text/probe reset. Test keyboard focus and
   record any observed export/PDF behavior without treating exports as acceptance.

If tiled placement is used by mistake, the diagnostic must explain floating
placement and allow retry after correction. Below 320 × 300, it must show a size
warning instead of attempting an unusable expansion.

## Hosted Server gate

Before publishing `dev`, complete publication review and the SDK licensing
owner-review item. Enable Workers non-production builds with command
`npm run deploy:dev`; leave production branch `main` and its deploy command alone.

After the approved `dev` push, verify the exact SHA at:
<https://dev-tableau-chatbot-ui.algo-alert-cramer.workers.dev/>.

Have a site administrator add the exact extension source URL to the safe list.
Confirm extensions are enabled, applicable consent, and pilot-user Download
Summary Data permission. Do not use an unrestricted hosting wildcard.

Load `public/AIGuide.dev.trex` in a test workbook and publish it. Desktop
publication is a valid route; document web-authoring installation if available.
Repeat the Desktop checklist in Server authoring and non-author viewing modes,
in Firefox and Chrome. Confirm refresh/load behavior and diagnose console/API
errors without logging identity or worksheet data.

## Evidence to return

Record Desktop/Server/browser versions, tested SHA, dashboard sizes, initialization,
expand/collapse/restoration, text/probe/scroll persistence, layout changes,
keyboard behavior, consent/permissions, and export observations.

| Gate | Result |
| --- | --- |
| Production hosting bootstrap | Passed (`830ce91`) |
| Local automated and Chrome browser checks | Passed: 20 tests across four files; Chrome 155.0.8059.40 browser smoke |
| Actual Tableau Desktop | Pending |
| Hosted Server authoring and viewing | Pending |
| Firefox and Chrome within Server | Pending |
| Rollback/recovery rehearsal | Pending |

If self-resize or iframe-state preservation fails, retain this diagnostic and
record the exact failure. Validate the native Show/Hide floating-container
alternative and agree on that interaction before proceeding to the chat port.
