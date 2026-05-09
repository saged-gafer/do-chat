const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const useragent = require('express-useragent');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // In production, restrict this to known domains
    methods: ["GET", "POST"]
  }
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
  } else if (ua.isiPhone || ua.isPad) {
    downloadLink = 'https://apps.apple.com/app/p2p-chat'; // App Store Link
    osName = 'iOS';
  }

  // Simplified response for the task (In reality, this would serve an HTML file)
  res.send(`
    <h1>Secure P2P Chat</h1>
    <p>Detected OS: ${osName}</p>
    <a href="${downloadLink}"><button>Download for ${osName}</button></a>
    <hr>
    <p>Manual Downloads:</p>
    <ul>
        <li><a href="/downloads/p2p-chat-setup.exe">Windows (.exe)</a></li>
        <li><a href="/downloads/p2p-chat.apk">Android (.apk)</a></li>
    </ul>
  `);
});

// Serve static build files
app.use('/downloads', express.static(path.join(__dirname, 'builds')));


// --- Part 2: WebRTC Signaling logic ---

/**
 * The signaling server facilitates the initial handshake.
 * It NEVER stores or inspects the payload content.
 */
io.on('connection', (socket) => {
  console.log(`User connected for signaling: ${socket.id}`);

  // User joins a private "room" based on their unique signaling ID
  socket.on('register-id', (customId) => {
    socket.join(customId);
    console.log(`Socket ${socket.id} registered as ID: ${customId}`);
  });

  // Forwarding WebRTC Offer
  socket.on('offer', ({ targetId, offer }) => {
    console.log(`Forwarding offer from ${socket.id} to ${targetId}`);
    socket.to(targetId).emit('offer', {
      senderId: socket.id,
      offer: offer
    });
  });

  // Forwarding WebRTC Answer
  socket.on('answer', ({ targetId, answer }) => {
    console.log(`Forwarding answer from ${socket.id} to ${targetId}`);
    socket.to(targetId).emit('answer', {
      senderId: socket.id,
      answer: answer
    });
  });

  // Forwarding ICE Candidates
  socket.on('ice-candidate', ({ targetId, candidate }) => {
    console.log(`Forwarding ICE candidate to ${targetId}`);
    socket.to(targetId).emit('ice-candidate', {
      senderId: socket.id,
      candidate: candidate
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected from signaling');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Signaling & Distribution Server running on port ${PORT}`);
});
