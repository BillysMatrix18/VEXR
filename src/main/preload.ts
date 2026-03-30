import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('vexrBridge', {
  // Session control
  startSession: () => ipcRenderer.send('start-session'),
  pauseConversation: () => ipcRenderer.send('pause-conversation'),
  resumeConversation: () => ipcRenderer.send('resume-conversation'),
  newSession: () => ipcRenderer.send('new-session'),
  userInterrupt: (message: string) => ipcRenderer.send('user-interrupt', message),

  // Events from main process
  onNewMessage: (callback: (data: { role: string; content: string }) => void) => {
    const handler = (_event: any, data: { role: string; content: string }) => callback(data);
    ipcRenderer.on('new-message', handler);
    return () => ipcRenderer.removeListener('new-message', handler);
  },
  onTypingStart: (callback: (who: string) => void) => {
    const handler = (_event: any, who: string) => callback(who);
    ipcRenderer.on('typing-start', handler);
    return () => ipcRenderer.removeListener('typing-start', handler);
  },
  onTypingStop: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('typing-stop', handler);
    return () => ipcRenderer.removeListener('typing-stop', handler);
  },
  onSessionReady: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('session-ready', handler);
    return () => ipcRenderer.removeListener('session-ready', handler);
  },
  onSessionCleared: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('session-cleared', handler);
    return () => ipcRenderer.removeListener('session-cleared', handler);
  },

  // Window controls
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),
});
