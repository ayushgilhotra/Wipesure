const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectFile: () => ipcRenderer.invoke('select-file'),
  startWipe: (fileInfo, wipeOptions) => ipcRenderer.invoke('start-wipe', fileInfo, wipeOptions),
  getWipeProgress: (jobId) => ipcRenderer.invoke('get-wipe-progress', jobId),
  generateCertificateAndDelete: (jobId, originalFilePath) => 
    ipcRenderer.invoke('generate-certificate-and-delete', jobId, originalFilePath)
});