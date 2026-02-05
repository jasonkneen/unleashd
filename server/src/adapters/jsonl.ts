/**
 * JSONL Adapter
 *
 * Reads Claude Code's JSONL session files and converts them to our Conversation type.
 * Claude Code stores sessions at ~/.claude/projects/{encoded-path}/*.jsonl
 *
 * Key functions:
 * - loadAllConversations() - Load all sessions from all project directories
 * - parseJsonlFile() - Parse a single JSONL file
 * - extractMessagesFromEntries() - Convert JSONL entries to Message[]
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';
import type {
  Message,
  Conversation,
  Provider,
  SubAgent,
  JsonlEntry,
  JsonlSession,
  JsonlUserEntry,
  JsonlAssistantEntry,
  JsonlTextBlock,
  JsonlToolUseBlock,
} from '@claude-web-view/shared';
import {
  isJsonlUserEntry,
  isJsonlAssistantEntry,
  isJsonlTextBlock,
  isJsonlToolUseBlock,
} from '@claude-web-view/shared';

// =============================================================================
// Constants
// =============================================================================

/** Default location of Claude Code projects directory */
const CLAUDE_PROJECTS_DIR = path.join(os.homedir(), '.claude', 'projects');

/** Directory for Codex conversation persistence (our own format) */
const CODEX_PERSISTENCE_DIR = path.join(os.homedir(), '.claude-web-view', 'codex');

/** Track directories that have already warned about ENOENT (only log once) */
const warnedDirectories = new Set<string>();

// =============================================================================
// Directory Scanning
// =============================================================================

/**
 * Get all project directories in the Claude projects folder
 */
export async function getProjectDirectories(
  projectsDir: string = CLAUDE_PROJECTS_DIR
): Promise<string[]> {
  try {
    const entries = await fs.promises.readdir(projectsDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => path.join(projectsDir, entry.name));
  } catch (error: unknown) {
    const code = error instanceof Error && 'code' in error ? (error as NodeJS.ErrnoException).code : undefined;
    if (code === 'ENOENT') {
      // Only warn once per directory to avoid log spam during polling
      if (!warnedDirectories.has(projectsDir)) {
        warnedDirectories.add(projectsDir);
        console.warn(`Projects directory not found, skipping: ${projectsDir}`);
      }
    } else {
      console.warn(`Failed to read projects directory: ${projectsDir} (${error instanceof Error ? error.message : error})`);
    }
    return [];
  }
}

/**
 * Find all JSONL session files in a project directory
 */
export async function scanSessionDirectory(projectPath: string): Promise<string[]> {
  try {
    const entries = await fs.promises.readdir(projectPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.jsonl'))
      .map((entry) => path.join(projectPath, entry.name));
  } catch (error: unknown) {
    console.warn(`Failed to scan project directory: ${projectPath} (${error instanceof Error ? error.message : error})`);
    return [];
  }
}

/**
 * Decode a project directory name back to the original path
 * Claude Code encodes paths by replacing '/' with '-'
 * e.g., "-Users-nick-project" -> "/Users/nick/project"
 */
export function decodeProjectPath(encodedName: string): string {
  // The encoded name starts with '-' and replaces '/' with '-'
  // e.g., "-Users-nick-project" -> "/Users/nick/project"
  if (encodedName.startsWith('-')) {
    return encodedName.replace(/-/g, '/');
  }
  return encodedName;
}

// =============================================================================
// JSONL File Parsing
// =============================================================================

/**
 * Parse a JSONL file into a JsonlSession object
 * Uses streaming to handle large files efficiently
 */
export async function parseJsonlFile(filePath: string): Promise<JsonlSession> {
  const entries: JsonlEntry[] = [];
  let workingDirectory = '';
  let model = 'unknown';
  let createdAt: Date | null = null;
  let modifiedAt: Date | null = null;

  const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let skippedLines = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const entry = JSON.parse(line) as JsonlEntry;
      entries.push(entry);

      // Extract metadata from entries
      if (isJsonlUserEntry(entry) || isJsonlAssistantEntry(entry)) {
        // Get working directory from first entry with cwd
        if (!workingDirectory && 'cwd' in entry && entry.cwd) {
          workingDirectory = entry.cwd;
        }

        // Get model from first assistant message
        if (isJsonlAssistantEntry(entry) && (!model || model === 'unknown')) {
          if (entry.message?.model) {
            model = entry.message.model;
          }
        }

        // Track timestamps
        if (entry.timestamp) {
          const timestamp = new Date(entry.timestamp);
          if (!createdAt || timestamp < createdAt) {
            createdAt = timestamp;
          }
          if (!modifiedAt || timestamp > modifiedAt) {
            modifiedAt = timestamp;
          }
        }
      }
    } catch {
      skippedLines++;
    }
  }

  if (skippedLines > 0) {
    console.warn(`Skipped ${skippedLines} malformed line${skippedLines > 1 ? 's' : ''} in ${filePath}`);
  }

  // Extract session ID from filename
  const sessionId = path.basename(filePath, '.jsonl');

  // Fallback for working directory: decode from parent directory name
  if (!workingDirectory) {
    const projectDirName = path.basename(path.dirname(filePath));
    workingDirectory = decodeProjectPath(projectDirName);
  }

  return {
    sessionId,
    filePath,
    workingDirectory,
    model,
    createdAt: createdAt ?? new Date(),
    modifiedAt: modifiedAt ?? new Date(),
    entries,
  };
}

