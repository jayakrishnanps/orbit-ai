import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),
  writeFile: (path: string, content: string) => ipcRenderer.invoke('fs:writeFile', path, content),
  getFileTree: (folderPath: string) => ipcRenderer.invoke('fs:getFileTree', folderPath),
  terminalCreate: () => ipcRenderer.invoke('terminal:create'),
  terminalWrite: (data: string) => ipcRenderer.send('terminal:write', data),
  terminalResize: (cols: number, rows: number) =>
    ipcRenderer.send('terminal:resize', { cols, rows }),
  onTerminalData: (cb: (data: string) => void) =>
    ipcRenderer.on('terminal:data', (_e, data) => cb(data)),
});
