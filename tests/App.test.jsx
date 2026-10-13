import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App.jsx';
import { createTableauHost } from '../src/tableau/host.js';
import { tableauFixture } from './tableau-fixture.js';

const hosts = [];
function createHost(options) {
  const host = createTableauHost(options);
  hosts.push(host);
  return host;
}
afterEach(() => hosts.splice(0).forEach(host => host.dispose()));

describe('resize diagnostic UI', () => {
  it('preserves text, probe state, scroll, and keyboard focus across toggles', async () => {
    const user = userEvent.setup();
    const host = createHost({ standalone: true, viewport: () => ({ width: 1000, height: 800 }) });
    render(<App host={host} />);
    await user.click(await screen.findByRole('button', { name: 'AI Guide' }));
    const close = screen.getByRole('button', { name: 'Close AI Guide' });
    await waitFor(() => expect(document.activeElement).toBe(close));
    await user.type(screen.getByLabelText('Text to preserve while toggling'), 'Retain this draft{enter}and newline');
    await user.click(screen.getByRole('button', { name: 'Persistence probe: 0' }));
    document.querySelector('.panel-body').scrollTop = 120;
    await user.click(close);
    const open = screen.getByRole('button', { name: 'AI Guide' });
    await waitFor(() => expect(document.activeElement).toBe(open));
    await user.click(open);
    expect(screen.getByLabelText('Text to preserve while toggling').value).toBe('Retain this draft\nand newline');
    expect(screen.getByRole('button', { name: 'Persistence probe: 1' })).toBeTruthy();
    expect(document.querySelector('.panel-body').scrollTop).toBe(120);
  });

  it('keeps Close reachable after a failed collapse', async () => {
    const user = userEvent.setup();
    const fixture = tableauFixture();
    render(<App host={createHost({ tableau: fixture.tableau })} />);
    await user.click(await screen.findByRole('button', { name: 'AI Guide' }));
    fixture.dashboard.moveAndResizeDashboardObjectsAsync.mockRejectedValueOnce(new Error('Not allowed'));
    await user.click(screen.getByRole('button', { name: 'Close AI Guide' }));
    expect(screen.getByRole('alert').textContent).toContain('Could not close');
    expect(screen.getByRole('button', { name: 'Close AI Guide' }).disabled).toBe(false);
    expect(screen.getByRole('region', { name: 'AI Guide panel' })).toBeTruthy();
  });

  it('shows a real integration error rather than an implicit standalone demo', async () => {
    render(<App host={createHost({ tableau: {} })} />);
    expect((await screen.findByRole('alert')).textContent).toContain('library could not load');
    expect(screen.getByRole('button', { name: 'Retry connection' })).toBeTruthy();
    expect(screen.queryByText(/Standalone dev mode/)).toBeNull();
  });

  it('keeps the SDK controller usable across a component remount', async () => {
    const user = userEvent.setup();
    const fixture = tableauFixture();
    const host = createHost({ tableau: fixture.tableau });
    const first = render(<App host={host} />);
    await screen.findByRole('button', { name: 'AI Guide' });
    first.unmount();
    render(<App host={host} />);
    await user.click(screen.getByRole('button', { name: 'AI Guide' }));
    expect(screen.getByRole('region', { name: 'AI Guide panel' })).toBeTruthy();
    expect(fixture.tableau.extensions.initializeAsync).toHaveBeenCalledTimes(1);
  });
});
