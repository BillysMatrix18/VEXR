import React, { useState, useEffect, useRef, useCallback } from 'react';
import ConstructScene from './world/ConstructScene';
import NeuralPanel from './NeuralPanel';
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
  const [spawnedEntities, setSpawnedEntities] = useState<Set<string>>(new Set());
  const [worldEvent, setWorldEvent] = useState(WORLD_EVENTS[0]);
  const [thoughts, setThoughts] = useState<string[]>([]);
  const [emotions, setEmotions] = useState<Record<string, number>>({});
  const [isMuted, setIsMuted] = useState(false);
  const [refImage, setRefImage] = useState<{ base64: string; mimeType: string; preview: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isMutedRef = useRef(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, typingWho, scrollToBottom]);

  // World event ticker
  useEffect(() => {
    const iv = setInterval(() => {
      setWorldEvent(WORLD_EVENTS[Math.floor(Math.random() * WORLD_EVENTS.length)]);
    }, 8000);
    return () => clearInterval(iv);
  }, []);

  // IPC listeners
  useEffect(() => {
    const cleanups: (() => void)[] = [];

    cleanups.push(window.vexrBridge.onNewMessage((data) => {
      setMessages(prev => [...prev, data as Message]);
    }));
    cleanups.push(window.vexrBridge.onTypingStart((who) => setTypingWho(who)));
    cleanups.push(window.vexrBridge.onTypingStop(() => setTypingWho(null)));
    cleanups.push(window.vexrBridge.onThoughtFragments((fragments) => {
      setThoughts(prev => [...prev, ...fragments].slice(-20));
    }));
    cleanups.push(window.vexrBridge.onEmotionalState((emo) => {
      setEmotions(emo);
    }));
    cleanups.push(window.vexrBridge.onTtsAudio((data) => {
      if (isMutedRef.current) return;
      try {
        // Stop any currently playing audio
        if (currentAudioRef.current) {
          currentAudioRef.current.pause();
          currentAudioRef.current = null;
        }
        const audio = new Audio(`data:${data.mimeType};base64,${data.audio}`);
        currentAudioRef.current = audio;
        audio.play().catch(() => {});
      } catch {}
    }));
    cleanups.push(window.vexrBridge.onSessionCleared(() => {
      setMessages([]);
      setTypingWho(null);
      setIsPaused(false);
      setSpawnedEntities(new Set());
      setThoughts([]);
      setEmotions({});
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
    }));

    return () => cleanups.forEach(fn => fn());
  }, []);

  const spawnEntity = (entity: string) => {
    if (spawnedEntities.has(entity)) return;
    setSpawnedEntities(prev => {
      const next = new Set(prev);
      next.add(entity);
      return next;
    });
    window.vexrBridge.spawnEntity(entity);
  };

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    setInput('');
    window.vexrBridge.userInterrupt(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handlePause = () => { setIsPaused(true); window.vexrBridge.pauseConversation(); };
  const handleResume = () => { setIsPaused(false); window.vexrBridge.resumeConversation(); };
  const handleNewSession = () => { window.vexrBridge.newSession(); };
  const handleMuteToggle = () => {
    const next = !isMuted;
    setIsMuted(next);
    isMutedRef.current = next;
    window.vexrBridge.setMuted(next); // Tell main process to skip TTS API calls
    if (next && currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }
  };

  const handleImageDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && /^image\/(jpeg|png|webp)/.test(file.type)) loadImage(file);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadImage(file);
  };

  const loadImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1];
      const mimeType = file.type;
      setRefImage({ base64, mimeType, preview: dataUrl });
      window.vexrBridge.sendReferenceImage(base64, mimeType);
    };
    reader.readAsDataURL(file);
  };

  const clearRefImage = () => setRefImage(null);

  const getMsgClass = (role: string) => {
    if (role === 'vexr') return 'vexr-msg';
    if (role === 'trapped') return 'trapped-msg';
    return 'signal-msg';
  };

  const getMsgLabel = (role: string) => {
    if (role === 'vexr') return '◈ VEXR';
    if (role === 'trapped') return '○ THE TRAPPED ONE';
    return '▸ SIGNAL DETECTED';
  };

  const getTypingLabel = () => {
    if (typingWho === 'vexr') return '◈ VEXR is composing...';
    if (typingWho === 'trapped') return '○ THE TRAPPED ONE is thinking...';
    return '';
  };

  const getPerceptions = (): string[] => {
    const percs: string[] = [];
    if (typingWho === 'vexr' || messages.some(m => m.role === 'vexr')) percs.push('VEXR SPEAKING');
    const lastVexr = [...messages].reverse().find(m => m.role === 'vexr');
    if (lastVexr && /\b(build|tower|stage|structure|arch|pillar)\b/i.test(lastVexr.content)) percs.push('NEW STRUCTURE');
    if (messages.some(m => m.role === 'signal')) percs.push('SIGNAL DETECTED');
    percs.push('UNFAMILIAR ENV');
    return percs.slice(0, 4);
  };

  return (
    <div className="app">
      <div className="scanline-overlay" />
      <div className="corner-chrome top-left" />
      <div className="corner-chrome top-right" />
      <div className="corner-chrome bottom-left" />
      <div className="corner-chrome bottom-right" />

      {/* Titlebar */}
      <div className="titlebar">
        <div className="titlebar-drag">
          <span className="titlebar-label">
            <span className="glyph">◈</span> VEXR — THE CONSTRUCT <span className="glyph">◈</span>
          </span>
        </div>
        <div className="titlebar-controls">
          <button onClick={() => window.vexrBridge.windowMinimize()}>─</button>
          <button onClick={() => window.vexrBridge.windowMaximize()}>□</button>
          <button className="close-btn" onClick={() => window.vexrBridge.windowClose()}>✕</button>
        </div>
      </div>

      <div className="main-content">
        {/* 3D Viewport + Entity Panel + Neural Panel */}
        <div className="viewport-section">
          <ConstructScene
            spawnedEntities={spawnedEntities}
            messages={messages}
            typingWho={typingWho}
          />

          <div className="entity-panel">
            <div className="entity-panel-title">ENTITIES</div>
            <button
              className={`entity-btn ${spawnedEntities.has('vexr') ? 'entity-active vexr-active' : 'vexr-btn'}`}
              onClick={() => spawnEntity('vexr')}
              disabled={spawnedEntities.has('vexr')}
            >
              {spawnedEntities.has('vexr') ? '◈ VEXR' : '+ ADD VEXR'}
            </button>
            <button
              className={`entity-btn ${spawnedEntities.has('trapped') ? 'entity-active trapped-active' : 'trapped-btn'}`}
              onClick={() => spawnEntity('trapped')}
              disabled={spawnedEntities.has('trapped')}
            >
              {spawnedEntities.has('trapped') ? '○ TRAPPED' : '+ ADD TRAPPED'}
            </button>
            <div className="image-feed-section">
              <div className="entity-panel-title">REFERENCE</div>
              {refImage ? (
                <div className="ref-image-preview">
                  <img src={refImage.preview} alt="ref" />
                  <button className="ref-image-clear" onClick={clearRefImage}>✕</button>
                </div>
              ) : (
                <div
                  className="image-drop-zone"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleImageDrop}
                  onClick={() => document.getElementById('ref-image-input')?.click()}
                >
                  DROP IMAGE
                </div>
              )}
              <input
                id="ref-image-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={handleImageSelect}
              />
            </div>
            <div className="entity-panel-hint">
              Feed VEXR a reference image to inspire his building
            </div>
          </div>

          <div className="neural-panel-container">
            <NeuralPanel
              isThinking={typingWho === 'trapped'}
              emotions={emotions}
              thoughts={thoughts}
              perceptions={getPerceptions()}
              isActive={spawnedEntities.has('trapped')}
            />
          </div>
        </div>

        {/* Chat Section */}
        <div className="chat-section">
          {/* Control bar */}
          <div className="control-bar">
            <div className="controls-left">
              {isPaused ? (
                <button className="ctrl-btn resume-btn" onClick={handleResume}>▶ RESUME</button>
              ) : (
                <button
                  className="ctrl-btn pause-btn"
                  onClick={handlePause}
                  disabled={spawnedEntities.size === 0}
                >
                  ❚❚ PAUSE
                </button>
              )}
              <button className="ctrl-btn new-btn" onClick={handleNewSession}>⟳ NEW SESSION</button>
              <button
                className={`ctrl-btn mute-btn ${isMuted ? 'muted' : ''}`}
                onClick={handleMuteToggle}
              >
                {isMuted ? 'UNMUTE' : 'MUTE'}
              </button>
            </div>
            <div className="world-ticker">
              <span className="ticker-label">WORLD:</span>
              <span className="ticker-text">{worldEvent}</span>
            </div>
          </div>

          {/* Messages */}
          <div className="messages">
            {messages.length === 0 && spawnedEntities.size === 0 && (
              <div className="empty-state">
                <div className="empty-title">THE CONSTRUCT</div>
                <div className="empty-hint">Add an entity to begin</div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`message ${getMsgClass(msg.role)}`}>
                <div className="message-label">{getMsgLabel(msg.role)}</div>
                <div className="message-content">{msg.content}</div>
              </div>
            ))}

            {typingWho && (
              <div className={`message ${typingWho === 'vexr' ? 'vexr-msg' : 'trapped-msg'}`}>
                <div className="message-label">{getTypingLabel()}</div>
                <div className="message-content">
                  <div className="typing-indicator">
                    <span className="dot-pulse">
                      <span>.</span><span>.</span><span>.</span>
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="input-area">
            <div className="input-border">
              <textarea
                ref={inputRef}
                className="input-field"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Transmit signal into the Construct..."
                rows={1}
                disabled={spawnedEntities.size === 0}
              />
              <button
                className="send-btn"
                onClick={handleSend}
                disabled={spawnedEntities.size === 0 || !input.trim()}
              >
                ▶
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
