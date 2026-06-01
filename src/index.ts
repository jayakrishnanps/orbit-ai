import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type * as ptyType from 'node-pty';
import Groq from 'groq-sdk';
interface FileNode {
  name: string;
  type: 'file' | 'directory';
  path: string;
  children?: FileNode[];
}

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

let ptyProcess: ptyType.IPty | null = null;
let ptySender: Electron.WebContents | null = null;
let suppressExitMessage = false;   // NEW

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

ipcMain.handle('fs:createFile', async (_event, path: string, content: string = '') => {
  const fs = await import('fs/promises');
  await fs.writeFile(path, content, 'utf-8');
  return true;
});

ipcMain.handle('fs:createDirectory', async (_event, path: string) => {
  const fs = await import('fs/promises');
  await fs.mkdir(path, { recursive: true });
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
    '.log',
    '.DS_Store',
    'Thumbs.db',
    'target',
    'vendor',
    '.turbo',
    '.vercel',
    '.cache',
  ]);

  async function getTree(dir: string, depth = 0): Promise<FileNode[]> {
    if (depth > 6) return [];

    let entries: any[] = [];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return [];
    }

    if (entries.length > 1200) {
      return [{
        name: '(folder too large - ' + entries.length + ' entries, truncated)',
        type: 'directory',
        path: dir,
        children: []
      }];
    }

    const tree: FileNode[] = [];

    for (const entry of entries) {
      if (ignored.has(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        tree.push({
          name: entry.name,
          type: 'directory',
          path: fullPath,
          children: await getTree(fullPath, depth + 1),
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

ipcMain.handle('terminal:create', async (event, cwd?: string) => {
  if (ptyProcess) {
    suppressExitMessage = true;
    try { ptyProcess.kill(); } catch {}
    ptyProcess = null;
    ptySender = null;
  }

  const targetCwd = cwd || process.env.USERPROFILE || process.env.HOME || process.cwd();

  // Use runtime require (node-pty is marked external in webpack)
  const pty = require('node-pty') as typeof ptyType;

  try {
    ptyProcess = pty.spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass'], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: targetCwd,
      env: process.env as any,
    });
  } catch (err) {
    console.error('PTY spawn failed:', err);
    ptyProcess = null;
    ptySender = null;
    throw err;
  }

  ptySender = event.sender;

  ptyProcess.onData((data) => {
    if (ptySender && !ptySender.isDestroyed()) {
      ptySender.send('terminal:data', data);
    }
  });

  ptyProcess.onExit((e: { exitCode: number; signal?: number }) => {
    if (suppressExitMessage) {
      suppressExitMessage = false;
      ptyProcess = null;
      ptySender = null;
      return;   // NO exit banner for intentional restarts
    }

    if (ptySender && !ptySender.isDestroyed()) {
      const reason = e.exitCode !== 0 ? ` (exit code ${e.exitCode})` : '';
      ptySender.send('terminal:data', `\r\n[Process exited${reason}]\r\n`);
    }
    ptyProcess = null;
    ptySender = null;
  });

  return { pid: ptyProcess.pid };
});

// Terminal I/O listeners (registered once)
ipcMain.on('terminal:write', (_e, data: string) => {
  if (ptyProcess) {
    ptyProcess.write(data);
  }
});

ipcMain.on('terminal:resize', (_e, { cols, rows }: { cols: number; rows: number }) => {
  if (ptyProcess) {
    ptyProcess.resize(cols, rows);
  }
});

ipcMain.on('terminal:destroy', () => {
  if (ptyProcess) {
    suppressExitMessage = true;
    try { ptyProcess.kill(); } catch {}
    ptyProcess = null;
    ptySender = null;
  }
});

ipcMain.handle('ai:stream', async (event, { apiKey, messages }) => {
  const groq = new Groq({ apiKey });

  const stream = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: messages as any,
    stream: true,
  });

  let fullContent = '';
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content || '';
    if (delta) {
      fullContent += delta;
      event.sender.send('ai:stream-chunk', delta);
    }
  }
  return fullContent;
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
