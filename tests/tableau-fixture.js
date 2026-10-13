import { vi } from 'vitest';

export function tableauFixture() {
  let listener;
  const object = { id: 42, isFloating: true, isVisible: true, position: { x: 840, y: 20 }, size: { width: 140, height: 36 } };
  const unregister = vi.fn(() => { listener = undefined; });
  const dashboard = {
    name: 'Pilot dashboard',
    activeDashboardName: 'Pilot dashboard',
    size: { width: 1000, height: 800 },
    objects: [{ id: 7, isFloating: false }, object],
    worksheets: [{ name: 'Sales' }, { name: 'Summary' }],
    addEventListener: vi.fn((_eventType, callback) => { listener = callback; return unregister; }),
    removeEventListener: vi.fn(),
    moveAndResizeDashboardObjectsAsync: vi.fn(async ([update]) => {
      object.position = { x: update.x, y: update.y };
      object.size = { width: update.width, height: update.height };
      listener?.();
    }),
  };
  const tableau = {
    TableauEventType: { DashboardLayoutChanged: 'dashboard-layout-changed' },
    extensions: {
      initializeAsync: vi.fn(async () => {}),
      dashboardObjectId: 42,
      dashboardContent: { dashboard },
      environment: { apiVersion: '1.17.0', tableauVersion: '2026.2.0', mode: 'viewing', uniqueUserId: 'DO-NOT-CAPTURE' },
    },
  };
  return { tableau, object, dashboard, unregister, emit: () => listener?.() };
}
