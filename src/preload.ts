import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),
  writeFile: (path: string, content: string) => ipcRenderer.invoke('fs:writeFile', path, content),
  createFile: (path: string, content?: string) => ipcRenderer.invoke('fs:createFile', path, content),
  createDirectory: (path: string) => ipcRenderer.invoke('fs:createDirectory', path),
  getFileTree: (folderPath: string) => ipcRenderer.invoke('fs:getFileTree', folderPath),
  terminalCreate: (cwd?: string) => ipcRenderer.invoke('terminal:create', cwd),
  terminalWrite: (data: string) => ipcRenderer.send('terminal:write', data),
  terminalResize: (cols: number, rows: number) => ipcRenderer.send('terminal:resize', { cols, rows }),
  onTerminalData: (cb: (data: string) => void) => ipcRenderer.on('terminal:data', (_e, data) => cb(data)),
  aiChat: (apiKey: string, messages: { role: string; content: string }[]) =>
    ipcRenderer.invoke('ai:chat', { apiKey, messages }),
  aiStream: (apiKey: string, messages: any[]) =>
    ipcRenderer.invoke('ai:stream', { apiKey, messages }),

  onStreamChunk: (callback: (delta: string) => void) =>
    ipcRenderer.on('ai:stream-chunk', (_event, delta) => callback(delta)),
});
