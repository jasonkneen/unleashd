import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { executeCommand } from '@nbardy/agent-cli';
import { parseJsonlFile } from '../src/adapters/jsonl';

async function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runTest() {
  const provider = 'claude';
  const testDir = path.join(os.tmpdir(), 'tool-integration-test');
  fs.mkdirSync(testDir, { recursive: true });

  const sessionId = 'test-session-' + Date.now();
  console.log(`[TEST] Starting session: ${sessionId}`);

  // Create a mock stream
  let streamText = '';

  const runTurn = async (prompt: string, resumeId?: string) => {
    console.log(`\n[TEST] Running prompt: "${prompt}"`);
    const turn = executeCommand({
      harness: provider,
      mode: 'conversation',
      prompt: prompt,
      cwd: testDir,
      resumeSessionId: resumeId,
      yolo: true,
      detached: true,
    });

    let currentSessionId = resumeId;
    let turnText = '';

    for await (const event of turn.events) {
      if (event.type === 'session.started') {
        currentSessionId = event.sessionId;
      } else if (event.type === 'tool.use') {
        if (event.displayText) {
          turnText += event.displayText;
          streamText += event.displayText;
        }
      } else if (event.type === 'text.delta') {
        turnText += event.text;
        streamText += event.text;
      }
    }
    
    await turn.completed;
    return { sessionId: currentSessionId, text: turnText };
  };

  // Turn 1
  const turn1 = await runTurn("Use the run_shell_command tool to run bash -c 'echo \"hello world\"'");
  console.log(`[TEST] Turn 1 stream text:\n${turn1.text}\n`);
  
  // Turn 2
  const turn2 = await runTurn("Now write 'tree' to file.sh using a shell command", turn1.sessionId);
  console.log(`[TEST] Turn 2 stream text:\n${turn2.text}\n`);

  // Turn 3
  const turn3 = await runTurn("Now run cat file.sh using a shell command", turn1.sessionId);
  console.log(`[TEST] Turn 3 stream text:\n${turn3.text}\n`);

  // Now, parse from disk
  const b64Path = Buffer.from(testDir).toString('base64');
  const sessionFile = path.join(os.homedir(), '.claude', 'projects', b64Path, `${turn1.sessionId}.jsonl`);
  
  console.log(`[TEST] Parsing session from disk: ${sessionFile}`);
  
  // Ensure the file was written
  await wait(1000);

  if (!fs.existsSync(sessionFile)) {
    throw new Error(`Session file not found: ${sessionFile}`);
  }

  const session = await parseJsonlFile(sessionFile);
  
  const allAssistantMessages = session.messages.filter(m => m.role === 'assistant').map(m => m.content).join('\\n');
  
  console.log('\\n--- PARSED FROM DISK ---');
  console.log(allAssistantMessages);
  
  console.log('\\n--- STREAMED ---');
  console.log(streamText);
  
  // Verify tools were formatted using the new standard!
  if (!allAssistantMessages.includes('⚡ run_shell_command')) {
    throw new Error('Parsed disk output did not contain the formatted tool string "⚡ run_shell_command"');
  }
  
  console.log('[TEST] SUCCESS! Disk parsing matches expected format.');
}

runTest().catch(console.error);
