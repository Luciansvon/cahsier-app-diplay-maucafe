import { normalizeQueueNumber, queueNumberPage, queueNumberText } from './queue-number.js';

const number = document.querySelector('#active-number');
const message = document.querySelector('#pickup-message');
const connection = document.querySelector('#display-connection');
const outletNameEl = document.querySelector('#display-outlet-name');
const promoVideo = document.querySelector('#promo-video');
const promoImage = document.querySelector('#promo-image');
const promoWrapper = document.querySelector('.promo-wrapper');
const promoBackdrop = document.querySelector('#promo-backdrop');
const preparingStatus = document.querySelector('#preparing-status');
const preparingPage = document.querySelector('#preparing-page');
const voiceButton = document.querySelector('#enable-voice');

function getOutletId() {
  const match = window.location.pathname.match(/\/outlet\/([^/]+)/);
  if (match) return match[1];
  return new URLSearchParams(window.location.search).get('outlet') || 'maucafe-alunalun';
}

const outletId = getOutletId();
const apiBase = `/api/outlet/${outletId}`;
const cacheKey = `queue-display-state-${outletId}`;
const STALE_AFTER_MS = 30_000;
const PREPARING_ROTATION_MS = 4_000;

let state = null;
let voiceEnabled = localStorage.getItem('queue-voice-enabled') === 'true';
let lastSpokenEvent = Number(localStorage.getItem(`queue-last-spoken-event-${outletId}`) || 0);
let currentMediaUrl = '';
let currentMediaId = '';
let playlistIndex = 0;
let preparingPageIndex = 0;
let preparingSignature = '';
let imageTimer = null;
let speechGeneration = 0;
let promoAudioMutedBeforeSpeech = true;
let promoAudioDuckActive = false;
let lastFreshAt = 0;
let events = null;

function setConnection(mode) {
  if (!connection) return;
  const labels = {
    online: 'Terhubung',
    reconnecting: 'Menghubungkan ulang...',
    offline: 'Koneksi terputus',
    stale: 'Data antrean tidak tersedia',
  };
  connection.textContent = labels[mode] || labels.offline;
  connection.className = `connection ${mode === 'online' ? 'online' : 'offline'}`;
}

function restorePromoAudio(generation) {
  if (generation !== speechGeneration || !promoAudioDuckActive) return;
  if (promoVideo) promoVideo.muted = promoAudioMutedBeforeSpeech;
  promoAudioDuckActive = false;
}

function announce(activeCall) {
  if (!voiceEnabled || !activeCall || activeCall.eventId <= lastSpokenEvent) return;
  const generation = ++speechGeneration;
  if (promoVideo && !promoVideo.hidden) {
    if (!promoAudioDuckActive) promoAudioMutedBeforeSpeech = promoVideo.muted;
    promoAudioDuckActive = true;
    promoVideo.muted = true;
  }
  try {
    speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(`Pesanan nomor ${queueNumberText(activeCall.queueNumber)}, silakan diambil.`);
    speech.lang = 'id-ID';
    speech.rate = 0.88;
    speech.volume = 1;
    speech.onend = () => restorePromoAudio(generation);
    speech.onerror = speech.onend;
    speechSynthesis.speak(speech);
    window.setTimeout(() => restorePromoAudio(generation), 15_000);
  } catch {
    restorePromoAudio(generation);
    return;
  }
  lastSpokenEvent = activeCall.eventId;
  localStorage.setItem(`queue-last-spoken-event-${outletId}`, String(lastSpokenEvent));
}

function setImageBackdrop(url = '') {
  if (!promoBackdrop || !promoWrapper) return;
  if (!url) {
    promoBackdrop.style.backgroundImage = '';
    promoWrapper.classList.remove('has-image-backdrop');
    return;
  }
  promoBackdrop.style.backgroundImage = `url(${JSON.stringify(url)})`;
  promoWrapper.classList.add('has-image-backdrop');
}

function resolvedMediaFit(promoMedia) {
  const requestedFit = promoMedia?.fit === 'cover' ? 'cover' : 'contain';
  if (promoMedia?.type === 'image' && promoMedia?.fitVersion !== 2) {
    return 'contain';
  }
  return requestedFit;
}

