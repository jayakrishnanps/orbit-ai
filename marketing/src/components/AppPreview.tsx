import React, { useState } from 'react';
import * as Lucide from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  code?: string;
}

interface FileNode {
  name: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  content?: string;
}

const SAMPLE_FILES: Record<string, { content: string; language: string }> = {
  'App.tsx': {
    content: `import React, { useState } from 'react';

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="app">
      <h1>Orbit AI Demo</h1>
      <button onClick={() => setCount(c => c + 1)}>
        Clicked {count} times
      </button>
    </div>
  );
}`,
    language: 'tsx'
  },
  'utils.ts': {
    content: `export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

export const formatPath = (p: string) => p.replace(/\\\\/g, '/');`,
    language: 'ts'
  },
  'package.json': {
    content: `{
  "name": "my-orbit-project",
  "version": "0.1.0",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build"
  },
  "dependencies": {
    "react": "^19.0.0"
  }
}`,
    language: 'json'
  }
};

const INITIAL_TREE: FileNode[] = [
  {
    name: 'src',
    type: 'directory',
    children: [
      { name: 'App.tsx', type: 'file' },
      { name: 'utils.ts', type: 'file' },
      { name: 'components', type: 'directory', children: [
        { name: 'Button.tsx', type: 'file' }
      ]}
    ]
  },
  { name: 'package.json', type: 'file' },
  { name: 'tsconfig.json', type: 'file' },
];

