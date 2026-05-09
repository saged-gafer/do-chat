const db = require('../db/database'); // Hypothetical DB wrapper

/**
 * Saves incoming WebRTC messages to the local SQLite database.
 * Standardized for both Windows and Mobile.
 */
async function saveIncomingMessage(envelope) {
  const { type, sender_id, payload, nonce, timestamp } = envelope;

  // Calculate expiration (12 hours from now)
  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
  const messageId = generateUUID(); // Helper to generate unique ID

  try {
    await db.run(`
      INSERT INTO messages (
        message_id, peer_id, direction, payload_type,
        encrypted_blob, nonce, expires_at, created_at
      ) VALUES (?, ?, 'inbound', ?, ?, ?, ?, ?)
    `, [
      messageId,
      sender_id,
      type.toLowerCase(),
      Buffer.from(payload, 'base64'),
      Buffer.from(nonce, 'base64'),
      expiresAt,
      timestamp
    ]);

    return messageId;
  } catch (error) {
    console.error('Failed to save message:', error);
    throw error;
  }
}

function generateUUID() {
    return require('crypto').randomUUID();
}

module.exports = { saveIncomingMessage };
