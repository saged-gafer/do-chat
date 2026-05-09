/**
 * GhostNet — Database Connection & Initialization
 * ================================================
 * Provides a single shared better-sqlite3 connection for the server process.
 * On mobile (React Native), swap this module's internals for
 * react-native-sqlite-storage — the schema and all SQL statements are identical.
 *
 * Usage:
 *   const db = require('./db');
 *   const row = db.prepare('SELECT * FROM peers WHERE peer_id = ?').get(id);
 */

'use strict';

const Database = require('better-sqlite3');
const fs       = require('fs');
const path     = require('path');

// ---------------------------------------------------------------------------
// Resolve DB and schema paths
// ---------------------------------------------------------------------------

// On Windows/Electron this would point to app.getPath('userData').
// On mobile, react-native-sqlite-storage resolves its own path automatically.
// Here we use a local `server/data/` directory for the signaling-server demo.
const DATA_DIR  = path.join(__dirname, '..', 'data');
const DB_PATH   = path.join(DATA_DIR, 'ghostnet.db');
const SCHEMA_SQL = path.join(__dirname, '..', 'db', 'schema.sql');

// Ensure the data directory exists (cross-platform: works on Windows & POSIX)
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ---------------------------------------------------------------------------
// Open database with safe production pragmas
// ---------------------------------------------------------------------------
const db = new Database(DB_PATH, {
  // verbose: console.log,  // Uncomment to log every SQL statement during dev
});

// Apply performance + safety pragmas immediately after opening
db.pragma('journal_mode = WAL');   // WAL = safer under concurrent reads
db.pragma('foreign_keys = ON');    // Enforce FK constraints
db.pragma('synchronous = NORMAL'); // Balance between safety and speed

// ---------------------------------------------------------------------------
// Initialize schema
// Read the canonical .sql file so the schema stays in a single source of truth
// ---------------------------------------------------------------------------
function initializeSchema() {
  const sql = fs.readFileSync(SCHEMA_SQL, 'utf8');

  // Execute the entire schema as a single batch.
  // better-sqlite3's exec() handles multi-statement SQL correctly.
  db.exec(sql);

  console.log('[DB] Schema initialized — ghostnet.db ready');
}

initializeSchema();

// ---------------------------------------------------------------------------
// Health check helper — used by startup and tests
// ---------------------------------------------------------------------------
function healthCheck() {
  const tables = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
    .all()
    .map(r => r.name);

  return {
    path:   DB_PATH,
    tables,
    ok:     ['link_metadata', 'messages', 'peers'].every(t => tables.includes(t)),
  };
}

module.exports = { db, healthCheck };
