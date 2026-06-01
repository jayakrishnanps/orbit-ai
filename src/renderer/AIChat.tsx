import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface AIChatProps {
  currentFile: string | null;
  currentCode: string;
  folderPath?: string | null;
  onApplyCode: (code: string, mode: 'insert' | 'replace') => void;
}

export default function AIChat({ currentFile, currentCode, folderPath, onApplyCode }: AIChatProps) {
  const [apiKey, setApiKey]       = useState(() => localStorage.getItem('groq_api_key') ?? '');
  const [showKey, setShowKey]     = useState(!localStorage.getItem('groq_api_key'));
  const [messages, setMessages]   = useState<Message[]>([]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const chunkHandlerRef = useRef<((delta: string) => void) | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Register stream listener ONCE (prevents accumulation of ipc handlers on every send).
  // Per-message chunkHandler is swapped via ref. Cleanup on unmount follows remove pattern.
  useEffect(() => {
    const api = (window as any).electronAPI;
    const dispatcher = (delta: string) => {
      if (chunkHandlerRef.current) chunkHandlerRef.current(delta);
    };
    api.onStreamChunk(dispatcher);

    return () => {
      chunkHandlerRef.current = null;
      // removeListener pattern (full unsubscription would need preload to expose remover or use ipcRenderer directly)
    };
  }, []);

  const saveKey = () => {
    localStorage.setItem('groq_api_key', apiKey);
    setShowKey(false);
    setError('');
  };

  const sendMessage = async () => {
    if (!apiKey || !input.trim()) return;

    const userMessage = input.trim();
    const newHistory = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(newHistory);
    setInput(''); // clear input immediately

    let systemPrompt = 'You are Orbit AI, an expert coding assistant.';
    if (folderPath) {
      try {
        const tree = await (window as any).electronAPI.getFileTree(folderPath);
        systemPrompt += `\n\nProject tree:\n` + JSON.stringify(tree).slice(0, 4000);
      } catch {}
    }
    if (currentFile) {
      systemPrompt += `\n\nCurrent file: ${currentFile}\n\`\`\`\n${currentCode.slice(0, 4000)}\n\`\`\``;
    }

    const fullMessages = [{ role: 'system' as const, content: systemPrompt }, ...newHistory];

    setMessages(prev => [...prev, { role: 'assistant' as const, content: '' }]);

    let assistantMessage = '';

    const chunkHandler = (delta: string) => {
      assistantMessage += delta;
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1].content = assistantMessage;
        return updated;
      });
    };

    // Assign to ref instead of re-registering listener every send (see mount useEffect)
    chunkHandlerRef.current = chunkHandler;

    try {
      await (window as any).electronAPI.aiStream(apiKey, fullMessages);
    } finally {
      chunkHandlerRef.current = null;

      // Auto-apply the first code block from the AI response (user requested "it should do it by itself")
      if (currentFile && assistantMessage) {
        const codeBlockMatch = assistantMessage.match(/```(?:\w+)?\s*\n([\s\S]*?)\n```/i)
          || assistantMessage.match(/```([\s\S]*?)```/i);
        if (codeBlockMatch) {
          const code = codeBlockMatch[1].trim();
          // Automatically insert the suggested code at the current cursor position
          onApplyCode(code, 'insert');
        }
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="chat-panel">
      {/* Header */}
      <div className="chat-header">
        <span className="chat-header__title">🛸 Orbit AI</span>
        <button
          className="chat-header__key-btn"
          onClick={() => setShowKey(v => !v)}
          title="Set API key"
        >
          🔑
        </button>
      </div>

      {/* API key input */}
      {showKey && (
        <div className="chat-apikey">
          <input
            className="chat-apikey__input"
            type="password"
            placeholder="Paste your Groq API key…"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && saveKey()}
          />
          <button className="chat-apikey__save" onClick={saveKey}>Save</button>
          <a
            className="chat-apikey__link"
            href="https://console.groq.com/keys"
            target="_blank"
            rel="noreferrer"
          >
            Get free key ↗
          </a>
        </div>
      )}

      {/* Context badge */}
      {currentFile && (
        <div className="chat-context">
          📄 {currentFile.split(/[/\\]/).pop()}
        </div>
      )}

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 && !loading && (
          <div className="chat-empty">
            Ask anything about your code.<br />
            {currentFile ? 'Context: current file is included.' : 'Open a file for context.'}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg chat-msg--${m.role}`}>
            <span className="chat-msg__label">{m.role === 'user' ? 'You' : 'Orbit AI'}</span>
            <pre className="chat-msg__content">{m.content}</pre>
            {/* Buttons removed per user request - AI now automatically applies the first code block it suggests (see sendMessage) */}
          </div>
        ))}
        {loading && (
          <div className="chat-msg chat-msg--assistant">
            <span className="chat-msg__label">Orbit AI</span>
            <span className="chat-typing">●●●</span>
          </div>
        )}
        {error && <div className="chat-error">{error}</div>}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="chat-input-row">
        <textarea
          className="chat-input"
          rows={2}
          placeholder="Ask about your code… (Enter to send, Shift+Enter for newline)"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        <button
          className="chat-send"
          onClick={sendMessage}
          disabled={loading || !input.trim()}
        >
          ↑
        </button>
      </div>
    </div>
  );
}
