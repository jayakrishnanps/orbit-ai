import React, { useState, useEffect, useRef, useCallback } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import './app.css';

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

// ── Types ────────────────────────────────────────────────────────────────────
interface FileNode {
  name: string;
  type: 'file' | 'directory';
  path: string;
  children?: FileNode[];
}

declare global {
  interface Window {
    electronAPI: {
      openFolder: () => Promise<string | null>;
      readFile: (path: string) => Promise<string>;
      writeFile: (path: string, content: string) => Promise<boolean>;
      getFileTree: (folderPath: string) => Promise<FileNode[]>;
    };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────
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

// ── FileTree component ───────────────────────────────────────────────────────
interface FileTreeProps {
  nodes: FileNode[];
  depth: number;
  currentFile: string | null;
  onFileClick: (path: string) => void;
}

function FileTree({ nodes, depth, currentFile, onFileClick }: FileTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (p: string) =>
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(p) ? next.delete(p) : next.add(p);
      return next;
    });

  return (
    <>
      {nodes.map(node => (
        <div key={node.path}>
          {node.type === 'directory' ? (
            <>
              <div
                className="tree-item tree-item--dir"
                style={{ paddingLeft: 8 + depth * 12 }}
                onClick={() => toggle(node.path)}
              >
                <span className="tree-item__arrow">
                  {expanded.has(node.path) ? '▾' : '▸'}
                </span>
                <span className="tree-item__icon">📁</span>
                {node.name}
              </div>
              {expanded.has(node.path) && node.children && (
                <FileTree
                  nodes={node.children}
                  depth={depth + 1}
                  currentFile={currentFile}
                  onFileClick={onFileClick}
                />
              )}
            </>
          ) : (
            <div
              className={`tree-item tree-item--file${currentFile === node.path ? ' tree-item--active' : ''}`}
              style={{ paddingLeft: 20 + depth * 12 }}
              onClick={() => onFileClick(node.path)}
            >
              <span className="tree-item__icon">📄</span>
              {node.name}
            </div>
          )}
        </div>
      ))}
    </>
  );
}

// ── App ──────────────────────────────────────────────────────────────────────
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
            <div className="ide-sidebar__empty">No folder opened</div>
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

        {/* ── Editor ── */}
        <div className="ide-editor">
          <div className="ide-tabs">
            <div className="ide-tab">
              {fileName ?? 'Untitled'}
              {!saved && <span className="ide-tab__dot"> ●</span>}
            </div>
          </div>
          <div className="ide-monaco">
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
          </div>
        </div>

        {/* ── AI Chat sidebar ── */}
        <div className="ide-chat">
          <div className="ide-chat__title">Orbit AI Chat</div>
          <div className="ide-chat__body">
            AI assistant coming soon…
          </div>
        </div>

      </div>

      {/* ── Status bar ── */}
      <div className="ide-statusbar">
        <span>{saved ? 'Saved' : '● Unsaved'}</span>
        <span>{language}</span>
        <span>Orbit AI v0.1</span>
      </div>

    </div>
  );
}

export default App;