import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addMediaItem,
  mediaDurationSeconds,
  removeMediaItem,
  reorderMediaItems,
} from '../src/media.js';
import { createInitialState } from '../src/queue.js';

function mp4WithDuration(seconds, timescale = 1000) {
  const mvhd = Buffer.alloc(28);
  mvhd.writeUInt32BE(28, 0);
  mvhd.write('mvhd', 4, 'ascii');
  mvhd.writeUInt32BE(timescale, 20);
  mvhd.writeUInt32BE(seconds * timescale, 24);
  const moov = Buffer.alloc(8 + mvhd.length);
  moov.writeUInt32BE(moov.length, 0);
  moov.write('moov', 4, 'ascii');
  mvhd.copy(moov, 8);
  const ftyp = Buffer.from([0, 0, 0, 12, 0x66, 0x74, 0x79, 0x70, 0, 0, 0, 0]);
  return Buffer.concat([ftyp, moov]);
}

test('reads MP4 movie duration and rejects malformed metadata', () => {
  assert.equal(mediaDurationSeconds(mp4WithDuration(42)), 42);
  assert.throws(() => mediaDurationSeconds(Buffer.from('not-an-mp4')), /durasi video/i);
});

test('playlist allows five videos plus images, validates duration, reorders, and removes', () => {
  let state = { ...createInitialState(), mediaPlaylist: [] };
  for (let index = 1; index <= 5; index += 1) {
    state = addMediaItem(state, {
      type: 'video',
      url: `/media/video-${index}.mp4`,
      filename: `video-${index}.mp4`,
      durationSeconds: index * 10,
      fit: 'cover',
    }).state;
  }
  state = addMediaItem(state, {
    type: 'image',
    url: '/media/promo.png',
    filename: 'promo.png',
    imageDurationSeconds: 12,
    fit: 'contain',
  }).state;
  assert.equal(state.mediaPlaylist.length, 6);
  assert.throws(() => addMediaItem(state, {
    type: 'video', url: '/media/six.mp4', filename: 'six.mp4', durationSeconds: 10,
  }), /maksimal 5 video/i);
  assert.throws(() => addMediaItem({ ...state, mediaPlaylist: [] }, {
    type: 'video', url: '/media/long.mp4', filename: 'long.mp4', durationSeconds: 121,
  }), /maksimal 120 detik/i);

  const reversedIds = state.mediaPlaylist.map((item) => item.id).reverse();
  state = reorderMediaItems(state, reversedIds).state;
  assert.deepEqual(state.mediaPlaylist.map((item) => item.id), reversedIds);
  const removedId = state.mediaPlaylist[0].id;
  state = removeMediaItem(state, removedId).state;
  assert.equal(state.mediaPlaylist.some((item) => item.id === removedId), false);
});
