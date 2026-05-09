const fs = require('./fsBridge');
const path = require('path'); // Note: 'path' has browser-safe versions for RN
const db = require('../db/database');

async function processViewOnceMedia(messageId, storageRoot) {
  try {
    const message = await db.get('SELECT media_local_path FROM messages WHERE message_id = ?', [messageId]);
    if (!message || !message.media_local_path) return;

    const absolutePath = `${storageRoot}/${message.media_local_path}`;

    try {
      await fs.unlink(absolutePath);
      console.log(`[Security] Physically deleted: ${absolutePath}`);
    } catch (err) {
      console.warn(`File removal skipped: ${err.message}`);
    }

    await db.run('DELETE FROM messages WHERE message_id = ?', [messageId]);
    return { status: 'destroyed' };
  } catch (error) {
    console.error('Error in processViewOnceMedia:', error);
  }
}

module.exports = { processViewOnceMedia };
