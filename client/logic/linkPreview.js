const axios = require('axios');
const cheerio = require('cheerio');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

/**
 * Fetches link previews LOCALLY on the client device.
 * This prevents the signaling server from knowing what links are being shared.
 * To prevent IP leaks to the target site, this could be routed through a Tor proxy
 * or a trusted VPN if required by the user's security settings.
 */
async function getSecureLinkPreview(url) {
  try {
    const urlHash = crypto.createHash('sha256').update(url).digest('hex');

    // 1. Check local cache (SQLite logic omitted for brevity)
    // if (existsInDb(urlHash)) return getFromDb(urlHash);

    // 2. Fetch the URL content
    // User-Agent is set to a common browser to avoid being blocked,
    // but minimized to reduce fingerprinting.
    const response = await axios.get(url, {
      timeout: 5000,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) PreviewFetcher/1.0' }
    });

    const $ = cheerio.load(response.data);

    // 3. Extract OpenGraph tags
    const preview = {
      url_hash: urlHash,
      title: $('meta[property="og:title"]').attr('content') || $('title').text(),
      description: $('meta[property="og:description"]').attr('content') || '',
      image_url: $('meta[property="og:image"]').attr('content') || ''
    };

    // 4. Securely download the thumbnail to local storage
    // instead of hotlinking (which would leak IP to the image host on render)
    if (preview.image_url) {
      const imgPath = path.join('previews', `${urlHash}.jpg`);
      const imgResponse = await axios.get(preview.image_url, { responseType: 'arraybuffer' });
      await fs.writeFile(imgPath, imgResponse.data);
      preview.local_image_path = imgPath;
    }

    return preview;
  } catch (error) {
    console.error(`Link preview failed for ${url}:`, error.message);
    return null;
  }
}

/**
 * Android/iOS Share Intent Handler Logic
 */
function handleIncomingShareIntent(intentData) {
    // If the intent contains a URL, trigger the preview fetch
    if (intentData.type === 'text/plain' && intentData.value.startsWith('http')) {
        return getSecureLinkPreview(intentData.value);
    }
}

module.exports = { getSecureLinkPreview, handleIncomingShareIntent };
