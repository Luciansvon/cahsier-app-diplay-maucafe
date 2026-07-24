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

function getOutletId() {
  const match = window.location.pathname.match(/\/outlet\/([^/]+)/);
  if (match) return match[1];
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('outlet') || 'maucafe-bsd';
}

const outletId = getOutletId();
const apiBase = `/api/outlet/${outletId}`;

let state = JSON.parse(localStorage.getItem(`queue-display-state-${outletId}`) || 'null');
let voiceEnabled = localStorage.getItem('queue-voice-enabled') === 'true';
let lastSpokenEvent = Number(localStorage.getItem(`queue-last-spoken-event-${outletId}`) || 0);
let promoIndex = 0;
let hasCustomMedia = false;
let currentMediaUrl = '';

const rupiah = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);

function setConnection(online) {
  if (connection) {
    connection.textContent = online ? 'Terhubung' : 'Koneksi terputus';
    connection.className = `connection ${online ? 'online' : 'offline'}`;
  }
}

function announce(activeCall) {
  if (!voiceEnabled || !activeCall || activeCall.eventId <= lastSpokenEvent) return;
  speechSynthesis.cancel();
  const speech = new SpeechSynthesisUtterance(`Pesanan nomor ${activeCall.queueNumber}, silakan diambil.`);
  speech.lang = 'id-ID';
  speech.rate = 0.88;
  speech.volume = 1;
  speechSynthesis.speak(speech);
  lastSpokenEvent = activeCall.eventId;
  localStorage.setItem(`queue-last-spoken-event-${outletId}`, String(lastSpokenEvent));
}

function renderMedia(promoMedia) {
  if (!promoMedia || !promoMedia.url) return false;

  const url = promoMedia.url;
  const isVideo = promoMedia.type === 'video';

  if (isVideo) {
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
    if (promoCounter) promoCounter.textContent = 'VIDEO';
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
    if (promoCounter) promoCounter.textContent = 'FOTO';
    return true;
  }

  return false;
}

function renderPromo() {
  if (hasCustomMedia) return;
  const products = state?.products?.filter((product) => product.active) ?? [];
  if (promoVideo) promoVideo.hidden = true;
  if (promoImage) promoImage.hidden = true;
  if (promo) promo.hidden = false;
  promo.replaceChildren();

  if (!products.length) {
    promo.innerHTML = '<p class="promo-kicker">HARI INI</p><h1>Racikan hangat<br>untuk harimu.</h1><p>Menu aktif akan tampil otomatis di layar ini.</p>';
    if (promoCounter) promoCounter.textContent = '01 / 01';
    if (promoTagline) promoTagline.textContent = 'MENU PILIHAN';
    return;
  }

  promoIndex %= products.length;
  const product = products[promoIndex];
  const kicker = document.createElement('p');
  kicker.className = 'promo-kicker';
  kicker.textContent = product.category.toUpperCase();
  const title = document.createElement('h1');
  title.textContent = product.name;
  const price = document.createElement('strong');
  price.className = 'promo-price';
  price.textContent = rupiah(product.price);
  promo.append(kicker, title, price);
  if (promoCounter) promoCounter.textContent = `${String(promoIndex + 1).padStart(2, '0')} / ${String(products.length).padStart(2, '0')}`;
  if (promoTagline) promoTagline.textContent = 'MENU PILIHAN';
}

function applyState(nextState) {
  state = nextState;
  localStorage.setItem(`queue-display-state-${outletId}`, JSON.stringify(state));

  if (nextState.outletInfo && outletNameEl) {
    outletNameEl.textContent = nextState.outletInfo.name.toUpperCase();
  }

  const activeCall = state.activeCall;
  if (number) number.textContent = activeCall?.queueNumber ?? '---';
  if (message) message.textContent = activeCall ? 'Silakan ambil pesanan di counter' : 'Menunggu panggilan berikutnya';
  announce(activeCall);

  hasCustomMedia = renderMedia(state.promoMedia);
  if (!hasCustomMedia) {
    renderPromo();
  }
}

function activateVoice() {
  voiceEnabled = true;
  localStorage.setItem('queue-voice-enabled', 'true');
  if (voiceButton) {
    voiceButton.textContent = '🔊 Suara Panggilan Aktif';
    voiceButton.classList.add('enabled');
  }
  if (state?.activeCall) {
    lastSpokenEvent = state.activeCall.eventId - 1;
    announce(state.activeCall);
  }
}

if (voiceButton) {
  voiceButton.addEventListener('click', activateVoice);

  if (voiceEnabled) {
    voiceButton.textContent = '🔊 Suara Panggilan Aktif';
    voiceButton.classList.add('enabled');
  }
}

document.body.addEventListener('click', () => {
  if (!voiceEnabled) activateVoice();
}, { once: true });

if (state) applyState(state);

async function syncState() {
  try {
    const response = await fetch(`${apiBase}/state`, { cache: 'no-store' });
    if (!response.ok) throw new Error('Server tidak merespons');
    applyState(await response.json());
    setConnection(true);
  } catch {
    setConnection(false);
  }
}

async function connect() {
  await syncState();
  const events = new EventSource(`${apiBase}/events`);
  events.onmessage = (event) => { applyState(JSON.parse(event.data)); setConnection(true); };
  events.onerror = () => setConnection(false);
}

window.setInterval(() => {
  if (!hasCustomMedia) {
    promoIndex += 1;
    renderPromo();
  }
}, 8000);
window.setInterval(syncState, 2000);

connect();
