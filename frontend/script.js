// WipeSure Enterprise Dashboard - JavaScript
class WipeSureApp {
    constructor() {
        this.currentPage = 'dashboard';
        this.currentWipeJob = null;
        this.devices = [];
        this.wipeJobs = [];
        this.certificates = [];
        this.radarAnimation = null;
        this.wipeCompleted = false;
        
        this.initializeApp();
    }

    async initializeApp() {
        this.setupEventListeners();
        this.setupNavigation();
        await this.loadDashboardData();
        await this.loadDevices();
        this.populateDeviceSelectors();
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = e.target.closest('.nav-link').dataset.page;
                this.navigateToPage(page);
            });
        });

        // Data Wipe Page
        document.querySelectorAll('input[name="wipeType"]').forEach(radio => {
            radio.addEventListener('change', this.handleWipeTypeChange.bind(this));
        });

        document.getElementById('file-input').addEventListener('change', this.handleFileSelection.bind(this));
        document.getElementById('file-upload').addEventListener('click', () => {
            document.getElementById('file-input').click();
        });

        document.getElementById('start-wipe').addEventListener('click', this.startWipeJob.bind(this));

        // Data Backup Page
        document.getElementById('start-backup').addEventListener('click', this.startBackup.bind(this));

        // Data Transfer Page
        document.getElementById('start-transfer').addEventListener('click', this.startTransfer.bind(this));

        // AI Scan Page
        document.getElementById('start-ai-scan').addEventListener('click', this.startAIScan.bind(this));

        // Certificates Page
        document.getElementById('refresh-certificates').addEventListener('click', this.loadCertificates.bind(this));

        // Multi-Device Page
        document.getElementById('batch-wipe').addEventListener('click', this.startBatchWipe.bind(this));
        document.getElementById('select-all-devices').addEventListener('click', this.selectAllDevices.bind(this));

        // Settings Page
        document.getElementById('save-settings').addEventListener('click', this.saveSettings.bind(this));

        // Drag and drop for file upload
        const fileUpload = document.getElementById('file-upload');
        fileUpload.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileUpload.style.background = 'rgba(0, 255, 65, 0.1)';
        });

        fileUpload.addEventListener('dragleave', () => {
            fileUpload.style.background = '';
        });

        fileUpload.addEventListener('drop', (e) => {
            e.preventDefault();
            fileUpload.style.background = '';
            const files = e.dataTransfer.files;
            this.handleFileSelection({ target: { files } });
        });
    }

    setupNavigation() {
        // Set initial page
        this.navigateToPage('dashboard');
    }

    navigateToPage(pageId) {
        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[data-page="${pageId}"]`).classList.add('active');

        // Update page content
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        document.getElementById(pageId).classList.add('active');

        // Update header
        const pageTitle = pageId.split('-').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
        document.getElementById('page-title').textContent = pageTitle;
        document.getElementById('current-page').textContent = pageTitle;

        this.currentPage = pageId;

        // Load page-specific data
        this.loadPageData(pageId);
    }

    async loadPageData(pageId) {
        switch(pageId) {
            case 'dashboard':
                await this.loadDashboardData();
                break;
            case 'certificates':
                await this.loadCertificates();
                break;
            case 'multi-device':
                await this.loadMultiDeviceView();
                break;
        }
    }

    async loadDashboardData() {
        try {
            const response = await fetch('/api/dashboard');
            const data = await response.json();
            
            document.getElementById('total-devices').textContent = data.total_devices || 0;
            document.getElementById('total-wipes').textContent = data.total_wipes || 0;
            document.getElementById('total-certificates').textContent = data.total_certificates || 0;
            document.getElementById('active-wipes').textContent = data.active_wipes || 0;

            await this.loadRecentJobs();
            await this.loadDeviceStatus();
        } catch (error) {
            console.error('Error loading dashboard data:', error);
        }
    }

    async loadRecentJobs() {
        try {
            const response = await fetch('/api/wipe-jobs');
            this.wipeJobs = await response.json();
            
            const recentJobsContainer = document.getElementById('recent-jobs');
            recentJobsContainer.innerHTML = '';

            this.wipeJobs.slice(0, 5).forEach(job => {
                const jobElement = document.createElement('div');
                jobElement.className = 'job-item';
                jobElement.innerHTML = `
                    <div class="job-info">
                        <strong>${job.device_name || 'Unknown Device'}</strong>
                        <span class="job-method">${job.method}</span>
                    </div>
                    <div class="job-status status-${job.status}">
                        ${job.status.toUpperCase()}
                        ${job.status === 'in_progress' ? `(${job.progress}%)` : ''}
                    </div>
                `;
                recentJobsContainer.appendChild(jobElement);
            });
        } catch (error) {
            console.error('Error loading recent jobs:', error);
        }
    }

    async loadDevices() {
        try {
            const response = await fetch('/api/devices');
            this.devices = await response.json();
        } catch (error) {
            console.error('Error loading devices:', error);
            this.devices = [];
        }
    }

    async loadDeviceStatus() {
        const deviceListContainer = document.getElementById('device-list');
        deviceListContainer.innerHTML = '';

        this.devices.forEach(device => {
            const deviceElement = document.createElement('div');
            deviceElement.className = 'device-card';
            deviceElement.innerHTML = `
                <div class="device-info">
                    <h4>${device.name}</h4>
                    <p>${device.model}</p>
                    <p>${device.storage}</p>
                </div>
                <div class="device-health">
                    <div class="health-bar">
                        <div class="health-fill" style="width: ${device.health}%"></div>
                    </div>
                    <span>${device.health}% Health</span>
                </div>
            `;
            deviceListContainer.appendChild(deviceElement);
        });
    }

    populateDeviceSelectors() {
        const selectors = [
            'device-select',
            'backup-device-select',
            'source-device-select',
            'target-device-select',
            'ai-device-select'
        ];

        selectors.forEach(selectorId => {
            const select = document.getElementById(selectorId);
            if (select) {
                select.innerHTML = '<option value="">Select Device...</option>';
                this.devices.forEach(device => {
                    const option = document.createElement('option');
                    option.value = device.id;
                    option.textContent = `${device.name} (${device.model})`;
                    select.appendChild(option);
                });
            }
        });
    }

    handleWipeTypeChange(e) {
        const wipeType = e.target.value;
        const fileUpload = document.getElementById('file-upload');
        const deviceSelector = document.getElementById('device-selector');

        if (wipeType === 'file') {
            fileUpload.style.display = 'block';
            deviceSelector.style.display = 'none';
        } else {
            fileUpload.style.display = 'none';
            deviceSelector.style.display = 'block';
        }
    }

    handleFileSelection(e) {
        const files = e.target.files;
        const fileUpload = document.getElementById('file-upload');
        
        if (files.length > 0) {
            const fileList = Array.from(files).map(file => file.name).join(', ');
            
            // Create a status display without removing the file input
            let statusDiv = fileUpload.querySelector('.file-status');
            if (!statusDiv) {
                statusDiv = document.createElement('div');
                statusDiv.className = 'file-status';
                fileUpload.appendChild(statusDiv);
            }
            
            statusDiv.innerHTML = `
                <i class="fas fa-check-circle"></i>
                <p>Selected: ${fileList}</p>
                <p class="file-count">${files.length} file(s) selected</p>
            `;
            
            fileUpload.style.borderColor = 'var(--primary-color)';
            
            // Hide the original content but keep the input
            const originalContent = fileUpload.querySelector('p');
            const originalIcon = fileUpload.querySelector('i');
            if (originalContent) originalContent.style.display = 'none';
            if (originalIcon) originalIcon.style.display = 'none';
        }
    }

    // 🔒 Modified here
    async startWipeJob() {
        const wipeType = document.querySelector('input[name="wipeType"]:checked').value;

        if (wipeType === 'file') {
            const fileInput = document.getElementById('file-input');
            if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
                alert('Please select a file first.');
                return;
            }
        } else {
            const deviceId = document.getElementById('device-select').value;
            if (!deviceId) {
                alert('Please select a device first.');
                return;
            }
        }

        // Instead of starting a wipe, show security popup
        alert("⚠️ For security reasons, file deletion must be done using the Desktop App.\n\nPlease download and use the Desktop App to securely delete files and generate certificates.");
    }

    showWipeProgress() {
        const progressContainer = document.getElementById('wipe-progress');
        const method = document.getElementById('wipe-method').value;
        const passes = document.getElementById('wipe-passes').value;

        document.getElementById('current-method').textContent = method;
        document.getElementById('total-passes').textContent = passes;
        
        progressContainer.style.display = 'block';
        progressContainer.scrollIntoView({ behavior: 'smooth' });
    }

    async monitorWipeProgress() {
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        const wipeStatus = document.getElementById('wipe-status');
        const currentPass = document.getElementById('current-pass');

        const interval = setInterval(async () => {
            try {
                const response = await fetch(`/api/wipe/${this.currentWipeJob}`);
                const job = await response.json();

                progressFill.style.width = `${job.progress}%`;
                progressText.textContent = `${job.progress}%`;
                wipeStatus.textContent = job.status.replace('_', ' ').toUpperCase();

                // Calculate current pass based on progress
                const passes = parseInt(document.getElementById('total-passes').textContent);
                const calculatedPass = Math.min(Math.ceil((job.progress / 100) * passes), passes);
                currentPass.textContent = calculatedPass;

                if (job.status === 'completed' && !this.wipeCompleted) {
                    clearInterval(interval);
                    wipeStatus.textContent = 'COMPLETED';
                    this.wipeCompleted = true;
                    this.showWipeCompletion();
                }
            } catch (error) {
                console.error('Error monitoring wipe progress:', error);
                clearInterval(interval);
            }
        }, 1000);
    }

    showWipeCompletion() {
        const progressContainer = document.getElementById('wipe-progress');
        
        // Check if completion message already exists to prevent duplicates
        if (progressContainer.querySelector('.completion-message')) {
            return; // Already shown, don't add again
        }
        
        const completionMessage = document.createElement('div');
        completionMessage.className = 'completion-message';
        completionMessage.innerHTML = `
            <div class="success-icon">
                <i class="fas fa-check-circle"></i>
            </div>
            <h3>Wipe Completed Successfully</h3>
            <p>Data has been securely wiped according to ${document.getElementById('current-method').textContent} standards.</p>
            <button class="btn-primary" onclick="app.generateCertificate()">
                <i class="fas fa-certificate"></i> Generate Certificate
            </button>
        `;
        progressContainer.appendChild(completionMessage);
    }

    async generateCertificate() {
        if (!this.currentWipeJob) {
            alert('No active wipe job to generate certificate for.');
            return;
        }

        try {
            const response = await fetch(`/api/certificate/${this.currentWipeJob}`, {
                method: 'POST'
            });

            const result = await response.json();
            
            if (result.downloadUrl) {
                const link = document.createElement('a');
                link.href = result.downloadUrl;
                link.download = `certificate-${this.currentWipeJob}.pdf`;
                link.click();
                
                alert('Certificate generated and downloaded successfully!');
                
                // Reset the file upload area and clear selection
                this.resetFileUploadArea();
                this.currentWipeJob = null;
                this.wipeCompleted = false;
            }
        } catch (error) {
            console.error('Error generating certificate:', error);
            alert('Failed to generate certificate. Please try again.');
        }
    }

    resetFileUploadArea() {
        // Clear file input
        const fileInput = document.getElementById('file-input');
        if (fileInput) {
            fileInput.value = '';
        }
        
        // Reset file upload area UI
        const fileUpload = document.getElementById('file-upload');
        if (fileUpload) {
            // Remove file status if it exists
            const fileStatus = fileUpload.querySelector('.file-status');
            if (fileStatus) {
                fileStatus.remove();
            }
            
            // Show original content
            const originalContent = fileUpload.querySelector('p');
            const originalIcon = fileUpload.querySelector('i');
            if (originalContent) originalContent.style.display = 'block';
            if (originalIcon) originalIcon.style.display = 'block';
            
            // Reset border color
            fileUpload.style.borderColor = 'var(--border-color)';
        }
        
        // Hide progress container
        const progressContainer = document.getElementById('wipe-progress');
        if (progressContainer) {
            progressContainer.style.display = 'none';
            
            // Clear any completion messages
            const completionMessages = progressContainer.querySelectorAll('.completion-message');
            completionMessages.forEach(msg => msg.remove());
        }
        
        // Reset progress values
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        if (progressFill) progressFill.style.width = '0%';
        if (progressText) progressText.textContent = '0%';
    }

    async startBackup() {
        const email = document.getElementById('backup-email').value;
        const deviceId = document.getElementById('backup-device-select').value;
        const backupType = document.getElementById('backup-type').value;

        if (!email || !deviceId) {
            alert('Please fill in all required fields.');
            return;
        }

        try {
            const response = await fetch('/api/backup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, deviceId, backupType })
            });

            const result = await response.json();
            
            const statusDiv = document.getElementById('backup-status');
            statusDiv.style.display = 'block';
            statusDiv.className = 'status-display success';
            statusDiv.innerHTML = `
                <i class="fas fa-check-circle"></i>
                <h4>Backup Completed</h4>
                <p>${result.message}</p>
                <p><strong>Backup Size:</strong> ${result.size}</p>
            `;
        } catch (error) {
            console.error('Error starting backup:', error);
            const statusDiv = document.getElementById('backup-status');
            statusDiv.style.display = 'block';
            statusDiv.className = 'status-display error';
            statusDiv.innerHTML = `
                <i class="fas fa-exclamation-circle"></i>
                <h4>Backup Failed</h4>
                <p>Failed to complete backup. Please try again.</p>
            `;
        }
    }

    async startTransfer() {
        const sourceDevice = document.getElementById('source-device-select').value;
        const targetDevice = document.getElementById('target-device-select').value;
        const fileTypes = Array.from(document.querySelectorAll('.checkbox-group input:checked'))
            .map(cb => cb.value);

        if (!sourceDevice || !targetDevice) {
            alert('Please select both source and target devices.');
            return;
        }

        if (sourceDevice === targetDevice) {
            alert('Source and target devices cannot be the same.');
            return;
        }

        if (fileTypes.length === 0) {
            alert('Please select at least one file type to transfer.');
            return;
        }

        try {
            const response = await fetch('/api/transfer', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    sourceDevice, 
                    targetDevice, 
                    files: fileTypes 
                })
            });

            const result = await response.json();
            
            const statusDiv = document.getElementById('transfer-status');
            statusDiv.style.display = 'block';
            statusDiv.className = 'status-display success';
            statusDiv.innerHTML = `
                <i class="fas fa-check-circle"></i>
                <h4>Transfer Completed</h4>
                <p>${result.message}</p>
                <p><strong>Files Transferred:</strong> ${result.filesTransferred}</p>
            `;
        } catch (error) {
            console.error('Error starting transfer:', error);
        }
    }

    async startAIScan() {
        const deviceId = document.getElementById('ai-device-select').value;
        
        if (!deviceId) {
            alert('Please select a device to scan.');
            return;
        }

        const radarContainer = document.getElementById('radar-container');
        radarContainer.style.display = 'flex';
        
        this.startRadarAnimation();

        try {
            const response = await fetch('/api/ai/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    jobId: this.currentWipeJob || 'scan-' + Date.now(),
                    deviceId 
                })
            });

            const result = await response.json();
            
            setTimeout(() => {
                this.stopRadarAnimation();
                this.displayAIResults(result);
            }, 5000);
            
        } catch (error) {
            console.error('Error starting AI scan:', error);
            this.stopRadarAnimation();
        }
    }

    startRadarAnimation() {
        const canvas = document.getElementById('radar-canvas');
        const ctx = canvas.getContext('2d');
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = 180;

        let angle = 0;
        const dots = [];

        // Generate random dots
        for (let i = 0; i < 50; i++) {
            dots.push({
                x: centerX + (Math.random() - 0.5) * radius * 2,
                y: centerY + (Math.random() - 0.5) * radius * 2,
                intensity: Math.random(),
                type: Math.floor(Math.random() * 4)
            });
        }

        this.radarAnimation = setInterval(() => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Draw radar circles
            ctx.strokeStyle = 'rgba(0, 255, 65, 0.3)';
            ctx.lineWidth = 1;
            for (let r = 40; r <= radius; r += 40) {
                ctx.beginPath();
                ctx.arc(centerX, centerY, r, 0, 2 * Math.PI);
                ctx.stroke();
            }
            
            // Draw crosshairs
            ctx.beginPath();
            ctx.moveTo(centerX, centerY - radius);
            ctx.lineTo(centerX, centerY + radius);
            ctx.moveTo(centerX - radius, centerY);
            ctx.lineTo(centerX + radius, centerY);
            ctx.stroke();
            
            // Draw dots
            dots.forEach(dot => {
                const distance = Math.sqrt(Math.pow(dot.x - centerX, 2) + Math.pow(dot.y - centerY, 2));
                if (distance <= radius) {
                    ctx.fillStyle = `rgba(0, 255, 65, ${dot.intensity})`;
                    ctx.beginPath();
                    ctx.arc(dot.x, dot.y, 2, 0, 2 * Math.PI);
                    ctx.fill();
                }
            });
            
            angle += 2;
        }, 50);
    }

    stopRadarAnimation() {
        if (this.radarAnimation) {
            clearInterval(this.radarAnimation);
            this.radarAnimation = null;
        }
    }

    displayAIResults(results) {
        document.getElementById('entropy-score').textContent = `${results.entropy_score}%`;
        document.getElementById('recoverable-files').textContent = results.recoverable_files;
        document.getElementById('residue-status').textContent = results.residue_status;
        
        // Update color based on status
        const statusElement = document.getElementById('residue-status');
        statusElement.className = '';
        if (results.residue_status === 'CLEAN') {
            statusElement.style.color = 'var(--primary-color)';
        } else if (results.residue_status === 'MOSTLY_CLEAN') {
            statusElement.style.color = 'var(--warning-color)';
        } else {
            statusElement.style.color = 'var(--danger-color)';
        }
    }

    async loadCertificates() {
        try {
            const response = await fetch('/api/certificates');
            this.certificates = await response.json();
            
            const certificatesContainer = document.getElementById('certificates-list');
            certificatesContainer.innerHTML = '';

            this.certificates.forEach(cert => {
                const certElement = document.createElement('div');
                certElement.className = 'certificate-card';
                certElement.innerHTML = `
                    <div class="cert-header">
                        <h4>Certificate #${cert.id.substring(0, 8)}</h4>
                        <span class="cert-date">${new Date(cert.created_at).toLocaleDateString()}</span>
                    </div>
                    <div class="cert-details">
                        <p><strong>Device:</strong> ${cert.device_name}</p>
                        <p><strong>Method:</strong> ${cert.method}</p>
                        <p><strong>Hash:</strong> ${cert.hash.substring(0, 16)}...</p>
                    </div>
                    <div class="cert-actions">
                        <button class="btn-primary" onclick="app.downloadCertificate('${cert.pdf_path}')">
                            <i class="fas fa-download"></i> Download
                        </button>
                    </div>
                `;
                certificatesContainer.appendChild(certElement);
            });
        } catch (error) {
            console.error('Error loading certificates:', error);
        }
    }

    downloadCertificate(pdfPath) {
        const link = document.createElement('a');
        link.href = pdfPath;
        link.download = pdfPath.split('/').pop();
        link.click();
    }

    async loadMultiDeviceView() {
        const gridContainer = document.getElementById('multi-device-grid');
        gridContainer.innerHTML = '';

        this.devices.forEach(device => {
            const deviceElement = document.createElement('div');
            deviceElement.className = 'device-card';
            deviceElement.dataset.deviceId = device.id;
            deviceElement.innerHTML = `
                <div class="device-header">
                    <input type="checkbox" class="device-checkbox">
                    <h4>${device.name}</h4>
                </div>
                <div class="device-info">
                    <p>${device.model}</p>
                    <p>${device.storage}</p>
                    <div class="device-health">
                        <span>${device.health}% Health</span>
                    </div>
                </div>
                <div class="device-status">
                    <span class="status-idle">Idle</span>
                </div>
            `;
            
            deviceElement.addEventListener('click', (e) => {
                if (e.target.type !== 'checkbox') {
                    const checkbox = deviceElement.querySelector('.device-checkbox');
                    checkbox.checked = !checkbox.checked;
                    deviceElement.classList.toggle('selected', checkbox.checked);
                }
            });
            
            gridContainer.appendChild(deviceElement);
        });
    }

    selectAllDevices() {
        const checkboxes = document.querySelectorAll('.device-checkbox');
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        
        checkboxes.forEach(cb => {
            cb.checked = !allChecked;
            cb.closest('.device-card').classList.toggle('selected', cb.checked);
        });
    }

    async startBatchWipe() {
        const selectedDevices = Array.from(document.querySelectorAll('.device-checkbox:checked'))
            .map(cb => cb.closest('.device-card').dataset.deviceId);
        
        if (selectedDevices.length === 0) {
            alert('Please select at least one device.');
            return;
        }

        for (const deviceId of selectedDevices) {
            try {
                const formData = new FormData();
                formData.append('deviceId', deviceId);
                formData.append('method', 'DoD 5220.22-M');
                formData.append('passes', '3');
                formData.append('wipeType', 'device');

                const response = await fetch('/api/wipe', {
                    method: 'POST',
                    body: formData
                });

                const result = await response.json();
                console.log(`Started wipe job ${result.jobId} for device ${deviceId}`);
            } catch (error) {
                console.error(`Error starting wipe for device ${deviceId}:`, error);
            }
        }

        alert(`Batch wipe started for ${selectedDevices.length} devices.`);
    }

    saveSettings() {
        const defaultMethod = document.getElementById('default-wipe-method').value;
        const aiEnabled = document.getElementById('ai-toggle').checked;
        const cloudApiKey = document.getElementById('cloud-api-key').value;

        // Save to localStorage (in a real app, this would be saved to the backend)
        localStorage.setItem('wipesure-settings', JSON.stringify({
            defaultMethod,
            aiEnabled,
            cloudApiKey: cloudApiKey ? '****' : ''  // Don't actually store the key
        }));

        alert('Settings saved successfully!');
    }
}

// Initialize the application
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new WipeSureApp();
});
