/**
 * Simple Database Wrapper Bridge.
 * On Windows (Tauri/Electron), this would wrap 'better-sqlite3'.
 * On Mobile (React Native), this would wrap 'react-native-sqlite-storage'.
 */

class Database {
    constructor() {
        this.db = null; // To be initialized by platform-specific loader
    }

    // Abstracted methods for cross-platform use
    async run(sql, params = []) {
        console.log(`[DB Run] ${sql}`, params);
        // Implementation would call the underlying driver's run/execute
        return { changes: 1 };
    }

    async get(sql, params = []) {
        console.log(`[DB Get] ${sql}`, params);
        return {};
    }

    async all(sql, params = []) {
        console.log(`[DB All] ${sql}`, params);
        return [];
    }
}

module.exports = new Database();
