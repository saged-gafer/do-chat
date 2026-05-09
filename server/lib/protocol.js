/**
 * GhostNet Standardized P2P Messaging Protocol
 * =============================================
 * These factory functions produce the exact JSON objects sent over WebRTC
 * Data Channels between Windows (Electron/better-sqlite3) and Mobile
 * (React Native/react-native-sqlite-storage) clients.
 *
 * WIRE FORMAT RULE: Every payload is serialized to a UTF-8 JSON string,
 * then the string itself is AES-256-GCM encrypted before transmission.
 * The signaling server never sees plaintext payloads — only opaque blobs.
 *
 * Payload envelope:
 * {
 *   v:   number   — protocol version (current: 1)
 *   type: string  — message type discriminator
 *   id:   string  — UUID v4, unique per message
 *   ts:   number  — Unix ms timestamp (sender's clock)
 *   from: string  — sender's peer_id
 *   to:   string  — recipient's peer_id
 *   body: object  — type-specific payload (see factories below)
 * }
 */

'use strict';

const { randomUUID } = require('crypto');

const PROTOCOL_VERSION = 1;

/**
 * Creates the common envelope wrapper shared by all message types.
 * @private
 */
function createEnvelope(type, fromPeerId, toPeerId, body) {
  return {
    v:    PROTOCOL_VERSION,
    type,
    id:   randomUUID(),       // Unique message ID — stored in messages.message_id
    ts:   Date.now(),         // Unix ms — stored in messages.sent_at
    from: fromPeerId,
    to:   toPeerId,
    body,
  };
}

// =============================================================================
// MESSAGE TYPES
// =============================================================================

/**
 * TYPE: text
 * A standard encrypted text message.
 *
 * @param {string} fromPeerId - Sender's peer_id UUID
 * @param {string} toPeerId   - Recipient's peer_id UUID
 * @param {string} ciphertextB64 - Base64(iv[12] + authTag[16] + ciphertext)
 *                                 produced by AES-256-GCM on the plaintext body
 * @param {boolean} screenshotProtected - If true, UI must blur on screenshot attempt
 * @returns {object} Wire-ready envelope (serialize with JSON.stringify before encrypting)
 *
 * Example wire payload (before outer encryption):
 * {
 *   "v": 1,
 *   "type": "text",
 *   "id": "a3f2c1d0-...",
 *   "ts": 1718000000000,
 *   "from": "peer-uuid-alice",
 *   "to": "peer-uuid-bob",
 *   "body": {
 *     "ciphertext": "BASE64_ENCRYPTED_TEXT_HERE==",
 *     "screenshot_protected": false
 *   }
 * }
 */
function createTextMessage(fromPeerId, toPeerId, ciphertextB64, screenshotProtected = false) {
  return createEnvelope('text', fromPeerId, toPeerId, {
    ciphertext:           ciphertextB64,
    screenshot_protected: screenshotProtected,
  });
}

/**
 * TYPE: view_once_media
 * Notifies the recipient that a view-once photo or video is ready to be fetched
 * directly over the P2P data channel (chunked transfer, not via server).
 *
 * The actual encrypted media bytes are sent in separate binary DataChannel
 * chunks AFTER the recipient ACKs this notification. The `transfer_id` links
 * the notification to the binary stream.
 *
 * @param {string} fromPeerId
 * @param {string} toPeerId
 * @param {string} transferId  - UUID linking this notification to the binary stream
 * @param {string} mimeType    - 'image/jpeg' | 'video/mp4' | etc.
 * @param {number} sizeBytes   - Plaintext byte size (for progress display)
 * @param {string} thumbB64    - Base64-encoded tiny thumbnail (≤ 4 KB, blurred)
 *
 * Example wire payload (before outer encryption):
 * {
 *   "v": 1,
 *   "type": "view_once_media",
 *   "id": "b7e9d2a1-...",
 *   "ts": 1718000001000,
 *   "from": "peer-uuid-alice",
 *   "to": "peer-uuid-bob",
 *   "body": {
 *     "transfer_id": "c1d2e3f4-...",
 *     "mime_type": "image/jpeg",
 *     "size_bytes": 204800,
 *     "blurred_thumb_b64": "BASE64_TINY_THUMBNAIL=="
 *   }
 * }
 */
function createViewOnceMediaMessage(fromPeerId, toPeerId, transferId, mimeType, sizeBytes, thumbB64) {
  return createEnvelope('view_once_media', fromPeerId, toPeerId, {
    transfer_id:       transferId,
    mime_type:         mimeType,
    size_bytes:        sizeBytes,
    blurred_thumb_b64: thumbB64,
  });
}

