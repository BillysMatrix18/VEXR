interface VexrBridge {
  spawnEntity: (entity: string) => void;
  userInterrupt: (message: string) => void;
  pauseConversation: () => void;
  resumeConversation: () => void;
  newSession: () => void;
  onNewMessage: (cb: (data: { role: string; content: string }) => void) => () => void;
  onTypingStart: (cb: (who: string) => void) => () => void;
  onTypingStop: (cb: () => void) => () => void;
  onEntitySpawned: (cb: (entity: string) => void) => () => void;
  onSessionCleared: (cb: () => void) => () => void;
  windowMinimize: () => void;
  windowMaximize: () => void;
  windowClose: () => void;
}

interface Window {
  vexrBridge: VexrBridge;
}
