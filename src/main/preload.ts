import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('vexrBridge', {
  sendMessage: (message: string): Promise<string> =>
    ipcRenderer.invoke('send-message', message),
  getOpeningMessage: (): Promise<string> =>
    ipcRenderer.invoke('get-opening-message'),
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),
});
