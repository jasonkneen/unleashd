import os from 'node:os';
import path from 'node:path';

export const HOME_DIRECTORY = os.homedir();

export function expandHomeAlias(inputPath: string): string {
  if (inputPath === '~') return HOME_DIRECTORY;
  if (inputPath.startsWith('~/')) return path.join(HOME_DIRECTORY, inputPath.slice(2));
  if (path.sep === '\\' && inputPath.startsWith('~\\')) {
    return path.join(HOME_DIRECTORY, inputPath.slice(2));
  }
  return inputPath.startsWith('~') ? inputPath.replace(/^~/, HOME_DIRECTORY) : inputPath;
}

export function normalizeDirectoryInput(inputPath: string): string {
  const trimmed = inputPath.trim();
  return trimmed ? path.normalize(expandHomeAlias(trimmed)) : '';
}

export function resolveWorkingDirectoryInput(
  inputPath: string | null | undefined,
  fallback = process.cwd()
): string {
  const normalized = normalizeDirectoryInput(inputPath ?? '');
  const resolved = path.resolve(normalized || fallback);
  return resolved === path.parse(resolved).root ? resolved : resolved.replace(/[\\/]+$/, '');
}

export function displayPathWithHomeAlias(resolvedPath: string, useHomeAlias: boolean): string {
  if (!useHomeAlias) return resolvedPath;
  if (resolvedPath === HOME_DIRECTORY) return '~';
  return resolvedPath.startsWith(`${HOME_DIRECTORY}${path.sep}`)
    ? `~${resolvedPath.slice(HOME_DIRECTORY.length)}`
    : resolvedPath;
}

/**
 * Return whether candidate is root itself or a descendant of root.
 *
 * A string-prefix check is not a path boundary check: `/work/app-evil` starts
 * with `/work/app`. `path.relative` gives us path segments, so parent traversal
 * and absolute cross-volume results can be rejected explicitly.
 */
export function isPathWithin(
  root: string,
  candidate: string,
  options: { allowRoot?: boolean } = {}
): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  if (relative === '') return options.allowRoot !== false;
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}
