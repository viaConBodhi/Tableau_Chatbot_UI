import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { createTableauHost } from './tableau/host.js';
import './App.css';

const standalone = import.meta.env.DEV && new URLSearchParams(window.location.search).get('standalone') === '1';
const host = createTableauHost({
  standalone,
  viewport: () => ({ width: window.innerWidth, height: Math.max(0, window.innerHeight - 56) }),
});
createRoot(document.getElementById('root')).render(<App host={host} />);

// The SDK controller belongs to the iframe/page, not a component effect.
// React Fast Refresh can remount effects while preserving this controller.
window.addEventListener('beforeunload', host.dispose, { once: true });
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    window.removeEventListener('beforeunload', host.dispose);
    host.dispose();
  });
}
