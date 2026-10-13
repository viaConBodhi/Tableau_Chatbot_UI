import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import robot from './assets/robot.svg?raw';
import ChatPanel from './chat/ChatPanel.jsx';
import { MOCK_SCENARIOS } from './chat/mock-adapter.js';
import ResizeDiagnostic from './tableau/ResizeDiagnostic.jsx';

function RobotIcon() {
  // This SVG is a source-controlled, original asset, never response/user HTML.
  return <span className="robot-icon" aria-hidden="true" dangerouslySetInnerHTML={{ __html: robot }} />;
}

export default function App({ host, chat, testControls = false, initialView = 'chat', initialScenario = 'ok', mockAdapter }) {
  const state = useSyncExternalStore(host.subscribe, host.getSnapshot);
  const chatState = useSyncExternalStore(chat.subscribe, chat.getSnapshot);
  const [view, setView] = useState(testControls && initialView === 'diagnostic' ? 'diagnostic' : 'chat');
  const [scenario, setScenario] = useState(initialScenario);
  const buttonRef = useRef(null);
  const closeRef = useRef(null);
  const previousExpanded = useRef(false);

  useEffect(() => { void host.initialize(); }, [host]);
  useEffect(() => {
    if (state.status === 'ready' && view === 'chat') void chat.start();
  }, [chat, state.status, view]);

  useEffect(() => {
    if (state.expanded !== previousExpanded.current) {
      if (state.expanded) closeRef.current?.focus();
      else buttonRef.current?.focus();
      previousExpanded.current = state.expanded;
    }
  }, [state.expanded]);

  const busy = state.status === 'resizing';
  const chatBusy = ['starting', 'sending', 'resetting'].includes(chatState.status);
  const simulationStyle = state.standalone && state.diagnostics ? { width: state.diagnostics.current.width, height: state.diagnostics.current.height } : undefined;

  if (state.status === 'idle' || state.status === 'initializing') return <main className="integration-state" role="status">Connecting to Tableau…</main>;
  if (state.status === 'error') return <main className="integration-state integration-state--error"><p>This extension runs inside Tableau.</p><p role="alert">{state.error}</p><button type="button" onClick={() => void host.initialize()}>Retry connection</button><a href="./AIGuide.local.trex">Local manifest</a></main>;

  return <main className={`extension ${state.standalone ? 'extension--standalone' : ''}`}>
    {state.standalone && <p className="standalone-badge">Standalone dev mode · resize simulation</p>}
    <div className={`guide-frame ${state.expanded ? 'guide-frame--expanded' : 'guide-frame--collapsed'}`} style={simulationStyle}>
      {!state.expanded && <button ref={buttonRef} className="guide-button" type="button" aria-expanded="false" aria-controls="ai-guide-panel" disabled={busy} title={state.error || 'Open AI Guide'} onClick={() => void host.toggle()}><RobotIcon /><span>{busy ? 'Opening…' : 'AI Guide'}</span>{state.error && <span aria-label="Resize error">!</span>}</button>}
      <section hidden={!state.expanded} className="guide-panel" id="ai-guide-panel" aria-label="AI Guide panel" aria-busy={busy}>
        <header className="panel-header"><div className="panel-title"><RobotIcon /><strong>AI Guide</strong></div><button ref={closeRef} type="button" className="close-button" disabled={busy} onClick={() => void host.toggle()} aria-label="Close AI Guide" aria-expanded="true" aria-controls="ai-guide-panel">{busy ? 'Resizing…' : 'Close'}</button></header>
        {testControls && <div className="test-controls"><button type="button" className="view-button" onClick={() => setView(value => value === 'chat' ? 'diagnostic' : 'chat')}>{view === 'chat' ? 'Layout test' : 'Back to chat'}</button>{mockAdapter && <label>Demo scenario<select value={scenario} disabled={chatBusy} onChange={event => { mockAdapter.setScenario(event.target.value); setScenario(event.target.value); }}>{MOCK_SCENARIOS.map(value => <option key={value} value={value}>{value}</option>)}</select></label>}</div>}
        <div className="panel-view" hidden={view !== 'chat'}><ChatPanel chat={chat} visible={state.expanded && view === 'chat'} /></div>
        {testControls && <div className="panel-view" hidden={view !== 'diagnostic'}><ResizeDiagnostic diagnostic={state.diagnostics} /></div>}
        {state.error && <p className="error-banner" role="alert">{state.error}</p>}
      </section>
    </div>
    {!state.expanded && state.error && <p className="sr-only" role="alert">{state.error}</p>}
  </main>;
}
