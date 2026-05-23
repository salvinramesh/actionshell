# ActionShell

<div align="center">
  <img src="resources/icons/icon.png" width="80" height="80" alt="ActionShell Logo" />
  <h3>Enterprise SSH & SFTP Management Platform</h3>
  <p>A secure, cross-platform SSH client with team collaboration, RBAC, and SFTP file management</p>

  [![GitHub release](https://img.shields.io/github/v/release/actionshell-app/actionshell)](https://github.com/actionshell-app/actionshell/releases)
  [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE.md)
  [![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20Linux-lightgrey)]()
</div>

---

## 📥 Download

Go to the **[Releases](../../releases)** page to download the latest version.

| Platform | Installer |
|----------|-----------|
| 🪟 **Windows** | `ActionShell-x.x.x-Setup-x64.exe` |
| 🪟 **Windows Portable** | `ActionShell-x.x.x-x64.zip` |
| 🐧 **Linux (AppImage)** | `ActionShell-x.x.x-x64.AppImage` |
| 🐧 **Linux (Debian/Ubuntu)** | `actionshell_x.x.x_amd64.deb` |

## ✨ Features

### Core
- 🔐 **Secure Credential Vault** — AES-256-GCM encryption, OS keychain storage
- 🖥️ **Multi-tab Terminal** — GPU-accelerated xterm.js with split-pane SFTP
- 📁 **Integrated SFTP** — Full file manager with drag-and-drop, progress tracking
- 🔑 **SSH Key Support** — RSA, ED25519, PEM, PPK, OpenSSH, passphrase-protected

### Enterprise
- 👥 **Role-Based Access Control** — Super Admin, Admin, Standard, Read-only
- 🛡️ **Audit Logging** — Append-only compliance log for all actions
- 👁️ **Live Session Monitoring** — Admin dashboard showing all active connections
- 🔒 **Server ACLs** — Per-server per-user access grants with expiry
- 🧩 **Snippet Palette** — Reusable commands with variable interpolation (Ctrl+Shift+P)

### UX
- 🌙 **Dark/Light themes** — Premium "Command Center" aesthetic
- 📌 **Favorites & Groups** — Organize servers with folders, tags, colors
- 🔍 **Fuzzy Search** — Search by hostname, username, IP, or tag
- 🌉 **Jump Host / Bastion** — ProxyJump support built-in
- ⌨️ **Keyboard-first** — Full keyboard navigation

## 🚀 Quick Start

### Windows
1. Download `ActionShell-Setup-x64.exe` from Releases
2. Run the installer and follow prompts
3. Launch ActionShell from the Start Menu
4. Create your Super Admin account on first run

### Linux (AppImage)
```bash
chmod +x ActionShell-*.AppImage
./ActionShell-*.AppImage
```

### Linux (Debian/Ubuntu)
```bash
sudo dpkg -i actionshell_*_amd64.deb
actionshell
```

## 🏗️ Development

```bash
# Install dependencies
npm install --legacy-peer-deps

# Start dev server
npm run dev

# Build production
npm run build

# Package installers
npm run build:linux   # .deb + .AppImage
npm run build:win     # .exe + .zip (requires Windows or Wine)
```

## 🔒 Security

- All passwords and SSH keys encrypted with **AES-256-GCM**
- Encryption key stored in OS keychain (`safeStorage`)
- Brute-force protection (5 attempts → 15 min lockout)
- Session auto-lock with configurable timeout
- No telemetry, no cloud sync — 100% local data

## 📄 License

MIT © 2025 ActionShell
