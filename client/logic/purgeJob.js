const fs = require('./fsBridge');
const db = require('../db/database');

async function runPurgeCycle(storageRoot) {
  const now = new Date().toISOString();
  try {
    const expiredMessages = await db.all(
        'SELECT message_id, media_local_path FROM messages WHERE expires_at < ?',
        [now]
    );

    for (const msg of expiredMessages) {
      if (msg.media_local_path) {
        try {
          await fs.unlink(`${storageRoot}/${msg.media_local_path}`);
        } catch (e) {}
      }
    }

    await db.run('DELETE FROM messages WHERE expires_at < ?', [now]);

    const previewExpiry = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const oldPreviews = await db.all(
        'SELECT thumbnail_local_path FROM link_metadata WHERE fetched_at < ?',
        [previewExpiry]
    );

    for (const preview of oldPreviews) {
        if (preview.thumbnail_local_path) {
            try {
                await fs.unlink(`${storageRoot}/${preview.thumbnail_local_path}`);
            } catch (e) {}
        }
    }

    await db.run('DELETE FROM link_metadata WHERE fetched_at < ?', [previewExpiry]);
  } catch (error) {
    console.error('[Purge Error]', error);
  }
}

function startBackgroundPurge(storageRoot) {
    runPurgeCycle(storageRoot);
    setInterval(() => runPurgeCycle(storageRoot), 60 * 60 * 1000);
}

module.exports = { startBackgroundPurge };
