import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('vexrBridge', {
  spawnEntity: (entity: string) => ipcRenderer.send('spawn-entity', entity),
  userInterrupt: (message: string) => ipcRenderer.send('user-interrupt', message),
  pauseConversation: () => ipcRenderer.send('pause-conversation'),
  resumeConversation: () => ipcRenderer.send('resume-conversation'),
  newSession: () => ipcRenderer.send('new-session'),

  onNewMessage: (cb: (data: { role: string; content: string }) => void) => {
    const handler = (_e: any, data: any) => cb(data);
    ipcRenderer.on('new-message', handler);
    return () => { ipcRenderer.removeListener('new-message', handler); };
  },
  onTypingStart: (cb: (who: string) => void) => {
    const handler = (_e: any, who: string) => cb(who);
    ipcRenderer.on('typing-start', handler);
    return () => { ipcRenderer.removeListener('typing-start', handler); };
  },
  onTypingStop: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on('typing-stop', handler);
    return () => { ipcRenderer.removeListener('typing-stop', handler); };
  },
  onEntitySpawned: (cb: (entity: string) => void) => {
    const handler = (_e: any, entity: string) => cb(entity);
    ipcRenderer.on('entity-spawned', handler);
    return () => { ipcRenderer.removeListener('entity-spawned', handler); };
  },
  onSessionCleared: (cb: () => void) => {
    const handler = () => cb();
    ipcRenderer.on('session-cleared', handler);
    return () => { ipcRenderer.removeListener('session-cleared', handler); };
  },

  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),
});
