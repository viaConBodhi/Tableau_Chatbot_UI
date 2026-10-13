# Phase 1 chat interface acceptance

The owner authorized Desktop chat development while the Tableau Server safe-list
entry is pending. Server authoring/viewing, browser, and layout acceptance are
still required before production release. This interface uses only in-memory
mock replies. It does not authenticate users or call a gateway, Forge, or AWS.

## Local Desktop test

Keep `npm run dev` running. Collapse the existing extension before reloading it
from Tableau's object menu; its `AIGuide.local.trex` still points to localhost:5173.
Load the regenerated manifest if adding it to another test dashboard. Placement
must be floating.

1. Open AI Guide. Confirm the greeting, author labels, New conversation, Message,
   Send, and the persistent no-backend notice.
2. Type a draft with Enter/newlines; Enter must not submit. Close/reopen and
   verify the draft and scroll position. Send a nonblank message. Blank messages
   are disabled, and the composer limits input to 2000 characters.
3. Select `slow` under Demo scenario. Send, close while Preparing response is
   visible, and reopen after a few seconds. Confirm exactly one reply remains,
   the draft clears after success, and New conversation was disabled while sending.
4. Select `sources`. Send and expand Sources and Quoted evidence. Inspect ranks,
   citation labels, excerpts, and public Tableau links; links open a new tab.
5. Select `send-fail-once`. Send, then Retry message without editing. Confirm
   there is one user turn and one assistant reply for that request.
6. Select `send-fail-always` or `malformed`. Confirm an error, retained draft,
   and available retry. Editing makes a new request. Switch to `ok` to recover.
7. Select `reset-fail`, type an unsent draft, and use New conversation. Confirm
   draft and messages remain. Switch to `ok`, retry New conversation, and confirm
   it starts a fresh greeting and clears the draft.
8. Use Layout test and Back to chat. Chat and diagnostic drafts/probes must remain
   independent. Repeat the existing layout checklist, including a smaller dashboard.
9. Collapse/reload. Confirm a fresh conversation and empty draft. Verify keyboard
   focus moves to Close on opening and returns to the AI Guide button on closing.

All source excerpts in the mock are labeled samples, not retrieved evidence.
New conversation replaces this instance's memory only; it makes no persistent
backend-deletion promise. Avoid patient or participant information in test text.

## Standalone browser test

Open <http://localhost:5173/?standalone=1>. Add `&mock=sources`, `&mock=slow`,
or another supported scenario to select the initial mock. The local Demo scenario
selector changes subsequent requests without reloading or discarding the chat.
Add `&diagnostics=1` to initially open the layout-test view.

This browser mode simulates the host. Actual Tableau iframe resizing is accepted
separately; a browser smoke test does not prove the hosted Server integration.

## Hosted development test controls

Test controls are available locally. A built hosted `dev` copy requires the
explicit build variable `AI_GUIDE_TEST_CONTROLS=true` to include the scenario
selector, query overrides, and Layout test. Configure that only under Cloudflare
Previews Base if needed after publication approval. The builder enforces branch
`dev`; a `main` build disables these controls even if the variable is set.
Production always uses normal mock replies and ignores mock/diagnostic query
overrides. Built deployments always ignore the standalone flag.

After the administrator adds the exact development source URL to the safe list,
publish a test workbook using `AIGuide.dev.trex` and repeat chat/layout checks in
Server authoring and viewer modes, Firefox and Chrome. Confirm the deployed SHA
first. Server sizing remains pending; do not mark Phase 1 complete until it passes.

## Adapter and state rules

The adapter exposes `startConversation()`,
`sendMessage({conversationId, requestId, message, context})`, and
`resetConversation({conversationId})`. Valid replies carry `ok` plus a conversation
with ID, message IDs, roles, string text, and optional source objects. Error
envelopes carry `ok: false`, `code`, and `message`. There is no required `answer`.

The controller copies/validates replies before updating UI state, freezes new
request payloads with only dashboard/worksheet names, and reuses the exact payload
on retry. It ignores results after disposal, deduplicates message IDs, and locks
send/reset actions against each other. Panel visibility never owns the conversation.

Each mock adapter owns its conversation/request cache. `send-fail-once` processes
the request but drops the first reply, proving that a retry retrieves the same
result without creating another turn. Reload recreates the adapter/controller;
there are no browser-storage identities or chat histories.

## Evidence

Automated checks cover submit/reset races, input/newline rules, retry identity and
context, lost-reply recovery, reset preservation, malformed replies, unsafe sources,
stale/disposed results, instance isolation, pending replies while closed, focus,
scroll/draft retention, and the original host/geometry/manifest regression suite.

Desktop chat manual acceptance and hosted Server acceptance remain pending.

On October 13, 2026, all 44 tests across seven files passed on Node 22.23.3.
The runner uses two VM-thread workers with per-file isolation; the original fork
pool hit startup timeouts on this Windows-mounted workspace. Pure controller,
geometry, and manifest checks run in Node; UI checks use jsdom.

Chrome 155.0.8059.40 browser smoke passed the local chat flows above at 1100 × 820
and 600 × 400, including real scroll retention, pending replies while closed,
duplicate-safe retry, failed/successful reset, sources, the retained diagnostic,
reload clearing state, and pinned controls. No page errors or external
chat/context requests were observed. Built-client tests with a simulated Tableau
SDK confirmed production ignores all development overrides even when the build
flag is set, while explicitly enabled `dev` accepts scenarios and Layout test.
These simulated SDK checks are not actual Tableau Server acceptance.

The application build, Wrangler dry run, and full local Worker verifier also
passed manifest/URL/icon/header/404/asset/SDK-license checks. Ignored screenshots
and browser results are in `.wrangler/browser-smoke/chat-*`.
