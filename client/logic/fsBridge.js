/**
 * Cross-Platform File System Bridge.
 * Handles the differences between Node.js 'fs' and React Native 'react-native-fs'.
 */

let fs;

if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
    // Mobile: Use react-native-fs (Conceptual)
    // const RNFS = require('react-native-fs');
    fs = {
        unlink: async (path) => { /* RNFS.unlink(path) */ },
        mkdir: async (path, options) => { /* RNFS.mkdir(path) */ },
        writeFile: async (path, data, options) => { /* RNFS.writeFile(path, data, 'base64') */ }
    };
} else {
    // Desktop/Backend: Use Node.js fs
    const nodeFs = require('fs').promises;
    fs = {
        unlink: nodeFs.unlink,
        mkdir: (path, options) => nodeFs.mkdir(path, options),
        writeFile: (path, data, options) => nodeFs.writeFile(path, data, options)
    };
}

module.exports = fs;
