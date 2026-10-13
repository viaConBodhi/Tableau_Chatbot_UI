// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { readConversation, safeSourceUrl, secureId } from '../src/chat/protocol.js';
import { createChatController } from '../src/chat/controller.js';
import { createMockAdapter, resolveMockScenario } from '../src/chat/mock-adapter.js';

afterEach(() => vi.unstubAllGlobals());

describe('reply validation and mock contract', () => {
  it('starts, sends, recovers a lost reply, and resets without newer browser APIs', async () => {
    vi.stubGlobal('structuredClone', undefined);
    vi.stubGlobal('crypto', { getRandomValues: webcrypto.getRandomValues.bind(webcrypto) });
    const adapter = createMockAdapter({ scenario: 'send-fail-once', delayMs: 0 });
    const chat = createChatController({ adapter });
    expect(await chat.start()).toBe(true);
    expect(chat.getSnapshot().conversation.id).toMatch(/^[a-f\d]{32}$/);
    chat.setDraft('Desktop compatibility');
    expect(await chat.send()).toBe(false);
    expect(await chat.retry()).toBe(true);
    expect(chat.getSnapshot().conversation.messages).toHaveLength(3);
    expect(await chat.reset()).toBe(true);
    expect(chat.getSnapshot().conversation.messages).toHaveLength(1);
    chat.dispose();
  });

  it('keeps cached mock replies independent of caller changes without structuredClone', async () => {
    vi.stubGlobal('structuredClone', undefined);
    const adapter = createMockAdapter({ delayMs: 0 });
    const initial = await adapter.startConversation();
    initial.conversation.messages[0].text = 'Changed by caller';
    const request = { conversationId: initial.conversation.id, requestId: 'copy-test', message: 'Question', context: null };
    const first = await adapter.sendMessage(request);
    expect(first.conversation.messages[0].text).toContain('Hello!');
    first.conversation.messages.at(-1).text = 'Changed by caller';
    const repeated = await adapter.sendMessage(request);
    expect(repeated.conversation.messages.at(-1).text).toContain('Demo reply');
  });

  it('reports unavailable secure randomness explicitly instead of retrying a generic startup failure', async () => {
    expect(() => secureId({})).toThrow(expect.objectContaining({ code: 'SECURE_RANDOM_UNAVAILABLE' }));
    vi.stubGlobal('crypto', {});
    const chat = createChatController({ adapter: createMockAdapter({ delayMs: 0 }) });
    expect(await chat.start()).toBe(false);
    expect(chat.getSnapshot().error).toMatchObject({ code: 'SECURE_RANDOM_UNAVAILABLE', operation: 'start' });
    expect(chat.getSnapshot().error.message).toContain('Secure browser randomness');
    chat.dispose();
  });

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
