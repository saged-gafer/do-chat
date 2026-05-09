# Standardized P2P Messaging Protocol (JSON Examples)

All communication over WebRTC Data Channels MUST use this standardized JSON envelope.

## 1. The Standard Envelope
Every message is wrapped in this structure before being sent.

```json
{
  "version": "1.0",
  "type": "TEXT | MEDIA | VIEW_ONCE | RECEIPT | SIGNAL",
  "sender_id": "string (Peer Public Key Hash)",
  "timestamp": "ISO8601_STRING",
  "payload": "BASE64_ENCRYPTED_JSON_BLOB",
  "nonce": "BASE64_IV_OR_NONCE"
}
```

---

## 2. Payload Examples (Decrypted)

### Standard Text Message
`type: "TEXT"`
```json
{
  "text": "Hello! This is a secure P2P message.",
  "reply_to": "uuid-v4-of-previous-message (optional)"
}
```

### View Once Media Notification
`type: "VIEW_ONCE"`
```json
{
  "media_id": "uuid-v4",
  "mime_type": "image/jpeg",
  "file_size": 125400,
  "is_view_once": true,
  "thumbnail_blur_hash": "LEHLh[nn00%ASWh4pAe.v_f6pAt7",
  "security_flags": ["anti-screenshot", "blur-on-loss-focus"]
}
```

### Message Read / Media Viewed Receipt
`type: "RECEIPT"`
```json
{
  "target_message_id": "uuid-v4-of-original-message",
  "action": "READ | VIEWED | DELETED",
  "timestamp": "2024-05-09T14:30:00Z"
}
```

---

## 3. Protocol Flow for View Once Destruction
1. **Sender** sends `VIEW_ONCE` envelope + encrypted media bytes.
2. **Receiver** saves media locally and notifies UI.
3. **Receiver UI** displays media (e.g., on long-press).
4. **Receiver Backend** sends `RECEIPT` with `action: "VIEWED"` back to Sender.
5. **Receiver Backend** calls `processViewOnceMedia()` to physically delete the file and DB record.
6. **Sender Backend** receives the receipt and deletes its local copy of the sent media.
