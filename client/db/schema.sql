-- Local SQLite Schema for P2P Secure Chat

-- Contacts Table: Stores peer info and public keys for E2EE
CREATE TABLE IF NOT EXISTS contacts (
    id TEXT PRIMARY KEY,          -- Unique ID (e.g., public key hash or signaling ID)
    display_name TEXT,
    public_key TEXT NOT NULL,     -- Peer's public key for encrypting messages
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Messages Table: Stores E2EE payloads
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    contact_id TEXT NOT NULL,
    direction TEXT CHECK(direction IN ('inbound', 'outbound')),
    encrypted_payload BLOB NOT NULL, -- The AES-GCM encrypted message
    nonce BLOB NOT NULL,            -- Initialization vector for decryption
    message_type TEXT DEFAULT 'text', -- 'text', 'media', 'view_once'
    media_path TEXT,                -- Local path to encrypted media file
    is_viewed INTEGER DEFAULT 0,    -- 0=No, 1=Yes (Used for View Once logic)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
);

-- Link Previews Table: Cache for locally fetched previews
CREATE TABLE IF NOT EXISTS link_previews (
    url_hash TEXT PRIMARY KEY,      -- SHA-256 of the URL for privacy
    title TEXT,
    description TEXT,
    image_path TEXT,                -- Local path to cached thumbnail
    fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indices for performance and purge efficiency
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_link_previews_fetched_at ON link_previews(fetched_at);
