import React, { useState } from 'react';

function formatRectangle(rectangle) {
  return rectangle ? `${Math.round(rectangle.x)}, ${Math.round(rectangle.y)} · ${Math.round(rectangle.width)} × ${Math.round(rectangle.height)}` : 'Unavailable';
}

export default function ResizeDiagnostic({ diagnostic }) {
  const [draft, setDraft] = useState('');
  const [probeCount, setProbeCount] = useState(0);
  return <div className="diagnostic-pane">
    <div className="panel-body">
      <p className="eyebrow">Tableau resize diagnostic</p><h1>Verify the panel layout</h1>
      <p>Check opening, closing, dashboard resizing, and retained text before accepting the hosted integration.</p>
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
    <footer className="panel-footer"><label htmlFor="probe-draft">Text to preserve while toggling</label><textarea id="probe-draft" rows="2" maxLength={2000} value={draft} onChange={event => setDraft(event.target.value)} placeholder="Type test text, close, and reopen" /><p className="demo-notice">Phase 1 demo — no backend connected</p></footer>
  </div>;
}
