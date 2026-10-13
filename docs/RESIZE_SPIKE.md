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

The initial Desktop attempt on October 13, 2026 stopped at manifest parsing
(FD722608: missing required author `email`). All three generated manifests now
include the designated support contact, `infoserv@vcu.edu`, and build validation
rejects missing or blank email. Tableau's [Author-CT schema](https://github.com/tableau/tableau-document-schemas/blob/main/schemas/2026_1/twb_2026.1.0.xsd)
requires email, name, and an HTTPS website. Reload the regenerated local manifest
when retesting after a manifest change.

On October 13, 2026, the user confirmed that changing the extension to floating
and reloading resolved the pink initialization error. The diagnostic panel loads,
opens/closes, and retains typed text across close/reopen. This tested the local
`dev` working tree based on `509dbf2`, with the manifest email fixes above.
The user subsequently confirmed that position/size restoration, probe count
and scroll retention, fitting a smaller dashboard, and clearing text/probe on
reload all appear to work. The core Desktop interaction checks pass based on
that report. Dashboard dimensions, displayed Desktop/API versions, live layout
changes, and keyboard focus still need explicit evidence for the final acceptance
record. No hosted Server results have been reported yet.

## Hosted Server gate

The owner confirmed SDK licensing review and approved development publication
on October 13, 2026. In Workers Previews Base, use build `npm run build` and Preview
command `npx wrangler preview`; leave production branch `main` and its deploy
command alone. See `DEPLOYMENT.md` for the confirmed preview model and settings.

After the approved `dev` push, record the actual stable Preview URL from the
successful build, update/regenerate `AIGuide.dev.trex` if needed, and verify the
exact SHA there. The originally planned Version URL is not yet verified.

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
| Local automated and Chrome browser checks | Passed: 21 tests across four files; Chrome 155.0.8059.40 browser smoke |
| Actual Tableau Desktop | Core interaction checks passed by user report: initialization, toggling, geometry restoration, text/probe/scroll retention, smaller dashboard fit, and reload reset; version/size details, live layout changes, and keyboard checks pending |
| Hosted Server authoring and viewing | Pending |
| Firefox and Chrome within Server | Pending |
| Rollback/recovery rehearsal | Pending |

If self-resize or iframe-state preservation fails, retain this diagnostic and
record the exact failure. Validate the native Show/Hide floating-container
alternative and agree on that interaction before proceeding to the chat port.
