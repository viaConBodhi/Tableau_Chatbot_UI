import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTableauHost } from '../src/tableau/host.js';
import { tableauFixture } from './tableau-fixture.js';

const hosts = [];
function hostFor(options) {
  const host = createTableauHost(options);
  hosts.push(host);
  return host;
}
afterEach(() => {
  for (const host of hosts.splice(0)) host.dispose();
  vi.useRealTimers();
});

describe('Tableau host controller', () => {
  it('initializes once and reads only the intended context', async () => {
    const fixture = tableauFixture();
    const host = hostFor({ tableau: fixture.tableau });
    await Promise.all([host.initialize(), host.initialize()]);
    await host.initialize();
    expect(fixture.tableau.extensions.initializeAsync).toHaveBeenCalledTimes(1);
    expect(host.getSnapshot().status).toBe('ready');
    expect(host.getDashboardContext()).toEqual({ dashboardName: 'Pilot dashboard', worksheetNames: ['Sales', 'Summary'] });
    expect(JSON.stringify(host.getSnapshot())).not.toContain('DO-NOT-CAPTURE');
  });

  it('changes only itself and restores authored geometry after delayed layout events', async () => {
    const fixture = tableauFixture();
    const host = hostFor({ tableau: fixture.tableau });
    await host.initialize();
    await host.toggle();
    expect(fixture.dashboard.moveAndResizeDashboardObjectsAsync).toHaveBeenLastCalledWith([{ dashboardObjectID: 42, x: 560, y: 20, width: 420, height: 700 }]);
    fixture.emit();
    await host.toggle();
    fixture.emit();
    await Promise.resolve();
    expect(fixture.dashboard.moveAndResizeDashboardObjectsAsync).toHaveBeenCalledTimes(2);
    expect(host.getSnapshot().diagnostics.authored).toEqual({ x: 840, y: 20, width: 140, height: 36 });
    expect(fixture.object.position).toEqual({ x: 840, y: 20 });
    expect(fixture.object.size).toEqual({ width: 140, height: 36 });
  });

  it('retains the expanded view and a retryable controller after a failed collapse', async () => {
    const fixture = tableauFixture();
    const host = hostFor({ tableau: fixture.tableau });
    await host.initialize();
    await host.toggle();
    fixture.dashboard.moveAndResizeDashboardObjectsAsync.mockRejectedValueOnce(new Error('Resize denied'));
    expect(await host.toggle()).toBe(false);
    expect(host.getSnapshot()).toMatchObject({ expanded: true, status: 'ready', error: 'Could not close AI Guide: Resize denied' });
    expect(await host.toggle()).toBe(true);
    expect(host.getSnapshot().expanded).toBe(false);
  });

  it('does not repeat an acknowledged resize when a late SDK snapshot still reports old bounds', async () => {
    const fixture = tableauFixture();
    const host = hostFor({ tableau: fixture.tableau });
    await host.initialize();
    await host.toggle();
    fixture.object.position = { x: 840, y: 20 };
    fixture.object.size = { width: 140, height: 36 };
    fixture.emit();
    await Promise.resolve();
    expect(fixture.dashboard.moveAndResizeDashboardObjectsAsync).toHaveBeenCalledTimes(1);
    expect(host.getSnapshot().expanded).toBe(true);
  });

  it('blocks duplicate toggles until Tableau has acknowledged the first resize', async () => {
    const fixture = tableauFixture();
    let complete;
    fixture.dashboard.moveAndResizeDashboardObjectsAsync.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    const host = hostFor({ tableau: fixture.tableau });
    await host.initialize();
    const first = host.toggle();
    expect(host.getSnapshot()).toMatchObject({ status: 'resizing', expanded: false });
    expect(await host.toggle()).toBe(false);
    expect(fixture.dashboard.moveAndResizeDashboardObjectsAsync).toHaveBeenCalledTimes(1);
    fixture.object.position = { x: 560, y: 20 };
    fixture.object.size = { width: 420, height: 700 };
    complete();
    await first;
    expect(host.getSnapshot().expanded).toBe(true);
  });

  it('reflows once after a dashboard shrink and never loses the original anchor', async () => {
    const fixture = tableauFixture();
    const host = hostFor({ tableau: fixture.tableau });
    await host.initialize();
    await host.toggle();
    fixture.dashboard.size = { width: 600, height: 400 };
    fixture.emit();
    await Promise.resolve();
    await Promise.resolve();
    fixture.emit();
    await Promise.resolve();
    expect(fixture.dashboard.moveAndResizeDashboardObjectsAsync).toHaveBeenCalledTimes(2);
    expect(fixture.object.position).toEqual({ x: 172, y: 8 });
    expect(fixture.object.size).toEqual({ width: 420, height: 384 });
    await host.toggle();
    expect(fixture.object.position).toEqual({ x: 460, y: 20 });
    expect(host.getSnapshot().diagnostics.authored.x).toBe(840);
  });

  it('adopts author repositioning while collapsed', async () => {
    const fixture = tableauFixture();
    const host = hostFor({ tableau: fixture.tableau });
    await host.initialize();
    fixture.object.position = { x: 650, y: 30 };
    fixture.emit();
    await host.toggle();
    await host.toggle();
    expect(fixture.object.position).toEqual({ x: 650, y: 30 });
  });

  it('reports tiled objects and supports retry without a second SDK handshake', async () => {
    const fixture = tableauFixture();
    fixture.object.isFloating = false;
    const host = hostFor({ tableau: fixture.tableau });
    await host.initialize();
    expect(host.getSnapshot()).toMatchObject({ status: 'error', error: 'Add this extension as a floating object.' });
    fixture.object.isFloating = true;
    await host.initialize();
    expect(host.getSnapshot().status).toBe('ready');
    expect(fixture.tableau.extensions.initializeAsync).toHaveBeenCalledTimes(1);
  });

  it('bounds initialization and ignores stale waits on a late successful handshake', async () => {
    vi.useFakeTimers();
    const fixture = tableauFixture();
    let connect;
    fixture.tableau.extensions.initializeAsync.mockImplementation(() => new Promise(resolve => { connect = resolve; }));
    const host = hostFor({ tableau: fixture.tableau, timeoutMs: 25 });
    const first = host.initialize();
    await vi.advanceTimersByTimeAsync(25);
    await first;
    expect(host.getSnapshot().status).toBe('error');
    const retry = host.initialize();
    connect();
    await retry;
    expect(host.getSnapshot().status).toBe('ready');
    expect(fixture.tableau.extensions.initializeAsync).toHaveBeenCalledTimes(1);
  });

  it('cleans up subscriptions and ignores platform results after disposal', async () => {
    const fixture = tableauFixture();
    const host = hostFor({ tableau: fixture.tableau });
    await host.initialize();
    let complete;
    fixture.dashboard.moveAndResizeDashboardObjectsAsync.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    const pending = host.toggle();
    host.dispose();
    complete();
    await pending;
    expect(fixture.unregister).toHaveBeenCalledTimes(1);
    expect(host.getSnapshot().expanded).toBe(false);
  });

  it('uses standalone only when explicitly requested', async () => {
    const host = hostFor({ standalone: true, tableau: {}, viewport: () => ({ width: 1000, height: 800 }) });
    await host.initialize();
    await host.toggle();
    expect(host.getSnapshot()).toMatchObject({ expanded: true, standalone: true });
    expect(host.getDashboardContext()).toBeNull();
    const integration = hostFor({ tableau: {} });
    await integration.initialize();
    expect(integration.getSnapshot()).toMatchObject({ status: 'error', standalone: false });
  });
});
