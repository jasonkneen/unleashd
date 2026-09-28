import assert from 'node:assert/strict';
import { register } from 'node:module';
import test from 'node:test';

// BuddyAboutCard imports a stylesheet; node cannot load CSS, so it loads as an empty module.
register(
  `data:text/javascript,${encodeURIComponent(`
    export async function load(url, context, nextLoad) {
      if (url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true };
      return nextLoad(url, context);
    }
  `)}`,
  import.meta.url
);
const { plainPreview } = await import('../src/components/buddies/BuddyAboutCard');

// The (i) card previews each memory doc in two lines. The soul template carries its guidance
// in HTML comments; leaking them made every Buddy's preview the same template prose.
test('memory preview drops comments and markdown syntax, keeps the words', () => {
  const soul = [
    '<!-- Write who this Buddy is.\nKeep it short. -->',
    '# Release Engineer',
    '',
    '- Ship **bounded** work with [evidence](https://x.test).',
    '> `long_term` notes live elsewhere',
    '<!-- unterminated',
  ].join('\n');
  assert.equal(
    plainPreview(soul),
    'Release Engineer — Ship bounded work with evidence. long_term notes live elsewhere'
  );
  assert.equal(plainPreview('<!-- only guidance -->\n# Title'), 'Title');
});