function renderMedia(promoMedia, position = 0, total = 1, { forcePlayback = false } = {}) {
  if (!promoMedia?.url) return false;
  const url = promoMedia.url;
  const fit = resolvedMediaFit(promoMedia);

  if (promoMedia.type === 'video') {
    setImageBackdrop('');
    if (promoImage) {
      promoImage.hidden = true;
    }
    if (promoVideo) {
      promoVideo.style.objectFit = fit;
      if (currentMediaUrl !== url) {
        currentMediaUrl = url;
        const source = promoVideo.querySelector('source') || promoVideo;
        source.src = url;
        promoVideo.load();
        promoVideo.play().catch(() => {});
      } else if (forcePlayback) {
        promoVideo.currentTime = 0;
        promoVideo.play().catch(() => {});
      }
      promoVideo.hidden = false;
    }
    return true;
  }

  if (promoMedia.type === 'image') {
    if (promoVideo) {
      promoVideo.pause();
      promoVideo.hidden = true;
    }
    setImageBackdrop(url);
    if (promoImage) {
      promoImage.style.objectFit = fit;
      if (currentMediaUrl !== url) {
        currentMediaUrl = url;
        promoImage.src = url;
      }
      promoImage.hidden = false;
    }
    return true;
  }

  setImageBackdrop('');
  return false;
}

function activePlaylist() {
  const playlist = (state?.mediaPlaylist ?? []).filter((item) => item.active !== false && item.url);
  if (playlist.length) return playlist;
  return state?.promoMedia?.url ? [{ id: 'legacy-promo', ...state.promoMedia }] : [];
}

function clearImageTimer() {
  if (imageTimer) window.clearTimeout(imageTimer);
  imageTimer = null;
}

function showPlaylistItem({ force = false, forcePlayback = false } = {}) {
  const playlist = activePlaylist();
  if (!playlist.length) {
    clearImageTimer();
    currentMediaId = '';
    currentMediaUrl = '';
    setImageBackdrop('');
    if (promoVideo) {
      promoVideo.pause();
      promoVideo.hidden = true;
    }
    if (promoImage) promoImage.hidden = true;
    return;
  }
  playlistIndex %= playlist.length;
  const item = playlist[playlistIndex];
  if (!force && currentMediaId === item.id) return;
  currentMediaId = item.id;
  clearImageTimer();
  renderMedia(item, playlistIndex, playlist.length, { forcePlayback });
  if (item.type === 'image') {
    imageTimer = window.setTimeout(
      () => advancePlaylist(),
      Math.max(3, Math.min(60, Number(item.imageDurationSeconds) || 8)) * 1000,
    );
  }
}

function advancePlaylist({ replayCurrent = false } = {}) {
  const playlist = activePlaylist();
  if (!playlist.length) return;
  playlistIndex = (playlistIndex + 1) % playlist.length;
  currentMediaId = '';
  showPlaylistItem({ force: true, forcePlayback: replayCurrent });
}

promoVideo?.addEventListener('ended', () => advancePlaylist({ replayCurrent: true }));
promoVideo?.addEventListener('error', () => advancePlaylist());
promoImage?.addEventListener('error', () => {
  setImageBackdrop('');
  advancePlaylist();
});

function renderPreparing(numbers, { reset = false } = {}) {
  const safeNumbers = Array.isArray(numbers) ? numbers : [];
  const signature = safeNumbers.join('|');
  if (reset || signature !== preparingSignature) {
    preparingSignature = signature;
    preparingPageIndex = 0;
  }
  const page = queueNumberPage(safeNumbers, preparingPageIndex);
  preparingPageIndex = page.pageIndex;
  if (preparingStatus) {
    preparingStatus.textContent = page.numbers.length
      ? page.numbers.join(', ')
      : 'Belum ada pesanan yang sedang dibuat';
  }
  if (preparingPage) {
    preparingPage.hidden = page.pageCount <= 1;
    preparingPage.textContent = `${page.pageIndex + 1} / ${page.pageCount}`;
  }
}