export default function AppPreview() {
  // Editor state
  const [openTabs, setOpenTabs] = useState<string[]>(['App.tsx']);
  const [activeFile, setActiveFile] = useState<string>('App.tsx');
  const [editorContent, setEditorContent] = useState(SAMPLE_FILES['App.tsx'].content);
  const [tree, setTree] = useState(INITIAL_TREE);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set(['src']));

  // Terminal state
  const [terminalLines, setTerminalLines] = useState<string[]>([
    'PS C:\\Users\\dev\\project> ls',
    '    Directory: C:\\Users\\dev\\project',
    '',
    'Mode   LastWriteTime   Name',
    '----   -------------   ----',
    'd-----  3/12/2025  14:22 src',
    '-a----  3/12/2025  09:41 package.json',
  ]);
  const [terminalInput, setTerminalInput] = useState('');

  // AI Chat state
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: 'assistant', 
      content: "Hi! I'm your local AI coding companion. I see you're in App.tsx. What would you like to do?",
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isReplying, setIsReplying] = useState(false);

  // Toast
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  // File tree helpers
  const toggleDir = (path: string) => {
    const next = new Set(expandedDirs);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setExpandedDirs(next);
  };

  const openFile = (name: string) => {
    if (!SAMPLE_FILES[name]) return;
    
    if (!openTabs.includes(name)) {
      setOpenTabs([...openTabs, name]);
    }
    setActiveFile(name);
    setEditorContent(SAMPLE_FILES[name].content);
  };

  const closeTab = (name: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newTabs = openTabs.filter(t => t !== name);
    if (newTabs.length === 0) return;
    
    setOpenTabs(newTabs);
    if (activeFile === name) {
      const nextActive = newTabs[newTabs.length - 1];
      setActiveFile(nextActive);
      setEditorContent(SAMPLE_FILES[nextActive].content);
    }
  };

  // Terminal
  const runTerminal = (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    const newLines = [...terminalLines, `PS C:\\Users\\dev\\project> ${trimmed}`];

    let response = '';
    const lower = trimmed.toLowerCase();

    if (lower === 'ls' || lower === 'dir') {
      response = 'src  package.json  tsconfig.json  README.md';
    } else if (lower.startsWith('echo ')) {
      response = trimmed.slice(5);
    } else if (lower === 'clear') {
      setTerminalLines([]);
      setTerminalInput('');
      return;
    } else if (lower.includes('git')) {
      response = 'fatal: not a git repository (or any of the parent directories): .git';
    } else {
      response = `'${trimmed.split(' ')[0]}' is not recognized as an internal or external command.`;
    }

    if (response) newLines.push(response);
    setTerminalLines(newLines.slice(-12)); // keep last N lines
    setTerminalInput('');
  };

  const handleTerminalKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      runTerminal(terminalInput);
    }
  };

  // AI Chat — smart demo responses
  const getAssistantReply = (userMsg: string): { content: string; code?: string } => {
    const msg = userMsg.toLowerCase();

    if (msg.includes('refactor') || msg.includes('improve')) {
      return {
        content: "Here's a cleaner version using a custom hook:",
        code: `function useCounter(initial = 0) {
  const [count, setCount] = useState(initial);
  const increment = () => setCount(c => c + 1);
  return { count, increment };
}`
      };
    }
    if (msg.includes('comment') || msg.includes('explain')) {
      return {
        content: "Added JSDoc + inline comments for clarity:",
        code: `/**
 * Debounces a function. Useful for search inputs.
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T, delay: number
) {
  let t: any;
  return (...args: Parameters<T>) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}`
      };
    }
    if (msg.includes('bug') || msg.includes('fix') || msg.includes('error')) {
      return {
        content: "Potential issue: state updater uses stale closure in some cases. Here's the fix:",
        code: `const increment = useCallback(() => {
  setCount(c => c + 1);
}, []);`
      };
    }
    if (msg.includes('test') || msg.includes('vitest')) {
      return {
        content: "Quick test scaffold for the current component:",
        code: `import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

test('increments count on click', () => {
  render(<App />);
  fireEvent.click(screen.getByText(/clicked/i));
  expect(screen.getByText(/1 times/i)).toBeInTheDocument();
});`
      };
    }

    // Default helpful reply
    return {
      content: "Good question. Here's a solid pattern for this:",
      code: `// Keep side effects out of render
useEffect(() => {
  const handler = () => { /* ... */ };
  window.addEventListener('resize', handler);
  return () => window.removeEventListener('resize', handler);
}, []);`
    };
  };

  const sendMessage = async (override?: string) => {
    const text = (override ?? chatInput).trim();
    if (!text || isReplying) return;

    const userMessage: Message = { role: 'user', content: text };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setChatInput('');
    setIsReplying(true);

    // Simulate "thinking"
    await new Promise(r => setTimeout(r, 420));

    const reply = getAssistantReply(text);
    const assistantMsg: Message = {
      role: 'assistant',
      content: reply.content,
      code: reply.code
    };

    setMessages([...newMessages, assistantMsg]);
    setIsReplying(false);
  };

  const handleQuickAction = (prompt: string) => {
    setChatInput(prompt);
    // auto-send shortly after
    setTimeout(() => sendMessage(prompt), 30);
  };

  // The magic: Insert code into the "editor"
  const insertCode = (code: string) => {
    const snippet = '\n\n' + code.trim();
    const newContent = editorContent + snippet;
    
    setEditorContent(newContent);
    
    // Also "open" a relevant file if not already
    if (!openTabs.includes(activeFile)) {
      setOpenTabs([...openTabs, activeFile]);
    }

    showToast('Code inserted into editor ✓');

    // Bonus: scroll the editor area into view (visual cue)
    const editorEl = document.getElementById('editor-surface');
    if (editorEl) {
      editorEl.scrollTop = editorEl.scrollHeight;
    }
  };

  // Render file tree recursively (simple)
  const renderTree = (nodes: FileNode[], depth = 0) => {
    return nodes.map((node, idx) => {
      const key = node.name + depth + idx;
      const isExpanded = expandedDirs.has(node.name);
      const isActive = node.name === activeFile;

      if (node.type === 'directory') {
        return (
          <div key={key}>
            <div 
              onClick={() => toggleDir(node.name)}
              className="flex items-center gap-1.5 px-2 py-1 hover:bg-white/5 rounded cursor-pointer text-zinc-400"
            >
              <Lucide.Folder className="w-3.5 h-3.5" />
              <span className="text-[13px]">{node.name}</span>
            </div>
            {isExpanded && node.children && (
              <div className="pl-4 border-l border-white/10 ml-1.5">
                {renderTree(node.children, depth + 1)}
              </div>
            )}
          </div>
        );
      }

      return (
        <div 
          key={key}
          onClick={() => openFile(node.name)}
          className={`flex items-center gap-1.5 px-2 py-0.5 rounded cursor-pointer text-[13px] ${
            isActive ? 'bg-white/10 text-white' : 'hover:bg-white/5 text-zinc-400'
          }`}
        >
          <Lucide.FileText className="w-3.5 h-3.5" />
          {node.name}
        </div>
      );
    });
  };

  return (
    <div className="relative">
      {/* Window frame */}
      <div className="app-window mx-auto max-w-[1080px] select-none">
        {/* Titlebar */}
        <div className="app-titlebar">
          <div className="flex items-center gap-1.5 mr-3">
            <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
            <div className="w-3 h-3 rounded-full bg-[#28c840]" />
          </div>
          <div className="flex-1 text-center text-xs font-medium tracking-wide text-zinc-500">
            Orbit AI — C:\Users\dev\my-orbit-project
          </div>
          <div className="text-[10px] px-2 py-px bg-zinc-800 rounded text-zinc-400">MAIN</div>
        </div>

        <div className="app-content text-sm">
          {/* Left: File explorer + activity */}
          <div className="ide-sidebar w-[210px] flex flex-col shrink-0 overflow-hidden">
            <div className="px-3 py-2 text-[10px] uppercase tracking-[1px] text-zinc-500 border-b border-white/10 flex items-center justify-between">
              <span>EXPLORER</span>
              <Lucide.Plus className="w-3 h-3" />
            </div>
            
            <div className="p-1.5 text-zinc-300 overflow-auto flex-1 text-[13px]">
              {renderTree(tree)}
            </div>

            <div className="p-2 border-t border-white/10 text-[10px] text-zinc-500">
              6 files • 2 folders
            </div>
          </div>

          {/* Center: Editor + Terminal */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Tabs */}
            <div className="h-9 bg-[#111113] border-b border-white/10 flex items-center px-1 shrink-0 overflow-x-auto">
              {openTabs.map(tab => (
                <div
                  key={tab}
                  onClick={() => {
                    setActiveFile(tab);
                    setEditorContent(SAMPLE_FILES[tab].content);
                  }}
                  className={`flex items-center gap-1.5 pl-3 pr-2 py-1 text-xs rounded-t cursor-pointer mr-0.5 border-b-2 ${
                    activeFile === tab 
                      ? 'bg-[#0a0a0b] border-indigo-500 text-white' 
                      : 'border-transparent text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Lucide.FileText className="w-3.5 h-3.5" />
                  {tab}
                  {tab !== 'App.tsx' && (
                    <Lucide.X 
                      onClick={(e) => closeTab(tab, e)} 
                      className="w-3 h-3 hover:text-white" 
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Editor surface */}
            <div 
              id="editor-surface"
              className="ide-editor flex-1 p-3 overflow-auto font-medium leading-[1.45] mono text-[13px] text-zinc-200"
            >
              <div className="flex items-center gap-2 text-[10px] text-emerald-400 mb-2 pl-1">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                {activeFile} • {SAMPLE_FILES[activeFile]?.language.toUpperCase()}
              </div>

              {editorContent.split('\n').map((line, i) => (
                <div key={i} className="editor-line group">
                  <div className="editor-gutter">{(i + 1).toString().padStart(2, ' ')}</div>
                  <div className="flex-1 whitespace-pre text-zinc-300 group-hover:bg-white/5 pl-2 -ml-1 rounded">
                    {renderColoredLine(line)}
                  </div>
                </div>
              ))}
            </div>

            {/* Integrated Terminal */}
            <div className="ide-terminal h-[138px] flex flex-col">
              <div className="px-3 py-1 text-[10px] text-zinc-500 border-b border-white/10 flex items-center gap-2">
                <Lucide.Terminal className="w-3 h-3" /> TERMINAL — PowerShell
              </div>
              <div className="flex-1 p-2.5 overflow-auto mono text-emerald-300/90 text-[12px] leading-snug bg-black/30">
                {terminalLines.map((line, idx) => (
                  <div key={idx}>{line || '\u00A0'}</div>
                ))}
              </div>
              <div className="flex items-center border-t border-white/10 bg-black/40 px-2 text-emerald-300/90 mono text-xs">
                <span className="text-emerald-400 mr-1.5">PS&gt;</span>
                <input
                  value={terminalInput}
                  onChange={(e) => setTerminalInput(e.target.value)}
                  onKeyDown={handleTerminalKey}
                  className="flex-1 bg-transparent outline-none py-1.5 placeholder:text-zinc-600"
                  placeholder="Type a command (try: ls, echo hello, clear)"
                />
              </div>
            </div>
          </div>

          {/* Right: AI Chat Sidebar (the star feature) */}
          <div className="ai-sidebar w-[280px] shrink-0 flex flex-col">
            <div className="px-3 py-2 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Lucide.Bot className="w-4 h-4 text-violet-400" />
                <span className="font-semibold text-sm">AI Assistant</span>
              </div>
              <div className="badge">llama-3.3-70b</div>
            </div>

            <div className="px-2.5 py-1.5 text-[10px] text-zinc-500 border-b border-white/10 flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-violet-400 rounded-full" />
              Context: {activeFile} (412 tokens)
            </div>

            {/* Chat history */}
            <div className="flex-1 overflow-auto p-3 space-y-3 text-sm">
              {messages.map((m, idx) => (
                <div key={idx} className={m.role === 'user' ? 'text-right' : ''}>
                  <div className={`inline-block max-w-[94%] px-3 py-2 text-left text-[13px] leading-snug ${
                    m.role === 'user' ? 'chat-bubble-user' : 'chat-bubble-assistant'
                  }`}>
                    {m.content}
                    {m.code && (
                      <pre className="mt-2 p-2 bg-black/60 rounded text-[11px] overflow-x-auto text-emerald-200/90 border border-white/10">
                        {m.code}
                      </pre>
                    )}
                  </div>

                  {m.code && (
                    <div className="flex gap-1.5 justify-end mt-1.5 pr-0.5">
                      <button
                        onClick={() => insertCode(m.code!)}
                        className="text-[10px] flex items-center gap-1 px-2.5 py-px rounded bg-indigo-500/90 hover:bg-indigo-500 active:bg-indigo-600 text-white transition"
                      >
                        <Lucide.ArrowRight className="w-3 h-3" /> Insert at cursor
                      </button>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(m.code!);
                          showToast('Copied to clipboard');
                        }}
                        className="text-[10px] px-2 py-px rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
                      >
                        Copy
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {isReplying && (
                <div className="text-zinc-400 text-xs flex items-center gap-2 pl-1">
                  <div className="animate-pulse">Thinking...</div>
                </div>
              )}
            </div>

            {/* Quick prompts */}
            <div className="px-2.5 py-2 border-t border-white/10 flex flex-wrap gap-1.5">
              {[
                "Refactor this",
                "Add comments",
                "Find bugs",
                "Write a test"
              ].map(p => (
                <button 
                  key={p}
                  onClick={() => handleQuickAction(p)}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-zinc-400 hover:text-zinc-200 transition"
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Input */}
            <div className="p-2.5 border-t border-white/10">
              <div className="flex items-center bg-zinc-950 rounded-xl border border-white/10 pr-1">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Ask about your code..."
                  className="flex-1 bg-transparent px-3 py-2 text-sm placeholder:text-zinc-600 focus:outline-none"
                  disabled={isReplying}
                />
                <button
                  onClick={() => sendMessage()}
                  disabled={!chatInput.trim() || isReplying}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-40 transition"
                >
                  <Lucide.Send className="w-4 h-4" />
                </button>
              </div>
              <div className="text-[9px] text-center text-zinc-600 mt-1">Press Enter to send • Powered by Groq (local key required in app)</div>
            </div>
          </div>
        </div>

        {/* Status bar */}
        <div className="status-bar">
          <div>TypeScript • React 19</div>
          <div>{activeFile} — Ln {editorContent.split('\n').length}, Col 18</div>
          <div className="flex-1" />
          <div>UTF-8 • LF</div>
          <div className="text-emerald-400/70">● Saved</div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="toast">
          <Lucide.Check className="w-4 h-4 text-emerald-400" /> {toast}
        </div>
      )}

      <div className="text-center mt-3 text-xs text-zinc-500">
        Fully interactive preview — try the chat, terminal commands, file tree, and Insert buttons
      </div>
    </div>
  );
}

// Very small syntax highlighter for the demo (good enough for marketing)
function renderColoredLine(line: string) {
  // Simple tokenization for demo beauty
  let html = line
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // keywords
  html = html.replace(
    /\b(const|let|var|function|return|import|export|from|if|else|for|while|async|await|useState|useEffect|useCallback)\b/g,
    '<span class="code-token-keyword">$1</span>'
  );
  html = html.replace(
    /\b([A-Z][a-zA-Z0-9_]*)\(/g,
    '<span class="code-token-function">$1</span>('
  );
  html = html.replace(
    /(".*?"|'.*?')/g,
    '<span class="code-token-string">$1</span>'
  );
  html = html.replace(
    /(\/\/.*$)/g,
    '<span class="code-token-comment">$1</span>'
  );
  html = html.replace(
    /\b(\d+)\b/g,
    '<span class="code-token-number">$1</span>'
  );

  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}