// =============================================================================
// Message Extraction
// =============================================================================

/**
 * Extract text content from a user entry
 */
function extractUserContent(entry: JsonlUserEntry): string {
  const content = entry.message.content;

  // Plain text message
  if (typeof content === 'string') {
    return content;
  }

  // Array of content blocks (usually tool results)
  if (Array.isArray(content)) {
    const textParts: string[] = [];

    for (const block of content) {
      if ('type' in block && block.type === 'tool_result' && 'content' in block) {
        // Include a short indicator for tool results
        const toolContent = block.content as string;
        if (toolContent.length > 200) {
          textParts.push(`[Tool result: ${toolContent.substring(0, 200)}...]`);
        } else {
          textParts.push(`[Tool result: ${toolContent}]`);
        }
      }
    }

    return textParts.join('\n') || '[Tool interaction]';
  }

  return '';
}

/**
 * Extract text content from an assistant entry
 */
function extractAssistantContent(entry: JsonlAssistantEntry): string {
  const content = entry.message.content;
  const textParts: string[] = [];

  for (const block of content) {
    if (isJsonlTextBlock(block)) {
      textParts.push((block as JsonlTextBlock).text);
    } else if (isJsonlToolUseBlock(block)) {
      const toolBlock = block as JsonlToolUseBlock;
      textParts.push(`[Tool: ${toolBlock.name}]`);
    }
    // Skip thinking blocks - internal reasoning
  }

  return textParts.join('\n') || '';
}

/**
 * Extract messages from JSONL entries
 * Filters to only user and assistant messages, extracts text content
 */
export function extractMessagesFromEntries(entries: JsonlEntry[]): Message[] {
  const messages: Message[] = [];

  for (const entry of entries) {
    if (isJsonlUserEntry(entry)) {
      const content = extractUserContent(entry);
      // Skip tool result messages that are just internal tool communication
      if (content && !content.startsWith('[Tool result:')) {
        messages.push({
          role: 'user',
          content,
          timestamp: new Date(entry.timestamp),
        });
      }
    } else if (isJsonlAssistantEntry(entry)) {
      const content = extractAssistantContent(entry);
      if (content) {
        messages.push({
          role: 'assistant',
          content,
          timestamp: new Date(entry.timestamp),
        });
      }
    }
  }

  // Deduplicate consecutive messages with same role and content
  // (Claude Code writes multiple entries per response)
  const deduped: Message[] = [];
  for (const msg of messages) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.role === msg.role && prev.content === msg.content) {
      // Skip duplicate
      continue;
    }
    deduped.push(msg);
  }

  return deduped;
}

// =============================================================================
// Sub-Agent Extraction
// =============================================================================

/**
 * Extract sub-agent history from JSONL entries by detecting Task tool uses.
 *
 * This reconstructs historical sub-agent invocations from completed sessions.
 * Sub-agents are detected when an assistant entry contains a tool_use block
 * with name === 'Task'.
 *
 * Limitations:
 * - All sub-agents are marked as 'completed' (we don't have failure data)
 * - Token counts are set to 0 (not available in JSONL)
 * - Tool use counts are estimates
 * - Timestamps use the entry timestamp (approximation)
 */
