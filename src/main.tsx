import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AccessProvider } from './security/AccessProvider';
// Expired sessions immediately remove the gallery and any cached private view.
const originalFetch = window.fetch.bind(window);
window.fetch = async (...args) => {
  const response = await originalFetch(...args);
  const input = args[0]; const url = typeof input === 'string' ? input : input instanceof URL ? input.pathname : input.url;
  if (response.status === 401 && url.includes('/api/') && !url.includes('/api/access/login')) window.dispatchEvent(new Event('genery-session-expired'));
  return response;
};
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AccessProvider><App /></AccessProvider>
  </React.StrictMode>
);
