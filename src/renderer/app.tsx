import React, { useState, useEffect, useRef, useCallback } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import './app.css';
import TerminalPanel from './Terminal';
import { FileTree, FileNode } from './FileTree';
import AIChat from './AIChat';

// ── Monaco worker setup ──────────────────────────────────────────────────────
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

loader.config({ monaco });

// ── Global type augmentation ──────────────────────────────────────────────────
declare global {
  interface Window {
    electronAPI: {
      openFolder: () => Promise<string | null>;
      readFile: (path: string) => Promise<string>;
      writeFile: (path: string, content: string) => Promise<boolean>;
      getFileTree: (folderPath: string) => Promise<FileNode[]>;
      terminalCreate: (cwd?: string) => Promise<void>;
      terminalWrite: (data: string) => void;
      terminalResize: (cols: number, rows: number) => void;
      onTerminalData: (cb: (data: string) => void) => void;
      aiChat: (apiKey: string, messages: { role: string; content: string }[]) => Promise<string>;
    };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const EXT_LANGUAGE: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript',
  js: 'javascript', jsx: 'javascript',
  json: 'json', md: 'markdown',
  css: 'css', html: 'html', py: 'python',
  sh: 'shell', yaml: 'yaml', yml: 'yaml',
};

function getLanguage(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  return EXT_LANGUAGE[ext] ?? 'plaintext';
}

function basename(filePath: string): string {
  return filePath.split(/[/\\]/).pop() ?? filePath;
}

// ── App ───────────────────────────────────────────────────────────────────────
function App() {
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [fileTree, setFileTree]     = useState<FileNode[]>([]);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [code, setCode]             = useState('');
  const [language, setLanguage]     = useState('typescript');
  const [saved, setSaved]           = useState(true);
  const editorRef = useRef<any>(null);

  const openFolder = async () => {
    const selected = await window.electronAPI.openFolder();
    if (!selected) return;
    setFolderPath(selected);
    const tree = await window.electronAPI.getFileTree(selected);
    setFileTree(tree);
  };

  const loadFile = async (filePath: string) => {
    const content = await window.electronAPI.readFile(filePath);
    setCurrentFile(filePath);
    setCode(content);
    setLanguage(getLanguage(filePath));
    setSaved(true);
  };

  const saveFile = useCallback(async () => {
    if (!currentFile || !editorRef.current) return;
    await window.electronAPI.writeFile(currentFile, editorRef.current.getValue());
    setSaved(true);
  }, [currentFile]);

  const applyToEditor = (aiCode: string, mode: 'insert' | 'replace') => {
    if (!editorRef.current) return;
    const editor = editorRef.current;
    const selection = editor.getSelection();
    
    // Extract code block content if it is a markdown code block
    let cleanedCode = aiCode;
    const codeBlockMatch = aiCode.match(/```[a-z]*\n([\s\S]*?)```/);
    if (codeBlockMatch) {
      cleanedCode = codeBlockMatch[1];
    }
    
    if (mode === 'replace' && selection) {
      editor.executeEdits('ai-apply', [{
        range: selection,
        text: cleanedCode,
      }]);
    } else {
      // insert at cursor
      const position = editor.getPosition();
      editor.executeEdits('ai-apply', [{
        range: { startLineNumber: position.lineNumber, startColumn: position.column, endLineNumber: position.lineNumber, endColumn: position.column },
        text: cleanedCode,
      }]);
    }
    saveFile();
  };

  // Ctrl+S global save
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        saveFile();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [saveFile]);

  const folderName = folderPath ? basename(folderPath) : null;
  const fileName   = currentFile ? basename(currentFile) : null;

  return (
    <div className="ide-shell">

      {/* ── Title bar ── */}
      <div className="ide-titlebar">
        <span className="ide-titlebar__title">
          Orbit AI{folderName ? ` — ${folderName}` : ''}
        </span>
        <button className="ide-titlebar__btn" onClick={openFolder}>
          Open Folder
        </button>
      </div>

      <div className="ide-body">

        {/* ── Activity bar ── */}
        <div className="ide-activity">
          <div className="ide-activity__icon" title="Explorer">📁</div>
        </div>

        {/* ── Sidebar / File Explorer ── */}
        <div className="ide-sidebar">
          <div className="ide-sidebar__header">Explorer</div>
          {folderName && (
            <div className="ide-sidebar__root">{folderName}</div>
          )}
          {!folderPath && (
            <div className="ide-sidebar__empty">
              <p>No folder opened</p>
            </div>
          )}
          <div className="ide-sidebar__tree">
            <FileTree
              nodes={fileTree}
              depth={0}
              currentFile={currentFile}
              onFileClick={loadFile}
            />
          </div>
        </div>

        {/* ── Editor + Terminal column ── */}
        <div className="ide-editor">

          {/* Tab bar */}
          <div className="ide-tabs">
            <div className="ide-tab">
              {fileName ?? 'No file open'}
              {!saved && <span className="ide-tab__dot"> ●</span>}
            </div>
          </div>

          {/* Monaco */}
          <div className="ide-monaco">
            {currentFile ? (
              <Editor
                height="100%"
                language={language}
                value={code}
                onChange={val => { setCode(val ?? ''); setSaved(false); }}
                onMount={editor => { editorRef.current = editor; }}
                theme="vs-dark"
                options={{
                  minimap: { enabled: true },
                  fontSize: 14,
                  wordWrap: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                }}
              />
            ) : (
              <div className="ide-editor__empty">
                <div className="ide-editor__empty-icon">🛸</div>
                <p>Open a folder and select a file to start editing</p>
              </div>
            )}
          </div>

          {/* Terminal */}
          <div className="ide-terminal">
            <TerminalPanel folderPath={folderPath} />
          </div>

        </div>

        {/* ── AI Chat sidebar ── */}
        <div className="ide-chat">
          <AIChat currentFile={currentFile} currentCode={code} onApplyCode={applyToEditor} />
        </div>

      </div>

      {/* ── Status bar ── */}
      <div className="ide-statusbar">
        <span>{saved ? 'Saved' : '● Unsaved changes'}</span>
        <span>{currentFile ? language : ''}</span>
        <span>{currentFile ?? 'No file open'}</span>
        <span className="ide-statusbar__right">Orbit AI v0.1</span>
      </div>

    </div>
  );
}

export default App;