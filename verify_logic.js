/**
 * Enhanced verification script to simulate the backend logic.
 */

const { handleIncomingPayload } = require('./client/logic/messageController');
const { runPurgeCycle } = require('./client/logic/purgeJob');
const db = require('./client/db/database');

async function testBackend() {
    console.log('--- Starting Enhanced Backend Verification Test ---');

    const storageRoot = './test_storage';

    // Mock DB initialization with enhanced stubs
    db.init({
        // Mock DB implementation is not strictly needed for this test
        // as the wrapper logs all calls and returns defaults.
    });

    // 1. Simulate an incoming Text Message
    const textEnvelope = {
        version: '1.0',
        type: 'TEXT',
        sender_id: 'peer_123',
        timestamp: new Date().toISOString(),
        payload: Buffer.from(JSON.stringify({ text: 'Hello!' })).toString('base64'),
        nonce: Buffer.from('nonce_123').toString('base64')
    };

    console.log('\n[Test] Processing Text Payload...');
    const textResult = await handleIncomingPayload(textEnvelope, storageRoot);
    console.log('Result:', textResult);

    // 2. Simulate an incoming View Once Receipt
    const receiptEnvelope = {
        version: '1.0',
        type: 'RECEIPT',
        sender_id: 'peer_123',
        timestamp: new Date().toISOString(),
        payload: Buffer.from(JSON.stringify({
            target_message_id: 'msg_999',
            action: 'VIEWED'
        })).toString('base64'),
        nonce: Buffer.from('nonce_456').toString('base64')
    };

    console.log('\n[Test] Processing Receipt Payload...');
    const receiptResult = await handleIncomingPayload(receiptEnvelope, storageRoot);
    console.log('Result:', receiptResult);

    // 3. Simulate Purge Job
    console.log('\n[Test] Running Purge Cycle...');
    await runPurgeCycle(storageRoot);

    console.log('\n--- Verification Test Complete ---');
}

testBackend().catch(err => {
    console.error('Test Failed:', err);
    process.exit(1);
});
