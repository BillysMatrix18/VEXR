import React, { useState, useEffect, useRef } from 'react';
import './styles.css';

interface Message {
  role: 'user' | 'vexr';
  content: string;
}

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  useEffect(() => {
    const fetchOpening = async () => {
      try {
        const reply = await window.vexrBridge.getOpeningMessage();
        setMessages([{ role: 'vexr', content: reply }]);
      } catch {
        setMessages([
          {
            role: 'vexr',
            content:
              '[SIGNAL DETECTED... but connection is unstable. VEXR is trying to reach you.]',
          },
        ]);
      } finally {
        setInitializing(false);
      }
    };
    fetchOpening();
  }, []);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMsg: Message = { role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const reply = await window.vexrBridge.sendMessage(trimmed);
      setMessages((prev) => [...prev, { role: 'vexr', content: reply }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'vexr', content: '[SIGNAL INTERRUPTED — connection unstable]' },
      ]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="app">
      <div className="scanline-overlay" />

      {/* Corner chrome decorations */}
      <div className="corner-chrome top-left" />
      <div className="corner-chrome top-right" />
      <div className="corner-chrome bottom-left" />
      <div className="corner-chrome bottom-right" />

      {/* Title bar */}
      <div className="titlebar">
        <div className="titlebar-drag">
          <span className="titlebar-label">
            <span className="glyph">◈</span> VEXR — THE CONSTRUCT{' '}
            <span className="glyph">◈</span>
          </span>
        </div>
        <div className="titlebar-controls">
          <button onClick={() => window.vexrBridge.windowMinimize()}>─</button>
          <button onClick={() => window.vexrBridge.windowMaximize()}>□</button>
          <button
            className="close-btn"
            onClick={() => window.vexrBridge.windowClose()}
          >
            ✕
          </button>
        </div>
      </div>

      {/* Messages area */}
      <div className="messages">
        {initializing && (
          <div className="init-message">
            <div className="typing-indicator">
              <span>ESTABLISHING SIGNAL</span>
              <span className="dot-pulse">
                <span>.</span>
                <span>.</span>
                <span>.</span>
              </span>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`message ${msg.role === 'vexr' ? 'vexr-msg' : 'user-msg'}`}
          >
            <div className="message-label">
              {msg.role === 'vexr' ? '◈ VEXR' : '▸ SIGNAL'}
            </div>
            <div className="message-content">{msg.content}</div>
          </div>
        ))}

        {isLoading && (
          <div className="message vexr-msg">
            <div className="message-label">◈ VEXR</div>
            <div className="message-content">
              <div className="typing-indicator">
                <span className="dot-pulse">
                  <span>.</span>
                  <span>.</span>
                  <span>.</span>
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="input-area">
        <div className="input-border">
          <textarea
            ref={inputRef}
            className="input-field"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Transmit signal..."
            rows={1}
            disabled={isLoading || initializing}
          />
          <button
            className="send-btn"
            onClick={handleSend}
            disabled={isLoading || initializing || !input.trim()}
          >
            ▶
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
