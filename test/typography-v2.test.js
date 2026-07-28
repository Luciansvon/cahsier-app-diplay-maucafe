import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readPublic = (file) => readFile(new URL(`../public/${file}`, import.meta.url), 'utf8');

test('all pages load typography v2 last and use fresh CSS cache keys', async () => {
  const pages = [
    ['index.html', 'launcher.css'],
    ['admin.html', 'admin.css'],
    ['owner.html', 'owner.css'],
    ['partner.html', 'partner.css'],
    ['display.html', 'display.css'],
  ];

  for (const [page, roleCss] of pages) {
    const html = await readPublic(page);
    const baseIndex = html.indexOf('./base.css');
    const roleIndex = html.indexOf(`./${roleCss}`);
    const typographyIndex = html.indexOf('./typography.css');

    assert.ok(baseIndex >= 0, `${page} harus memakai base.css`);
    assert.ok(roleIndex > baseIndex, `${page} harus memuat ${roleCss} setelah base.css`);
    assert.ok(typographyIndex > roleIndex, `${page} harus memuat typography.css paling akhir`);
  }
});

test('legacy stacked typography overrides are removed from role stylesheets', async () => {
  const stylesheets = ['base.css', 'admin.css', 'owner.css', 'partner.css', 'display.css', 'launcher.css'];
  for (const stylesheet of stylesheets) {
    const css = await readPublic(stylesheet);
    assert.doesNotMatch(css, /typography-spacing-fix:/, `${stylesheet} masih memuat patch lama`);
  }
});

test('typography v2 defines coherent scale, spacing, wrapping, and responsive layouts', async () => {
  const css = await readPublic('typography.css');

  assert.match(css, /MAUCAFE Typography System v2/);
  assert.match(css, /--content-gutter:\s*clamp\(1rem,\s*2\.2vw,\s*1\.75rem\)/);
  assert.match(css, /--leading-body:\s*1\.55/);
  assert.match(css, /\.partner-toolbar\.card\s*\{[\s\S]*padding:\s*var\(--card-pad\)/);
  assert.match(css, /\.partner-panel\s*>\s*article\.card\s*\{[\s\S]*padding:/);
  assert.match(css, /\.owner-tab\s*\{[\s\S]*text-transform:\s*none/);
  assert.match(css, /\.tab\s*\{[\s\S]*text-transform:\s*none/);
  assert.match(css, /\.partner-tab\s*\{[\s\S]*text-transform:\s*none/);
  assert.match(css, /@media\s*\(max-width:\s*600px\)[\s\S]*\.tab-bar,[\s\S]*repeat\(2,/);
  assert.match(css, /@media\s*\(max-width:\s*600px\)[\s\S]*\.owner-tab:last-child/);
  assert.match(css, /@media\s*\(max-width:\s*600px\)[\s\S]*#partner-media-form,[\s\S]*grid-template-columns:\s*1fr/);
  assert.match(css, /\.queue-panel\s*\{[\s\S]*padding:\s*clamp\(2rem,\s*4vw,\s*4\.25rem\)/);
  assert.match(css, /\.active-number\s*\{[\s\S]*font-size:\s*clamp\(4\.75rem,/);
});

test('mobile form controls retain a readable 16px font size', async () => {
  const css = await readPublic('typography.css');
  assert.match(
    css,
    /@media\s*\(max-width:\s*480px\)[\s\S]*input,\s*select,\s*textarea\s*\{\s*font-size:\s*1rem/,
  );
});
