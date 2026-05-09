/**
 * GhostNet — Zero-Knowledge P2P Signaling Server
 * ================================================
 * Responsibilities:
 *   1. Serve the dark-mode landing page (server/public/)
 *   2. Run the WebRTC signaling relay (Socket.IO) — zero-knowledge, no message logging
 *   3. Initialize the local SQLite database and schema on startup
 *   4. Start the 12-hour automatic purge job for ephemeral message data
 *
 * This server stores NO message content. It only relays encrypted SDP
 * offers/answers and ICE candidates so P2P connections can be established.
 * All actual chat data lives exclusively on the clients' local devices.
 */

'use strict';

const express    = require('express');
const http       = require('http');
const path       = require('path');
const { Server } = require('socket.io');

// ── GhostNet backend modules ──────────────────────────────────────────────────
const { healthCheck }  = require('./lib/db');         // DB init runs on import
const { startPurgeJob } = require('./lib/purgeJob');  // 12-hour ephemeral purge

// ── Express + Socket.IO setup ─────────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*' },
});

// ── Static file serving — landing page ───────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Health / status endpoint (for uptime monitors) ───────────────────────────
app.get('/health', (req, res) => {
  const db = healthCheck();
  res.json({
    status:  db.ok ? 'ok' : 'degraded',
    version: '2.0.0',
    db,
  });
});

// =============================================================================
// WebRTC Zero-Knowledge Signaling
// =============================================================================
// The server operates as a pure relay:
//   - Peers register their Peer ID on connect
//   - SDP offers/answers and ICE candidates are forwarded verbatim
//   - The server NEVER logs, inspects, or stores any signal payload
//   - Once the P2P DataChannel is established, the signaling server is no
//     longer in the message path at all
// =============================================================================

// In-memory peer registry: Map<peerId, socketId>
// Deliberately NOT persisted — if the server restarts, peers re-register.
const peerRegistry = new Map();

io.on('connection', (socket) => {

  // ── 1. Peer Registration ────────────────────────────────────────────────
  // Clients call this immediately after connecting, passing their local UUID.
  socket.on('join-signaling', (peerId) => {
    if (typeof peerId !== 'string' || peerId.length > 64) {
      socket.emit('error', { code: 'INVALID_PEER_ID' });
      return;
    }

    socket.join(peerId);
    socket.peerId = peerId;
    peerRegistry.set(peerId, socket.id);

    console.log(`[Signal] Peer registered: ${peerId.slice(0, 8)}…`);

    // Confirm registration to the client
    socket.emit('registered', { peerId });
  });

  // ── 2. Signal Relay (SDP Offer / Answer / ICE Candidate) ───────────────
  // `data` is an opaque blob — could be an SDP string or ICE candidate JSON.
  // The server forwards it as-is without reading the contents.
  socket.on('signal', ({ targetPeerId, data }) => {
    if (!socket.peerId) {
      socket.emit('error', { code: 'NOT_REGISTERED' });
      return;
    }
    if (typeof targetPeerId !== 'string') {
      socket.emit('error', { code: 'INVALID_TARGET' });
      return;
    }

    // Forward to the target peer's room — if they're online they'll receive it
    io.to(targetPeerId).emit('signal', {
      senderPeerId: socket.peerId,
      data,
    });
    // Zero-knowledge: no logging of `data` — ever
  });

  // ── 3. Peer Availability Check ──────────────────────────────────────────
  // Lets a client ask "is peer X currently online?" before attempting a call
  socket.on('check-peer', (targetPeerId, callback) => {
    const online = peerRegistry.has(targetPeerId) &&
                   io.sockets.sockets.has(peerRegistry.get(targetPeerId));
    if (typeof callback === 'function') callback({ online });
  });

  // ── 4. Disconnect Cleanup ───────────────────────────────────────────────
  socket.on('disconnect', () => {
    if (socket.peerId) {
      peerRegistry.delete(socket.peerId);
      console.log(`[Signal] Peer disconnected: ${socket.peerId.slice(0, 8)}…`);
    }
  });
});

// =============================================================================
// Startup
// =============================================================================

const PORT = process.env.PORT || 5000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n╔══════════════════════════════════════════════╗`);
  console.log(`║       GhostNet Signaling Server v2.0.0       ║`);
  console.log(`╚══════════════════════════════════════════════╝`);
  console.log(`[Server]  Listening on port ${PORT}`);

  // Verify DB health
  const db = healthCheck();
  if (db.ok) {
    console.log(`[DB]      SQLite ready — tables: ${db.tables.join(', ')}`);
  } else {
    console.error(`[DB]      WARNING: Schema check failed — tables: ${db.tables.join(', ')}`);
  }

  // Start the 12-hour ephemeral message purge scheduler
  startPurgeJob();

  console.log(`[Ready]   Zero-knowledge relay active\n`);
});
