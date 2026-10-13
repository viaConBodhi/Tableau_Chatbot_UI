// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readConversation, safeSourceUrl } from '../src/chat/protocol.js';
import { createMockAdapter, resolveMockScenario } from '../src/chat/mock-adapter.js';

describe('reply validation and mock contract', () => {
  it('accepts conversation envelopes without a top-level answer and deduplicates identical IDs', () => {
    const message = { id: 'same', role: 'assistant', text: 'Reply' };
    const conversation = readConversation({ ok: true, conversation: { id: 'c', messages: [message, message] } });
    expect(conversation.messages).toHaveLength(1);
    expect(Object.isFrozen(conversation.messages)).toBe(true);
    expect(() => readConversation({ ok: true, conversation: { id: 'c', messages: [message, { ...message, text: 'Conflicting reply' }] } })).toThrow();
  });

  it('rejects malformed envelopes, messages, and sources', () => {
    for (const response of [null, [], { ok: 1 }, { ok: false }, { ok: true }, { ok: true, conversation: { id: '', messages: [] } }, { ok: true, conversation: { id: 'c', messages: [{ id: 'm', role: 'assistant', text: {} }] } }, { ok: true, conversation: { id: 'c', messages: [{ id: 'm', role: 'assistant', text: 'Reply', sources: [{ excerpt: {} }] }] } }]) {
      expect(() => readConversation(response)).toThrow(expect.objectContaining({ code: 'BACKEND_BAD_RESPONSE' }));
    }
  });

  it('only links absolute HTTP(S) sources without embedded credentials', () => {
    for (const value of ['javascript:alert(1)', 'data:text/html,x', 'file:///tmp/x', '/relative', 'https://user:password@example.com/', undefined]) expect(safeSourceUrl(value)).toBeNull();
    expect(safeSourceUrl('https://help.tableau.com/path')).toBe('https://help.tableau.com/path');
  });

  it('ignores mock query overrides unless explicitly enabled', () => {
    expect(resolveMockScenario('?mock=send-fail-always', false)).toBe('ok');
    expect(resolveMockScenario('?mock=send-fail-always', true)).toBe('send-fail-always');
    expect(resolveMockScenario('?mock=unknown', true)).toBe('ok');
  });

  it('exercises source, permanent send failure, reset failure, and malformed scenarios', async () => {
    for (const scenario of ['sources', 'send-fail-always', 'reset-fail', 'malformed']) {
      const adapter = createMockAdapter({ scenario, delayMs: 0 });
      const initial = readConversation(await adapter.startConversation());
      const request = { conversationId: initial.id, requestId: 'request', message: 'Question', context: null };
      if (scenario === 'send-fail-always') {
        await expect(adapter.sendMessage(request)).rejects.toThrow();
        await expect(adapter.sendMessage(request)).rejects.toThrow();
      } else if (scenario === 'malformed') {
        const response = await adapter.sendMessage(request);
        expect(() => readConversation(response)).toThrow(expect.objectContaining({ code: 'BACKEND_BAD_RESPONSE' }));
      } else {
        const conversation = readConversation(await adapter.sendMessage(request));
        expect(conversation.messages).toHaveLength(3);
        if (scenario === 'sources') expect(conversation.messages.at(-1).sources).toHaveLength(2);
        else {
          const reset = await adapter.resetConversation({ conversationId: initial.id });
          expect(reset).toMatchObject({ ok: false, code: 'MOCK_RESET_FAILED' });
        }
      }
    }
  });
});
