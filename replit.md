# GhostNet — P2P Secure Chat

## Project Overview

A zero-knowledge, peer-to-peer encrypted chat ecosystem. The server is a pure WebRTC signaling relay — it never stores, reads, or logs any message content. All chat data lives exclusively on users' devices and auto-destructs after 12 hours.

### Stack
- **Server**: Node.js 20, Express 4, Socket.IO 4
- **Database**: SQLite via `better-sqlite3` (Windows/Electron) / `react-native-sqlite-storage` (Mobile)
- **Encryption**: AES-256-GCM (E2EE, client-side — server is zero-knowledge)
- **Frontend**: Vanilla HTML/CSS/JS served statically (Tailwind CDN, inline SVGs)

### Architecture

```
server/
├── index.js                  Main server — Express + Socket.IO signaling + startup wiring
├── public/
│   ├── index.html            Dark-mode GhostNet landing page (OS-detection, all sections)
│   └── hero-network.png      AI-generated hero image
├── db/
│   └── schema.sql            Universal SQLite schema (peers, messages, link_metadata)
├── lib/
│   ├── db.js                 SQLite connection, schema init, health check
│   ├── protocol.js           Standardized P2P JSON payload factories + validation
│   ├── messageController.js  saveIncomingMessage / processViewOnceMedia / fetchSecureLinkPreview
│   └── purgeJob.js           12-hour rolling purge job (messages + media files)
├── data/
│   └── ghostnet.db           SQLite database file (gitignored in production)
└── media/                    Encrypted media file storage (auto-purged)
```

### Key Endpoints
- `GET /`        — Landing page
- `GET /health`  — DB health check + server status
- `WS /`         — Socket.IO signaling (join-signaling, signal, check-peer events)

### Running
```bash
node server/index.js
```

## User Preferences
- Dark mode first design — GhostNet brand (sky-400 blue / purple-500 gradient)
- Zero-knowledge constraint must be strictly maintained — no message logging anywhere in the server
- Schema must remain compatible with both better-sqlite3 and react-native-sqlite-storage
- No frontend build system for the main app — plain HTML served statically
