const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');
const os = require('os');
const crypto = require('crypto');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'WipeSure Enterprise Desktop',
    icon: path.join(__dirname, 'assets', 'icon.png')
  });

  mainWindow.loadFile('index.html');

  // Remove menu bar for cleaner look
  mainWindow.setMenuBarVisibility(false);
}

app.whenReady().then(createWindow);

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

// ==========================
// File selection
// ==========================
ipcMain.handle('select-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'All Files', extensions: ['*'] },
      { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'txt'] },
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif'] }
    ]
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return {
      filePath: result.filePaths[0],
      fileName: path.basename(result.filePaths[0]),
      fileSize: fs.statSync(result.filePaths[0]).size
    };
  }
  return null;
});

// ==========================
// Start wipe
// ==========================
ipcMain.handle('start-wipe', async (event, fileInfo, wipeOptions) => {
  try {
    const { filePath, fileName } = fileInfo;
    const { method, passes } = wipeOptions;

    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));
    formData.append('method', method);
    formData.append('passes', passes);
    formData.append('wipeType', 'file');
    formData.append('deviceId', 'desktop-app');

    const response = await axios.post('http://localhost:5000/api/wipe', formData, {
      headers: formData.getHeaders(),
      timeout: 10000 // 10s timeout to avoid hanging
    });

    return response.data;
  } catch (error) {
    console.error('❌ Wipe error:', error.message || error);
    return { success: false, message: error.message || 'Unknown wipe error' };
  }
});

// ==========================
// Progress monitoring
// ==========================
ipcMain.handle('get-wipe-progress', async (event, jobId) => {
  try {
    const response = await axios.get(`http://localhost:5000/api/wipe/${jobId}`);
    return response.data;
  } catch (error) {
    console.error('❌ Progress error:', error.message || error);
    return { success: false, message: error.message || 'Progress check failed' };
  }
});

// ==========================
// Certificate generation & deletion
// ==========================
ipcMain.handle('generate-certificate-and-delete', async (event, jobId, originalFilePath) => {
  try {
    const response = await axios.post(`http://localhost:5000/api/certificate/${jobId}`);
    const certificateData = response.data;

    const certResponse = await axios.get(
      `http://localhost:5000${certificateData.downloadUrl}`,
      { responseType: 'stream' }
    );

    const downloadsPath = path.join(os.homedir(), 'Downloads');
    const certFileName = `WipeSure-Certificate-${Date.now()}.pdf`;
    const certPath = path.join(downloadsPath, certFileName);

    const writer = fs.createWriteStream(certPath);
    certResponse.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });

    if (fs.existsSync(originalFilePath)) {
      await secureDeleteLocalFile(originalFilePath);
      console.log(`✅ Original file securely deleted: ${originalFilePath}`);
    }

    return {
      success: true,
      certificatePath: certPath,
      certificateFileName: certFileName,
      originalFileDeleted: true,
      hash: certificateData.hash
    };
  } catch (error) {
    console.error('❌ Certificate error:', error.message || error);
    return { success: false, message: error.message || 'Certificate generation failed' };
  }
});

// ==========================
// Secure local deletion
// ==========================
async function secureDeleteLocalFile(filePath) {
  try {
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    const fd = fs.openSync(filePath, 'r+');

    try {
      // Pass 1: zeros
      const zeros = Buffer.alloc(Math.min(fileSize, 1024 * 1024), 0x00);
      for (let offset = 0; offset < fileSize; offset += zeros.length) {
        fs.writeSync(fd, zeros, 0, Math.min(zeros.length, fileSize - offset), offset);
      }
      fs.fsyncSync(fd);

      // Pass 2: ones
      const ones = Buffer.alloc(Math.min(fileSize, 1024 * 1024), 0xFF);
      for (let offset = 0; offset < fileSize; offset += ones.length) {
        fs.writeSync(fd, ones, 0, Math.min(ones.length, fileSize - offset), offset);
      }
      fs.fsyncSync(fd);

      // Pass 3: random
      for (let offset = 0; offset < fileSize; offset += 1024 * 1024) {
        const writeSize = Math.min(1024 * 1024, fileSize - offset);
        const randomData = crypto.randomBytes(writeSize);
        fs.writeSync(fd, randomData, 0, writeSize, offset);
      }
      fs.fsyncSync(fd);

    } finally {
      fs.closeSync(fd);
    }

    fs.unlinkSync(filePath);
  } catch (error) {
    console.error('❌ Secure deletion error:', error.message || error);
    throw error;
  }
}
