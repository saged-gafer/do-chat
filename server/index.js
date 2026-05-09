const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const useragent = require('express-useragent');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

app.use(useragent.express());

// --- Part 1: Landing Page & OS Detection ---

app.get('/', (req, res) => {
  const ua = req.useragent;
  let downloadLink = '#';
  let osName = 'Unknown';

  if (ua.isWindows) {
    downloadLink = '/downloads/p2p-chat-setup.exe';
    osName = 'Windows';
  } else if (ua.isAndroid) {
    downloadLink = '/downloads/p2p-chat.apk';
    osName = 'Android';
  } else if (ua.isIphone || ua.isIpad) {
    downloadLink = 'https://apps.apple.com/app/p2p-chat';
    osName = 'iOS';
  }

  res.send(`
    <html>
      <head><title>Secure P2P Chat</title></head>
      <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
        <h1>Secure P2P Chat</h1>
        <p>Detected Platform: <strong>${osName}</strong></p>
        <a href="${downloadLink}" style="padding: 15px 30px; background: #007bff; color: white; text-decoration: none; border-radius: 5px;">
            Download for ${osName}
        </a>
      </body>
    </html>
  `);
});


// --- Part 2: Zero-Knowledge WebRTC Signaling ---

io.on('connection', (socket) => {
  // 1. Join a room for signaling based on persistent Cryptographic Peer ID
  socket.on('join-signaling', (peerId) => {
    socket.join(peerId);
    socket.peerId = peerId; // Store for relay identification
    console.log(`Peer ${peerId} registered for signaling.`);
  });

  // 2. Relay WebRTC Signal
  socket.on('signal', ({ targetPeerId, data }) => {
    // data contains the SDP blob or ICE candidate
    io.to(targetPeerId).emit('signal', {
      senderPeerId: socket.peerId, // Use persistent ID, not socket.id
      data: data
    });
  });

  socket.on('disconnect', () => {
    console.log(`Node disconnected: ${socket.peerId || socket.id}`);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Signaling Server running on port ${PORT}`);
});
