-- Unified SQLite Schema for Cross-Platform P2P Chat
-- Compatible with react-native-sqlite-storage (Mobile) and better-sqlite3 (Windows)

-- 1. Peers Table: Stores connection and cryptographic info
CREATE TABLE IF NOT EXISTS peers (
    peer_id TEXT PRIMARY KEY,        -- Unique identity (e.g., Public Key Hash)
    display_name TEXT,
    public_key TEXT NOT NULL,       -- Peer's public key for E2EE
    last_seen DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Messages Table: Central store for all communication
CREATE TABLE IF NOT EXISTS messages (
    message_id TEXT PRIMARY KEY,
    peer_id TEXT NOT NULL,
    direction TEXT CHECK(direction IN ('inbound', 'outbound')),
    payload_type TEXT CHECK(payload_type IN ('text', 'media', 'view_once', 'receipt', 'signal')),

    -- Encrypted content
    encrypted_blob BLOB NOT NULL,   -- The actual message or media metadata
    nonce BLOB NOT NULL,            -- Initialization Vector (IV) for AES-GCM

    -- Media specific
    media_local_path TEXT,          -- Relative path to the local file

    -- Status & Ephemerality
    is_viewed INTEGER DEFAULT 0,    -- 0=False, 1=True
    security_flags TEXT,            -- Metadata flags (e.g., 'anti-screenshot', 'blur-on-loss-focus')
    expires_at DATETIME NOT NULL,   -- Set to 12 hours after creation/receipt
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (peer_id) REFERENCES peers(peer_id) ON DELETE CASCADE
);

-- 3. Link_Metadata Table: Cache for secure link previews
CREATE TABLE IF NOT EXISTS link_metadata (
    url_hash TEXT PRIMARY KEY,      -- SHA-256 hash of the URL
    title TEXT,
    description TEXT,
    thumbnail_local_path TEXT,      -- Local path to downloaded thumbnail
    original_url TEXT,              -- Optional: Encrypted at rest
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Performance and Cleanup Indices
CREATE INDEX IF NOT EXISTS idx_messages_expiry ON messages(expires_at);
CREATE INDEX IF NOT EXISTS idx_messages_peer ON messages(peer_id);
CREATE INDEX IF NOT EXISTS idx_links_expiry ON link_metadata(fetched_at);
