# WipeSure Enterprise Dashboard

## Overview

WipeSure is a comprehensive data security and management platform designed to provide secure data wiping, backup, transfer, and compliance services. The system is built for enterprise environments requiring tamper-proof data destruction with verifiable certificates and AI-powered residue analysis. It features a futuristic cybersecurity-themed interface and supports multi-device management for large-scale operations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Technology Stack**: Pure HTML5, CSS3, and vanilla JavaScript (no frameworks)
- **Design Pattern**: Single Page Application (SPA) with component-based navigation
- **UI Theme**: Futuristic cybersecurity aesthetic with dark mode, glowing elements, and neon accents
- **Navigation**: Sidebar-based navigation with dynamic page switching
- **Key Pages**: Dashboard, Data Wipe, Data Backup, Data Transfer, AI Residue Scan, Certificates, Compliance, Multi-Device Management, Settings

### Backend Architecture
- **Primary Server**: Node.js with Express.js framework
- **API Design**: RESTful API architecture with JSON communication
- **File Handling**: Multer middleware for file uploads with disk storage
- **Cross-Origin Support**: CORS enabled for frontend-backend communication
- **Static File Serving**: Express static middleware for uploads and certificates

### Data Storage Solutions
- **Primary Database**: SQLite3 for lightweight, embedded database operations
- **Database Schema**: Tables for devices, wipe jobs, backup operations, transfers, and certificates
- **File Storage**: Local filesystem storage for uploaded files, generated certificates, and temporary data
- **Directory Structure**: Organized folders for uploads, certificates, and temporary files

### AI Integration
- **AI Service**: Separate Python Flask microservice for residue analysis
- **Communication**: HTTP API calls between Node.js backend and Python AI service
- **Functionality**: Entropy calculation, recoverable file detection, and residue status determination
- **Analysis Engine**: ResidueAnalyzer class with configurable entropy thresholds

### Security and Compliance
- **Certificate Generation**: PDF-based tamper-proof certificates using PDFKit
- **Encryption**: Crypto module for secure operations and unique identifiers
- **File Security**: Multi-pass secure deletion simulation with progress tracking
- **Compliance Standards**: NIST SP 800-88 compliance integration

### External Dependencies

- **Node.js Runtime Environment**: Core JavaScript runtime for backend operations
- **Express.js Framework**: Web application framework for API endpoints and routing
- **SQLite3 Database**: Embedded SQL database for data persistence
- **Python Flask**: Microservice framework for AI residue analysis
- **Multer**: File upload handling middleware
- **PDFKit**: PDF document generation for certificates
- **UUID**: Unique identifier generation for jobs and devices
- **Axios**: HTTP client for API communications
- **CORS**: Cross-origin resource sharing middleware
- **Crypto**: Node.js cryptographic functionality
- **FS-Extra**: Enhanced file system operations
- **BCrypt**: Password hashing and security (configured but not actively used)
- **Nodemailer**: Email service integration for backup notifications