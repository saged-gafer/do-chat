const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('./fsBridge');
const db = require('../db/database');

/**
 * Securely fetches link previews locally.
 * Prevents IP leaks by downloading images to local storage.
 */
async function fetchSecureLinkPreview(url, storageRoot) {
  try {
    // Basic URL hashing for keying
    const urlHash = Array.from(url).reduce((s, c) => s + c.charCodeAt(0), 0).toString(16);

    const response = await axios.get(url, {
      timeout: 4000,
      headers: { 'User-Agent': 'Mozilla/5.0 (P2P-Chat-Client)' }
    });

    const $ = cheerio.load(response.data);
    const title = $('meta[property="og:title"]').attr('content') || $('title').text();
    const desc = $('meta[property="og:description"]').attr('content') || '';
    const ogImg = $('meta[property="og:image"]').attr('content');

    let localImgPath = null;

    if (ogImg) {
      const imgName = `thumb_${urlHash}.jpg`;
      const imgDest = `${storageRoot}/previews/${imgName}`;

      const imgRes = await axios.get(ogImg, { responseType: 'arraybuffer' });
      await fs.mkdir(`${storageRoot}/previews`, { recursive: true });
      await fs.writeFile(imgDest, imgRes.data);

      localImgPath = `previews/${imgName}`;
    }

    await db.run(`
      INSERT OR REPLACE INTO link_metadata
      (url_hash, title, description, thumbnail_local_path)
      VALUES (?, ?, ?, ?)
    `, [urlHash, title, desc, localImgPath]);

    return { title, desc, localImgPath };
  } catch (error) {
    console.error('Link preview error:', error.message);
    return null;
  }
}

module.exports = { fetchSecureLinkPreview };
