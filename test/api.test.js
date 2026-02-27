/**
 * API Tests for Claude Multi-Chat
 *
 * Spins up the server and tests WebSocket communication
 * Run with: npm test
 */

const WebSocket = require('ws');
const { spawn } = require('node:child_process');
const path = require('node:path');

const PORT = 3001; // Use different port for tests
const SERVER_URL = `ws://localhost:${PORT}`;

let serverProcess = null;

/**
 * Start the server on test port
 */
function startServer() {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, PORT: PORT };
    serverProcess = spawn('npx', ['tsx', 'src/server.ts'], {
      cwd: path.join(__dirname, '..', 'server'),
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let started = false;

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('[Server]', output.trim());
      if (output.includes('Server running') && !started) {
        started = true;
        setTimeout(resolve, 500); // Give server async init time (7000+ files parsed)
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error('[Server Error]', data.toString().trim());
    });

    serverProcess.on('error', reject);

    // Timeout if server doesn't start
    setTimeout(() => {
      if (!started) reject(new Error('Server failed to start'));
    }, 5000);
  });
}

/**
 * Stop the server
 */
function stopServer() {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    serverProcess = null;
  }
}

/**
 * Create WebSocket connection
 */
function createConnection() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(SERVER_URL);
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
    setTimeout(() => reject(new Error('Connection timeout')), 3000);
  });
}

/**
 * Wait for specific message type from WebSocket
 */
