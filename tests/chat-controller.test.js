// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createChatController } from '../src/chat/controller.js';
import { createMockAdapter } from '../src/chat/mock-adapter.js';

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function fixture(overrides = {}) {
  let sequence = 0;
  const adapter = {
    startConversation: vi.fn(async () => ({ ok: true, conversation: { id: 'conversation', messages: [] } })),
    sendMessage: vi.fn(async request => ({ ok: true, conversation: { id: request.conversationId, messages: [{ id: `${request.requestId}-u`, role: 'user', text: request.message }, { id: `${request.requestId}-a`, role: 'assistant', text: 'Reply' }] } })),
    resetConversation: vi.fn(async () => ({ ok: true, conversation: { id: 'replacement', messages: [] } })),
    ...overrides,
  };
  const getContext = vi.fn(() => ({ dashboardName: 'Pilot', worksheetNames: ['Summary'], uniqueUserId: 'MUST-NOT-CAPTURE', filters: ['MUST-NOT-CAPTURE'] }));
  const chat = createChatController({ adapter, getContext, createId: () => `request-${++sequence}` });
  return { chat, adapter, getContext };
}

describe('conversation controller', () => {
  it('starts only once and permits an explicit retry after startup failure', async () => {
    const waiting = deferred();
    const { chat, adapter } = fixture({ startConversation: vi.fn(() => waiting.promise) });
    const first = chat.start();
    const second = chat.start();
    expect(adapter.startConversation).toHaveBeenCalledTimes(1);
    waiting.resolve({ ok: false, code: 'START_FAILED', message: 'Try again.' });
    await Promise.all([first, second]);
    expect(chat.getSnapshot().error).toMatchObject({ operation: 'start', code: 'START_FAILED' });
    adapter.startConversation.mockResolvedValue({ ok: true, conversation: { id: 'ready', messages: [] } });
    await chat.start();
    await chat.start();
    expect(adapter.startConversation).toHaveBeenCalledTimes(2);
    expect(chat.getSnapshot().conversation.id).toBe('ready');
  });

  it('serializes submits and prevents reset and edits while sending', async () => {
    const waiting = deferred();
    const { chat, adapter } = fixture({ sendMessage: vi.fn(() => waiting.promise) });
    await chat.start();
    chat.setDraft('Question');
    const sending = chat.send();
    expect(await chat.send()).toBe(false);
    expect(await chat.reset()).toBe(false);
    chat.setDraft('Changed during send');
    expect(chat.getSnapshot().draft).toBe('Question');
    expect(adapter.sendMessage).toHaveBeenCalledTimes(1);
    expect(adapter.resetConversation).not.toHaveBeenCalled();
    waiting.resolve({ ok: true, conversation: { id: 'conversation', messages: [] } });
    expect(await sending).toBe(true);
    expect(chat.getSnapshot().draft).toBe('');
  });

  it('rejects blank messages, bounds the draft, and trims only on submit', async () => {
    const { chat, adapter } = fixture();
    await chat.start();
    chat.setDraft(' \n ');
    expect(await chat.send()).toBe(false);
    expect(adapter.sendMessage).not.toHaveBeenCalled();
    chat.setDraft('x'.repeat(2001));
    expect(chat.getSnapshot().draft).toHaveLength(2000);
    chat.setDraft('  Line one\nLine two  ');
    await chat.send();
    expect(adapter.sendMessage.mock.calls[0][0].message).toBe('Line one\nLine two');
  });

  it('retries a processed-but-lost reply with its original ID and frozen names, without duplicates', async () => {
    const adapter = createMockAdapter({ scenario: 'send-fail-once', delayMs: 0 });
    const send = vi.spyOn(adapter, 'sendMessage');
    const context = { dashboardName: 'Original', worksheetNames: ['First'], uniqueUserId: 'IGNORE' };
    const getContext = vi.fn(() => context);
    const chat = createChatController({ adapter, getContext });
    await chat.start();
    chat.setDraft('Question');
    expect(await chat.send()).toBe(false);
    const firstRequest = send.mock.calls[0][0];
    expect(firstRequest.context).toEqual({ dashboardName: 'Original', worksheetNames: ['First'] });
    expect(Object.isFrozen(firstRequest)).toBe(true);
    expect(Object.isFrozen(firstRequest.context.worksheetNames)).toBe(true);
    context.dashboardName = 'Changed';
    context.worksheetNames.push('Second');
    expect(await chat.retry()).toBe(true);
    expect(send.mock.calls[1][0]).toBe(firstRequest);
    expect(getContext).toHaveBeenCalledTimes(1);
    expect(chat.getSnapshot().conversation.messages).toHaveLength(3);
    expect(chat.getSnapshot().conversation.messages.at(-1).text).toContain('Original');
    expect(chat.getSnapshot()).toMatchObject({ canRetry: false, pendingMessage: null, draft: '', error: null });
    expect(await chat.retry()).toBe(false);
    chat.dispose();
  });

  it('uses a fresh request ID and context after editing a failed message', async () => {
    const { chat, adapter, getContext } = fixture({ sendMessage: vi.fn(async () => { throw new Error('Lost reply'); }) });
    await chat.start();
    chat.setDraft('First');
    await chat.send();
    const first = adapter.sendMessage.mock.calls[0][0];
    chat.setDraft('Second');
    expect(chat.getSnapshot().canRetry).toBe(false);
    getContext.mockReturnValue({ dashboardName: 'New dashboard', worksheetNames: [] });
    await chat.send();
    const second = adapter.sendMessage.mock.calls[1][0];
    expect(second.requestId).not.toBe(first.requestId);
    expect(second.message).toBe('Second');
    expect(second.context.dashboardName).toBe('New dashboard');
  });

  it('preserves conversation and draft on reset failure; clears only on replacement success', async () => {
    const { chat, adapter } = fixture();
    await chat.start();
    chat.setDraft('Sent');
    await chat.send();
    const original = chat.getSnapshot().conversation;
    chat.setDraft('Unsent draft');
    adapter.resetConversation.mockResolvedValueOnce({ ok: false, code: 'RESET_FAILED', message: 'Could not reset.' });
    expect(await chat.reset()).toBe(false);
    expect(chat.getSnapshot().conversation).toBe(original);
    expect(chat.getSnapshot().draft).toBe('Unsent draft');
    expect(await chat.reset()).toBe(true);
    expect(chat.getSnapshot()).toMatchObject({ conversation: { id: 'replacement', messages: [] }, draft: '', error: null });
  });

  it('blocks sends and duplicate resets while resetting', async () => {
    const waiting = deferred();
    const { chat, adapter } = fixture({ resetConversation: vi.fn(() => waiting.promise) });
    await chat.start();
    chat.setDraft('Draft');
    const resetting = chat.reset();
    expect(await chat.send()).toBe(false);
    expect(await chat.reset()).toBe(false);
    expect(adapter.sendMessage).not.toHaveBeenCalled();
    waiting.resolve({ ok: true, conversation: { id: 'replacement', messages: [] } });
    await resetting;
  });

  it('rejects malformed send/reset replies without destroying the current conversation', async () => {
    const { chat, adapter } = fixture();
    await chat.start();
    const original = chat.getSnapshot().conversation;
    chat.setDraft('Keep me');
    adapter.sendMessage.mockResolvedValue({ ok: true, conversation: { id: 'other-conversation', messages: [] } });
    await chat.send();
    expect(chat.getSnapshot().error.code).toBe('BACKEND_BAD_RESPONSE');
    expect(chat.getSnapshot().conversation).toBe(original);
    expect(chat.getSnapshot().draft).toBe('Keep me');
    adapter.resetConversation.mockResolvedValue({ ok: true, conversation: { id: original.id, messages: [] } });
    await chat.reset();
    expect(chat.getSnapshot().error.code).toBe('BACKEND_BAD_RESPONSE');
    expect(chat.getSnapshot().conversation).toBe(original);
  });

  it('ignores a send reply and notifications after disposal', async () => {
    const waiting = deferred();
    const { chat } = fixture({ sendMessage: () => waiting.promise });
    await chat.start();
    chat.setDraft('Question');
    const sending = chat.send();
    const before = chat.getSnapshot();
    const notify = vi.fn();
    chat.subscribe(notify);
    chat.dispose();
    waiting.resolve({ ok: true, conversation: { id: 'conversation', messages: [] } });
    expect(await sending).toBe(false);
    expect(chat.getSnapshot()).toBe(before);
    expect(notify).not.toHaveBeenCalled();
  });

  it('ignores stale initial replies after disposal and isolates extension instances', async () => {
    const waiting = deferred();
    const { chat } = fixture({ startConversation: () => waiting.promise });
    const started = chat.start();
    chat.dispose();
    waiting.resolve({ ok: true, conversation: { id: 'ignored', messages: [] } });
    await started;
    expect(chat.getSnapshot().conversation).toBeNull();
    const a = createChatController({ adapter: createMockAdapter({ delayMs: 0 }) });
    const b = createChatController({ adapter: createMockAdapter({ delayMs: 0 }) });
    await Promise.all([a.start(), b.start()]);
    a.setDraft('Only A');
    await a.send();
    expect(a.getSnapshot().conversation.id).not.toBe(b.getSnapshot().conversation.id);
    expect(b.getSnapshot().conversation.messages).toHaveLength(1);
    expect(b.getSnapshot().draft).toBe('');
    a.dispose(); b.dispose();
  });
});
