import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import './app.css';
import TerminalPanel from './Terminal';
import { FileTree, FileNode } from './FileTree';
import AIChat from './AIChat';
import EditorTabs from './EditorTabs';

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

function App() {
  const [folderPath, setFolderPath] = useState<string | null>(null);
  const [fileTree, setFileTree]     = useState<FileNode[]>([]);
  const [tabs, setTabs] = useState<{ path: string; name: string; content: string; saved: boolean }[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null);
  const [language, setLanguage]     = useState('typescript');
  const editorRef = useRef<any>(null);

  const activeTab = useMemo(() => tabs.find(t => t.path === activeTabPath) || null, [tabs, activeTabPath]);
  const currentFile = activeTab?.path ?? null;
  const code = activeTab?.content ?? '';
  const saved = activeTab?.saved ?? true;

  const openFolder = async () => {
    const selected = await window.electronAPI.openFolder();
    if (!selected) return;

    // Guard against accidentally opening node_modules or other pathological folders as the project root.
    const baseName = selected.split(/[/\\]/).pop()?.toLowerCase() || '';
    if (baseName === 'node_modules' || baseName === '.git') {
      alert(`It is not recommended to open "${baseName}" as a project folder. The file tree and terminal will be very slow or empty. Please choose the actual project root instead.`);
      return;
    }

    // Load the full tree first (can be slow on huge folders with many files).
    // Only update folderPath (which restarts the terminal) after the tree is ready.
    // This prevents the terminal from going blank while the main process is busy walking a large directory.
    const tree = await window.electronAPI.getFileTree(selected);
    setFileTree(tree);
    setFolderPath(selected);
  };

  const openFileInNewTab = async (filePath: string) => {
    const content = await window.electronAPI.readFile(filePath);
    const name = filePath.split(/[/\\]/).pop() || 'Untitled';
    setTabs(prev => {
      const existing = prev.find(t => t.path === filePath);
      if (existing) return prev;
      return [...prev, { path: filePath, name, content, saved: true }];
    });
    setActiveTabPath(filePath);
    setLanguage(getLanguage(filePath));
  };

  const closeTab = (path: string) => {
    setTabs(prev => {
      const newTabs = prev.filter(t => t.path !== path);
      if (activeTabPath === path && newTabs.length > 0) {
        setActiveTabPath(newTabs[newTabs.length - 1].path);
      } else if (newTabs.length === 0) {
        setActiveTabPath(null);
      }
      return newTabs;
    });
  };

  const switchTab = (path: string) => {
    setActiveTabPath(path);
    const tab = tabs.find(t => t.path === path);
    if (tab) setLanguage(getLanguage(path));
  };

  const loadFile = (filePath: string) => {
    openFileInNewTab(filePath);
  };

  const saveFile = useCallback(async () => {
    if (!currentFile || !editorRef.current) return;
    const newContent = editorRef.current.getValue();
    await window.electronAPI.writeFile(currentFile, newContent);
    setTabs(prev => prev.map(t =>
      t.path === currentFile ? { ...t, content: newContent, saved: true } : t
    ));
  }, [currentFile]);

  const applyToEditor = useCallback((aiCode: string, mode: 'insert' | 'replace') => {
    if (!editorRef.current) {
      console.warn('No editor open. Open a file first to use Insert/Replace.');
      return;
    }
    const editor = editorRef.current;
    const selection = editor.getSelection();

    // Improved extraction supporting optional language, flexible whitespace/newlines
    let cleanedCode = aiCode;
    const codeBlockMatch = aiCode.match(/```(?:\w+)?\s*\n([\s\S]*?)\n```/i) || aiCode.match(/```([\s\S]*?)```/i);
    if (codeBlockMatch) {
      cleanedCode = codeBlockMatch[1].trim();
    } else {
      cleanedCode = aiCode.trim();
    }

    let editRange;
    if (mode === 'replace' && selection) {
      editRange = selection;
    } else {
      const position = editor.getPosition() || { lineNumber: 1, column: 1 };
      editRange = {
        startLineNumber: position.lineNumber,
        startColumn: position.column,
        endLineNumber: position.lineNumber,
        endColumn: position.column
      };
    }
    editor.executeEdits('ai-apply', [{ range: editRange, text: cleanedCode }]);
    saveFile();
  }, [currentFile, editorRef]);

  // Global save handler
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

      {/* Title bar */}
      <div className="ide-titlebar">
        <span className="ide-titlebar__title">
          Orbit AI{folderName ? ` — ${folderName}` : ''}
        </span>
        <button className="ide-titlebar__btn" onClick={openFolder}>
          Open Folder
        </button>
      </div>

      <div className="ide-body">

        {/* Activity bar */}
        <div className="ide-activity">
          <div className="ide-activity__icon" title="Explorer">📁</div>
        </div>

        {/* Sidebar / File Explorer */}
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

        {/* Editor + Terminal column */}
        <div className="ide-editor">

          {/* Tab bar */}
          <EditorTabs
            tabs={tabs.map(t => ({ path: t.path, name: t.name, saved: t.saved }))}
            activeTabPath={activeTabPath}
            onTabClick={switchTab}
            onTabClose={closeTab}
          />

          {/* Monaco */}
          <div className="ide-monaco">
            {currentFile ? (
              <Editor
                height="100%"
                language={language}
                value={code}
                onChange={val => {
                  const newVal = val ?? '';
                  setTabs(prev => prev.map(t =>
                    t.path === activeTabPath ? { ...t, content: newVal, saved: false } : t
                  ));
                }}
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

        {/* AI Chat sidebar */}
        <div className="ide-chat">
          <AIChat currentFile={activeTabPath} currentCode={code} folderPath={folderPath} onApplyCode={applyToEditor} />
        </div>

      </div>

      {/* Status bar */}
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