export function extractSubAgentsFromEntries(entries: JsonlEntry[]): SubAgent[] {
  const subAgents: SubAgent[] = [];
  let currentSubAgent: SubAgent | null = null;

  for (const entry of entries) {
    // Only process assistant entries that contain tool uses
    if (!isJsonlAssistantEntry(entry)) {
      continue;
    }

    const content = entry.message.content;
    const timestamp = new Date(entry.timestamp);

    // Scan all content blocks in this assistant message
    for (const block of content) {
      if (isJsonlToolUseBlock(block)) {
        const toolBlock = block as JsonlToolUseBlock;

        // Check if this is a Task tool (sub-agent spawn)
        if (toolBlock.name === 'Task') {
          // Complete the previous sub-agent if one is active
          if (currentSubAgent) {
            currentSubAgent.status = 'completed';
            currentSubAgent.completedAt = timestamp;
            subAgents.push(currentSubAgent);
          }

          // Extract description and subagent_type from input
          const input = toolBlock.input as Record<string, unknown>;
          const description = (input.description as string) || 'Sub-agent task';
          const subagentType = input.subagent_type as string | undefined;

          // Create new sub-agent
          currentSubAgent = {
            id: toolBlock.id,
            description: subagentType ? `[${subagentType}] ${description}` : description,
            status: 'running',
            toolUses: 0,
            tokens: 0,
            currentAction: undefined,
            startedAt: timestamp,
            completedAt: undefined,
          };
        } else if (currentSubAgent) {
          // Regular tool use within an active sub-agent
          currentSubAgent.toolUses += 1;
          currentSubAgent.currentAction = toolBlock.name;
        }
      }
    }
  }

  // Handle case where last sub-agent never got completed
  if (currentSubAgent) {
    currentSubAgent.status = 'completed';
    currentSubAgent.completedAt = currentSubAgent.startedAt;
    subAgents.push(currentSubAgent);
  }

  return subAgents;
}

// =============================================================================
// Conversion to Conversation
// =============================================================================

/**
 * Infer provider from model name
 */
export function inferProviderFromModel(model: string): Provider {
  if (model.includes('codex') || model.includes('gpt')) {
    return 'codex';
  }
  return 'claude';
}

/**
 * Convert a parsed JSONL session to our Conversation type
 */
export function jsonlSessionToConversation(session: JsonlSession): Conversation {
  return {
    id: session.sessionId,
    messages: extractMessagesFromEntries(session.entries),
    isRunning: false,
    isReady: false,
    createdAt: session.createdAt,
    workingDirectory: session.workingDirectory,
    loopConfig: null,
    provider: inferProviderFromModel(session.model),
    subAgents: extractSubAgentsFromEntries(session.entries),
    queue: [],
  };
}

// =============================================================================
// Main Loading Function
// =============================================================================

/**
 * Result of loading conversations, includes mtime index for subsequent polling.
 */
export interface LoadResult {
  conversations: Map<string, Conversation>;
  mtimes: Map<string, number>; // filepath → mtime ms
}

/**
 * Result of polling for changes since last check.
 */
export interface PollResult {
  updated: Map<string, Conversation>; // changed or new conversations
  mtimes: Map<string, number>;        // full updated mtime index
}

// =============================================================================
// Parallel Processing Helper
// =============================================================================

/**
 * Process items with bounded concurrency (worker-pool pattern).
 * No external dependencies — just Promise-based throttling.
 *
 * @param items - Array of items to process
 * @param concurrency - Max concurrent operations
 * @param fn - Async function to call on each item
 * @returns Array of results in the same order as input
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      results[index] = await fn(items[index]);
    }
  }

  // Start `concurrency` workers
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, worker);
  await Promise.all(workers);

  return results;
}

// =============================================================================
// File Discovery (Phase 1 — fast readdir + stat for mtime sorting)
// =============================================================================

interface DiscoveredFile {
  filePath: string;
  mtimeMs: number;
  forceProvider?: 'codex';
}

/**
 * Discover all JSONL files across both sources, sorted by mtime descending.
 * Stats each file to get mtime for sorting (most recently modified first).
 * This enables progressive loading: recent conversations appear first.
 */
async function discoverAllJsonlFiles(
  claudeProjectsDir: string,
  codexPersistenceDir: string
): Promise<DiscoveredFile[]> {
  const files: DiscoveredFile[] = [];

  async function scanSource(projectsDir: string, forceProvider?: 'codex') {
    const dirs = await getProjectDirectories(projectsDir);
    for (const projectDir of dirs) {
      const jsonlPaths = await scanSessionDirectory(projectDir);
      // Stat each file to get mtime (parallel within directory)
      const statPromises = jsonlPaths.map(async (filePath) => {
        try {
          const stat = await fs.promises.stat(filePath);
          return { filePath, mtimeMs: stat.mtimeMs, forceProvider };
        } catch {
          // File may have been deleted between readdir and stat
          return null;
        }
      });
      const results = await Promise.all(statPromises);
      for (const result of results) {
        if (result) files.push(result);
      }
    }
  }

  await Promise.all([
    scanSource(claudeProjectsDir),
    scanSource(codexPersistenceDir, 'codex'),
  ]);

  // Sort by mtime descending (most recent first)
  files.sort((a, b) => b.mtimeMs - a.mtimeMs);

  return files;
}

