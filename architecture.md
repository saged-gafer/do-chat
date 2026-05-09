# P2P Secure Chat Ecosystem Architecture

## 1. System Overview

This ecosystem is designed for maximum privacy and security, using a Zero-Knowledge signaling server and a decentralized P2P communication model.

### Components:
- **Central Web Server**: Node.js/Express app for landing page, OS detection, and WebRTC signaling.
- **Client Application**: Cross-platform app (Desktop & Mobile) that handles all data storage, encryption, and P2P communication.

## 2. Step-by-Step Flow

1.  **Discovery & Download**:
    - User A visits `https://secure-chat.com`.
    - Server detects User A's OS (Windows/Android/iOS) via `User-Agent`.
    - User A downloads and installs the platform-specific build.
2.  **App Initialization**:
    - User A opens the app. A local SQLite database is initialized.
    - User A generates a temporary cryptographic identity (e.g., Ed25519 key pair).
3.  **Signaling Connection**:
    - User A connects to the Central Web Server via Socket.IO.
    - User A receives a short-lived, unique Signaling ID.
4.  **Initiating Connection**:
    - User A shares their Signaling ID with User B (via an external secure channel or QR code).
    - User B enters User A's ID in their app.
5.  **WebRTC Handshake (Signaling)**:
    - User B sends a "join" request to the Signaling Server with User A's ID.
    - The Server facilitates the exchange of SDP (Session Description Protocol) offers/answers and ICE candidates.
    - **Note**: The server only relays these encrypted blobs; it cannot read them.
6.  **P2P Establishment**:
    - Once the WebRTC handshake is complete, a direct P2P Data Channel is established between User A and User B.
    - The signaling connection can be closed or kept idle for future hole-punching if needed.
7.  **Secure Communication**:
    - All messages and media are encrypted locally using E2EE (e.g., AES-256-GCM) before being sent over the P2P channel.
    - The Central Server never sees the message content.

## 3. Technology Stack Recommendation

### Mobile (Android/iOS)
- **Framework**: React Native.
- **Reasoning**: Allows for high-performance native modules, widespread community support for WebRTC (`react-native-webrtc`), and robust local storage (`react-native-sqlite-storage`).
- **Security**: Provides native APIs for "Anti-Screenshot" (e.g., `FLAG_SECURE` on Android).

### Desktop (Windows)
- **Framework**: Tauri (preferred over Electron).
- **Reasoning**:
    - **Security**: Smaller attack surface. The frontend is isolated from the system; system calls go through a secure Rust-based bridge.
    - **Performance**: Significantly smaller binary size and memory footprint compared to Electron.
    - **Native SQLite**: Rust-based backend can handle SQLite operations extremely fast and securely.

### Signaling Server
- **Runtime**: Node.js.
- **Library**: Socket.IO for real-time, bidirectional communication.
- **Infrastructure**: Cloud-hosted (AWS/GCP/DigitalOcean) with a focus on high availability but zero data persistence.

## 4. Security Measures

- **Zero-Knowledge Signaling**: The server never stores message logs, metadata, or IP mappings longer than the session duration.
- **Local-Only Storage**: SQLite database remains strictly on the user's device.
- **12-Hour Purge**: A local cron job ensures data doesn't accumulate and reduces the window of exposure if the device is compromised.
- **Link Previews**: Fetched locally by the client to prevent the signaling server (or the link's host) from tracking who shared what via IP leak.
