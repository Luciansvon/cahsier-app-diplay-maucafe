import { randomUUID } from 'node:crypto';

const MAX_MEDIA_ITEMS = 20;
const MAX_IMAGE_ITEMS = 15;
const MAX_VIDEO_ITEMS = 5;

function clone(value) {
  return structuredClone(value);
}

function changed(state) {
  state.revision = (state.revision ?? 0) + 1;
  return state;
}

function findBox(buffer, wantedType, start = 0, end = buffer.length) {
  let offset = start;
  while (offset + 8 <= end) {
    let size = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    let headerSize = 8;
    if (size === 1) {
      if (offset + 16 > end) return null;
      const largeSize = buffer.readBigUInt64BE(offset + 8);
      if (largeSize > BigInt(Number.MAX_SAFE_INTEGER)) return null;
      size = Number(largeSize);
      headerSize = 16;
    } else if (size === 0) {
      size = end - offset;
    }
    if (size < headerSize || offset + size > end) return null;
    if (type === wantedType) return { offset, size, headerSize };
    if (['moov', 'trak', 'mdia'].includes(type)) {
      const nested = findBox(buffer, wantedType, offset + headerSize, offset + size);
      if (nested) return nested;
    }
    offset += size;
  }
  return null;
}

export function mediaDurationSeconds(buffer) {
  if (!Buffer.isBuffer(buffer)) throw new Error('Durasi video MP4 tidak dapat dibaca');
  const box = findBox(buffer, 'mvhd');
  if (!box) throw new Error('Durasi video MP4 tidak dapat dibaca');
  const payload = box.offset + box.headerSize;
  const version = buffer[payload];
  let timescale;
  let duration;
  if (version === 0 && payload + 20 <= box.offset + box.size) {
    timescale = buffer.readUInt32BE(payload + 12);
    duration = buffer.readUInt32BE(payload + 16);
  } else if (version === 1 && payload + 32 <= box.offset + box.size) {
    timescale = buffer.readUInt32BE(payload + 20);
    const rawDuration = buffer.readBigUInt64BE(payload + 24);
    if (rawDuration > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Durasi video MP4 tidak dapat dibaca');
    duration = Number(rawDuration);
  }
  if (!timescale || !Number.isFinite(duration)) throw new Error('Durasi video MP4 tidak dapat dibaca');
  const seconds = duration / timescale;
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('Durasi video MP4 tidak dapat dibaca');
  return Math.ceil(seconds * 1000) / 1000;
}

function validateUrl(value) {
  const url = String(value ?? '').trim();
  if (!/^\/media\/[A-Za-z0-9._-]+$/.test(url)) throw new Error('URL media tidak valid');
  return url;
}

export function addMediaItem(currentState, input, now = new Date().toISOString()) {
  const state = clone(currentState);
  state.mediaPlaylist = Array.isArray(state.mediaPlaylist) ? state.mediaPlaylist : [];
  const type = input?.type;
  if (!['video', 'image'].includes(type)) throw new Error('Tipe media tidak valid');
  if (state.mediaPlaylist.length >= MAX_MEDIA_ITEMS) {
    throw new Error(`Playlist maksimal ${MAX_MEDIA_ITEMS} media`);
  }
  if (type === 'video' && state.mediaPlaylist.filter((item) => item.type === 'video').length >= MAX_VIDEO_ITEMS) {
    throw new Error(`Playlist maksimal ${MAX_VIDEO_ITEMS} video`);
  }
  if (type === 'image' && state.mediaPlaylist.filter((item) => item.type === 'image').length >= MAX_IMAGE_ITEMS) {
    throw new Error(`Playlist maksimal ${MAX_IMAGE_ITEMS} foto`);
  }
  const durationSeconds = type === 'video' ? Number(input.durationSeconds) : null;
  if (type === 'video' && (!Number.isFinite(durationSeconds) || durationSeconds <= 0 || durationSeconds > 120)) {
    throw new Error('Durasi video maksimal 120 detik');
  }
  const imageDurationSeconds = type === 'image'
    ? Number(input.imageDurationSeconds ?? 8)
    : null;
  if (type === 'image' && (!Number.isSafeInteger(imageDurationSeconds) || imageDurationSeconds < 3 || imageDurationSeconds > 60)) {
    throw new Error('Durasi foto harus 3-60 detik');
  }
  const item = {
    id: `media-${randomUUID()}`,
    type,
    url: validateUrl(input.url),
    filename: String(input.filename ?? 'media').trim().slice(0, 120) || 'media',
    fit: input.fit === 'contain' ? 'contain' : 'cover',
    durationSeconds,
    imageDurationSeconds,
    createdAt: now,
    active: true,
  };
  state.mediaPlaylist.push(item);
  return { state: changed(state), item };
}

export function reorderMediaItems(currentState, orderedIds) {
  const state = clone(currentState);
  const items = Array.isArray(state.mediaPlaylist) ? state.mediaPlaylist : [];
  if (
    !Array.isArray(orderedIds)
    || orderedIds.length !== items.length
    || new Set(orderedIds).size !== items.length
  ) {
    throw new Error('Urutan playlist tidak valid');
  }
  const byId = new Map(items.map((item) => [item.id, item]));
  if (orderedIds.some((id) => !byId.has(id))) throw new Error('Urutan playlist tidak valid');
  state.mediaPlaylist = orderedIds.map((id) => byId.get(id));
  return { state: changed(state), mediaPlaylist: state.mediaPlaylist };
}

export function removeMediaItem(currentState, itemId) {
  const state = clone(currentState);
  const index = (state.mediaPlaylist ?? []).findIndex((item) => item.id === itemId);
  if (index < 0) throw new Error('Media playlist tidak ditemukan');
  const [item] = state.mediaPlaylist.splice(index, 1);
  return { state: changed(state), item, mediaPlaylist: state.mediaPlaylist };
}
