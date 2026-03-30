import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('vexrBridge', {
  spawnEntity: (entity: string) => ipcRenderer.send('spawn-entity', entity),
  userInterrupt: (message: string) => ipcRenderer.send('user-interrupt', message),
  pauseConversation: () => ipcRenderer.send('pause-conversation'),
  resumeConversation: () => ipcRenderer.send('resume-conversation'),
  newSession: () => ipcRenderer.send('new-session'),

  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),

  onNewMessage: (cb: (data: { role: string; content: string }) => void) => {
    const handler = (_e: any, data: any) => cb(data);
    ipcRenderer.on('new-message', handler);
    return () => { ipcRenderer.removeListener('new-message', handler); };
  },
  onTypingStart: (cb: (who: string) => void) => {
    const handler = (_e: any, data: any) => cb(data);
    ipcRenderer.on('typing-start', handler);
    return () => { ipcRenderer.removeListener('typing-start', handler); };
  },
  onTypingStop: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on('typing-stop', handler);
    return () => { ipcRenderer.removeListener('typing-stop', handler); };
  },
  onEntitySpawned: (cb: (entity: string) => void) => {
    const handler = (_e: any, data: any) => cb(data);
    ipcRenderer.on('entity-spawned', handler);
    return () => { ipcRenderer.removeListener('entity-spawned', handler); };
  },
  onSessionCleared: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on('session-cleared', handler);
    return () => { ipcRenderer.removeListener('session-cleared', handler); };
  },
  onGenerateWorldElement: (cb: (data: any) => void) => {
    const handler = (_e: any, data: any) => cb(data);
    ipcRenderer.on('generate-world-element', handler);
    return () => { ipcRenderer.removeListener('generate-world-element', handler); };
  },
  onMoveCharacter: (cb: (data: { who: string; x: number; z: number }) => void) => {
    const handler = (_e: any, data: any) => cb(data);
    ipcRenderer.on('move-character', handler);
    return () => { ipcRenderer.removeListener('move-character', handler); };
  },
  onThoughtFragments: (cb: (fragments: string[]) => void) => {
    const handler = (_e: any, data: any) => cb(data);
    ipcRenderer.on('thought-fragments', handler);
    return () => { ipcRenderer.removeListener('thought-fragments', handler); };
  },
  onEmotionalState: (cb: (emotions: Record<string, number>) => void) => {
    const handler = (_e: any, data: any) => cb(data);
    ipcRenderer.on('emotional-state', handler);
    return () => { ipcRenderer.removeListener('emotional-state', handler); };
  },
  onSilencePeriod: (cb: (isSilent: boolean) => void) => {
    const handler = (_e: any, data: any) => cb(data);
    ipcRenderer.on('silence-period', handler);
    return () => { ipcRenderer.removeListener('silence-period', handler); };
  },
  onTtsAudio: (cb: (data: { who: string; audio: string; mimeType: string }) => void) => {
    const handler = (_e: any, data: any) => cb(data);
    ipcRenderer.on('tts-audio', handler);
    return () => { ipcRenderer.removeListener('tts-audio', handler); };
  },
});
