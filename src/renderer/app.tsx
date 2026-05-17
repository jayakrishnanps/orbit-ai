import React, { useState } from 'react';
import Editor, { loader } from '@monaco-editor/react';

// Import Monaco from the ESM path — NOT 'monaco-editor' (which resolves to
// the AMD/min bundle that requires `define` and crashes in Electron's webpack).
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

// Set up language workers manually (replaces monaco-editor-webpack-plugin).
// We use webpack 5's built-in worker bundling via `new URL(..., import.meta.url).
(self as any).MonacoEnvironment = {
  getWorker(_moduleId: string, label: string) {
    if (label === 'json') {
      return new Worker(
        new URL('monaco-editor/esm/vs/language/json/json.worker', import.meta.url)
      );
    }
    if (label === 'typescript' || label === 'javascript') {
      return new Worker(
        new URL('monaco-editor/esm/vs/language/typescript/ts.worker', import.meta.url)
      );
    }
    return new Worker(
      new URL('monaco-editor/esm/vs/editor/editor.worker', import.meta.url)
    );
  },
};

// Tell @monaco-editor/react to use our locally-bundled monaco instance
// instead of fetching from cdn.jsdelivr.net (which Electron's CSP blocks).
loader.config({ monaco });

import './app.css';

const INITIAL_CODE = `// Welcome to Orbit AI
function greet(name: string): string {
  return \`Hello, \${name}!\`;
}

console.log(greet('Orbit AI'));
`;

function App() {
  const [code, setCode] = useState(INITIAL_CODE);

  return (
    <div className="shell">
      <div className="titlebar">Orbit AI</div>

      <div className="body">
        <div className="activity-bar">
          <div className="activity-icon" title="Explorer">📁</div>
        </div>

        <div className="sidebar">
          <div className="sidebar-header">Explorer</div>
          <div className="sidebar-content">
            <div className="sidebar-item">📂 src</div>
            <div className="sidebar-item" style={{ paddingLeft: 32 }}>📄 index.ts</div>
            <div className="sidebar-item" style={{ paddingLeft: 32 }}>📂 renderer</div>
            <div className="sidebar-item" style={{ paddingLeft: 48 }}>📄 app.tsx</div>
            <div className="sidebar-item" style={{ paddingLeft: 48 }}>📄 main.tsx</div>
          </div>
        </div>

        <div className="editor-area">
          <div className="tab-bar">
            <div className="tab">app.tsx</div>
          </div>
          <div className="monaco-container">
            <Editor
              height="100%"
              defaultLanguage="typescript"
              value={code}
              onChange={(val) => setCode(val ?? '')}
              theme="vs-dark"
              options={{
                minimap: { enabled: true },
                fontSize: 14,
                wordWrap: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          </div>
        </div>

        <div className="right-panel">
          <div style={{ fontWeight: 600, color: '#cccccc', marginBottom: 8 }}>AI Chat</div>
          <div>Composer panel coming soon…</div>
        </div>
      </div>

      <div className="statusbar">
        <span>main branch</span>
        <span>TypeScript</span>
        <span>Orbit AI v0.1</span>
      </div>
    </div>
  );
}

export default App;