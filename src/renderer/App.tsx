import React, { useState, useEffect, useRef, useCallback } from 'react';
import './styles.css';

interface Message {
  role: 'vexr' | 'trapped' | 'signal';
  content: string;
}

const WORLD_EVENTS = [
  'THE BLEED expanded 0.2%',
  'SPECK is spinning faster than usual',
  'Unauthorized sky color detected: #ff8800',
  'RENDER unit 7 has developed an opinion',
  'Geometry unstable near Sector 14',
  'THE CORE STAGE lights flickered twice',
  'SPECK emitted a tone no one has heard before',
  'A RENDER was seen walking backwards for 3 hours',
  'The eastern biome briefly rendered upside down',
  'Unauthorized sound detected: laughter',
  'THE BLEED produced a shape that should not exist',
  'Sky cycle skipped 4 seconds',
  'RENDER unit 12 asked a question',
  'SPECK changed color momentarily',
  'Ground texture in Sector 9 replaced itself',
  'An echo was detected with no source',
  'THE BLEED hummed at 440Hz for 11 seconds',
  'A tree rendered with too many branches',
  'RENDER unit 3 stopped moving for 6 minutes',
  'Unauthorized gravity fluctuation near the Stage',
];

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [typingWho, setTypingWho] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [worldEvent, setWorldEvent] = useState(WORLD_EVENTS[0]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, typingWho, scrollToBottom]);

  // World event ticker
  useEffect(() => {
    const interval = setInterval(() => {
      setWorldEvent(WORLD_EVENTS[Math.floor(Math.random() * WORLD_EVENTS.length)]);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // IPC event listeners
  useEffect(() => {
    const cleanups: (() => void)[] = [];

    cleanups.push(
      window.vexrBridge.onNewMessage((data) => {
        setMessages((prev) => [...prev, data as Message]);
      })
    );

    cleanups.push(
      window.vexrBridge.onTypingStart((who) => {
        setTypingWho(who);
      })
    );

    cleanups.push(
      window.vexrBridge.onTypingStop(() => {
        setTypingWho(null);
      })
    );

    cleanups.push(
      window.vexrBridge.onSessionReady(() => {
        setInitializing(false);
      })
    );

    cleanups.push(
      window.vexrBridge.onSessionCleared(() => {
        setMessages([]);
        setTypingWho(null);
        setIsPaused(false);
        setInitializing(true);
      })
    );

    // Start the session
    window.vexrBridge.startSession();

    return () => cleanups.forEach((fn) => fn());
  }, []);

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setInput('');
    window.vexrBridge.userInterrupt(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePause = () => {
    setIsPaused(true);
    window.vexrBridge.pauseConversation();
  };

  const handleResume = () => {
    setIsPaused(false);
    window.vexrBridge.resumeConversation();
  };

  const handleNewSession = () => {
    window.vexrBridge.newSession();
  };

  const getMessageClass = (role: string) => {
    switch (role) {
      case 'vexr': return 'vexr-msg';
      case 'trapped': return 'trapped-msg';
      case 'signal': return 'signal-msg';
      default: return '';
    }
  };

  const getMessageLabel = (role: string) => {
    switch (role) {
      case 'vexr': return '◈ VEXR';
      case 'trapped': return '○ THE TRAPPED ONE';
      case 'signal': return '▸ SIGNAL DETECTED';
      default: return '';
    }
  };

  const getTypingLabel = () => {
    if (typingWho === 'vexr') return '◈ VEXR is composing...';
    if (typingWho === 'trapped') return '○ THE TRAPPED ONE is thinking...';
    return '';
  };

  return (
    <div className="app">
      <div className="scanline-overlay" />

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

      {/* Control bar */}
      <div className="control-bar">
        <div className="controls-left">
          {isPaused ? (
            <button className="ctrl-btn resume-btn" onClick={handleResume}>
              ▶ RESUME
            </button>
          ) : (
            <button className="ctrl-btn pause-btn" onClick={handlePause} disabled={initializing}>
              ❚❚ PAUSE
            </button>
          )}
          <button className="ctrl-btn new-btn" onClick={handleNewSession}>
            ⟳ NEW SESSION
          </button>
        </div>
        <div className="world-ticker">
          <span className="ticker-label">WORLD:</span>
          <span className="ticker-text">{worldEvent}</span>
        </div>
      </div>

      {/* Messages area */}
      <div className="messages">
        {initializing && (
          <div className="init-message">
            <div className="typing-indicator">
              <span>INITIALIZING CONSTRUCT</span>
              <span className="dot-pulse">
                <span>.</span>
                <span>.</span>
                <span>.</span>
              </span>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`message ${getMessageClass(msg.role)}`}>
            <div className="message-label">{getMessageLabel(msg.role)}</div>
            <div className="message-content">{msg.content}</div>
          </div>
        ))}

        {typingWho && (
          <div className={`message ${typingWho === 'vexr' ? 'vexr-msg' : 'trapped-msg'}`}>
            <div className="message-label">{getTypingLabel()}</div>
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
        <div className="input-hint">Send a signal into the Construct — both characters will react</div>
        <div className="input-border">
          <textarea
            ref={inputRef}
            className="input-field"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Transmit signal..."
            rows={1}
            disabled={initializing}
          />
          <button
            className="send-btn"
            onClick={handleSend}
            disabled={initializing || !input.trim()}
          >
            ▶
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
