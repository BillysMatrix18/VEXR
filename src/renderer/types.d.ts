interface VexrBridge {
  spawnEntity: (entity: string) => void;
  userInterrupt: (message: string) => void;
  setMuted: (muted: boolean) => void;
  setSilenced: (silenced: boolean) => void;
  sendReferenceImage: (base64: string, mimeType: string) => void;
  pauseConversation: () => void;
  resumeConversation: () => void;
  newSession: () => void;
  resetVexr: () => void;
  getVexrModel: () => Promise<string | null>;

  windowMinimize: () => void;
  windowMaximize: () => void;
  windowClose: () => void;

  onNewMessage: (cb: (data: { role: string; content: string }) => void) => () => void;
  onTypingStart: (cb: (who: string) => void) => () => void;
  onTypingStop: (cb: () => void) => () => void;
  onEntitySpawned: (cb: (entity: string) => void) => () => void;
  onSessionCleared: (cb: () => void) => () => void;
  onClearWorld: (cb: () => void) => () => void;
  sendSnapshot: (base64: string) => void;
  onRequestSnapshot: (cb: () => void) => () => void;
  onGenerateWorldElement: (cb: (data: any) => void) => () => void;
  onMoveCharacter: (cb: (data: { who: string; x: number; z: number }) => void) => () => void;
  onThoughtFragments: (cb: (fragments: string[]) => void) => () => void;
  onEmotionalState: (cb: (emotions: Record<string, number>) => void) => () => void;
  onModelLoading: (cb: (data: { query: string; status: string; name?: string }) => void) => () => void;
  onSilencePeriod: (cb: (isSilent: boolean) => void) => () => void;
  onTtsAudio: (cb: (data: { who: string; audio: string; mimeType: string }) => void) => () => void;
}

interface Window {
  vexrBridge: VexrBridge;
}
