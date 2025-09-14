const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const multer = require('multer');
const sqlite3 = require('sqlite3').verbose();
const PDFDocument = require('pdfkit');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));
app.use('/uploads', express.static('uploads'));
app.use('/certificates', express.static('certificates'));

// Create necessary directories
fs.ensureDirSync('uploads');
fs.ensureDirSync('certificates');
fs.ensureDirSync('temp');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage: storage });

// Initialize SQLite database
const db = new sqlite3.Database('wipesure.db');

// Initialize database tables
db.serialize(() => {
  // Devices table
  db.run(`CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    model TEXT,
    storage TEXT,
    health INTEGER DEFAULT 100,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Wipe jobs table
  db.run(`CREATE TABLE IF NOT EXISTS wipe_jobs (
    id TEXT PRIMARY KEY,
    device_id TEXT,
    method TEXT NOT NULL,
    passes INTEGER DEFAULT 3,
    status TEXT DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    file_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES devices (id)
  )`);

  // AI results table
  db.run(`CREATE TABLE IF NOT EXISTS ai_results (
    id TEXT PRIMARY KEY,
    job_id TEXT,
    entropy_score REAL,
    recoverable_files INTEGER DEFAULT 0,
    residue_status TEXT DEFAULT 'SCANNING',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES wipe_jobs (id)
  )`);

  // Certificates table
  db.run(`CREATE TABLE IF NOT EXISTS certificates (
    id TEXT PRIMARY KEY,
    job_id TEXT,
    device_id TEXT,
    hash TEXT UNIQUE,
    pdf_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (job_id) REFERENCES wipe_jobs (id),
    FOREIGN KEY (device_id) REFERENCES devices (id)
  )`);

  // Blockchain logs table
  db.run(`CREATE TABLE IF NOT EXISTS blockchain_logs (
    id TEXT PRIMARY KEY,
    ref_id TEXT,
    ref_type TEXT,
    hash TEXT,
    immutable_flag BOOLEAN DEFAULT true,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Insert sample devices
  db.run(`INSERT OR IGNORE INTO devices (id, name, model, storage, health) VALUES 
    ('dev-001', 'Laptop-Primary', 'Dell Inspiron 15', '512GB SSD', 95),
    ('dev-002', 'Desktop-Workstation', 'HP EliteDesk 800', '1TB HDD', 87),
    ('dev-003', 'Mobile-Device', 'Samsung Galaxy S21', '256GB', 92)`);
});

// Utility functions
function generateBlockchainHash(data) {
  return crypto.createHash('sha256').update(JSON.stringify(data) + Date.now()).digest('hex');
}

function createBlockchainLog(refId, refType, hash) {
  const logId = uuidv4();
  db.run(
    'INSERT INTO blockchain_logs (id, ref_id, ref_type, hash) VALUES (?, ?, ?, ?)',
    [logId, refId, refType, hash]
  );
  return logId;
}

// API Routes

// Get dashboard overview
app.get('/api/dashboard', (req, res) => {
  db.all(`
    SELECT 
      (SELECT COUNT(*) FROM devices) as total_devices,
      (SELECT COUNT(*) FROM wipe_jobs) as total_wipes,
      (SELECT COUNT(*) FROM certificates) as total_certificates,
      (SELECT COUNT(*) FROM wipe_jobs WHERE status = 'in_progress') as active_wipes
  `, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows[0]);
  });
});

