/**
 * Simple Database Wrapper Bridge.
 * On Windows (Tauri/Electron), this would wrap 'better-sqlite3'.
 * On Mobile (React Native), this would wrap 'react-native-sqlite-storage'.
 */

class Database {
    constructor() {
        this.db = null; // To be initialized by platform-specific loader
    }

    /**
     * Initialization example for different platforms:
     *
     * Windows (better-sqlite3):
     * this.db = new Database('local.db');
     *
     * Mobile (react-native-sqlite-storage):
     * this.db = SQLite.openDatabase({ name: 'local.db', location: 'default' });
     */
    init(dbInstance) {
        this.db = dbInstance;
    }

    /**
     * Executes a SQL query (INSERT, UPDATE, DELETE).
     */
    async run(sql, params = []) {
        console.log(`[DB Run] ${sql}`, params);

        /* Implementation for better-sqlite3:
           const info = this.db.prepare(sql).run(params);
           return { changes: info.changes, lastInsertRowid: info.lastInsertRowid };
        */

        /* Implementation for react-native-sqlite-storage:
           return new Promise((resolve, reject) => {
               this.db.transaction(tx => {
                   tx.executeSql(sql, params, (_, result) => {
                       resolve({ changes: result.rowsAffected, lastInsertRowid: result.insertId });
                   }, (_, err) => reject(err));
               });
           });
        */

        return { changes: 1, lastInsertRowid: 1 };
    }

    /**
     * Fetches a single row from the database.
     */
    async get(sql, params = []) {
        console.log(`[DB Get] ${sql}`, params);

        /* Implementation for better-sqlite3:
           return this.db.prepare(sql).get(params);
        */

        /* Implementation for react-native-sqlite-storage:
           return new Promise((resolve, reject) => {
               this.db.transaction(tx => {
                   tx.executeSql(sql, params, (_, result) => {
                       resolve(result.rows.length > 0 ? result.rows.item(0) : null);
                   }, (_, err) => reject(err));
               });
           });
        */

        return null;
    }

    /**
     * Fetches all rows matching the query.
     */
    async all(sql, params = []) {
        console.log(`[DB All] ${sql}`, params);

        /* Implementation for better-sqlite3:
           return this.db.prepare(sql).all(params);
        */

        /* Implementation for react-native-sqlite-storage:
           return new Promise((resolve, reject) => {
               this.db.transaction(tx => {
                   tx.executeSql(sql, params, (_, result) => {
                       let rows = [];
                       for (let i = 0; i < result.rows.length; i++) {
                           rows.push(result.rows.item(i));
                       }
                       resolve(rows);
                   }, (_, err) => reject(err));
               });
           });
        */

        return [];
    }
}

module.exports = new Database();
