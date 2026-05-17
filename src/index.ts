import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';

interface FileNode {
  name: string;
  type: 'file' | 'directory';
  path: string;
  children?: FileNode[];
}

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = (): void => {
  const mainWindow = new BrowserWindow({
    height: 768,
    width: 1280,
    minHeight: 480,
    minWidth: 800,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,   // required for contextBridge
      nodeIntegration: false,   // security: keep Node out of renderer
    },
  });

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  mainWindow.webContents.openDevTools();
};

ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });
  return result.filePaths[0] || null;
});

ipcMain.handle('fs:readFile', async (_, filePath: string) => {
  return await fs.readFile(filePath, 'utf-8');
});

ipcMain.handle('fs:writeFile', async (_, filePath: string, content: string) => {
  await fs.writeFile(filePath, content, 'utf-8');
  return true;
});

ipcMain.handle('fs:getFileTree', async (_, folderPath: string) => {
  const ignored = new Set([
    'node_modules',
    '.git',
    '.webpack',
    'dist',
    'build',
    'out',
    '.next',
    'coverage',
    '.env',
    '.env.local',
    'logs',
    '*.log',
    '.DS_Store',
    'Thumbs.db',
  ]);

  async function getTree(dir: string, depth = 0): Promise<FileNode[]> {
    if (depth > 8) return [];                    // safety limit

    const entries = await fs.readdir(dir, { withFileTypes: true });
    const tree: FileNode[] = [];

    for (const entry of entries) {
      if (ignored.has(entry.name)) continue;     // skip heavy folders

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        tree.push({
          name: entry.name,
          type: 'directory',
          path: fullPath,
          children: await getTree(fullPath, depth + 1),   // recursive but limited
        });
      } else {
        tree.push({
          name: entry.name,
          type: 'file',
          path: fullPath,
        });
      }
    }
    return tree;
  }

  return getTree(folderPath);
});

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
