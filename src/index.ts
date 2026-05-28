import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'child_process';
import Groq from 'groq-sdk';
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

ipcMain.handle('terminal:create', (event, cwd?: string) => {
  const shell = spawn('powershell.exe', [], {
    cwd: cwd || process.env.HOME || process.env.USERPROFILE,
    env: process.env as { [key: string]: string },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  shell.stdout.on('data', (data) => {
    event.sender.send('terminal:data', data.toString());
  });
  shell.stderr.on('data', (data) => {
    event.sender.send('terminal:data', data.toString());
  });
  shell.on('close', () => {
    event.sender.send('terminal:data', '\r\n[Process exited]\r\n');
  });

  ipcMain.on('terminal:write', (_e, data: string) => {
    shell.stdin.write(data);
  });

  ipcMain.on('terminal:resize', (_e, { cols, rows }) => {
    // resize not supported in spawn, but kept for compatibility
  });

  return { pid: shell.pid };
});

ipcMain.handle('ai:chat', async (_event, { apiKey, messages }: { apiKey: string; messages: { role: string; content: string }[] }) => {
  const groq = new Groq({ apiKey });
  const completion = await groq.chat.completions.create({
    model: 'llama3-8b-8192',
    messages: messages as Groq.Chat.ChatCompletionMessageParam[],
  });
  return completion.choices[0]?.message?.content ?? '';
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