/**
 * TYPE: receipt
 * Sent by the recipient to acknowledge delivery or view events.
 * On the sender's side, a 'viewed' receipt for view_once_media MUST
 * trigger immediate deletion of the outbound media file and DB record.
 *
 * @param {string} fromPeerId       - Peer sending the receipt (the reader)
 * @param {string} toPeerId         - Peer receiving the receipt (the original sender)
 * @param {string} originalMessageId - The `id` field of the message being acknowledged
 * @param {'delivered'|'read'|'viewed'} event
 *   - 'delivered' → message arrived at device
 *   - 'read'      → text message opened in chat view
 *   - 'viewed'    → view-once media was opened (triggers destruction on BOTH ends)
 *
 * Example wire payload (before outer encryption):
 * {
 *   "v": 1,
 *   "type": "receipt",
 *   "id": "e5f6a7b8-...",
 *   "ts": 1718000002000,
 *   "from": "peer-uuid-bob",
 *   "to": "peer-uuid-alice",
 *   "body": {
 *     "ref_message_id": "b7e9d2a1-...",
 *     "event": "viewed"
 *   }
 * }
 */
function createReceipt(fromPeerId, toPeerId, originalMessageId, event) {
  const VALID_EVENTS = ['delivered', 'read', 'viewed'];
  if (!VALID_EVENTS.includes(event)) {
    throw new Error(`Invalid receipt event "${event}". Must be one of: ${VALID_EVENTS.join(', ')}`);
  }

  return createEnvelope('receipt', fromPeerId, toPeerId, {
    ref_message_id: originalMessageId,
    event,
  });
}

/**
 * TYPE: link_preview
 * Carries securely fetched OpenGraph metadata for a URL shared in a message.
 * Fetching is always done by the SENDER's device to protect recipient IP.
 * The metadata is embedded in the message payload, not fetched by the receiver.
 *
 * @param {string} fromPeerId
 * @param {string} toPeerId
 * @param {string} originalUrl
 * @param {object} meta - { title, description, thumbnailB64, siteName, canonicalUrl }
 *
 * Example wire payload (before outer encryption):
 * {
 *   "v": 1,
 *   "type": "link_preview",
 *   "id": "f9a0b1c2-...",
 *   "ts": 1718000003000,
 *   "from": "peer-uuid-alice",
 *   "to": "peer-uuid-bob",
 *   "body": {
 *     "original_url": "https://www.instagram.com/p/abc123/",
 *     "title": "Check this out 🔥",
 *     "description": "A wild post appeared",
 *     "thumbnail_b64": "BASE64_THUMBNAIL==",
 *     "site_name": "Instagram",
 *     "canonical_url": "https://www.instagram.com/p/abc123/"
 *   }
 * }
 */
function createLinkPreviewMessage(fromPeerId, toPeerId, originalUrl, meta = {}) {
  return createEnvelope('link_preview', fromPeerId, toPeerId, {
    original_url:   originalUrl,
    title:          meta.title        || null,
    description:    meta.description  || null,
    thumbnail_b64:  meta.thumbnailB64 || null,
    site_name:      meta.siteName     || null,
    canonical_url:  meta.canonicalUrl || null,
  });
}

// =============================================================================
// PROTOCOL VALIDATION
// =============================================================================

/**
 * Validates an incoming deserialized envelope from the wire.
 * Call this immediately after decrypting + JSON.parsing an inbound payload.
 *
 * @param {object} envelope - The parsed JSON object
 * @returns {{ valid: boolean, error?: string }}
 */
function validateEnvelope(envelope) {
  if (!envelope || typeof envelope !== 'object') {
    return { valid: false, error: 'Payload is not an object' };
  }
  if (envelope.v !== PROTOCOL_VERSION) {
    return { valid: false, error: `Unsupported protocol version: ${envelope.v}` };
  }
  const REQUIRED = ['type', 'id', 'ts', 'from', 'to', 'body'];
  for (const field of REQUIRED) {
    if (envelope[field] === undefined || envelope[field] === null) {
      return { valid: false, error: `Missing required field: "${field}"` };
    }
  }
  const VALID_TYPES = ['text', 'view_once_media', 'receipt', 'link_preview'];
  if (!VALID_TYPES.includes(envelope.type)) {
    return { valid: false, error: `Unknown message type: "${envelope.type}"` };
  }
  return { valid: true };
}

module.exports = {
  createTextMessage,
  createViewOnceMediaMessage,
  createReceipt,
  createLinkPreviewMessage,
  validateEnvelope,
  PROTOCOL_VERSION,
};
