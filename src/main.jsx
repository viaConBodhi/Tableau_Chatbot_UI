import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { createTableauHost } from './tableau/host.js';
import { createChatController } from './chat/controller.js';
import { createMockAdapter, resolveMockScenario } from './chat/mock-adapter.js';
import './App.css';

const standalone = import.meta.env.DEV && new URLSearchParams(window.location.search).get('standalone') === '1';
const testControls = import.meta.env.DEV || import.meta.env.VITE_AI_GUIDE_TEST_CONTROLS === 'true';
const scenario = resolveMockScenario(window.location.search, testControls);
const host = createTableauHost({
  standalone,
  viewport: () => ({ width: window.innerWidth, height: Math.max(0, window.innerHeight - 56) }),
});
const adapter = createMockAdapter({ scenario });
const chat = createChatController({ adapter, getContext: () => host.getDashboardContext() });
createRoot(document.getElementById('root')).render(<App host={host} chat={chat} mockAdapter={adapter} testControls={testControls} initialScenario={scenario} initialView={new URLSearchParams(window.location.search).get('diagnostics') === '1' ? 'diagnostic' : 'chat'} />);

// The SDK controller belongs to the iframe/page, not a component effect.
// React Fast Refresh can remount effects while preserving this controller.
const dispose = () => { chat.dispose(); host.dispose(); };
window.addEventListener('beforeunload', dispose, { once: true });
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    window.removeEventListener('beforeunload', dispose);
    dispose();
  });
}
