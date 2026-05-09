const fs = require('fs').promises;
const db = require('../db/database'); // Hypothetical DB wrapper

/**
 * Handles the logic for "View Once" media.
 * This should be triggered as soon as the UI confirms the user has finished viewing.
 */
async function handleViewOnceMedia(messageId) {
  try {
    // 1. Fetch message details from local SQLite
    const message = await db.get('SELECT * FROM messages WHERE id = ?', [messageId]);

    if (!message || message.message_type !== 'view_once') {
      return;
    }

    if (message.media_path) {
      // 2. Aggressively delete the physical file from local disk
      try {
        await fs.unlink(message.media_path);
        console.log(`Physically deleted View Once media: ${message.media_path}`);
      } catch (err) {
        console.error(`Failed to delete file: ${err.message}`);
      }
    }

    // 3. Update DB to mark as viewed and remove reference to the file
    await db.run(
      'UPDATE messages SET is_viewed = 1, media_path = NULL, encrypted_payload = NULL WHERE id = ?',
      [messageId]
    );

    console.log(`Message ${messageId} scrubbed from database.`);
  } catch (error) {
    console.error('Error in View Once logic:', error);
  }
}

module.exports = { handleViewOnceMedia };
