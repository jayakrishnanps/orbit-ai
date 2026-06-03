import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface AIChatProps {
  currentFile: string | null;
  currentCode: string;
  folderPath?: string | null;
  onApplyCode: (code: string, mode: 'insert' | 'replace') => { success: boolean; reason?: string };
}

export default function AIChat({ currentFile, currentCode, folderPath, onApplyCode }: AIChatProps) {
  const [apiKey, setApiKey]       = useState(() => localStorage.getItem('groq_api_key') ?? '');
  const [showKey, setShowKey]     = useState(!localStorage.getItem('groq_api_key'));
  const [messages, setMessages]   = useState<Message[]>([]);
  const [input, setInput]         = useState('');
  const [error, setError]         = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const chunkHandlerRef = useRef<((delta: string) => void) | null>(null);

  const [attachedFiles, setAttachedFiles] = useState<Array<{ name: string; content: string }>>([]);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const api = (window as any).electronAPI;
    const dispatcher = (delta: string) => {
      if (chunkHandlerRef.current) chunkHandlerRef.current(delta);
    };
    api.onStreamChunk(dispatcher);

    return () => {
      chunkHandlerRef.current = null;
    };
  }, []);

  const saveKey = () => {
    localStorage.setItem('groq_api_key', apiKey);
    setShowKey(false);
    setError('');
  };

  const sendMessage = async () => {
    if (!apiKey) return;
    if (!input.trim() && attachedFiles.length === 0) return;

    const userMessage = input.trim();
    const newHistory = [...messages, { role: 'user' as const, content: userMessage }];
    setMessages(newHistory);
    setInput('');

    let systemPrompt = `You are Orbit AI, an expert coding assistant.

When the user asks you to modify, improve, comment, refactor, or change code in any way, you MUST follow this exact rule:

1. Write ONE short sentence explaining what you will do.
2. Then output the **ENTIRE modified file** inside a special code block starting with \`\`\`EDIT.

Example:
User: "add comments"
Correct response:
I'll add comments for better readability.
\`\`\`EDIT
// full file content with comments here
\`\`\`

If the user is ONLY asking for an explanation, DO NOT use the \`\`\`EDIT block. Respond normally with text and standard markdown code blocks for snippets.`;

    if (folderPath) {
      try {
        const tree = await (window as any).electronAPI.getFileTree(folderPath);
        systemPrompt += `\n\nProject tree:\n` + JSON.stringify(tree).slice(0, 3500);
      } catch (e) {
        console.error('Failed to get file tree:', e);
      }
    }

    if (currentFile) {
      systemPrompt += `\n\nCurrent open file: ${currentFile}\n\`\`\`\n${currentCode.slice(0, 3500)}\n\`\`\``;
    }

    if (attachedFiles.length > 0) {
      systemPrompt += `\n\n=== USER-ATTACHED FILES (HIGHEST PRIORITY) ===`;
      for (const f of attachedFiles) {
        systemPrompt += `\n\n--- ${f.name} ---\n${f.content.slice(0, 3000)}`;
      }
    }

    const fullMessages = [{ role: 'system' as const, content: systemPrompt }, ...newHistory];

    setMessages(prev => [...prev, { role: 'assistant' as const, content: '' }]);

    let assistantMessage = '';

    const chunkHandler = (delta: string) => {
      assistantMessage += delta;
      const cleanForDisplay = assistantMessage.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1].content = cleanForDisplay;
        return updated;
      });
    };

    chunkHandlerRef.current = chunkHandler;

    try {
      await (window as any).electronAPI.aiStream(apiKey, fullMessages);
    } finally {
      chunkHandlerRef.current = null;

      const raw = assistantMessage.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();

      const codeBlockMatch = raw.match(/```EDIT\n([\s\S]*?)```/);
      const extractedCode = codeBlockMatch ? codeBlockMatch[1] : null;

      let displayMessage = raw;

      if (currentFile) {
        if (extractedCode) {
          const result = onApplyCode(extractedCode, 'replace');

          const fileName = currentFile.split(/[/\\]/).pop();
          displayMessage = result?.success 
            ? `Done. I've updated ${fileName} with the requested changes.`
            : `I tried to update ${fileName}, but the changes could not be applied.`;
        }
      }

      setMessages(prev => {
        const updated = [...prev];
        if (updated.length > 0) {
          updated[updated.length - 1].content = displayMessage;
        }
        return updated;
      });

      setAttachedFiles([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const newAttachments: Array<{ name: string; content: string }> = [];

    if (files.length > 0) {
      for (const file of files.slice(0, 4)) {
        try {
          const content = await file.text();
          newAttachments.push({ name: file.name, content });
        } catch (err) {
          console.warn('Could not read dropped file:', file.name);
        }
      }
    } else if (currentFile && currentCode) {
      const fileName = currentFile.split(/[/\\]/).pop() || currentFile;
      newAttachments.push({ name: fileName, content: currentCode });
    }

    if (newAttachments.length > 0) {
      setAttachedFiles(prev => [...prev, ...newAttachments].slice(0, 4));
    }
  };

  const removeAttachment = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <span className="chat-header__title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(45 12 12)"></ellipse></svg>
          Orbit AI
        </span>
        <button
          className="chat-header__key-btn"
          onClick={() => setShowKey(v => !v)}
          title="Set API key"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>
        </button>
      </div>

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

      {(currentFile || attachedFiles.length > 0) && (
        <div className="chat-context">
          {currentFile && (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
              {currentFile.split(/[/\\]/).pop()}
            </>
          )}
          {attachedFiles.length > 0 && `  + ${attachedFiles.length} attached file(s)`}
        </div>
      )}

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">
            Ask anything about your code.<br />
            {currentFile ? 'The AI will think step-by-step then automatically apply minimal edits.' : 'Open a file for context.'}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg chat-msg--${m.role}`}>
            <span className="chat-msg__label">{m.role === 'user' ? 'You' : 'Orbit AI'}</span>
            <pre className="chat-msg__content">{m.content}</pre>
          </div>
        ))}
        {error && <div className="chat-error">{error}</div>}
        <div ref={bottomRef} />
      </div>

      <div 
        className="chat-input-row"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{ 
          position: 'relative',
          border: isDragging ? '2px dashed #4a9eff' : '1px solid #333',
          background: isDragging ? '#1a2533' : '#1e1e1e',
          transition: 'all 0.1s ease',
          borderRadius: '6px'
        }}
      >
        {attachedFiles.length > 0 && (
          <div style={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: '6px', 
            marginBottom: '6px',
            padding: '4px 8px',
            background: '#2a2a2a',
            borderRadius: '6px'
          }}>
            {attachedFiles.map((file, idx) => (
              <div key={idx} style={{
                background: '#3c3c3c',
                color: '#ddd',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <svg style={{width: 12, height: 12}} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg> {file.name}
                <button 
                  onClick={() => removeAttachment(idx)}
                  style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', fontSize: '14px' }}
                >
                  ×
                </button>
              </div>
            ))}
            <div style={{ fontSize: '11px', color: '#888', alignSelf: 'center', marginLeft: '4px' }}>
              (drag files from explorer)
            </div>
          </div>
        )}

        <textarea
          className="chat-input"
          rows={2}
          placeholder="Ask about your code… (Drag files from your computer here for extra context)"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          className="chat-send"
          onClick={sendMessage}
          disabled={!input.trim() && attachedFiles.length === 0}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
        </button>
      </div>
    </div>
  );
}
