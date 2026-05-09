/**
 * Cross-Platform File System Bridge.
 * Handles the differences between Node.js 'fs' and React Native 'react-native-fs'.
 */

let fs;

const isReactNative = typeof navigator !== 'undefined' && navigator.product === 'ReactNative';

if (isReactNative) {
    // Mobile: Use react-native-fs (Conceptual)
    // const RNFS = require('react-native-fs');
    fs = {
        unlink: async (path) => {
            console.log(`[Mobile FS] Unlinking: ${path}`);
            // await RNFS.unlink(path);
        },
        mkdir: async (path, options) => {
            console.log(`[Mobile FS] Mkdir: ${path}`);
            // await RNFS.mkdir(path);
        },
        writeFile: async (path, data, options) => {
            console.log(`[Mobile FS] WriteFile: ${path}`);
            // await RNFS.writeFile(path, data, 'base64');
        },
        exists: async (path) => {
            console.log(`[Mobile FS] Exists: ${path}`);
            // return await RNFS.exists(path);
        }
    };
} else {
    // Desktop/Backend: Use Node.js fs
    const nodeFs = require('fs').promises;
    fs = {
        unlink: nodeFs.unlink,
        mkdir: (path, options) => nodeFs.mkdir(path, options),
        writeFile: (path, data, options) => nodeFs.writeFile(path, data, options),
        exists: async (path) => {
            try {
                await nodeFs.access(path);
                return true;
            } catch {
                return false;
            }
        }
    };
}

module.exports = fs;
