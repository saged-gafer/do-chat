const fs = require('./fsBridge');
const db = require('../db/database');

/**
 * 12-Hour Aggressive Purge Logic.
 * Scans the database for expired records and physically deletes associated media files.
 */
async function runPurgeCycle(storageRoot) {
    const now = new Date().toISOString();
    console.log(`[Purge Job] Starting cycle at ${now}`);

    try {
        // 1. Purge Expired Messages and Media
        const expiredMessages = await db.all(
            'SELECT message_id, media_local_path FROM messages WHERE expires_at < ?',
            [now]
        );

        for (const msg of expiredMessages) {
            if (msg.media_local_path) {
                const absolutePath = `${storageRoot}/${msg.media_local_path}`;
                try {
                    if (await fs.exists(absolutePath)) {
                        await fs.unlink(absolutePath);
                        console.log(`[Purge Job] Physically deleted media: ${absolutePath}`);
                    }
                } catch (e) {
                    console.error(`[Purge Job] Failed to delete file ${absolutePath}:`, e.message);
                }
            }
        }

        const msgResult = await db.run('DELETE FROM messages WHERE expires_at < ?', [now]);
        console.log(`[Purge Job] Deleted ${msgResult.changes} messages from database.`);

        // 2. Purge Old Link Metadata (e.g., older than 24 hours)
        const previewExpiry = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const oldPreviews = await db.all(
            'SELECT thumbnail_local_path FROM link_metadata WHERE fetched_at < ?',
            [previewExpiry]
        );

        for (const preview of oldPreviews) {
            if (preview.thumbnail_local_path) {
                const absolutePath = `${storageRoot}/${preview.thumbnail_local_path}`;
                try {
                    if (await fs.exists(absolutePath)) {
                        await fs.unlink(absolutePath);
                        console.log(`[Purge Job] Physically deleted thumbnail: ${absolutePath}`);
                    }
                } catch (e) {
                    console.error(`[Purge Job] Failed to delete thumbnail ${absolutePath}:`, e.message);
                }
            }
        }

        const previewResult = await db.run('DELETE FROM link_metadata WHERE fetched_at < ?', [previewExpiry]);
        console.log(`[Purge Job] Deleted ${previewResult.changes} link metadata records.`);

    } catch (error) {
        console.error('[Purge Error]', error);
    }
}

/**
 * Starts the background interval for the purge job.
 */
function startBackgroundPurge(storageRoot) {
    // Run once immediately on startup
    runPurgeCycle(storageRoot);

    // Run every hour to check for expirations
    setInterval(() => runPurgeCycle(storageRoot), 60 * 60 * 1000);
}

module.exports = {
    runPurgeCycle,
    startBackgroundPurge
};