// =============================================================================
// File Parsing (Phase 2 — parallelized with concurrency limit)
// =============================================================================

interface ParsedResult {
  filePath: string;
  mtimeMs: number;
  conversation: Conversation | null;
  parseTimeMs: number;
}

/**
 * Parse a single JSONL file and return the conversation.
 * Returns null if parsing fails or produces empty messages.
 * Includes timing metrics for performance analysis.
 */
async function parseOneFile(file: DiscoveredFile): Promise<ParsedResult> {
  const startTime = performance.now();
  try {
    // mtimeMs already available from discovery phase
    const session = await parseJsonlFile(file.filePath);
    const parseTimeMs = performance.now() - startTime;

    if (session.entries.length === 0) {
      return { filePath: file.filePath, mtimeMs: file.mtimeMs, conversation: null, parseTimeMs };
    }

    const conversation = jsonlSessionToConversation(session);
    if (conversation.messages.length === 0) {
      return { filePath: file.filePath, mtimeMs: file.mtimeMs, conversation: null, parseTimeMs };
    }

    // Override provider if needed
    if (file.forceProvider) {
      conversation.provider = file.forceProvider;
    }

    return { filePath: file.filePath, mtimeMs: file.mtimeMs, conversation, parseTimeMs };
  } catch (error: unknown) {
    const parseTimeMs = performance.now() - startTime;
    console.warn(`Failed to parse session: ${path.basename(file.filePath)} (${error instanceof Error ? error.message : error})`);
    return { filePath: file.filePath, mtimeMs: 0, conversation: null, parseTimeMs };
  }
}

/**
 * Callback for progressive loading — invoked with batches of conversations.
 * Called multiple times during loading so clients receive data incrementally.
 */
export type LoadProgressCallback = (batch: Conversation[], progress: { loaded: number; total: number }) => void;

/**
 * Load all conversations from both Claude Code's JSONL files and Codex persistence files.
 *
 * Scans:
 * 1. ~/.claude/projects/* (Claude Code sessions)
 * 2. ~/.claude-web-view/codex/* (Codex sessions we persist)
 *
 * Phase 1: Discover all file paths + stat for mtime (sorted by mtime descending)
 * Phase 2: Parse files in parallel with bounded concurrency, emitting batches progressively
 *
 * Files are sorted by mtime descending (most recent first), so the onProgress callback
 * receives the most recently used conversations first. This enables the server to
 * broadcast batches to clients incrementally instead of waiting for all files.
 *
 * @param claudeProjectsDir - Directory containing Claude Code project folders
 * @param codexPersistenceDir - Directory containing Codex persistence files
 * @param onProgress - Optional callback invoked with batches of parsed conversations
 * @returns conversations + mtime index for subsequent polling
 */
