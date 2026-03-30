interface VexrBridge {
  spawnEntity: (entity: string) => void;
  userInterrupt: (message: string) => void;
  pauseConversation: () => void;
  resumeConversation: () => void;
  newSession: () => void;

  windowMinimize: () => void;
  windowMaximize: () => void;
  windowClose: () => void;

  onNewMessage: (cb: (data: { role: string; content: string }) => void) => () => void;
  onTypingStart: (cb: (who: string) => void) => () => void;
  onTypingStop: (cb: () => void) => () => void;
  onEntitySpawned: (cb: (entity: string) => void) => () => void;
  onSessionCleared: (cb: () => void) => () => void;
  onGenerateWorldElement: (cb: (data: any) => void) => () => void;
  onMoveCharacter: (cb: (data: { who: string; x: number; z: number }) => void) => () => void;
  onThoughtFragments: (cb: (fragments: string[]) => void) => () => void;
  onEmotionalState: (cb: (emotions: Record<string, number>) => void) => () => void;
  onSilencePeriod: (cb: (isSilent: boolean) => void) => () => void;
}

interface Window {
  vexrBridge: VexrBridge;
}
