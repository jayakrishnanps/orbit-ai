import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import MonacoEditor from '@monaco-editor/react';
import 'monaco-editor/esm/vs/editor/editor.main.css';
import './app.css';
import TerminalPanel from './Terminal';
import { FileTree, FileNode } from './FileTree';
import AIChat from './AIChat';
import EditorTabs from './EditorTabs';

(self as any).MonacoEnvironment = {
  getWorkerUrl: function (_moduleId: string, label: string) {
    let worker = 'editor.worker.js';
    if (label === 'json') {
      worker = 'json.worker.js';
    } else if (label === 'typescript' || label === 'javascript') {
      worker = 'ts.worker.js';
    }
    if (typeof window !== 'undefined' && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
      return `/${worker}`;
    }
    return `../${worker}`;
  }
};

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
      terminalDestroy?: () => void;
      aiStream?: (apiKey: string, messages: any[]) => Promise<any>;
      onStreamChunk?: (callback: (delta: string) => void) => void;
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
    try {
      const selected = await window.electronAPI.openFolder();
      if (!selected) return;

      const baseName = selected.split(/[/\\]/).pop()?.toLowerCase() || '';
      if (baseName === 'node_modules' || baseName === '.git') {
        alert(`It is not recommended to open "${baseName}" as a project folder. The file tree and terminal will be very slow or empty. Please choose the actual project root instead.`);
        return;
      }

      const tree = await window.electronAPI.getFileTree(selected);
      setFileTree(tree);
      setFolderPath(selected);
    } catch (e) {
      console.error('Failed to open folder:', e);
      alert('Failed to open folder: ' + ((e as Error)?.message || e));
    }
  };

  const openFileInNewTab = async (filePath: string) => {
    try {
      const content = await window.electronAPI.readFile(filePath);
      const name = filePath.split(/[/\\]/).pop() || 'Untitled';
      setTabs(prev => {
        const existing = prev.find(t => t.path === filePath);
        if (existing) return prev;
        return [...prev, { path: filePath, name, content, saved: true }];
      });
      setActiveTabPath(filePath);
      setLanguage(getLanguage(filePath));
    } catch (e) {
      console.error('Failed to open file:', e);
      alert('Failed to read file: ' + ((e as Error)?.message || e));
    }
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

  const applyToEditor = useCallback((aiCode: string, _mode: 'insert' | 'replace') => {
    if (!editorRef.current) {
      return { success: false, reason: 'no-editor' };
    }

    const editor = editorRef.current;
    const _selection = editor.getSelection();

    if (typeof aiCode === 'string' && !aiCode.startsWith('{') && !aiCode.includes('EDIT:')) {
      const model = editor.getModel();
      if (model) {
        model.setValue(aiCode);
        saveFile();
        return { success: true };
      }
      return { success: false, reason: 'no-model' };
    }

    if (typeof aiCode === 'string' && aiCode.startsWith('{')) {
      try {
        const parsed = JSON.parse(aiCode);
        if (parsed.type === 'precise-replace' && parsed.find && parsed.replace) {
          const model = editor.getModel();
          const fullText = model.getValue();
          let newText = fullText.replace(parsed.find, parsed.replace);

          if (newText === fullText) {
            const trimmedFind = parsed.find.trim();
            const trimmedReplace = parsed.replace.trim();
            newText = fullText.replace(trimmedFind, trimmedReplace);
          }

          if (newText !== fullText) {
            const lastLine = model.getLineCount();
            const lastColumn = model.getLineMaxColumn(lastLine);
            editor.executeEdits('ai-apply', [{
              range: { startLineNumber: 1, startColumn: 1, endLineNumber: lastLine, endColumn: lastColumn },
              text: newText
            }]);
            saveFile();
            return { success: true };
          }
          return { success: false, reason: 'find-not-found' };
        }
      } catch (e) {
        
      }
    }

    const fileName = currentFile ? currentFile.split(/[/\\]/).pop() : 'file';
    console.warn(`Legacy edit path used for ${fileName}.`);
    return { success: false, reason: 'legacy-path-used' };
  }, [currentFile, editorRef]);

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

  return (
    <div className="ide-shell">

      <div className="ide-titlebar">
        <span className="ide-titlebar__title">
          Orbit AI{folderName ? ` — ${folderName}` : ''}
        </span>
        <button className="ide-titlebar__btn" onClick={openFolder}>
          Open Folder
        </button>
      </div>

      <div className="ide-body">

        <div className="ide-activity">
          <div className="ide-activity__icon" title="Explorer">📁</div>
        </div>

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

        <div className="ide-editor">

          <EditorTabs
            tabs={tabs.map(t => ({ path: t.path, name: t.name, saved: t.saved }))}
            activeTabPath={activeTabPath}
            onTabClick={switchTab}
            onTabClose={closeTab}
          />

          <div className="ide-monaco">
            {currentFile ? (
              <MonacoEditor
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

          <div className="ide-terminal">
            <TerminalPanel folderPath={folderPath} />
          </div>

        </div>

        <div className="ide-chat">
          <AIChat currentFile={activeTabPath} currentCode={code} folderPath={folderPath} onApplyCode={applyToEditor} />
        </div>

      </div>

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