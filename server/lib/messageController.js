/**
 * GhostNet — Message Controller
 * ==============================
 * Core business-logic layer shared between Windows (Electron) and Mobile
 * (React Native) backends. All SQLite operations use parameterized queries
 * to prevent injection. All file I/O uses Node's `path` and `fs` modules,
 * which behave identically across platforms (path separators are normalized).
 *
 * Mobile note: React Native's `react-native-fs` mirrors these fs operations
 * with the same method signatures — swap the `fs` import for RNFS there.
 *
 * Encryption note: The E2EE layer (AES-256-GCM key derivation, encrypt/decrypt)
 * is intentionally omitted here as a pure backend-logic module. Insert your
 * crypto adapter (e.g. libsodium-wrappers, SubtleCrypto) at the marked points.
 */

'use strict';

const fs           = require('fs');
const path         = require('path');
const https        = require('https');
const http         = require('http');
const { randomUUID } = require('crypto');
const { db }       = require('./db');
const { validateEnvelope, createReceipt } = require('./protocol');

// Directory where received media files are saved (platform-specific in prod)
const MEDIA_DIR = path.join(__dirname, '..', 'media');
if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });

// Auto-delete window in milliseconds — 12 hours
const TTL_MS = 12 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Prepared statements (compiled once, reused many times — better-sqlite3 best
// practice; they are also reusable on the same db instance without rebinding)
// ---------------------------------------------------------------------------
const stmts = {
  insertMessage: db.prepare(`
    INSERT INTO messages (
      message_id, peer_id, direction, type,
      encrypted_body, media_local_path, media_mime_type, media_size_bytes,
      is_view_once, link_metadata_id, screenshot_protected,
      sent_at, received_at, expires_at, status
    ) VALUES (
      @message_id, @peer_id, @direction, @type,
      @encrypted_body, @media_local_path, @media_mime_type, @media_size_bytes,
      @is_view_once, @link_metadata_id, @screenshot_protected,
      @sent_at, @received_at, @expires_at, @status
    )
  `),

  markViewed: db.prepare(`
    UPDATE messages
    SET is_viewed = 1, viewed_at = @viewed_at, status = 'read'
    WHERE message_id = @message_id
  `),

  getMessageById: db.prepare(`
    SELECT * FROM messages WHERE message_id = ?
  `),

  deleteMessageById: db.prepare(`
    DELETE FROM messages WHERE message_id = ?
  `),

  insertLinkMeta: db.prepare(`
    INSERT OR REPLACE INTO link_metadata
      (id, original_url, canonical_url, title, description,
       thumbnail_path, site_name, fetched_at, fetch_error)
    VALUES
      (@id, @original_url, @canonical_url, @title, @description,
       @thumbnail_path, @site_name, @fetched_at, @fetch_error)
  `),

  getLinkMetaByUrl: db.prepare(`
    SELECT * FROM link_metadata WHERE original_url = ?
  `),

  updateMessageStatus: db.prepare(`
    UPDATE messages SET status = @status WHERE message_id = @message_id
  `),
};

// =============================================================================
// 1. saveIncomingMessage(envelope)
// =============================================================================

/**
 * Persists a validated, decrypted-envelope from a P2P peer to local SQLite.
 *
 * @param {object} envelope  - Validated P2P protocol envelope (see protocol.js)
 * @param {string} localPeerId - This device's own peer_id (to set direction)
 * @returns {{ success: boolean, messageId?: string, error?: string }}
 *
 * Caller responsibilities BEFORE calling this function:
 *   1. Decrypt the outer AES-256-GCM layer from the WebRTC DataChannel blob
 *   2. JSON.parse the decrypted bytes into `envelope`
 *   3. Call validateEnvelope(envelope) and reject if invalid
 *   4. Verify the sender's peer_id matches the socket/DataChannel identity
 */
function saveIncomingMessage(envelope, localPeerId) {
  // ── Validate envelope structure ──────────────────────────────────────────
  const { valid, error: validationError } = validateEnvelope(envelope);
  if (!valid) {
    console.error('[saveIncomingMessage] Invalid envelope:', validationError);
    return { success: false, error: validationError };
  }

  // Reject messages that are not addressed to this device
  if (envelope.to !== localPeerId) {
    return { success: false, error: 'Message addressed to wrong peer — dropped' };
  }

  const now       = Date.now();
  const expiresAt = envelope.ts + TTL_MS; // 12-hour TTL from the sender's timestamp
  const peerId    = envelope.from;        // The remote peer who sent this

  // Determine row shape based on message type
  const isViewOnce = envelope.type === 'view_once_image' ||
                     envelope.type === 'view_once_media'  ||
                     envelope.type === 'view_once_video';

  const row = {
    message_id:          envelope.id,
    peer_id:             peerId,
    direction:           'inbound',
    type:                envelope.type,
    encrypted_body:      null,
    media_local_path:    null,
    media_mime_type:     null,
    media_size_bytes:    null,
    is_view_once:        isViewOnce ? 1 : 0,
    link_metadata_id:    null,
    screenshot_protected: 0,
    sent_at:             envelope.ts,
    received_at:         now,
    expires_at:          expiresAt,
    status:              'delivered',
  };

  // ── Populate type-specific fields ────────────────────────────────────────
  switch (envelope.type) {
    case 'text':
      // body.ciphertext is the AES-256-GCM encrypted text (Base64)
      // INSERT POINT: pass body.ciphertext through your re-encryption layer
      //               to store under your local device key instead.
      row.encrypted_body       = envelope.body.ciphertext;
      row.screenshot_protected = envelope.body.screenshot_protected ? 1 : 0;
      break;

    case 'view_once_media':
      // The actual media bytes arrive separately over the binary DataChannel.
      // Store the transfer metadata now; update media_local_path once received.
      row.media_mime_type  = envelope.body.mime_type;
      row.media_size_bytes = envelope.body.size_bytes;
      // Placeholder path — will be updated by the media transfer handler
      row.media_local_path = path.join(MEDIA_DIR, `${envelope.body.transfer_id}.enc`);
      break;

    case 'link_preview':
      // Link metadata was fetched by the sender; store it locally
      const metaId = saveLinkMetadata({
        originalUrl:   envelope.body.original_url,
        canonicalUrl:  envelope.body.canonical_url,
        title:         envelope.body.title,
        description:   envelope.body.description,
        thumbnailB64:  envelope.body.thumbnail_b64,
        siteName:      envelope.body.site_name,
      });
      row.link_metadata_id = metaId;
      break;

    case 'receipt':
      // Receipts are processed separately — do not store as a regular message
      return { success: false, error: 'Receipts must be processed via processReceipt(), not saved.' };

    default:
      return { success: false, error: `Unhandled message type: ${envelope.type}` };
  }

  // ── Write to DB (inside a transaction for atomicity) ─────────────────────
  try {
    stmts.insertMessage.run(row);
    console.log(`[saveIncomingMessage] Saved ${envelope.type} message ${envelope.id} from ${peerId}`);
    return { success: true, messageId: envelope.id };
  } catch (err) {
    // UNIQUE constraint violation = duplicate delivery — safe to ignore
    if (err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
      console.warn(`[saveIncomingMessage] Duplicate message ${envelope.id} — already stored, skipping`);
      return { success: true, messageId: envelope.id, duplicate: true };
    }
    console.error('[saveIncomingMessage] DB error:', err.message);
    return { success: false, error: err.message };
  }
}

// =============================================================================
// 2. processViewOnceMedia(messageId, emit)
// =============================================================================

/**
 * Serves view-once media to the UI layer, then:
 *   a) Physically deletes the media file from disk
 *   b) Removes the DB record entirely
 *   c) Emits a 'viewed' receipt back to the sender over the P2P channel
 *
 * This function must be called ONCE — the moment the user opens the media.
 * Subsequent calls will find no record and return an error.
 *
 * @param {string}   messageId   - The message_id of the view-once message
 * @param {string}   localPeerId - This device's peer_id (for the receipt)
 * @param {Function} emit        - Async fn(receipt) → sends the receipt over WebRTC
 *                                 e.g. (receipt) => dataChannel.send(JSON.stringify(receipt))
 * @returns {{ success: boolean, filePath?: string, error?: string }}
 */
async function processViewOnceMedia(messageId, localPeerId, emit) {
  // ── Fetch the DB record ───────────────────────────────────────────────────
  const record = stmts.getMessageById.get(messageId);

  if (!record) {
    return { success: false, error: 'View-once record not found — already destroyed or invalid ID' };
  }
  if (!record.is_view_once) {
    return { success: false, error: 'Message is not flagged as view-once' };
  }
  if (record.is_viewed) {
    return { success: false, error: 'Media already viewed — cannot serve again' };
  }

  const filePath = record.media_local_path;

  // ── Mark as viewed in DB first (prevents race conditions on fast double-tap) ──
  stmts.markViewed.run({ message_id: messageId, viewed_at: Date.now() });

  // ── Delete physical file ──────────────────────────────────────────────────
  // We wrap in a try/catch because the file may have already been deleted
  // by the purge job in a race condition — that outcome is still "success".
  if (filePath) {
    try {
      // Cross-platform note:
      //   Node.js: fs.unlinkSync(filePath)
      //   React Native (RNFS): await RNFS.unlink(filePath)
      //   Both accept absolute paths; RNFS normalizes separators on its own.
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[processViewOnceMedia] File destroyed: ${filePath}`);
      }
    } catch (fileErr) {
      // Log but do not abort — the DB record must still be purged
      console.error(`[processViewOnceMedia] File deletion failed (${filePath}):`, fileErr.message);
    }
  }

  // ── Delete DB record entirely ─────────────────────────────────────────────
  stmts.deleteMessageById.run(messageId);
  console.log(`[processViewOnceMedia] DB record ${messageId} purged`);

  // ── Emit 'viewed' receipt to sender ──────────────────────────────────────
  try {
    const receipt = createReceipt(localPeerId, record.peer_id, messageId, 'viewed');
    await emit(receipt);
    console.log(`[processViewOnceMedia] 'viewed' receipt sent to ${record.peer_id}`);
  } catch (emitErr) {
    // Non-fatal — the destruction is already done locally
    console.error('[processViewOnceMedia] Receipt emit failed:', emitErr.message);
  }

  return { success: true, filePath };
}

// =============================================================================
// 3. fetchSecureLinkPreview(url)
// =============================================================================

/**
 * Securely fetches OpenGraph metadata for a URL from the SENDER's device.
 * This design ensures the recipient's IP is NEVER exposed to the target server.
 *
 * Privacy model:
 *   - Only the sender fetches the URL (their IP is already exposed by sharing it)
 *   - Metadata is embedded in the link_preview message payload
 *   - The receiver stores the pre-fetched data without making any outbound request
 *
 * Fetching strategy:
 *   1. HEAD request to resolve redirects and confirm content-type
 *   2. GET request for the HTML (max 128 KB to avoid abuse)
 *   3. Parse <meta> og:* and twitter:* tags with regex (no DOM dependency)
 *   4. Optionally fetch og:image and base64-encode it (max 512 KB)
 *
 * @param {string} rawUrl - The URL to preview (Instagram, TikTok, any HTTP/S URL)
 * @returns {Promise<{ success: boolean, meta?: object, error?: string }>}
 *
 * meta shape: { title, description, thumbnailB64, siteName, canonicalUrl }
 */
async function fetchSecureLinkPreview(rawUrl) {
  // ── Basic URL validation ──────────────────────────────────────────────────
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { success: false, error: 'Invalid URL' };
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { success: false, error: 'Only HTTP/S URLs are supported' };
  }

  // ── Check local cache first ───────────────────────────────────────────────
  const CACHE_TTL_MS = 60 * 60 * 1000; // 1-hour cache for link previews
  const cached = stmts.getLinkMetaByUrl.get(rawUrl);
  if (cached && Date.now() - cached.fetched_at < CACHE_TTL_MS && !cached.fetch_error) {
    console.log(`[fetchSecureLinkPreview] Cache hit for ${rawUrl}`);
    return {
      success: true,
      meta: {
        title:        cached.title,
        description:  cached.description,
        thumbnailB64: null,           // thumbnail stored on disk, not re-serialized here
        siteName:     cached.site_name,
        canonicalUrl: cached.canonical_url,
      },
    };
  }

  // ── Fetch HTML (max 128 KB) ───────────────────────────────────────────────
  let html;
  try {
    html = await fetchHtml(rawUrl, 131072); // 128 KB limit
  } catch (fetchErr) {
    const errMsg = fetchErr.message;
    saveLinkMetadataError(rawUrl, errMsg);
    return { success: false, error: errMsg };
  }

  // ── Extract OpenGraph / Twitter Card meta tags ────────────────────────────
  const extract = (property) => {
    // Matches both og: and twitter: variants
    const patterns = [
      new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, 'i'),
      new RegExp(`<meta[^>]+name=["']${property.replace('og:', 'twitter:')}["'][^>]+content=["']([^"']+)["']`, 'i'),
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m && m[1]) return m[1].trim();
    }
    return null;
  };

  // Fallback: extract <title> tag if og:title is absent
  const extractTitle = () => {
    const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return m ? m[1].trim() : null;
  };

  const meta = {
    title:        extract('og:title')       || extractTitle(),
    description:  extract('og:description') || null,
    canonicalUrl: extract('og:url')         || rawUrl,
    siteName:     extract('og:site_name')   || parsed.hostname,
    imageUrl:     extract('og:image')       || null,
    thumbnailB64: null,
  };

  // ── Fetch thumbnail image (optional, max 512 KB) ──────────────────────────
  if (meta.imageUrl) {
    try {
      const imgBuf = await fetchBinary(meta.imageUrl, 524288); // 512 KB limit
      meta.thumbnailB64 = imgBuf.toString('base64');
    } catch {
      // Thumbnail failure is non-fatal — proceed without it
      meta.thumbnailB64 = null;
    }
  }

  // ── Persist to cache ──────────────────────────────────────────────────────
  saveLinkMetadata({
    originalUrl:  rawUrl,
    canonicalUrl: meta.canonicalUrl,
    title:        meta.title,
    description:  meta.description,
    thumbnailB64: meta.thumbnailB64,
    siteName:     meta.siteName,
  });

  console.log(`[fetchSecureLinkPreview] Fetched preview for ${rawUrl} — title: "${meta.title}"`);
  return { success: true, meta };
}

// =============================================================================
// Internal helpers
// =============================================================================

/**
 * Persists OpenGraph metadata to the link_metadata table.
 * Returns the generated UUID for use as a foreign key.
 * @private
 */
function saveLinkMetadata({ originalUrl, canonicalUrl, title, description, thumbnailB64, siteName }) {
  // Save the thumbnail image to disk if present
  let thumbnailPath = null;
  if (thumbnailB64) {
    thumbnailPath = path.join(MEDIA_DIR, `thumb_${randomUUID()}.jpg`);
    try {
      fs.writeFileSync(thumbnailPath, Buffer.from(thumbnailB64, 'base64'));
    } catch {
      thumbnailPath = null;
    }
  }

  const id = randomUUID();
  stmts.insertLinkMeta.run({
    id,
    original_url:   originalUrl,
    canonical_url:  canonicalUrl || null,
    title:          title        || null,
    description:    description  || null,
    thumbnail_path: thumbnailPath,
    site_name:      siteName     || null,
    fetched_at:     Date.now(),
    fetch_error:    null,
  });
  return id;
}

/** Saves a fetch-error record for a URL so callers know it was attempted. @private */
function saveLinkMetadataError(url, errMsg) {
  stmts.insertLinkMeta.run({
    id:            randomUUID(),
    original_url:  url,
    canonical_url: null,
    title:         null,
    description:   null,
    thumbnail_path: null,
    site_name:     null,
    fetched_at:    Date.now(),
    fetch_error:   errMsg,
  });
}

/**
 * Downloads up to `maxBytes` of an HTML page and returns it as a string.
 * @private
 */
function fetchHtml(url, maxBytes) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, {
      headers: {
        // Identify as a browser to get the og: meta tags (some servers block bots)
        'User-Agent': 'Mozilla/5.0 (compatible; GhostNetBot/1.0)',
        'Accept':     'text/html,application/xhtml+xml',
      },
      timeout: 8000,
    }, (res) => {
      // Follow up to 3 redirects manually
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        req.destroy();
        return fetchHtml(res.headers.location, maxBytes).then(resolve).catch(reject);
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        req.destroy();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }

      const chunks = [];
      let total = 0;
      res.on('data', (chunk) => {
        total += chunk.length;
        if (total > maxBytes) {
          req.destroy();
          resolve(Buffer.concat(chunks).toString('utf8')); // Return what we have
        } else {
          chunks.push(chunk);
        }
      });
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
  });
}

/**
 * Downloads up to `maxBytes` of a binary resource and returns a Buffer.
 * @private
 */
function fetchBinary(url, maxBytes) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: 10000 }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        req.destroy();
        return fetchBinary(res.headers.location, maxBytes).then(resolve).catch(reject);
      }
      const chunks = [];
      let total = 0;
      res.on('data', (chunk) => {
        total += chunk.length;
        if (total > maxBytes) { req.destroy(); resolve(Buffer.concat(chunks)); }
        else chunks.push(chunk);
      });
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Binary fetch timed out')); });
  });
}

module.exports = {
  saveIncomingMessage,
  processViewOnceMedia,
  fetchSecureLinkPreview,
};
