/**
 * JSONC helper — strip // line comments and /* block comments *\/
 * before JSON.parse. Minimal, no string-awareness needed for catalog
 * (no // inside strings). Shared so server and vendor loaders stay in sync
 * without duplicating the regex.
 */
export function stripJsonc(text: string): string {
  return text.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
}
