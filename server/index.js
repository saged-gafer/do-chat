const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// --- Part 1: Serve the dark-mode landing page & static assets ---

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// --- Part 2: Zero-Knowledge WebRTC Signaling ---

io.on('connection', (socket) => {
  // 1. Join a room for signaling based on persistent Cryptographic Peer ID
  socket.on('join-signaling', (peerId) => {
    socket.join(peerId);
    socket.peerId = peerId;
    console.log(`Peer ${peerId} registered for signaling.`);
  });

  // 2. Relay WebRTC Signal (Offer/Answer/ICE)
  socket.on('signal', ({ targetPeerId, data }) => {
    // SECURITY: The server only relays the blob. It does not log or inspect the content.
    // data contains the SDP offer/answer or ICE candidate.
    if (socket.peerId) {
      io.to(targetPeerId).emit('signal', {
        senderPeerId: socket.peerId,
        data: data
      });
    } else {
      console.warn('Attempted signal from unauthenticated socket.');
    }
  });

  socket.on('disconnect', () => {
    // Session-only metadata is automatically cleaned up by Socket.IO
    if (socket.peerId) {
      console.log(`Peer ${socket.peerId} disconnected.`);
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Zero-Knowledge Signaling Server running on port ${PORT}`);
});
