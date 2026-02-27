export function formatToolUse(name: string, input?: any): string {
  if (name === 'AskUserQuestion') {
    // Interactive widget, not a standard text line
    return `<!--ask_user_question:${JSON.stringify(input || {})}-->`;
  }

  const getEmoji = (toolName: string): string => {
    switch (toolName) {
      case 'read_file': return '📖';
      case 'write_file': return '✍️';
      case 'replace': return '✏️';
      case 'run_shell_command': return '⚡';
      case 'list_directory': return '📂';
      case 'glob': return '📂';
      case 'grep_search': return '🔍';
      case 'web_fetch': return '🌐';
      case 'code_execution': return '📓';
      case 'patch': return '🔀';
      case 'Task': return '▶️';
      default: return '🔧';
    }
  };

  const emoji = getEmoji(name);
  
  // Format the argument summary
  let argSummary = '';
  if (input && typeof input === 'object') {
    if (name === 'run_shell_command' && typeof input.command === 'string') {
      argSummary = input.command.includes('oompa run') ? `bash -c 'oompa run'` : input.command;
    } else if ((name === 'read_file' || name === 'write_file' || name === 'replace') && typeof input.file_path === 'string') {
      argSummary = input.file_path;
    } else if (name === 'Task' && typeof input.description === 'string') {
      argSummary = input.description;
    } else if (typeof input.path === 'string') {
      argSummary = input.path;
    } else if (typeof input.dir_path === 'string') {
      argSummary = input.dir_path;
    } else if (typeof input.query === 'string') {
      argSummary = input.query;
    } else if (typeof input.pattern === 'string') {
      argSummary = input.pattern;
    }
  }

  // Remove newlines from summary to keep it a single line
  if (argSummary) {
    argSummary = argSummary.split('\\n')[0].substring(0, 100);
  }

  return `${emoji} ${name}${argSummary ? ` ${argSummary}` : ''}`;
}

export function formatToolResult(content: string): string {
  if (content.length > 200) {
    return `[Tool result: ${content.substring(0, 200)}...]`;
  }
  return `[Tool result: ${content}]`;
}