function renderQueue({ allowActiveNumber = true } = {}) {
  const activeCall = allowActiveNumber ? state?.activeCall : null;
  const preparing = allowActiveNumber ? (state?.preparingQueueNumbers ?? []) : [];
  if (number) number.textContent = activeCall ? normalizeQueueNumber(activeCall.queueNumber) : '---';
  if (message) {
    message.textContent = activeCall
      ? 'Silakan ambil pesanan di counter'
      : allowActiveNumber ? 'Belum ada pesanan siap' : 'Nomor antrean sedang diperbarui';
  }
  renderPreparing(preparing);
  if (allowActiveNumber) announce(activeCall);
}

function cacheState(nextState) {
  try {
    localStorage.setItem(cacheKey, JSON.stringify({ cachedAt: Date.now(), state: nextState }));
  } catch {
    // Cache display bukan data kritis. Kegagalan penyimpanan tidak boleh menghentikan layar.
  }
}

function applyState(nextState, { fresh = true } = {}) {
  state = nextState;
  if (fresh) {
    lastFreshAt = Date.now();
    cacheState(nextState);
  }
  if (nextState?.outletInfo && outletNameEl) outletNameEl.textContent = nextState.outletInfo.name.toUpperCase();
  renderQueue({ allowActiveNumber: fresh || Date.now() - lastFreshAt <= STALE_AFTER_MS });
  const ids = activePlaylist().map((item) => item.id);
  if (!ids.includes(currentMediaId)) {
    playlistIndex = 0;
    currentMediaId = '';
  }
  showPlaylistItem();
}

function renderStaleIfNeeded() {
  if (lastFreshAt && Date.now() - lastFreshAt <= STALE_AFTER_MS) return;
  setConnection('stale');
  renderQueue({ allowActiveNumber: false });
}

function loadCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(cacheKey) || 'null');
    if (!raw) return;
    if (raw.state) {
      state = raw.state;
      lastFreshAt = Number(raw.cachedAt) || 0;
    } else {
      state = raw; // kompatibilitas cache versi lama
      lastFreshAt = 0;
    }
    applyState(state, { fresh: false });
    renderStaleIfNeeded();
  } catch {
    localStorage.removeItem(cacheKey);
  }
}

function activateVoice() {
  voiceEnabled = true;
  localStorage.setItem('queue-voice-enabled', 'true');
  if (voiceButton) {
    voiceButton.textContent = 'Suara panggilan aktif';
    voiceButton.classList.add('enabled');
  }
  if (state?.activeCall) {
    lastSpokenEvent = Math.max(0, Number(state.activeCall.eventId) - 1);
    announce(state.activeCall);
  }
}

voiceButton?.addEventListener('click', activateVoice);
if (voiceEnabled && voiceButton) {
  voiceButton.textContent = 'Suara panggilan aktif';
  voiceButton.classList.add('enabled');
}
document.body.addEventListener('click', () => { if (!voiceEnabled) activateVoice(); }, { once: true });

async function syncState() {
  try {
    const response = await fetch(`${apiBase}/state`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Server tidak merespons');
    applyState(await response.json(), { fresh: true });
    setConnection('online');
  } catch {
    setConnection(lastFreshAt && Date.now() - lastFreshAt <= STALE_AFTER_MS ? 'offline' : 'stale');
    renderStaleIfNeeded();
  }
}

async function connect() {
  await syncState();
  events?.close();
  events = new EventSource(`${apiBase}/events`);
  events.onopen = () => setConnection('online');
  events.onmessage = (event) => {
    applyState(JSON.parse(event.data), { fresh: true });
    setConnection('online');
  };
  events.onerror = () => {
    setConnection('reconnecting');
    renderStaleIfNeeded();
  };
}

loadCache();
window.setInterval(() => {
  if (!lastFreshAt || Date.now() - lastFreshAt > STALE_AFTER_MS) return;
  const numbers = state?.preparingQueueNumbers ?? [];
  const page = queueNumberPage(numbers, preparingPageIndex);
  if (page.pageCount <= 1) return;
  preparingPageIndex = (page.pageIndex + 1) % page.pageCount;
  renderPreparing(numbers);
}, PREPARING_ROTATION_MS);
window.setInterval(syncState, 5000);
window.setInterval(renderStaleIfNeeded, 5000);
connect();
