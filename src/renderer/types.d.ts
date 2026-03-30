interface VexrBridge {
  startSession: () => void;
  pauseConversation: () => void;
  resumeConversation: () => void;
  newSession: () => void;
  userInterrupt: (message: string) => void;
  onNewMessage: (callback: (data: { role: string; content: string }) => void) => () => void;
  onTypingStart: (callback: (who: string) => void) => () => void;
  onTypingStop: (callback: () => void) => () => void;
  onSessionReady: (callback: () => void) => () => void;
  onSessionCleared: (callback: () => void) => () => void;
  windowMinimize: () => void;
  windowMaximize: () => void;
  windowClose: () => void;
}

interface Window {
  vexrBridge: VexrBridge;
}
