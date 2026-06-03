const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  loadProject:  ()     => ipcRenderer.invoke('project:load'),
  saveProject:  (data) => ipcRenderer.invoke('project:save', data),
  openFile:     ()     => ipcRenderer.invoke('dialog:openFile'),
  exportJson:   (data) => ipcRenderer.invoke('dialog:exportJson', data),
  importJson:   ()     => ipcRenderer.invoke('dialog:importJson'),
  fileExists:   (p)    => ipcRenderer.invoke('file:exists', p),
  getMediaUrl:  (p)    => ipcRenderer.invoke('file:mediaUrl', p),
  showInFolder: (p)    => ipcRenderer.invoke('shell:showInFolder', p),
  minimize:     ()     => ipcRenderer.send('window:minimize'),
  maximize:     ()     => ipcRenderer.send('window:maximize'),
  close:        ()     => ipcRenderer.send('window:close'),
});
