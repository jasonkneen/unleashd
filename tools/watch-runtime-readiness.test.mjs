import assert from 'node:assert/strict';
import test from 'node:test';
import { missingRuntimeArtifacts } from './watch-runtime-readiness.mjs';

test('reports missing runtime artifacts while a clean build is incomplete', async () => {
  const missing = await missingRuntimeArtifacts(['/dist/a.js', '/dist/b.js'], async (file) => {
    if (file.endsWith('/b.js')) {
      throw Object.assign(new Error('not built yet'), { code: 'ENOENT' });
    }
  });

  assert.deepEqual(missing, ['/dist/b.js']);
});

test('propagates filesystem failures that are not a transient missing file', async () => {
  await assert.rejects(
    missingRuntimeArtifacts(['/dist/a.js'], async () => {
      throw Object.assign(new Error('permission denied'), { code: 'EACCES' });
    }),
    /permission denied/
  );
});
