const db = require('../db/database');
const { processViewOnceMedia } = require('./viewOnce');

/**
 * Note on Cross-Platform Compatibility:
 * - On Node.js/Windows: 'crypto' and 'Buffer' are globally available.
 * - On React Native/Mobile: You must install and use polyfills:
 *   - 'react-native-get-random-values' + 'uuid'
 *   - 'buffer' (global.Buffer = require('buffer').Buffer)
 */

// Use a cross-platform safe way to access global dependencies
const _Buffer = typeof Buffer !== 'undefined' ? Buffer : require('buffer').Buffer;

/**
 * Main entry point for all incoming WebRTC payloads.
 * Routes messages based on the standardized protocol types.
 */
async function handleIncomingPayload(envelope, storageRoot) {
    const { type } = envelope;

    switch (type) {
        case 'TEXT':
        case 'MEDIA':
        case 'VIEW_ONCE':
            return await saveIncomingMessage(envelope);

        case 'RECEIPT':
            return await handleReceipt(envelope, storageRoot);

        case 'SIGNAL':
            return { status: 'signal_received' };

        default:
            console.warn(`Unknown payload type: ${type}`);
            return null;
    }
}

/**
 * Saves incoming WebRTC messages to the local SQLite database.
 */
async function saveIncomingMessage(envelope) {
  const { type, sender_id, payload, nonce, timestamp } = envelope;

  const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
  const messageId = generateUUID();

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
      _Buffer.from(payload, 'base64'),
      _Buffer.from(nonce, 'base64'),
      expiresAt,
      timestamp
    ]);

    return { messageId, status: 'saved' };
  } catch (error) {
    console.error('Failed to save message:', error);
    throw error;
  }
}

/**
 * Handles incoming receipts (READ, VIEWED, DELETED).
 */
async function handleReceipt(envelope, storageRoot) {
    const decrypted = JSON.parse(_Buffer.from(envelope.payload, 'base64').toString());
    const { target_message_id, action } = decrypted;

    console.log(`[Receipt] Action ${action} for message ${target_message_id}`);

    if (action === 'VIEWED' || action === 'DELETED') {
        return await processViewOnceMedia(target_message_id, storageRoot);
    }

    await db.run('UPDATE messages SET is_viewed = 1 WHERE message_id = ?', [target_message_id]);

    return { status: 'receipt_processed' };
}

/**
 * UUID Generator helper.
 * Defaults to Node's crypto but expects polyfill on Mobile.
 */
function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for environments without randomUUID
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

module.exports = {
    handleIncomingPayload,
    saveIncomingMessage,
    handleReceipt
};
