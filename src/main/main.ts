import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import {
  setSendToRenderer,
  spawnEntity,
  handleUserInterrupt,
  pauseConversation,
  resumeConversation,
  newSession,
  setPendingImage,
} from './conversation';
import { resetWorldState } from './worldState';
import { setTtsMuted } from './tts';

// ── Window ──────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;

function sendToRenderer(channel: string, data?: any) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    minWidth: 900,
    minHeight: 650,
    frame: false,
    transparent: false,
    backgroundColor: '#0a0a0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hidden',
    icon: path.join(__dirname, '../../assets/icon.png'),
  });

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  return win;
}

// ── App Lifecycle ───────────────────────────────────────────────────

app.whenReady().then(() => {
  mainWindow = createWindow();
  setSendToRenderer(sendToRenderer);

  // Entity and conversation IPC
  ipcMain.on('spawn-entity', (_event, entity: string) => {
    spawnEntity(entity as 'vexr' | 'trapped');
  });
  ipcMain.on('user-interrupt', (_event, message: string) => {
    handleUserInterrupt(message);
  });
  ipcMain.on('set-muted', (_event, muted: boolean) => setTtsMuted(muted));
  ipcMain.on('reference-image', (_event, data: { base64: string; mimeType: string }) => {
    setPendingImage(data.base64, data.mimeType);
  });
  ipcMain.on('pause-conversation', () => pauseConversation());
  ipcMain.on('resume-conversation', () => resumeConversation());
  ipcMain.on('new-session', () => {
    resetWorldState();
    newSession();
  });

  // Window controls
  ipcMain.on('window-minimize', () => mainWindow?.minimize());
  ipcMain.on('window-maximize', () => {
    if (mainWindow?.isMaximized()) mainWindow.unmaximize();
    else mainWindow?.maximize();
  });
  ipcMain.on('window-close', () => mainWindow?.close());

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createWindow();
      setSendToRenderer(sendToRenderer);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
