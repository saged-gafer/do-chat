/**
 * Cross-Platform Share Intent Handler.
 * Bridges the OS-level "Share to..." action into the P2P application logic.
 */

const { fetchSecureLinkPreview } = require('./linkPreview');

const IntentHandler = {
    /**
     * Entry point for incoming shared content (URLs, Text, Files).
     */
    async handleIncomingIntent(intent, storageRoot) {
        console.log(`[Intent] Received shared content:`, intent);

        const { type, value } = intent;

        switch (type) {
            case 'text/url':
            case 'text/plain':
                if (this.isUrl(value)) {
                    // Automatically trigger secure link preview generation
                    console.log(`[Intent] Processing shared URL: ${value}`);
                    return await fetchSecureLinkPreview(value, storageRoot);
                }
                break;

            case 'media/image':
            case 'media/video':
                // Logic to move the shared file into the app's secure internal storage
                console.log(`[Intent] Processing shared media file: ${value}`);
                return { type: 'media', path: value };

            default:
                console.warn(`[Intent] Unsupported intent type: ${type}`);
        }
    },

    isUrl(str) {
        try {
            new URL(str);
            return true;
        } catch (_) {
            return false;
        }
    }
};

module.exports = IntentHandler;
