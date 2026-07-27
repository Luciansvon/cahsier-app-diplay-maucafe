import { normalizeQueueNumber, queueNumberText } from './queue-number.js';

const number = document.querySelector('#active-number');
const message = document.querySelector('#pickup-message');
const connection = document.querySelector('#display-connection');
const outletNameEl = document.querySelector('#display-outlet-name');
const promo = document.querySelector('#promo-content');
const promoCounter = document.querySelector('#promo-counter');
const promoTagline = document.querySelector('#promo-tagline');
const promoVideo = document.querySelector('#promo-video');
const promoImage = document.querySelector('#promo-image');
const voiceButton = document.querySelector('#enable-voice');
const displayShell = document.querySelector('.display-shell');

function getOutletId() {
  const match = window.location.pathname.match(/\/outlet\/([^/]+)/);
  if (match) return match[1];
  return new URLSearchParams(window.location.search).get('outlet') || 'maucafe-alunalun';
}

const outletId = getOutletId();
const apiBase = `/api/outlet/${outletId}`;
const cacheKey = `queue-display-state-${outletId}`;
const STALE_AFTER_MS = 30_000;

let state = null;
let voiceEnabled = localStorage.getItem('queue-voice-enabled') === 'true';
let lastSpokenEvent = Number(localStorage.getItem(`queue-last-spoken-event-${outletId}`) || 0);
let promoIndex = 0;
let hasCustomMedia = false;
let currentMediaUrl = '';
let currentMediaId = '';
let playlistIndex = 0;
let imageTimer = null;
let speechGeneration = 0;
let lastFreshAt = 0;
let events = null;

const rupiah = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);

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

function announce(activeCall) {
  if (!voiceEnabled || !activeCall || activeCall.eventId <= lastSpokenEvent) return;
  const generation = ++speechGeneration;
  const resumeVideo = Boolean(promoVideo && !promoVideo.hidden && !promoVideo.paused);
  if (promoVideo) {
    promoVideo.muted = true;
    promoVideo.pause();
  }
  speechSynthesis.cancel();
  const speech = new SpeechSynthesisUtterance(`Pesanan nomor ${queueNumberText(activeCall.queueNumber)}, silakan diambil.`);
  speech.lang = 'id-ID';
  speech.rate = 0.88;
  speech.volume = 1;
  speech.onend = () => {
    if (generation === speechGeneration && resumeVideo && promoVideo && !promoVideo.hidden) {
      promoVideo.play().catch(() => {});
    }
  };
  speech.onerror = speech.onend;
  speechSynthesis.speak(speech);
  lastSpokenEvent = activeCall.eventId;
  localStorage.setItem(`queue-last-spoken-event-${outletId}`, String(lastSpokenEvent));
}

function renderMedia(promoMedia, position = 0, total = 1) {
  if (!promoMedia?.url) return false;
  const url = promoMedia.url;
  const fit = promoMedia.fit === 'contain' ? 'contain' : 'cover';
  if (promoVideo) promoVideo.style.objectFit = fit;
  if (promoImage) promoImage.style.objectFit = fit;

  if (promoMedia.type === 'video') {
    if (promoImage) promoImage.hidden = true;
    if (promoVideo) {
      if (currentMediaUrl !== url) {
        currentMediaUrl = url;
        const source = promoVideo.querySelector('source') || promoVideo;
        source.src = url;
        promoVideo.load();
        promoVideo.play().catch(() => {});
      }
      promoVideo.hidden = false;
    }
    if (promo) promo.hidden = true;
    if (promoTagline) promoTagline.textContent = 'PROMO OUTLET';
    if (promoCounter) promoCounter.textContent = `${String(position + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
    return true;
  }

  if (promoMedia.type === 'image') {
    if (promoVideo) {
      promoVideo.pause();
      promoVideo.hidden = true;
    }
    if (promoImage) {
      if (currentMediaUrl !== url) {
        currentMediaUrl = url;
        promoImage.src = url;
      }
      promoImage.hidden = false;
    }
    if (promo) promo.hidden = true;
    if (promoTagline) promoTagline.textContent = 'PROMO OUTLET';
    if (promoCounter) promoCounter.textContent = `${String(position + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
    return true;
  }
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

function showPlaylistItem({ force = false } = {}) {
  const playlist = activePlaylist();
  if (!playlist.length) {
    clearImageTimer();
    currentMediaId = '';
    hasCustomMedia = false;
    renderDefaultPromo();
    return;
  }
  playlistIndex %= playlist.length;
  const item = playlist[playlistIndex];
  if (!force && currentMediaId === item.id) return;
  currentMediaId = item.id;
  clearImageTimer();
  hasCustomMedia = renderMedia(item, playlistIndex, playlist.length);
  if (item.type === 'image') {
    imageTimer = window.setTimeout(
      () => advancePlaylist(),
      Math.max(3, Math.min(60, Number(item.imageDurationSeconds) || 8)) * 1000,
    );
  }
}

function advancePlaylist() {
  const playlist = activePlaylist();
  if (!playlist.length) return;
  playlistIndex = (playlistIndex + 1) % playlist.length;
  currentMediaId = '';
  showPlaylistItem({ force: true });
}

promoVideo?.addEventListener('ended', advancePlaylist);
promoVideo?.addEventListener('error', advancePlaylist);

function renderDefaultPromo() {
  if (hasCustomMedia || !promo) return;
  const products = state?.products?.filter((product) => product.active) ?? [];
  if (promoVideo) promoVideo.hidden = true;
  if (promoImage) promoImage.hidden = true;
  promo.hidden = false;
  promo.replaceChildren();

  if (!products.length) {
    const kicker = document.createElement('p');
    kicker.className = 'promo-kicker';
    kicker.textContent = 'HARI INI';
    const title = document.createElement('h1');
    title.append(document.createTextNode('Racikan hangat'), document.createElement('br'), document.createTextNode('untuk harimu.'));
    const text = document.createElement('p');
    text.textContent = 'Menu aktif akan tampil otomatis di layar ini.';
    promo.append(kicker, title, text);
    if (promoCounter) promoCounter.textContent = '01 / 01';
    if (promoTagline) promoTagline.textContent = 'MENU PILIHAN';
    return;
  }

  promoIndex %= products.length;
  const product = products[promoIndex];
  const kicker = document.createElement('p');
  kicker.className = 'promo-kicker';
  kicker.textContent = String(product.category || 'Menu').toUpperCase();
  const title = document.createElement('h1');
  title.textContent = product.name;
  const price = document.createElement('strong');
  price.className = 'promo-price';
  price.textContent = rupiah(product.price);
  promo.append(kicker, title, price);
  if (promoCounter) promoCounter.textContent = `${String(promoIndex + 1).padStart(2, '0')} / ${String(products.length).padStart(2, '0')}`;
  if (promoTagline) promoTagline.textContent = 'MENU PILIHAN';
}

function renderQueue({ allowActiveNumber = true } = {}) {
  const activeCall = allowActiveNumber ? state?.activeCall : null;
  displayShell?.classList.toggle('has-active-call', Boolean(activeCall));
  if (number) number.textContent = activeCall ? normalizeQueueNumber(activeCall.queueNumber) : '---';
  if (message) {
    message.textContent = activeCall
      ? 'Silakan ambil pesanan di counter'
      : allowActiveNumber ? 'Menunggu panggilan berikutnya' : 'Nomor antrean sedang diperbarui';
  }
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
  if (!hasCustomMedia) {
    promoIndex += 1;
    renderDefaultPromo();
  }
}, 8000);
window.setInterval(syncState, 5000);
window.setInterval(renderStaleIfNeeded, 5000);
connect();
