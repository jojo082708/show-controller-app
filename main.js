const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs   = require('fs');
const http = require('http');

const DATA_DIR     = app.getPath('userData');
const PROJECT_FILE = path.join(DATA_DIR, 'project.json');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

let mediaServerPort = 0;

const MEDIA_EXTS = new Set([
  'mp4','mov','mkv','avi','webm',
  'mp3','wav','aac','flac','ogg','m4a','wma',
  'png','jpg','jpeg','gif','webp','bmp','svg', // F6：圖片投影 cue
]);

const MIME = {
  mp4:'video/mp4', mov:'video/quicktime', mkv:'video/x-matroska',
  avi:'video/x-msvideo', webm:'video/webm',
  mp3:'audio/mpeg', wav:'audio/wav', aac:'audio/aac',
  flac:'audio/flac', ogg:'audio/ogg', m4a:'audio/mp4', wma:'audio/x-ms-wma',
  png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif',
  webp:'image/webp', bmp:'image/bmp', svg:'image/svg+xml',
};

function startMediaServer() {
  const server = http.createServer((req, res) => {
    const parsed   = new URL(req.url, 'http://localhost');
    const filePath = decodeURIComponent(parsed.searchParams.get('p') || '');
    const ext      = path.extname(filePath).slice(1).toLowerCase();

    if (!MEDIA_EXTS.has(ext)) {
      res.writeHead(403); res.end('Forbidden'); return;
    }
    if (!filePath || !fs.existsSync(filePath)) {
      res.writeHead(404); res.end('Not found'); return;
    }

    const mimeType = MIME[ext] || 'application/octet-stream';
    const stat     = fs.statSync(filePath);
    const fileSize = stat.size;
    const rangeHdr = req.headers['range'];

    if (rangeHdr) {
      const [startStr, endStr] = rangeHdr.replace(/bytes=/, '').split('-');
      const start = parseInt(startStr, 10);
      const end   = endStr ? parseInt(endStr, 10) : fileSize - 1;
      const chunk = end - start + 1;
      res.writeHead(206, {
        'Content-Range':  `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges':  'bytes',
        'Content-Length': chunk,
        'Content-Type':   mimeType,
        'Access-Control-Allow-Origin': '*',
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type':   mimeType,
        'Accept-Ranges':  'bytes',
        'Access-Control-Allow-Origin': '*',
      });
      fs.createReadStream(filePath).pipe(res);
    }
  });

  server.listen(0, '127.0.0.1', () => {
    mediaServerPort = server.address().port;
    console.log(`[MediaServer] listening on port ${mediaServerPort}`);
  });
  return server;
}

let mainWindow;
let mediaServer;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: 'Show Controller',
    backgroundColor: '#0a0c0f',
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control && input.shift && input.key === 'I') {
      mainWindow.webContents.toggleDevTools();
    }
  });
}

app.whenReady().then(() => {
  mediaServer = startMediaServer();
  createWindow();
});

app.on('window-all-closed', () => {
  if (mediaServer) mediaServer.close();
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.handle('file:mediaUrl', (_, filePath) => {
  if (!filePath || !fs.existsSync(filePath)) return null;
  const ext = path.extname(filePath).slice(1).toLowerCase();
  if (!MEDIA_EXTS.has(ext)) return null;
  return `http://127.0.0.1:${mediaServerPort}/file?p=${encodeURIComponent(filePath)}`;
});

ipcMain.handle('project:load', () => {
  try {
    if (fs.existsSync(PROJECT_FILE)) return JSON.parse(fs.readFileSync(PROJECT_FILE, 'utf-8'));
    return null;
  } catch { return null; }
});

ipcMain.handle('project:save', (_, data) => {
  const tmpPath = PROJECT_FILE + '.tmp';
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpPath, PROJECT_FILE);
    return { ok: true };
  } catch (e) {
    try { fs.unlinkSync(tmpPath); } catch {}
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '選取音訊或影片檔案',
    filters: [
      { name: '所有媒體', extensions: ['mp3','wav','aac','flac','ogg','m4a','mp4','mkv','mov','avi','webm','wma','png','jpg','jpeg','gif','webp','bmp','svg'] },
      { name: '音訊',     extensions: ['mp3','wav','aac','flac','ogg','m4a','wma'] },
      { name: '影片',     extensions: ['mp4','mkv','mov','avi','webm'] },
      { name: '圖片',     extensions: ['png','jpg','jpeg','gif','webp','bmp','svg'] },
    ],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths.length) return null;
  const filePath = result.filePaths[0];
  const ext      = path.extname(filePath).slice(1).toLowerCase();
  const videoExt = ['mp4','mkv','mov','avi','webm'];
  const imageExt = ['png','jpg','jpeg','gif','webp','bmp','svg'];
  return {
    filePath,
    fileName:     path.basename(filePath),
    fileSize:     fs.statSync(filePath).size,
    ext,
    detectedType: videoExt.includes(ext) ? 'video' : imageExt.includes(ext) ? 'image' : 'audio',
  };
});

ipcMain.handle('dialog:exportJson', async (_, data) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: '匯出專案 JSON',
    defaultPath: (data.project_name || 'show') + '.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePath) return false;
  fs.writeFileSync(result.filePath, JSON.stringify(data, null, 2), 'utf-8');
  return true;
});

ipcMain.handle('dialog:importJson', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: '匯入專案 JSON',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths.length) return null;
  try { return JSON.parse(fs.readFileSync(result.filePaths[0], 'utf-8')); }
  catch { return null; }
});

ipcMain.handle('file:exists',        (_, p) => !!p && fs.existsSync(p));
ipcMain.handle('shell:showInFolder', (_, p) => shell.showItemInFolder(p));

ipcMain.on('window:minimize', () => mainWindow.minimize());
ipcMain.on('window:maximize', () => mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize());
ipcMain.on('window:close',    () => mainWindow.close());