export async function loadAllConversations(
  claudeProjectsDir: string = CLAUDE_PROJECTS_DIR,
  codexPersistenceDir: string = CODEX_PERSISTENCE_DIR,
  onProgress?: LoadProgressCallback
): Promise<LoadResult> {
  const CONCURRENCY = 10; // macOS default fd limit is 256; 10 is very safe
  const BATCH_SIZE = 50;  // Emit progress every N files

  // Phase 1: Discover all files (sorted by mtime descending)
  const discoverStart = performance.now();
  console.log('Discovering JSONL files...');
  const files = await discoverAllJsonlFiles(claudeProjectsDir, codexPersistenceDir);
  const discoverTimeMs = performance.now() - discoverStart;
  console.log(`Discovered ${files.length} JSONL files in ${discoverTimeMs.toFixed(0)}ms (sorted by mtime), parsing with concurrency=${CONCURRENCY}...`);

  // Phase 2: Parse files in parallel with batched progress callbacks
  const conversations = new Map<string, Conversation>();
  const mtimes = new Map<string, number>();
  const parseTimes: number[] = [];
  let batchBuffer: Conversation[] = [];
  let filesProcessed = 0;

  // Process files with bounded concurrency, emitting batches as we go
  const parseStart = performance.now();

  await mapWithConcurrency(files, CONCURRENCY, async (file) => {
    const result = await parseOneFile(file);

    // Track timing
    parseTimes.push(result.parseTimeMs);

    // Collect results
    if (result.mtimeMs > 0) {
      mtimes.set(result.filePath, result.mtimeMs);
    }
    if (result.conversation) {
      conversations.set(result.conversation.id, result.conversation);
      batchBuffer.push(result.conversation);
    }

    filesProcessed++;

    // Emit batch when threshold reached
    if (onProgress && batchBuffer.length >= BATCH_SIZE) {
      onProgress(batchBuffer, { loaded: filesProcessed, total: files.length });
      batchBuffer = [];
    }

    return result;
  });

  // Emit any remaining conversations in the final batch
  if (onProgress && batchBuffer.length > 0) {
    onProgress(batchBuffer, { loaded: filesProcessed, total: files.length });
  }

  const parseTimeMs = performance.now() - parseStart;

  // Log timing summary
  if (parseTimes.length > 0) {
    const sorted = [...parseTimes].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const avg = parseTimes.reduce((a, b) => a + b, 0) / parseTimes.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];

    console.log(`Parse timing (${parseTimes.length} files): min=${min.toFixed(1)}ms, avg=${avg.toFixed(1)}ms, median=${median.toFixed(1)}ms, p95=${p95.toFixed(1)}ms, max=${max.toFixed(1)}ms`);
  }

  const totalTimeMs = discoverTimeMs + parseTimeMs;
  console.log(`Loaded ${conversations.size} conversations from ${files.length} files in ${totalTimeMs.toFixed(0)}ms (discover: ${discoverTimeMs.toFixed(0)}ms, parse: ${parseTimeMs.toFixed(0)}ms)`);

  return { conversations, mtimes };
}

// =============================================================================
// File Polling — detect external changes to JSONL files
//
// Compares file mtimes against a previous index. Only re-parses files that
// changed. Skips conversations that are actively running (in-memory state
// is authoritative for those).
//
// NOTE: No dir-level mtime gate. Directory mtime only changes when files are
// added/removed, NOT when existing files are modified. Since we need to detect
// external writes to existing JSONL files, we must stat each file directly.
// Individual stat calls are cheap (microseconds).
// =============================================================================

/**
 * Poll for changes to JSONL files since the last check.
 *
 * @param prevMtimes - Previous mtime index (filepath → mtime ms)
 * @param activeIds - Conversation IDs currently running (skip these)
 * @returns Changed conversations + updated mtime index
 */
export async function pollForChanges(
  prevMtimes: Map<string, number>,
  activeIds: Set<string>,
  claudeProjectsDir: string = CLAUDE_PROJECTS_DIR,
  codexPersistenceDir: string = CODEX_PERSISTENCE_DIR
): Promise<PollResult> {
  const updated = new Map<string, Conversation>();
  const mtimes = new Map(prevMtimes);

  async function scanSource(projectsDir: string, forceProvider?: 'codex') {
    const dirs = await getProjectDirectories(projectsDir);

    for (const projectDir of dirs) {
      const jsonlFiles = await scanSessionDirectory(projectDir);

      for (const filePath of jsonlFiles) {
        try {
          const stat = await fs.promises.stat(filePath);
          const prevMtime = prevMtimes.get(filePath);

          // Skip if file mtime unchanged
          if (prevMtime !== undefined && stat.mtimeMs <= prevMtime) {
            continue;
          }

          // File is new or changed — re-parse
          mtimes.set(filePath, stat.mtimeMs);

          const sessionId = path.basename(filePath, '.jsonl');

          // Skip if this conversation is actively running
          if (activeIds.has(sessionId)) {
            continue;
          }

          const session = await parseJsonlFile(filePath);
          if (session.entries.length === 0) continue;

          const conversation = jsonlSessionToConversation(session);
          if (conversation.messages.length === 0) continue;

          if (forceProvider) {
            conversation.provider = forceProvider;
          }

          updated.set(conversation.id, conversation);
        } catch (error: unknown) {
          console.warn(`[Poll] Failed to parse: ${path.basename(filePath)} (${error instanceof Error ? error.message : error})`);
        }
      }

      // Also check for new files that weren't in the previous index
      // (already handled above — new files have no prevMtime entry)
    }
  }

  await scanSource(claudeProjectsDir);
  await scanSource(codexPersistenceDir, 'codex');

  return { updated, mtimes };
}