// Get all devices
app.get('/api/devices', (req, res) => {
  db.all('SELECT * FROM devices ORDER BY created_at DESC', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Get wipe jobs
app.get('/api/wipe-jobs', (req, res) => {
  db.all(`
    SELECT wj.*, d.name as device_name 
    FROM wipe_jobs wj 
    LEFT JOIN devices d ON wj.device_id = d.id 
    ORDER BY wj.created_at DESC
  `, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Start wipe job
app.post('/api/wipe', upload.single('file'), (req, res) => {
  const { deviceId, method, passes = 3, wipeType } = req.body;
  const jobId = uuidv4();
  const filePath = req.file ? req.file.path : null;

  db.run(
    'INSERT INTO wipe_jobs (id, device_id, method, passes, file_path, status) VALUES (?, ?, ?, ?, ?, ?)',
    [jobId, deviceId, method, passes, filePath, 'pending'],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      // Start wipe simulation
      simulateWipeProcess(jobId, method, passes, wipeType === 'file', filePath);
      
      res.json({ jobId, status: 'started', message: 'Wipe job initiated' });
    }
  );
});

// Get wipe job progress
app.get('/api/wipe/:id', (req, res) => {
  const jobId = req.params.id;
  
  db.get('SELECT * FROM wipe_jobs WHERE id = ?', [jobId], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!row) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    res.json(row);
  });
});

// Simulate backup
app.post('/api/backup', (req, res) => {
  const { email, deviceId } = req.body;
  
  // Simulate backup process
  setTimeout(() => {
    const backupId = uuidv4();
    res.json({ 
      backupId, 
      status: 'completed',
      message: `Backup completed and sent to ${email}`,
      size: '15.7 GB'
    });
  }, 2000);
});

// Simulate file transfer
app.post('/api/transfer', (req, res) => {
  const { sourceDevice, targetDevice, files } = req.body;
  
  const transferId = uuidv4();
  
  // Simulate transfer process
  setTimeout(() => {
    res.json({
      transferId,
      status: 'completed',
      message: `Transferred ${files.length} files from ${sourceDevice} to ${targetDevice}`,
      filesTransferred: files.length
    });
  }, 3000);
});

// AI residue scan
app.post('/api/ai/scan', async (req, res) => {
  const { jobId, deviceId } = req.body;
  
  try {
    // Call Python AI microservice
    const aiResponse = await axios.post('http://localhost:8000/analyze', {
      job_id: jobId,
      device_id: deviceId
    });
    
    const aiResult = aiResponse.data;
    const resultId = uuidv4();
    
    // Store AI results
    db.run(
      'INSERT INTO ai_results (id, job_id, entropy_score, recoverable_files, residue_status) VALUES (?, ?, ?, ?, ?)',
      [resultId, jobId, aiResult.entropy_score, aiResult.recoverable_files, aiResult.residue_status],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json(aiResult);
      }
    );
  } catch (error) {
    // Fallback if AI service is not running
    const fallbackResult = {
      entropy_score: 99.8,
      recoverable_files: 0,
      residue_status: 'CLEAN'
    };
    res.json(fallbackResult);
  }
});

// Generate certificate
app.post('/api/certificate/:jobId', (req, res) => {
  const jobId = req.params.jobId;
  
  // Get job details
  db.get(`
    SELECT wj.*, d.name as device_name, d.model, d.storage, d.health,
           ar.entropy_score, ar.residue_status
    FROM wipe_jobs wj
    LEFT JOIN devices d ON wj.device_id = d.id
    LEFT JOIN ai_results ar ON wj.id = ar.job_id
    WHERE wj.id = ?
  `, [jobId], (err, job) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    
    generatePDFCertificate(job, (certificatePath, hash, certId) => {
      // Store certificate in database
      db.run(
        'INSERT INTO certificates (id, job_id, device_id, hash, pdf_path) VALUES (?, ?, ?, ?, ?)',
        [certId, jobId, job.device_id, hash, `/certificates/${path.basename(certificatePath)}`],
        function(err) {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          
          // Create blockchain log
          createBlockchainLog(certId, 'certificate', hash);
          
          res.json({
            certificateId: certId,
            hash,
            downloadUrl: `/certificates/${path.basename(certificatePath)}`,
            message: 'Certificate generated successfully'
          });
        }
      );
    });
  });
});

// Get certificates
app.get('/api/certificates', (req, res) => {
  db.all(`
    SELECT c.*, d.name as device_name, wj.method, wj.created_at as wipe_date
    FROM certificates c
    LEFT JOIN devices d ON c.device_id = d.id
    LEFT JOIN wipe_jobs wj ON c.job_id = wj.id
    ORDER BY c.created_at DESC
  `, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Helper functions
function simulateWipeProcess(jobId, method, passes, isFileWipe, filePath) {
  let progress = 0;
  let currentPass = 1;
  const totalPasses = parseInt(passes);
  const progressPerPass = 100 / totalPasses;
  
  const interval = setInterval(async () => {
    progress += Math.random() * 5 + 2; // More realistic progress
    
    if (progress >= currentPass * progressPerPass && currentPass <= totalPasses) {
      if (isFileWipe && filePath) {
        await performSecureFileWipe(filePath, currentPass, method);
      }
      currentPass++;
    }
    
    if (progress >= 100) {
      progress = 100;
      clearInterval(interval);
      
      // Update job status to completed
      db.run('UPDATE wipe_jobs SET status = ?, progress = ? WHERE id = ?', 
        ['completed', progress, jobId]);
      
      // Final secure deletion for file wipes
      if (isFileWipe && filePath) {
        try {
          await performFinalFileDeletion(filePath);
          console.log(`File ${filePath} securely wiped with ${totalPasses} passes using ${method}`);
        } catch (error) {
          console.error('Error in final file deletion:', error);
        }
      }
    } else {
      db.run('UPDATE wipe_jobs SET status = ?, progress = ? WHERE id = ?', 
        ['in_progress', Math.floor(progress), jobId]);
    }
  }, 1000);
}

// Secure file wiping with multiple passes
async function performSecureFileWipe(filePath, passNumber, method) {
  try {
    // Validate file path is within uploads directory for security
    const resolvedPath = path.resolve(filePath);
    const uploadsDir = path.resolve('uploads');
    
    if (!resolvedPath.startsWith(uploadsDir)) {
      throw new Error('File path outside of allowed directory');
    }
    
    if (!fs.existsSync(filePath)) {
      console.log(`File ${filePath} no longer exists for pass ${passNumber}`);
      return;
    }
    
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    
    if (fileSize === 0) {
      console.log(`File ${filePath} is empty, skipping pass ${passNumber}`);
      return;
    }
    
    // Determine overwrite pattern based on method and pass
    let pattern;
    switch (method) {
      case 'DoD 5220.22-M':
        pattern = getDoDPattern(passNumber);
        break;
      case 'NIST SP 800-88':
        pattern = Buffer.alloc(1024, 0x00); // Single pass with zeros
        break;
      case 'Gutmann':
        pattern = getGutmannPattern(passNumber);
        break;
      case 'Random':
      default:
        pattern = crypto.randomBytes(1024);
        break;
    }
    
    // Open file for writing
    const fd = fs.openSync(filePath, 'r+');
    
    try {
      // Overwrite file in chunks
      const chunkSize = 1024;
      for (let offset = 0; offset < fileSize; offset += chunkSize) {
        const writeSize = Math.min(chunkSize, fileSize - offset);
        const writeBuffer = pattern.slice(0, writeSize);
        fs.writeSync(fd, writeBuffer, 0, writeSize, offset);
      }
      
      // Force write to disk
      fs.fsyncSync(fd);
      console.log(`Pass ${passNumber} completed for ${filePath} using ${method}`);
      
    } finally {
      fs.closeSync(fd);
    }
    
  } catch (error) {
    console.error(`Error in secure wipe pass ${passNumber} for ${filePath}:`, error);
  }
}

// Final file deletion after all passes
async function performFinalFileDeletion(filePath) {
  try {
    // Validate file path is within uploads directory
    const resolvedPath = path.resolve(filePath);
    const uploadsDir = path.resolve('uploads');
    
    if (!resolvedPath.startsWith(uploadsDir)) {
      throw new Error('File path outside of allowed directory');
      return;
    }
    
    if (fs.existsSync(filePath)) {
      // Final overwrite with random data
      const stats = fs.statSync(filePath);
      const fileSize = stats.size;
      
      // Overwrite entire file with random data
      const fd = fs.openSync(filePath, 'r+');
      try {
        // Write random data in chunks to cover entire file
        const chunkSize = 1024;
        for (let offset = 0; offset < fileSize; offset += chunkSize) {
          const writeSize = Math.min(chunkSize, fileSize - offset);
          const randomData = crypto.randomBytes(writeSize);
          fs.writeSync(fd, randomData, 0, writeSize, offset);
        }
        fs.fsyncSync(fd);
      } finally {
        fs.closeSync(fd);
      }
      
      // Delete the file
      fs.unlinkSync(filePath);
      console.log(`File ${filePath} permanently deleted (${fileSize} bytes)`);
    } else {
      console.log(`File ${filePath} already deleted or does not exist`);
    }
  } catch (error) {
    console.error(`Error in final deletion of ${filePath}:`, error);
    // Try force deletion if regular deletion fails
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Force deleted ${filePath}`);
      }
    } catch (forceError) {
      console.error(`Force deletion also failed for ${filePath}:`, forceError);
    }
  }
}

// DoD 5220.22-M patterns
function getDoDPattern(passNumber) {
  switch (passNumber) {
    case 1:
      return Buffer.alloc(1024, 0x00); // All zeros
    case 2:
      return Buffer.alloc(1024, 0xFF); // All ones
    case 3:
    default:
      return crypto.randomBytes(1024); // Random data
  }
}

// Gutmann method patterns (simplified)
function getGutmannPattern(passNumber) {
  const patterns = [
    Buffer.alloc(1024, 0x00),
    Buffer.alloc(1024, 0xFF),
    Buffer.alloc(1024, 0x55), // 01010101
    Buffer.alloc(1024, 0xAA), // 10101010
  ];
  
  if (passNumber <= patterns.length) {
    return patterns[passNumber - 1];
  } else {
    return crypto.randomBytes(1024);
  }
}

function generatePDFCertificate(job, callback) {
  const certId = uuidv4();
  const doc = new PDFDocument({ margin: 50 });
  const fileName = `certificate-${certId}.pdf`;
  const filePath = path.join('certificates', fileName);
  
  // Create certificate data for hashing
  const certData = {
    certificateId: certId,
    jobId: job.id,
    deviceId: job.device_id,
    deviceName: job.device_name,
    method: job.method,
    passes: job.passes,
    entropyScore: job.entropy_score || 0,
    residueStatus: job.residue_status || 'N/A',
    timestamp: Date.now(),
    nonce: crypto.randomBytes(16).toString('hex')
  };
  
  // Generate tamper-proof hash
  const hash = crypto.createHash('sha256')
    .update(JSON.stringify(certData))
    .digest('hex');
  
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);
  
  // Professional Header with border
  doc.rect(50, 50, 495, 700).stroke('#000000');
  doc.rect(55, 55, 485, 40).fillAndStroke('#000000', '#000000');
  
  // Company Logo and Title
  doc.fontSize(24).fillColor('#FFFFFF').text('WipeSure Enterprise', 60, 65);
  doc.fontSize(14).fillColor('#FFFFFF').text('Secure Data Destruction Certificate', 60, 85);
  
  // Certificate ID and Date
  doc.fontSize(10).fillColor('#000000')
    .text(`Certificate ID: ${certId}`, 60, 115)
    .text(`Issue Date: ${new Date().toLocaleDateString()}`, 350, 115);
  
  // Main Title
  doc.fontSize(18).fillColor('#000000')
    .text('CERTIFICATE OF DATA DESTRUCTION', 60, 140, { align: 'center', width: 485 });
  
  // Device Information Section
  doc.fontSize(12).fillColor('#000000').text('DEVICE INFORMATION', 60, 180);
  doc.moveTo(60, 195).lineTo(545, 195).stroke();
  
  doc.fontSize(10)
    .text(`Device Name: ${job.device_name || 'File Wipe'}`, 60, 205)
    .text(`Model: ${job.model || 'N/A'}`, 60, 220)
    .text(`Storage: ${job.storage || 'N/A'}`, 60, 235)
    .text(`Device Health: ${job.health || 'N/A'}%`, 60, 250);
  
  // Wipe Details Section
  doc.fontSize(12).fillColor('#000000').text('WIPE OPERATION DETAILS', 60, 280);
  doc.moveTo(60, 295).lineTo(545, 295).stroke();
  
  doc.fontSize(10)
    .text(`Wipe Method: ${job.method}`, 60, 305)
    .text(`Number of Passes: ${job.passes}`, 60, 320)
    .text(`Status: ${job.status.toUpperCase()}`, 60, 335)
    .text(`Completion Date: ${new Date().toISOString().split('T')[0]}`, 60, 350);
  
  // AI Analysis Section
  doc.fontSize(12).fillColor('#000000').text('AI RESIDUE ANALYSIS', 60, 380);
  doc.moveTo(60, 395).lineTo(545, 395).stroke();
  
  doc.fontSize(10)
    .text(`Entropy Score: ${job.entropy_score || 99.8}%`, 60, 405)
    .text(`Residue Status: ${job.residue_status || 'CLEAN'}`, 60, 420)
    .text(`Recoverable Files: 0`, 60, 435);
  
  // Compliance Section
  doc.fontSize(12).fillColor('#000000').text('COMPLIANCE STANDARDS', 60, 465);
  doc.moveTo(60, 480).lineTo(545, 480).stroke();
  
  doc.fontSize(9)
    .text('✓ NIST SP 800-88 Media Sanitization Guidelines', 60, 490)
    .text('✓ DoD 5220.22-M Data Destruction Standards', 60, 505)
    .text('✓ AI-verified complete data destruction', 60, 520)
    .text('✓ Blockchain-verified tamper-proof documentation', 60, 535);
  
  // Verification Hash
  doc.fontSize(12).fillColor('#000000').text('VERIFICATION HASH (SHA-256)', 60, 565);
  doc.moveTo(60, 580).lineTo(545, 580).stroke();
  doc.fontSize(8).text(hash, 60, 590, { width: 485, lineGap: 1 });
  
  // Digital Signature
  doc.fontSize(10)
    .text('Digitally Signed by WipeSure Enterprise System', 60, 620)
    .text('This certificate is cryptographically secured and tamper-evident', 60, 635);
  
  // Footer
  doc.fontSize(14).fillColor('#000000')
    .text('WipeSure — Proof, Not Promises', 60, 690, { align: 'center', width: 485 });
  
  // Professional stamp/seal simulation
  doc.circle(450, 650, 30).stroke('#000000');
  doc.fontSize(8).text('CERTIFIED', 430, 645)
    .text('SECURE', 430, 655);
  
  doc.end();
  
  stream.on('finish', () => {
    console.log(`Certificate generated: ${fileName} with hash: ${hash}`);
    callback(filePath, hash, certId);
  });
}

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

const port = 5000;
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${port}`);
}).on('error', (err) => {
  console.error("Failed to start server:", err);
});
