import { secureId } from './protocol.js';

export const MOCK_SCENARIOS = ['ok', 'slow', 'sources', 'send-fail-once', 'send-fail-always', 'reset-fail', 'malformed'];

export function resolveMockScenario(search, allowOverrides) {
  const value = allowOverrides ? new URLSearchParams(search).get('mock') : null;
  return MOCK_SCENARIOS.includes(value) ? value : 'ok';
}

// Mock envelopes contain JSON values only. Older Tableau Desktop webviews do
// not expose structuredClone; copying JSON also keeps replies independent of
// the adapter's stored conversation and request cache.
const copy = value => JSON.parse(JSON.stringify(value));

// No fetch, Forge bridge, browser storage, or AWS calls. Every instance owns
// its conversations and completed request cache; reload creates a new instance.
export function createMockAdapter({ scenario = 'ok', delayMs, createId = secureId } = {}) {
  let selected = MOCK_SCENARIOS.includes(scenario) ? scenario : 'ok';
  const conversations = new Map();
  const completed = new Map();
  const dropped = new Set();
  const pause = ms => ms === 0 ? Promise.resolve() : new Promise(resolve => setTimeout(resolve, ms));

  function freshConversation() {
    const conversation = { id: createId(), messages: [{ id: createId(), role: 'assistant', text: 'Hello! I’m AI Guide. Ask a question to try this chat interface. Replies are simulated; no backend is connected.' }] };
    conversations.set(conversation.id, conversation);
    return { ok: true, conversation: copy(conversation) };
  }

  return {
    setScenario(value) {
      if (!MOCK_SCENARIOS.includes(value)) throw new Error('Unknown mock scenario.');
      selected = value;
    },
    async startConversation() { return freshConversation(); },
    async sendMessage(request) {
      const mode = selected;
      await pause(delayMs ?? (mode === 'slow' ? 3000 : 450));
      if (mode === 'send-fail-always') throw new Error('Simulated transport failure.');
      const key = JSON.stringify([request.conversationId, request.requestId]);
      if (completed.has(key)) return copy(completed.get(key));
      const conversation = conversations.get(request.conversationId);
      if (!conversation) return { ok: false, code: 'CONVERSATION_NOT_FOUND', message: 'The demo conversation is unavailable. Start a new conversation.' };
      if (mode === 'malformed') return { ok: true, conversation: { id: request.conversationId, messages: [{ id: 'broken', role: 'assistant', text: { unexpected: true } }] } };
      const dashboard = request.context?.dashboardName;
      const text = mode === 'sources'
        ? 'This sample reply includes two public Tableau references. Expand Sources to inspect their links and excerpts. This is a demo, not a generated answer.'
        : `Demo reply to: ${request.message}\n\n${dashboard ? `Dashboard: ${dashboard}.\nWorksheets: ${request.context.worksheetNames.join(', ') || 'None'}.\n\n` : ''}The chat interface is working. A future phase will connect this panel to the company’s authenticated gateway.`;
      const sources = mode === 'sources' ? [
        { title: 'Use Dashboard Extensions', url: 'https://help.tableau.com/current/pro/desktop/en-us/dashboard_extensions.htm', citation_id: 1, excerpt: 'Sample excerpt: dashboard extensions add functionality to Tableau dashboards.' },
        { title: 'Tableau Extensions API', url: 'https://tableau.github.io/extensions-api/', citation_id: 3, excerpt: 'Sample excerpt: the Extensions API lets an extension interact with its dashboard.', excerpt_truncated: true },
      ] : undefined;
      const next = { id: conversation.id, messages: [...conversation.messages, { id: `${request.requestId}-user`, role: 'user', text: request.message }, { id: `${request.requestId}-assistant`, role: 'assistant', text, ...(sources ? { sources } : {}) }] };
      conversations.set(conversation.id, next);
      const response = { ok: true, conversation: copy(next) };
      completed.set(key, response);
      // The request completed, but its first reply is lost in transit. Retrying
      // the same frozen payload returns the stored result without another turn.
      if (mode === 'send-fail-once' && !dropped.has(key)) {
        dropped.add(key);
        throw new Error('Simulated lost reply after processing.');
      }
      return copy(response);
    },
    async resetConversation({ conversationId }) {
      const mode = selected;
      await pause(delayMs ?? 300);
      if (mode === 'reset-fail') return { ok: false, code: 'MOCK_RESET_FAILED', message: 'The demo reset failed. Your conversation and draft are unchanged. Try New conversation again.' };
      const next = freshConversation();
      conversations.delete(conversationId);
      for (const key of completed.keys()) if (JSON.parse(key)[0] === conversationId) { completed.delete(key); dropped.delete(key); }
      return next;
    },
  };
}
