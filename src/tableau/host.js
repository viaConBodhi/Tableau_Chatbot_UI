import {
  collapsedRectangle,
  expandedRectangle,
  objectRectangle,
  sameRectangle,
  validDashboardSize,
} from './geometry.js';

function boundedInitialization(promise, timeoutMs, signal) {
  let timer;
  let abort;
  return new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error('Tableau did not respond within 10 seconds. Reload the extension or try again.')), timeoutMs);
    abort = () => reject(new Error('Initialization cancelled.'));
    signal.addEventListener('abort', abort, { once: true });
    promise.then(resolve, reject);
  }).finally(() => {
    clearTimeout(timer);
    signal.removeEventListener('abort', abort);
  });
}

export function createTableauHost({
  tableau = globalThis.tableau,
  standalone = false,
  timeoutMs = 10_000,
  viewport = () => ({ width: globalThis.innerWidth || 1000, height: globalThis.innerHeight || 800 }),
  windowObject = globalThis.window,
} = {}) {
  const subscribers = new Set();
  let snapshot = {
    status: 'idle',
    standalone,
    expanded: false,
    error: '',
    diagnostics: null,
  };
  let disposed = false;
  let generation = 0;
  let initializationAttempt;
  let platformInitialization;
  let abortController;
  let removeLayoutListener;
  let dashboard;
  let authored;
  let objectId;
  let acknowledgedRectangle;
  let layoutPending = false;
  const ownedRectangles = [];

  function publish(update) {
    if (disposed) return;
    snapshot = { ...snapshot, ...update };
    for (const notify of subscribers) notify();
  }

  function ownObject() {
    const object = dashboard?.objects?.find(item => item.id === objectId);
    if (!object) throw new Error('The extension dashboard object could not be found. Reload the extension.');
    if (!object.isFloating) throw new Error('Add this extension as a floating object.');
    if (!object.isVisible) throw new Error('The extension object must be visible before it can resize.');
    return object;
  }

  function dashboardSize() {
    return validDashboardSize(standalone ? viewport() : dashboard?.size);
  }

  function diagnostics(lastResize = snapshot.diagnostics?.lastResize || 'Not attempted') {
    const object = standalone ? null : ownObject();
    return {
      apiVersion: standalone ? 'Standalone' : tableau.extensions.environment.apiVersion,
      tableauVersion: standalone ? 'Standalone' : tableau.extensions.environment.tableauVersion,
      mode: standalone ? 'Standalone development' : tableau.extensions.environment.mode,
      objectId: standalone ? null : objectId,
      isFloating: standalone ? true : object.isFloating,
      isVisible: standalone ? true : object.isVisible,
      authored: { ...authored },
      current: standalone ? snapshot.diagnostics?.current || { ...authored } : objectRectangle(object),
      dashboardSize: dashboardSize(),
      lastResize,
    };
  }

  function remember(rectangle) {
    ownedRectangles.push({ ...rectangle });
    if (ownedRectangles.length > 6) ownedRectangles.shift();
  }

  async function resize(rectangle, expanded) {
    if (disposed || snapshot.status !== 'ready') return false;
    const previous = snapshot;
    const operationGeneration = generation;
    remember(rectangle);
    publish({ status: 'resizing', error: '' });
    try {
      if (!standalone) {
        ownObject();
        await dashboard.moveAndResizeDashboardObjectsAsync([
          { dashboardObjectID: objectId, ...rectangle },
        ]);
      }
      if (disposed || operationGeneration !== generation) return false;
      acknowledgedRectangle = { ...rectangle };
      const nextDiagnostics = diagnostics('Succeeded');
      if (standalone) nextDiagnostics.current = { ...rectangle };
      publish({ status: 'ready', expanded, diagnostics: nextDiagnostics, error: '' });
      return true;
    } catch (error) {
      if (disposed || operationGeneration !== generation) return false;
      // Preserve the prior usable view, including Close after failed collapse.
      publish({
        status: 'ready',
        expanded: previous.expanded,
        error: `Could not ${expanded ? 'open' : 'close'} AI Guide: ${error.message}`,
        diagnostics: { ...previous.diagnostics, lastResize: `Failed: ${error.message}` },
      });
      return false;
    } finally {
      if (layoutPending && !disposed && snapshot.status === 'ready') {
        layoutPending = false;
        queueMicrotask(handleLayoutChange);
      }
    }
  }

  function handleLayoutChange() {
    if (disposed || (!standalone && !dashboard)) return;
    if (snapshot.status === 'resizing') {
      layoutPending = true;
      return;
    }
    if (snapshot.status !== 'ready') return;
    try {
      const current = standalone ? snapshot.diagnostics.current : objectRectangle(ownObject());
      const size = dashboardSize();
      if (snapshot.expanded) {
        const target = expandedRectangle(authored, size);
        publish({ diagnostics: diagnostics() });
        // A layout notification may arrive before the SDK's object snapshot
        // catches up with the already acknowledged resize.
        if (!sameRectangle(current, target) && !sameRectangle(acknowledgedRectangle, target)) void resize(target, true);
      } else {
        // Compare geometry as well as the in-flight flag: Tableau can deliver
        // an event after our resize promise resolves.
        if (!ownedRectangles.some(rectangle => sameRectangle(current, rectangle))) {
          authored = current;
          acknowledgedRectangle = { ...current };
        }
        publish({ diagnostics: diagnostics() });
      }
    } catch (error) {
      publish({ error: error.message });
    }
  }

  function initialize() {
    if (disposed) return Promise.resolve(snapshot);
    if (snapshot.status === 'ready') return Promise.resolve(snapshot);
    if (snapshot.status === 'initializing') return initializationAttempt;
    const currentGeneration = ++generation;
    abortController?.abort();
    abortController = new AbortController();
    publish({ status: 'initializing', error: '' });
    initializationAttempt = (async () => {
      try {
        if (standalone) {
          const size = dashboardSize();
          authored = { x: Math.max(0, size.width - 156), y: 8, width: 140, height: 36 };
          windowObject?.addEventListener('resize', handleLayoutChange);
          removeLayoutListener = () => windowObject?.removeEventListener('resize', handleLayoutChange);
        } else {
          if (!tableau?.extensions?.initializeAsync) {
            throw new Error('The Tableau library could not load. Reload the extension and check the hosting URL.');
          }
          // Retry a bounded wait without initiating a second concurrent SDK
          // handshake. After a rejected handshake, a new attempt is allowed.
          if (!platformInitialization) {
            platformInitialization = Promise.resolve().then(() => tableau.extensions.initializeAsync()).catch(error => {
              platformInitialization = null;
              throw error;
            });
          }
          await boundedInitialization(platformInitialization, timeoutMs, abortController.signal);
          if (disposed || currentGeneration !== generation) return snapshot;
          dashboard = tableau.extensions.dashboardContent?.dashboard;
          objectId = tableau.extensions.dashboardObjectId;
          authored = objectRectangle(ownObject());
          dashboardSize();
          removeLayoutListener?.();
          const eventType = tableau.TableauEventType.DashboardLayoutChanged;
          const unregister = dashboard.addEventListener(eventType, handleLayoutChange);
          removeLayoutListener = typeof unregister === 'function'
            ? unregister
            : () => dashboard.removeEventListener(eventType, handleLayoutChange);
        }
        if (!disposed && currentGeneration === generation) {
          acknowledgedRectangle = { ...authored };
          publish({ status: 'ready', expanded: false, error: '', diagnostics: diagnostics() });
        }
      } catch (error) {
        if (!disposed && currentGeneration === generation) {
          publish({ status: 'error', error: error.message });
        }
      }
      return snapshot;
    })();
    return initializationAttempt;
  }

  async function toggle() {
    if (snapshot.status !== 'ready' || disposed) return false;
    try {
      const target = snapshot.expanded
        ? collapsedRectangle(authored, dashboardSize())
        : expandedRectangle(authored, dashboardSize());
      return await resize(target, !snapshot.expanded);
    } catch (error) {
      publish({ error: error.message });
      return false;
    }
  }

  return {
    initialize,
    toggle,
    getSnapshot: () => snapshot,
    subscribe(notify) {
      subscribers.add(notify);
      return () => subscribers.delete(notify);
    },
    getDashboardContext() {
      if (standalone || !dashboard || !['ready', 'resizing'].includes(snapshot.status)) return null;
      return {
        dashboardName: dashboard.activeDashboardName || dashboard.name,
        worksheetNames: dashboard.worksheets.map(worksheet => worksheet.name),
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      generation += 1;
      abortController?.abort();
      removeLayoutListener?.();
      subscribers.clear();
    },
  };
}
