import { isPathWithin } from './path-utils';

export type ProjectRootSource = () => Iterable<string>;

/**
 * Creates a boundary-aware path authorizer backed by the current project roots.
 *
 * The source is evaluated for every check because conversations may be added,
 * removed, or moved while the server is running.
 */
export function createKnownProjectAuthorizer(
  listProjectRoots: ProjectRootSource
): (resolvedPath: string) => boolean {
  return (resolvedPath) => {
    for (const projectRoot of listProjectRoots()) {
      if (isPathWithin(projectRoot, resolvedPath)) return true;
    }
    return false;
  };
}
