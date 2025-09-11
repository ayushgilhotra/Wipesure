const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');

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

// File selection handler
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

// Secure wipe handler
ipcMain.handle('start-wipe', async (event, fileInfo, wipeOptions) => {
  try {
    const { filePath, fileName } = fileInfo;
    const { method, passes } = wipeOptions;
    
    // Create form data for upload
    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));
    formData.append('method', method);
    formData.append('passes', passes);
    formData.append('wipeType', 'file');
    formData.append('deviceId', 'desktop-app');
    
    // Send to backend server
    const serverUrl = 'https://61ac9072-150b-4085-baf4-73443b60dce2-00-wku1nbvqnld2.riker.replit.dev';
    const response = await axios.post(`${serverUrl}/api/wipe`, formData, {
      headers: formData.getHeaders()
    });
    
    return response.data;
  } catch (error) {
    console.error('Wipe error:', error);
    throw error;
  }
});

// Progress monitoring
ipcMain.handle('get-wipe-progress', async (event, jobId) => {
  try {
    const serverUrl = 'https://61ac9072-150b-4085-baf4-73443b60dce2-00-wku1nbvqnld2.riker.replit.dev';
    const response = await axios.get(`${serverUrl}/api/wipe/${jobId}`);
    return response.data;
  } catch (error) {
    console.error('Progress error:', error);
    throw error;
  }
});

// Certificate generation and local file deletion
ipcMain.handle('generate-certificate-and-delete', async (event, jobId, originalFilePath) => {
  try {
    // Generate certificate
    const serverUrl = 'https://61ac9072-150b-4085-baf4-73443b60dce2-00-wku1nbvqnld2.riker.replit.dev';
    const response = await axios.post(`${serverUrl}/api/certificate/${jobId}`);
    const certificateData = response.data;
    
    // Download certificate
    const certResponse = await axios.get(`${serverUrl}${certificateData.downloadUrl}`, {
      responseType: 'stream'
    });
    
    // Save certificate to Downloads folder
    const downloadsPath = path.join(require('os').homedir(), 'Downloads');
    const certFileName = `WipeSure-Certificate-${Date.now()}.pdf`;
    const certPath = path.join(downloadsPath, certFileName);
    
    const writer = fs.createWriteStream(certPath);
    certResponse.data.pipe(writer);
    
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    
    // **DELETE THE ORIGINAL FILE** - This is the key feature!
    if (fs.existsSync(originalFilePath)) {
      // Secure deletion with multiple overwrites
      await secureDeleteLocalFile(originalFilePath);
      console.log(`Original file deleted: ${originalFilePath}`);
    }
    
    return {
      success: true,
      certificatePath: certPath,
      certificateFileName: certFileName,
      originalFileDeleted: true,
      hash: certificateData.hash
    };
  } catch (error) {
    console.error('Certificate generation error:', error);
    throw error;
  }
});

// Secure local file deletion function
async function secureDeleteLocalFile(filePath) {
  try {
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    
    // Perform multiple overwrite passes
    const fd = fs.openSync(filePath, 'r+');
    
    try {
      // Pass 1: All zeros
      const zeros = Buffer.alloc(Math.min(fileSize, 1024 * 1024), 0x00);
      for (let offset = 0; offset < fileSize; offset += zeros.length) {
        const writeSize = Math.min(zeros.length, fileSize - offset);
        fs.writeSync(fd, zeros, 0, writeSize, offset);
      }
      fs.fsyncSync(fd);
      
      // Pass 2: All ones
      const ones = Buffer.alloc(Math.min(fileSize, 1024 * 1024), 0xFF);
      for (let offset = 0; offset < fileSize; offset += ones.length) {
        const writeSize = Math.min(ones.length, fileSize - offset);
        fs.writeSync(fd, ones, 0, writeSize, offset);
      }
      fs.fsyncSync(fd);
      
      // Pass 3: Random data
      for (let offset = 0; offset < fileSize; offset += 1024 * 1024) {
        const writeSize = Math.min(1024 * 1024, fileSize - offset);
        const randomData = require('crypto').randomBytes(writeSize);
        fs.writeSync(fd, randomData, 0, writeSize, offset);
      }
      fs.fsyncSync(fd);
      
    } finally {
      fs.closeSync(fd);
    }
    
    // Finally delete the file
    fs.unlinkSync(filePath);
    
  } catch (error) {
    console.error('Secure deletion error:', error);
    throw error;
  }
}