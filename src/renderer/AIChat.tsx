import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface AIChatProps {
  currentFile: string | null;
  currentCode: string;
  onApplyCode: (code: string, mode: 'insert' | 'replace') => void;
}

export default function AIChat({ currentFile, currentCode, onApplyCode }: AIChatProps) {
  const [apiKey, setApiKey]       = useState(() => localStorage.getItem('groq_api_key') ?? '');
  const [showKey, setShowKey]     = useState(!localStorage.getItem('groq_api_key'));
  const [messages, setMessages]   = useState<Message[]>([]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

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

    const systemPrompt = currentFile
      ? `You are Orbit AI, an expert coding assistant.\n\nCurrent file: ${currentFile}\n\`\`\`\n${currentCode.slice(0, 8000)}\n\`\`\``
      : `You are Orbit AI, an expert coding assistant.`;

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

    (window as any).electronAPI.onStreamChunk(chunkHandler);

    try {
      await (window as any).electronAPI.aiStream(apiKey, fullMessages);
    } finally {
      // optional cleanup
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
            {m.role === 'assistant' && (
              <div className="message-actions" style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <button 
                  onClick={() => onApplyCode(m.content, 'insert')}
                  style={{ background: '#3c3c3c', border: 'none', color: '#ccc', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                >
                  Insert at cursor
                </button>
                <button 
                  onClick={() => onApplyCode(m.content, 'replace')}
                  style={{ background: '#3c3c3c', border: 'none', color: '#ccc', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}
                >
                  Replace selection
                </button>
              </div>
            )}
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
