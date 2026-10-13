import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import robot from './assets/robot.svg?raw';

function RobotIcon() {
  // This SVG is a source-controlled, original asset, never response/user HTML.
  return <span className="robot-icon" aria-hidden="true" dangerouslySetInnerHTML={{ __html: robot }} />;
}

function formatRectangle(rectangle) {
  return rectangle ? `${Math.round(rectangle.x)}, ${Math.round(rectangle.y)} · ${Math.round(rectangle.width)} × ${Math.round(rectangle.height)}` : 'Unavailable';
}

export default function App({ host }) {
  const state = useSyncExternalStore(host.subscribe, host.getSnapshot);
  const [draft, setDraft] = useState('');
  const [probeCount, setProbeCount] = useState(0);
  const buttonRef = useRef(null);
  const closeRef = useRef(null);
  const previousExpanded = useRef(false);

  useEffect(() => {
    void host.initialize();
  }, [host]);

  useEffect(() => {
    if (state.expanded !== previousExpanded.current) {
      if (state.expanded) closeRef.current?.focus();
      else buttonRef.current?.focus();
      previousExpanded.current = state.expanded;
    }
  }, [state.expanded]);

  const busy = state.status === 'resizing';
  const simulationStyle = state.standalone && state.diagnostics
    ? { width: state.diagnostics.current.width, height: state.diagnostics.current.height }
    : undefined;

  if (state.status === 'idle' || state.status === 'initializing') {
    return <main className="integration-state" role="status">Connecting to Tableau…</main>;
  }

  if (state.status === 'error') {
    return (
      <main className="integration-state integration-state--error">
        <p>This extension runs inside Tableau.</p>
        <p role="alert">{state.error}</p>
        <button type="button" onClick={() => void host.initialize()}>Retry connection</button>
        <a href="./AIGuide.local.trex">Local manifest</a>
      </main>
    );
  }

  const diagnostic = state.diagnostics;
  return (
    <main className={`extension ${state.standalone ? 'extension--standalone' : ''}`}>
      {state.standalone && <p className="standalone-badge">Standalone dev mode · resize simulation</p>}
      <div className={`guide-frame ${state.expanded ? 'guide-frame--expanded' : 'guide-frame--collapsed'}`} style={simulationStyle}>
        {!state.expanded ? (
          <button
            ref={buttonRef}
            className="guide-button"
            type="button"
            aria-expanded="false"
            aria-controls="ai-guide-panel"
            disabled={busy}
            title={state.error || 'Open AI Guide'}
            onClick={() => void host.toggle()}
          >
            <RobotIcon />
            <span>{busy ? 'Opening…' : 'AI Guide'}</span>
            {state.error && <span aria-label="Resize error">!</span>}
          </button>
        ) : null}
          <section hidden={!state.expanded} className="guide-panel" id="ai-guide-panel" aria-label="AI Guide panel" aria-busy={busy}>
            <header className="panel-header">
              <div className="panel-title"><RobotIcon /><strong>AI Guide</strong></div>
              <button ref={closeRef} type="button" className="close-button" disabled={busy} onClick={() => void host.toggle()} aria-label="Close AI Guide" aria-expanded="true" aria-controls="ai-guide-panel">{busy ? 'Resizing…' : 'Close'}</button>
            </header>
            <div className="panel-body">
              <p className="eyebrow">Tableau resize diagnostic</p>
              <h1>Verify the panel first</h1>
              <p>Open and close this panel, change the dashboard size, and confirm that the text below survives. The chat UI comes after this integration test.</p>
              <dl className="diagnostics">
                <dt>Tableau version</dt><dd>{diagnostic.tableauVersion || 'Unavailable'}</dd>
                <dt>API version</dt><dd>{diagnostic.apiVersion || 'Unavailable'}</dd>
                <dt>Mode</dt><dd>{diagnostic.mode || 'Unavailable'}</dd>
                <dt>Object ID</dt><dd>{diagnostic.objectId ?? 'Simulation'}</dd>
                <dt>Floating / visible</dt><dd>{String(diagnostic.isFloating)} / {String(diagnostic.isVisible)}</dd>
                <dt>Authored position / size</dt><dd>{formatRectangle(diagnostic.authored)}</dd>
                <dt>Current position / size</dt><dd>{formatRectangle(diagnostic.current)}</dd>
                <dt>Dashboard size</dt><dd>{diagnostic.dashboardSize.width} × {diagnostic.dashboardSize.height}</dd>
                <dt>Last resize</dt><dd>{diagnostic.lastResize}</dd>
              </dl>
              <button className="probe-button" type="button" onClick={() => setProbeCount(value => value + 1)}>Persistence probe: {probeCount}</button>
            </div>
            {state.error && <p className="error-banner" role="alert">{state.error}</p>}
            <footer className="panel-footer">
              <label htmlFor="probe-draft">Text to preserve while toggling</label>
              <textarea id="probe-draft" rows="2" maxLength={2000} value={draft} onChange={event => setDraft(event.target.value)} placeholder="Type test text, close, and reopen" />
              <p className="demo-notice">Phase 1 demo — no backend connected</p>
            </footer>
          </section>
      </div>
      {!state.expanded && state.error && <p className="sr-only" role="alert">{state.error}</p>}
    </main>
  );
}
