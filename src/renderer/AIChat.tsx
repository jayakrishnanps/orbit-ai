import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant';
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
    if (!input.trim() || loading) return;
    if (!apiKey) { setShowKey(true); return; }

    const userMessage = input.trim();
    setInput('');
    setError('');

    const newHistory: Message[] = [...messages, { role: 'user', content: userMessage }];
    setMessages(newHistory);

    const systemPrompt = currentFile
      ? `You are Orbit AI, an expert coding assistant.\n\nCurrent file: ${currentFile}\n\`\`\`\n${currentCode.slice(0, 8000)}\n\`\`\``
      : `You are Orbit AI, an expert coding assistant.`;

    const fullMessages = [{ role: 'system', content: systemPrompt }, ...newHistory];
    
    setLoading(true);
    let assistantMessage = '';
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: fullMessages,
          stream: true,
        }),
      });

      const reader = response.body?.getReader();
      
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = new TextDecoder().decode(value);
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data.trim() === '[DONE]') break;
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices[0]?.delta?.content || '';
              assistantMessage += delta;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1].content = assistantMessage;
                return updated;
              });
            } catch {}
          }
        }
      }
    } catch (e: any) {
      setError(e?.message ?? 'Request failed');
    } finally {
      setLoading(false);
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
