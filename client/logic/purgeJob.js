const fs = require('fs').promises;
const path = require('path');
const db = require('../db/database'); // Hypothetical DB wrapper

/**
 * Aggressively purges all data older than 12 hours.
 * Runs as a background task on the local device.
 */
async function startPurgeJob() {
  // Run every hour to check for expired content
  setInterval(async () => {
    console.log('Starting 12-hour data purge...');
    const expiryTime = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

    try {
      // 1. Identify files to delete (Media and Link Preview thumbnails)
      const expiredMedia = await db.all(
        'SELECT media_path FROM messages WHERE created_at < ? AND media_path IS NOT NULL',
        [expiryTime]
      );

      const expiredPreviews = await db.all(
        'SELECT image_path FROM link_previews WHERE fetched_at < ? AND image_path IS NOT NULL',
        [expiryTime]
      );

      // 2. Physical Deletion
      const filesToDelete = [
        ...expiredMedia.map(m => m.media_path),
        ...expiredPreviews.map(p => p.image_path)
      ];

      for (const filePath of filesToDelete) {
        try {
          await fs.unlink(filePath);
          console.log(`Purged file: ${filePath}`);
        } catch (e) {
          // File might already be deleted (e.g., via View Once)
        }
      }

      // 3. Database Scrubbing
      const msgResult = await db.run('DELETE FROM messages WHERE created_at < ?', [expiryTime]);
      const preResult = await db.run('DELETE FROM link_previews WHERE fetched_at < ?', [expiryTime]);

      console.log(`Purge complete. Deleted ${msgResult.changes} messages and ${preResult.changes} previews.`);

    } catch (error) {
      console.error('Error during purge job:', error);
    }
  }, 60 * 60 * 1000); // Check every hour
}

module.exports = { startPurgeJob };
