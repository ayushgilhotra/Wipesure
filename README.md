🛡️ WipeSure – Secure Data Wiping & Verification System

WipeSure is a secure data wiping solution designed to permanently delete sensitive files and storage data using industry-level wiping standards. The main goal of this project is to ensure that deleted data cannot be recovered using forensic recovery tools.

This project was built as a prototype to demonstrate how secure wiping, logging, and verification can be combined into a single platform that is easy to use and audit.

🚀 Why WipeSure?

Normal delete operations (Shift + Delete, formatting drives, recycling bin delete, etc.) do not actually remove data permanently. Most of the time, the data still exists on disk and can be recovered using recovery software.

WipeSure solves this problem by securely overwriting the storage blocks using multiple passes, ensuring data is destroyed beyond recovery.

🔥 Key Features
✅ Secure wiping based on DoD 5220.22-M wiping standard
✅ Multiple overwrite passes to prevent data recovery
✅ Verification after wiping to confirm successful deletion
✅ Wipe logs and wiping report generation
✅ Simple user-friendly interface (Web + Desktop)
✅ Desktop application support (Electron-based)
✅ Certificate/report storage (PDF format)
✅ Backend API for wipe operations and reporting
🏗️ Project Structure
WipeSure/
│
├── frontend/              # Website UI (Login, Signup, Dashboard)
│   ├── index.html
│   ├── login.html
│   ├── signup.html
│   ├── script.js
│   └── styles.css
│
├── desktop-app/           # Electron desktop application
│   ├── index.html
│   ├── main.js
│   └── preload.js
│
├── desktop-package/       # Packaged desktop build files
│
├── certificates/          # Auto-generated wipe certificates (PDFs)
│
├── server.js              # Node.js backend server
├── ai_service.py          # AI-based analysis service (optional module)
├── package.json
└── pyproject.toml
⚙️ Tech Stack Used
Frontend
HTML
CSS
JavaScript
Backend
Node.js
Express.js
Desktop App
Electron.js
Extra / Optional
Python AI module (ai_service.py)
📌 How WipeSure Works

The system follows a clear wiping workflow:

User selects a file/folder/drive for wiping
WipeSure overwrites the data in multiple passes
A verification step confirms wiping completion
A wipe certificate/report is generated
The certificate is stored for future audit

This ensures the wiping process is not only secure but also trackable.

👨‍💻 Author
Ayush Gilhotra
Project: WipeSure (Secure Data Wiping Prototype)
