/**
 * Manual-news shared helpers (src/config/newsLocales.ts): YouTube parsing,
 * slugify, text sanitation, safe-URL, and the country→locale target map.
 */
import { build } from 'esbuild';
async function load(entry) {
  const r = await build({ entryPoints: [entry], bundle: true, format: 'esm', write: false, platform: 'neutral',
    define: { 'import.meta.env': JSON.stringify({ VITE_COUNTRY_CODE: 'DE', VITE_APP_MODE: 'app', DEV: false }) } });
  return import('data:text/javascript;base64,' + Buffer.from(r.outputFiles[0].text).toString('base64'));
}
const m = await load('src/config/newsLocales.ts');

let passed = 0, failed = 0;
const is = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name} — expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`); }
};

console.log('\nManual-news shared helpers\n');

// YouTube — accept watch / youtu.be / shorts / bare id; reject everything else
is('watch URL', m.parseYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
is('youtu.be', m.parseYouTubeId('https://youtu.be/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
is('shorts', m.parseYouTubeId('https://www.youtube.com/shorts/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
is('bare id', m.parseYouTubeId('dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
is('nocookie embed', m.parseYouTubeId('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'), 'dQw4w9WgXcQ');
is('reject vimeo', m.parseYouTubeId('https://vimeo.com/12345678'), null);
is('reject arbitrary url', m.parseYouTubeId('https://evil.example/watch?v=dQw4w9WgXcQ'), null);
is('reject iframe html', m.parseYouTubeId('<iframe src="https://youtube.com/embed/dQw4w9WgXcQ"></iframe>'), null);
is('reject empty', m.parseYouTubeId(''), null);
is('reject short id', m.parseYouTubeId('https://youtu.be/abc'), null);
is('watch url builder', m.youTubeWatchUrl('dQw4w9WgXcQ'), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');

// slugify
is('slug basic', m.slugify('BAFA Grant Boost 2026!'), 'bafa-grant-boost-2026');
is('slug diacritics', m.slugify('MaPrimeRénov’ élargie'), 'maprimerenov-elargie');
is('slug empty → article', m.slugify(''), 'article');

// sanitize — strip tags/scripts/handlers, keep text + paragraphs
is('sanitize strips tags', m.sanitizeNewsText('Hello <script>alert(1)</script> <b>world</b>'), 'Hello alert(1) world');
is('sanitize keeps paragraphs', m.sanitizeNewsText('Para one.\n\nPara two.'), 'Para one.\n\nPara two.');
is('sanitize collapses blank runs', m.sanitizeNewsText('a\n\n\n\nb'), 'a\n\nb');

// safe URL
is('safe https', m.safeHttpUrl('https://gse.it/x'), 'https://gse.it/x');
is('reject javascript:', m.safeHttpUrl('javascript:alert(1)'), '');
is('reject empty', m.safeHttpUrl(''), '');

// targets — one source, correct locales
is('5 targets', m.NEWS_TARGETS.length, 5);
is('DE→de-DE/de', [m.NEWS_TARGET_BY_COUNTRY.DE.locale, m.NEWS_TARGET_BY_COUNTRY.DE.lang], ['de-DE', 'de']);
is('GB→en-GB/en isSource', [m.NEWS_TARGET_BY_COUNTRY.GB.locale, m.NEWS_TARGET_BY_COUNTRY.GB.isSource], ['en-GB', true]);
is('IT→it-IT/it', [m.NEWS_TARGET_BY_COUNTRY.IT.locale, m.NEWS_TARGET_BY_COUNTRY.IT.lang], ['it-IT', 'it']);
is('isNewsCountry', [m.isNewsCountry('IT'), m.isNewsCountry('ZZ')], [true, false]);

console.log(failed ? `\n✗ ${failed} assertion(s) failed\n` : `\n✓ all ${passed} news-helper assertions passed\n`);
process.exit(failed ? 1 : 0);
