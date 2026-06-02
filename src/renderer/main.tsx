import React from "react";
import { createRoot } from "react-dom/client";
import App from "./app";

if (process.env.NODE_ENV === 'development') {
  const ignoreResizeLoop = (e: any) => {
    const msg = e.message || (e.reason && e.reason.message) || '';
    if (msg.includes('ResizeObserver loop')) {
      e.stopImmediatePropagation();
    }
  };
  window.addEventListener('error', ignoreResizeLoop);
  window.addEventListener('unhandledrejection', ignoreResizeLoop);
}

const container = document.getElementById("root");

function showFallback(message: string, err?: any) {
  if (container) {
    container.innerHTML = `
      <div style="background:#2a2a2a; color:#ffcc00; font-family: monospace; padding: 20px; height: 100%; overflow:auto; font-size:13px;">
        <h2 style="color:#fff; margin-top:0;">Orbit AI – Renderer failed to mount</h2>
        <p>${message}</p>
        ${err ? `<pre style="white-space:pre-wrap; background:#111; padding:10px; border:1px solid #444;">${(err && (err.stack || err.message || String(err)))}</pre>` : ''}
        <p style="opacity:0.6;">See DevTools Console (auto open) for details. Common: kill node on 3001/9001, restart npm start.</p>
      </div>
    `;
  }
  console.error(message, err);
}

if (container) {
  try {
    const root = createRoot(container);
    root.render(<App />);
  } catch (err) {
    showFallback('Synchronous error during React createRoot or initial render of App.', err);
  }
} else {
  console.error('No #root container found in index.html');
}