function waitForMessage(ws, type, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for message type: ${type}`));
    }, timeout);

    const handler = (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === type) {
          clearTimeout(timer);
          ws.off('message', handler);
          resolve(msg);
        }
      } catch (_e) {
        // Ignore parse errors
      }
    };

    ws.on('message', handler);
  });
}

/**
 * Send WebSocket message
 */
function send(ws, data) {
  ws.send(JSON.stringify(data));
}

// Test runner
async function runTests() {
  console.log('\n🧪 Starting API Tests\n');
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`✅ ${name}`);
      passed++;
    } catch (err) {
      console.log(`❌ ${name}`);
      console.log(`   Error: ${err.message}`);
      failed++;
    }
  }

  // Retry wrapper for tests that race against server async init (7000+ file parse).
  // waitForMessage can timeout if the server hasn't finished loading when the
  // test fires. Retrying with backoff is more robust than a single long timeout.
  async function testWithRetry(name, fn, retries = 2) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await fn();
        console.log(`✅ ${name}`);
        passed++;
        return;
      } catch (err) {
        if (attempt < retries) {
          console.log(`⚠️  ${name} (attempt ${attempt} failed, retrying...)`);
          await new Promise(r => setTimeout(r, 500));
        } else {
          console.log(`❌ ${name}`);
          console.log(`   Error: ${err.message}`);
          failed++;
        }
      }
    }
  }

  try {
    // Start server
    console.log('Starting server...');
    await startServer();
    console.log('Server started on port', PORT);
    console.log('');

    // Test: Connect and receive init
    await test('Connect and receive init message', async () => {
      const ws = await createConnection();
      const msg = await waitForMessage(ws, 'init');
      if (!msg.conversations) throw new Error('Missing conversations array');
      if (!msg.defaultCwd) throw new Error('Missing defaultCwd');
      ws.close();
    });

    // Test: Create conversation (retry — races with server async init)
    await testWithRetry('Create new conversation', async () => {
      const ws = await createConnection();
      await waitForMessage(ws, 'init');

      send(ws, { type: 'new_conversation' });
      const msg = await waitForMessage(ws, 'conversation_created');

      if (!msg.conversation) throw new Error('Missing conversation');
      if (!msg.conversation.id) throw new Error('Missing conversation id');
      if (!msg.conversation.workingDirectory) throw new Error('Missing workingDirectory');

      ws.close();
    });

    // Test: Create conversation with custom directory
    await test('Create conversation with custom directory', async () => {
      const ws = await createConnection();
      await waitForMessage(ws, 'init');

      send(ws, {
        type: 'new_conversation',
        workingDirectory: '/tmp',
      });
      const msg = await waitForMessage(ws, 'conversation_created');

      if (msg.conversation.workingDirectory !== '/tmp') {
        throw new Error(`Expected /tmp, got ${msg.conversation.workingDirectory}`);
      }

      ws.close();
    });

    // Test: Invalid directory returns error
    await test('Invalid directory returns error', async () => {
      const ws = await createConnection();
      await waitForMessage(ws, 'init');

      send(ws, {
        type: 'new_conversation',
        workingDirectory: '/nonexistent/path/12345',
      });
      const msg = await waitForMessage(ws, 'error');

      if (!msg.message.includes('not found')) {
        throw new Error(`Expected 'not found' error, got: ${msg.message}`);
      }

      ws.close();
    });

    // Test: Delete conversation
    await test('Delete conversation', async () => {
      const ws = await createConnection();
      await waitForMessage(ws, 'init');

      // Create first
      send(ws, { type: 'new_conversation' });
      const created = await waitForMessage(ws, 'conversation_created');
      const convId = created.conversation.id;

      // Delete
      send(ws, {
        type: 'delete_conversation',
        conversationId: convId,
      });
      const deleted = await waitForMessage(ws, 'conversation_deleted');

      if (deleted.conversationId !== convId) {
        throw new Error('Deleted wrong conversation');
      }

      ws.close();
    });

    // Test: Multiple connections receive same state (retry — races with server async init)
    await testWithRetry('Multiple connections sync state', async () => {
      const ws1 = await createConnection();
      const init1 = await waitForMessage(ws1, 'init');

      // Create conversation on ws1
      send(ws1, { type: 'new_conversation' });
      await waitForMessage(ws1, 'conversation_created');

      // Connect ws2 and check it sees the conversation
      const ws2 = await createConnection();
      const init2 = await waitForMessage(ws2, 'init');

      if (init2.conversations.length !== init1.conversations.length + 1) {
        throw new Error('Second connection missing new conversation');
      }

      ws1.close();
      ws2.close();
    });

    // Test: Upload rejects path traversal in conversationId
    await test('Upload rejects path traversal in conversationId', async () => {
      const http = require('node:http');
      const boundary = '----TestBoundary' + Date.now();
      const body = [
        `--${boundary}`,
        'Content-Disposition: form-data; name="conversationId"',
        '',
        '../../etc',
        `--${boundary}`,
        'Content-Disposition: form-data; name="files"; filename="test.txt"',
        'Content-Type: text/plain',
        '',
        'hello',
        `--${boundary}--`,
      ].join('\r\n');

      const result = await new Promise((resolve, reject) => {
        const req = http.request(
          {
            hostname: 'localhost',
            port: PORT,
            path: '/api/upload',
            method: 'POST',
            headers: {
              'Content-Type': `multipart/form-data; boundary=${boundary}`,
              'Content-Length': Buffer.byteLength(body),
            },
          },
          (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => resolve({ status: res.statusCode, body: data }));
          }
        );
        req.on('error', reject);
        req.write(body);
        req.end();
      });

      if (result.status < 400) {
        throw new Error(`Expected 4xx, got ${result.status}`);
      }
    });

    // Test: Malformed WS message returns error (not crash)
    await test('Malformed WS message returns error', async () => {
      const ws = await createConnection();
      await waitForMessage(ws, 'init');

      // Send a message missing required fields
      send(ws, { type: 'send_message' }); // missing conversationId and content
      // Server should not crash — verify by sending a valid message after
      send(ws, { type: 'new_conversation' });
      const msg = await waitForMessage(ws, 'conversation_created');
      if (!msg.conversation.id) throw new Error('Server crashed after malformed message');

      ws.close();
    });

    // Test: Deleted conversation does not reappear on new connection (retry — races with server async init)
    await testWithRetry('Deleted conversation stays deleted on reconnect', async () => {
      const ws1 = await createConnection();
      const init1 = await waitForMessage(ws1, 'init');
      const baseCount = init1.conversations.length;

      // Create then delete
      send(ws1, { type: 'new_conversation' });
      const created = await waitForMessage(ws1, 'conversation_created');
      const convId = created.conversation.id;

      send(ws1, { type: 'delete_conversation', conversationId: convId });
      await waitForMessage(ws1, 'conversation_deleted');
      ws1.close();

      // Reconnect and verify it's gone
      const ws2 = await createConnection();
      const init2 = await waitForMessage(ws2, 'init');

      const found = init2.conversations.find((c) => c.id === convId);
      if (found) {
        throw new Error('Deleted conversation reappeared in init');
      }
      if (init2.conversations.length !== baseCount) {
        throw new Error(
          `Expected ${baseCount} conversations, got ${init2.conversations.length}`
        );
      }

      ws2.close();
    });

    console.log(`\n${'='.repeat(40)}`);
    console.log(`Results: ${passed} passed, ${failed} failed`);
    console.log(`${'='.repeat(40)}\n`);
  } finally {
    stopServer();
  }

  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch((err) => {
  console.error('Test runner error:', err);
  stopServer();
  process.exit(1);
});
