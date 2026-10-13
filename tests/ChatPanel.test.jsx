import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App.jsx';
import { createTableauHost } from '../src/tableau/host.js';
import { createChatController } from '../src/chat/controller.js';
import { createMockAdapter } from '../src/chat/mock-adapter.js';

const lifetimes = [];
function fixture({ scenario = 'ok', adapter = createMockAdapter({ scenario, delayMs: 0 }), testControls = false } = {}) {
  const host = createTableauHost({ standalone: true, viewport: () => ({ width: 1000, height: 800 }) });
  const chat = createChatController({ adapter });
  lifetimes.push(host, chat);
  render(<App host={host} chat={chat} testControls={testControls} mockAdapter={adapter} initialScenario={scenario} />);
  return { host, chat, adapter };
}
afterEach(() => lifetimes.splice(0).forEach(item => item.dispose()));

describe('chat panel', () => {
  it('renders Forge-style authors, preserves draft/newlines and scroll across toggles, and restores focus', async () => {
    const user = userEvent.setup();
    fixture();
    await user.click(await screen.findByRole('button', { name: 'AI Guide' }));
    await screen.findByText(/Hello! I’m AI Guide/);
    expect(screen.getByText('AI assistant')).toBeTruthy();
    await user.type(screen.getByLabelText('Message'), 'Draft{enter}second line');
    const log = screen.getByRole('log');
    log.scrollTop = 84;
    fireEvent.scroll(log);
    await user.click(screen.getByRole('button', { name: 'Close AI Guide' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'AI Guide' }));
    await user.click(screen.getByRole('button', { name: 'AI Guide' }));
    expect(screen.getByLabelText('Message').value).toBe('Draft\nsecond line');
    expect(screen.getByRole('log').scrollTop).toBe(84);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close AI Guide' }));
    expect(screen.getByText('Phase 1 demo — no backend connected')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Layout test' })).toBeNull();
  });

  it('does not submit on Enter, rejects blanks, and applies the 2000-character limit', async () => {
    const user = userEvent.setup();
    const { adapter, chat } = fixture();
    const send = vi.spyOn(adapter, 'sendMessage');
    await user.click(await screen.findByRole('button', { name: 'AI Guide' }));
    const input = screen.getByLabelText('Message');
    await waitFor(() => expect(input.disabled).toBe(false));
    await user.type(input, 'Question{enter}');
    expect(input.value).toBe('Question\n');
    expect(send).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: 'x'.repeat(2001) } });
    expect(chat.getSnapshot().draft).toHaveLength(2000);
    expect(input.maxLength).toBe(2000);
    fireEvent.change(input, { target: { value: ' \n ' } });
    expect(screen.getByRole('button', { name: 'Send' }).disabled).toBe(true);
  });

  it('accepts a reply while closed, keeps Close enabled during send, and prevents duplicate submission', async () => {
    const user = userEvent.setup();
    let resolve;
    const adapter = createMockAdapter({ delayMs: 0 });
    adapter.sendMessage = vi.fn(request => new Promise(done => { resolve = () => done({ ok: true, conversation: { id: request.conversationId, messages: [{ id: 'u', role: 'user', text: request.message }, { id: 'a', role: 'assistant', text: 'Reply arrived while closed' }] } }); }));
    fixture({ adapter });
    await user.click(await screen.findByRole('button', { name: 'AI Guide' }));
    await user.type(screen.getByLabelText('Message'), 'Question');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByRole('button', { name: 'New conversation' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Close AI Guide' }).disabled).toBe(false);
    fireEvent.submit(screen.getByLabelText('Message').closest('form'));
    expect(adapter.sendMessage).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Close AI Guide' }));
    await act(async () => { resolve(); });
    await user.click(screen.getByRole('button', { name: 'AI Guide' }));
    expect(screen.getByText('Reply arrived while closed')).toBeTruthy();
    expect(screen.getByText('You')).toBeTruthy();
    expect(screen.getByLabelText('Message').value).toBe('');
  });

  it('shows retry after a lost reply and clears it after one successful recovery', async () => {
    const user = userEvent.setup();
    fixture({ scenario: 'send-fail-once' });
    await user.click(await screen.findByRole('button', { name: 'AI Guide' }));
    await user.type(screen.getByLabelText('Message'), 'Retry this');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    expect(screen.getByRole('alert').textContent).toContain('confirm the reply');
    expect(screen.getByLabelText('Message').value).toBe('Retry this');
    await user.click(screen.getByRole('button', { name: 'Retry message' }));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getAllByText('You')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Retry message' })).toBeNull();
  });

  it('keeps chat and draft after a failed reset and replaces them on a successful reset', async () => {
    const user = userEvent.setup();
    const { adapter } = fixture({ scenario: 'reset-fail' });
    await user.click(await screen.findByRole('button', { name: 'AI Guide' }));
    await user.type(screen.getByLabelText('Message'), 'Question');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await screen.findByText(/Demo reply to: Question/);
    await user.type(screen.getByLabelText('Message'), 'Keep this draft');
    await user.click(screen.getByRole('button', { name: 'New conversation' }));
    expect(screen.getByRole('alert').textContent).toContain('draft are unchanged');
    expect(screen.getByLabelText('Message').value).toBe('Keep this draft');
    expect(screen.getByText('Question')).toBeTruthy();
    adapter.setScenario('ok');
    await user.click(screen.getByRole('button', { name: 'New conversation' }));
    expect(screen.getByLabelText('Message').value).toBe('');
    expect(screen.queryByText('Question')).toBeNull();
  });

  it('renders source ranks, citation IDs, sample excerpts, and safe external links', async () => {
    const user = userEvent.setup();
    fixture({ scenario: 'sources' });
    await user.click(await screen.findByRole('button', { name: 'AI Guide' }));
    await user.type(screen.getByLabelText('Message'), 'Show sources');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await user.click(await screen.findByText('Sources (2)'));
    expect(screen.getByText('Cited as [3] in the answer')).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Open Use Dashboard Extensions in a new tab' });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    await user.click(screen.getAllByText('Quoted evidence')[0]);
    expect(screen.getByText(/Sample excerpt: dashboard/)).toBeTruthy();
  });

  it('renders untrusted text literally and never links an unsafe source URL', async () => {
    const user = userEvent.setup();
    const adapter = createMockAdapter({ delayMs: 0 });
    adapter.sendMessage = async request => ({ ok: true, conversation: { id: request.conversationId, messages: [{ id: 'html', role: 'assistant', text: '<img src=x onerror=alert(1)>', sources: [{ title: '<script>unsafe</script>', url: 'javascript:alert(1)', excerpt: '<b>Plain text</b>' }] }] } });
    fixture({ adapter });
    await user.click(await screen.findByRole('button', { name: 'AI Guide' }));
    await user.type(screen.getByLabelText('Message'), 'Question');
    await user.click(screen.getByRole('button', { name: 'Send' }));
    await user.click(await screen.findByText('Sources (1)'));
    expect(screen.getByText('<img src=x onerror=alert(1)>')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
    expect(document.querySelector('.message img')).toBeNull();
    expect(document.querySelector('.message script')).toBeNull();
  });

  it('keeps the original diagnostic available without losing chat state', async () => {
    const user = userEvent.setup();
    fixture({ testControls: true });
    await user.click(await screen.findByRole('button', { name: 'AI Guide' }));
    await user.type(screen.getByLabelText('Message'), 'Keep chat draft');
    await user.click(screen.getByRole('button', { name: 'Layout test' }));
    await user.type(screen.getByLabelText('Text to preserve while toggling'), 'Probe text');
    await user.click(screen.getByRole('button', { name: 'Persistence probe: 0' }));
    await user.click(screen.getByRole('button', { name: 'Back to chat' }));
    expect(screen.getByLabelText('Message').value).toBe('Keep chat draft');
    await user.click(screen.getByRole('button', { name: 'Layout test' }));
    expect(screen.getByRole('button', { name: 'Persistence probe: 1' })).toBeTruthy();
    expect(screen.getByLabelText('Text to preserve while toggling').value).toBe('Probe text');
  });
});
