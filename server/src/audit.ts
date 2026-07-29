import { getHarness, listHarnesses, resolveBinary } from '@nbardy/agent-cli';

export interface AuditResult {
  name: string;
  binary: string;
  installed: boolean;
  path: string | null;
}

export function auditLocalAgents(): AuditResult[] {
  const harnesses = listHarnesses();
  const results: AuditResult[] = [];

  for (const name of harnesses) {
    const config = getHarness(name);
    try {
      const binPath = resolveBinary(config.binary);
      results.push({ name, binary: config.binary, installed: true, path: binPath });
    } catch {
      results.push({ name, binary: config.binary, installed: false, path: null });
    }
  }

  const available = results.filter((result) => result.installed);
  const unavailable = results.filter((result) => !result.installed);
  console.log(
    `[agents] ${available.length}/${results.length} available: ${available
      .map((result) => result.name)
      .join(', ')}`
  );
  if (unavailable.length > 0) {
    console.log(
      `[agents] unavailable until installed: ${unavailable
        .map((result) => `${result.name} (${result.binary})`)
        .join(', ')}`
    );
  }

  return results;
}
