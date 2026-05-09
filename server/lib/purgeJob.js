/**
 * GhostNet — 12-Hour Purge Job
 * =============================
 * A background task that aggressively deletes ALL expired messages and their
 * associated media files from the local device. Runs immediately on startup,
 * then on a rolling 1-hour interval (catching items that expire mid-cycle).
 *
 * Cross-platform file deletion:
 *   Node.js / Electron (Windows): fs.unlinkSync(absolutePath)
 *   React Native (iOS/Android):   RNFS.unlink(absolutePath)  [swap the import below]
 *
 * The logic flow is identical on both platforms — only the fs adapter differs.
 *
 * Purge scope:
 *   1. messages where expires_at <= now
 *   2. associated media files on disk (media_local_path)
 *   3. associated link_metadata thumbnail files
 *   4. orphaned link_metadata rows with no referencing messages
 *   5. stale link_metadata cache entries (> 24 hours old)
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const { db } = require('./db');

// How often to check for expired records (every 1 hour).
// Items expire at their individual `expires_at` timestamp (12h after creation).
const CHECK_INTERVAL_MS = 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Prepared statements for the purge cycle
// ---------------------------------------------------------------------------
const stmts = {
  // Fetch all expired messages (including media path for disk deletion)
  getExpired: db.prepare(`
    SELECT message_id, media_local_path, link_metadata_id
    FROM   messages
    WHERE  expires_at <= ?
  `),

  // Delete a single message row
  deleteMessage: db.prepare(`
    DELETE FROM messages WHERE message_id = ?
  `),

  // Fetch link_metadata thumbnail path before deleting
  getLinkMeta: db.prepare(`
    SELECT id, thumbnail_path FROM link_metadata WHERE id = ?
  `),

  // Delete a link_metadata row
  deleteLinkMeta: db.prepare(`
    DELETE FROM link_metadata WHERE id = ?
  `),

  // Orphan cleanup: link_metadata rows no longer referenced by any message
  deleteOrphanLinkMeta: db.prepare(`
    DELETE FROM link_metadata
    WHERE id NOT IN (
      SELECT DISTINCT link_metadata_id
      FROM   messages
      WHERE  link_metadata_id IS NOT NULL
    )
  `),

  // Stale cache cleanup: link_metadata older than 24 hours
  deleteStaleCache: db.prepare(`
    DELETE FROM link_metadata WHERE fetched_at <= ?
  `),

  // Mark any "stuck" view-once records as purged (belt-and-suspenders)
  purgeStuckViewOnce: db.prepare(`
    UPDATE messages
    SET    status = 'purged'
    WHERE  is_view_once = 1
    AND    is_viewed = 0
    AND    expires_at <= ?
  `),
};

// ---------------------------------------------------------------------------
// Core purge function
// ---------------------------------------------------------------------------

/**
 * Executes one full purge cycle. Safe to call multiple times.
 * All DB operations run inside a single transaction for atomicity and speed.
 */
function runPurgeCycle() {
  const now          = Date.now();
  const staleCutoff  = now - (24 * 60 * 60 * 1000); // 24h ago

  console.log(`[PurgeJob] Starting purge cycle at ${new Date(now).toISOString()}`);

  // Collect stats for logging
  let deletedMessages  = 0;
  let deletedFiles     = 0;
  let deletedLinkMeta  = 0;
  let fileErrors       = 0;

  // ── Wrap everything in a single transaction ───────────────────────────────
  // SQLite transactions are dramatically faster for bulk deletes and prevent
  // partial state if the process crashes mid-cycle.
  const purgeTransaction = db.transaction(() => {
    // Step 1: Fetch all expired message rows
    const expiredRows = stmts.getExpired.all(now);

    for (const row of expiredRows) {
      // Step 2: Delete the physical media file (if any)
      if (row.media_local_path) {
        deleteFile(row.media_local_path);
        deletedFiles++;
      }

      // Step 3: Delete link_metadata thumbnail and row (if linked)
      if (row.link_metadata_id) {
        const meta = stmts.getLinkMeta.get(row.link_metadata_id);
        if (meta) {
          if (meta.thumbnail_path) {
            deleteFile(meta.thumbnail_path);
            deletedFiles++;
          }
          stmts.deleteLinkMeta.run(row.link_metadata_id);
          deletedLinkMeta++;
        }
      }

      // Step 4: Delete the message DB row
      stmts.deleteMessage.run(row.message_id);
      deletedMessages++;
    }

    // Step 5: Clean up any orphaned link_metadata (no referencing messages)
    const orphanResult = stmts.deleteOrphanLinkMeta.run();
    deletedLinkMeta += orphanResult.changes;

    // Step 6: Wipe stale link preview cache (> 24h)
    const staleResult = stmts.deleteStaleCache.run(staleCutoff);
    deletedLinkMeta += staleResult.changes;

    // Step 7: Mark any un-viewed view-once that expired (belt-and-suspenders)
    stmts.purgeStuckViewOnce.run(now);
  });

  try {
    purgeTransaction();
  } catch (err) {
    console.error('[PurgeJob] Transaction failed:', err.message);
    return;
  }

  console.log(
    `[PurgeJob] Cycle complete — ` +
    `messages: ${deletedMessages}, files: ${deletedFiles}, ` +
    `link_meta: ${deletedLinkMeta}, file_errors: ${fileErrors}`
  );
}

// ---------------------------------------------------------------------------
// File deletion helper (cross-platform, non-throwing)
// ---------------------------------------------------------------------------

/**
 * Safely deletes a file at the given absolute path.
 * Errors are logged but do NOT propagate — a missing file is not a fatal error.
 *
 * Mobile swap: replace `fs.unlinkSync` with `await RNFS.unlink(filePath)` and
 * make the parent function async.
 *
 * @param {string} filePath - Absolute path to the file to delete
 */
function deleteFile(filePath) {
  // Normalize path separators for cross-platform safety
  const normalized = path.normalize(filePath);

  // Security guard: refuse to delete anything outside the expected media dir
  // (prevents path-traversal bugs from corrupted DB entries)
  const MEDIA_ROOT = path.join(__dirname, '..', 'media');
  if (!normalized.startsWith(MEDIA_ROOT)) {
    console.warn(`[PurgeJob] BLOCKED deletion outside media dir: ${normalized}`);
    return;
  }

  try {
    if (fs.existsSync(normalized)) {
      fs.unlinkSync(normalized);
    }
    // File didn't exist — already gone, nothing to do
  } catch (err) {
    console.error(`[PurgeJob] Failed to delete file ${normalized}:`, err.message);
  }
}

// ---------------------------------------------------------------------------
// Scheduler
// ---------------------------------------------------------------------------

/**
 * Starts the purge scheduler. Runs immediately, then every CHECK_INTERVAL_MS.
 * Call this once from server/index.js at startup.
 */
function startPurgeJob() {
  console.log('[PurgeJob] Purge scheduler started (interval: 1 hour, TTL: 12 hours)');

  // Run immediately to clear anything expired from a previous session
  runPurgeCycle();

  // Then run on a rolling interval
  const timer = setInterval(runPurgeCycle, CHECK_INTERVAL_MS);

  // Prevent the interval from blocking process shutdown (Electron / Node.js)
  if (timer.unref) timer.unref();

  return timer;
}

module.exports = { startPurgeJob, runPurgeCycle };
