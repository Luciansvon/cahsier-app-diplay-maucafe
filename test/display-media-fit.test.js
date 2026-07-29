import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { addMediaItem } from '../src/media.js';

const readPublic = (name) =>
  readFile(
    new URL(`../public/${name}`, import.meta.url),
    'utf8',
  );

test(
  'media baru default tampil penuh dan menyimpan fitVersion',
  () => {
    const state = {
      mediaPlaylist: [],
      revision: 0,
    };

    const image = addMediaItem(state, {
      type: 'image',
      url: '/media/example.webp',
      filename: 'example.webp',
      imageDurationSeconds: 8,
    }).item;

    assert.equal(image.fit, 'contain');
    assert.equal(image.fitVersion, 2);

    const cropped = addMediaItem(state, {
      type: 'image',
      url: '/media/crop.webp',
      filename: 'crop.webp',
      fit: 'cover',
      imageDurationSeconds: 8,
    }).item;

    assert.equal(cropped.fit, 'cover');
    assert.equal(cropped.fitVersion, 2);
  },
);

test(
  'display memiliki safe fit dan blurred backdrop',
  async () => {
    const [html, css, js] =
      await Promise.all([
        readPublic('display.html'),
        readPublic('display.css'),
        readPublic('display.js'),
      ]);

    assert.match(
      html,
      /id="promo-backdrop"/,
    );

    assert.match(
      html,
      /display\.css\?v=5/,
    );

    assert.match(
      html,
      /display\.js\?v=5/,
    );

    assert.match(
      css,
      /display-media-safe-fit-v2/,
    );

    assert.match(
      css,
      /\.promo-image\s*\{[\s\S]*object-fit:\s*contain/,
    );

    assert.match(
      css,
      /filter:[\s\S]*blur\(26px\)/,
    );

    assert.match(
      js,
      /promoMedia\?\.type === 'image'[\s\S]*promoMedia\?\.fitVersion !== 2/,
    );

    assert.match(
      js,
      /setImageBackdrop\(url\)/,
    );
  },
);

test(
  'UI upload default contain dan crop tetap tersedia',
  async () => {
    const [owner, partner] =
      await Promise.all([
        readPublic('owner.html'),
        readPublic('partner.html'),
      ]);

    for (const html of [owner, partner]) {
      const contain = html.indexOf(
        'value="contain">Tampilkan penuh',
      );

      const cover = html.indexOf(
        'value="cover">Isi panel',
      );

      assert.ok(contain >= 0);
      assert.ok(cover > contain);
    }
  },
);
