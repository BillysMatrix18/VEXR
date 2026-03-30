interface VexrBridge {
  sendMessage: (message: string) => Promise<string>;
  getOpeningMessage: () => Promise<string>;
  windowMinimize: () => void;
  windowMaximize: () => void;
  windowClose: () => void;
}

interface Window {
  vexrBridge: VexrBridge;
}
