# Standardized P2P Messaging Protocol (WebRTC JSON)

To ensure seamless communication between Windows and Mobile, all messages sent over WebRTC Data Channels must follow this JSON structure.

## 1. Message Envelope
Every payload is wrapped in a standard envelope.

```json
{
  "version": "1.0",
  "type": "TEXT | MEDIA | VIEW_ONCE | RECEIPT | SIGNAL",
  "sender_id": "string",
  "timestamp": "ISO8601_STRING",
  "payload": "BASE64_ENCRYPTED_BLOB",
  "nonce": "BASE64_NONCE"
}
```

---

## 2. Decrypted Payload Examples (Internal)

### Standard Text Message
The `payload` field once decrypted:
```json
{
  "text": "Hello! This is a secure message.",
  "reply_to": "message_id_optional"
}
```

### "View Once" Media Notification
When sending media, the sender first uploads the encrypted file via P2P chunking (or separate data channel) and then sends the metadata:
```json
{
  "media_id": "uuid-v4",
  "mime_type": "image/jpeg",
  "file_size": 102456,
  "is_view_once": true,
  "thumbnail_preview": "BASE64_BLUR_HASH"
}
```

### "Message Read / Media Viewed" Receipt
Crucial for triggering the destruction of View Once media on both ends.
```json
{
  "type": "RECEIPT",
  "target_message_id": "uuid-of-original-message",
  "action": "READ | VIEWED | DELETED",
  "timestamp": "ISO8601_STRING"
}
```

---

## 3. Protocol Flow for View Once
1.  **Sender**: Encrypts media -> Sends `VIEW_ONCE` envelope -> Sends media bytes.
2.  **Receiver**: Saves media to local encrypted storage -> Notifies UI.
3.  **Receiver UI**: User opens media -> UI triggers `VIEWED` receipt.
4.  **Receiver Backend**: Immediately calls `processViewOnceMedia()` to delete local file and DB entry.
5.  **Sender Backend**: Receives `VIEWED` receipt -> Deletes their local copy of the sent media.
