const number = document.querySelector('#active-number');
const message = document.querySelector('#pickup-message');
const connection = document.querySelector('#display-connection');
const promo = document.querySelector('#promo-content');
const promoCounter = document.querySelector('#promo-counter');
const voiceButton = document.querySelector('#enable-voice');

let state = JSON.parse(localStorage.getItem('queue-display-state') || 'null');
let voiceEnabled = localStorage.getItem('queue-voice-enabled') === 'true';
let lastSpokenEvent = Number(localStorage.getItem('queue-last-spoken-event') || 0);
let promoIndex = 0;

const rupiah = (value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);

function setConnection(online) {
  connection.textContent = online ? 'Terhubung' : 'Koneksi terputus';
  connection.className = `connection ${online ? 'online' : 'offline'}`;
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
  localStorage.setItem('queue-last-spoken-event', String(lastSpokenEvent));
}

function renderPromo() {
  const products = state?.products?.filter((product) => product.active) ?? [];
  promo.replaceChildren();
  if (!products.length) {
    promo.innerHTML = '<p class="promo-kicker">HARI INI</p><h1>Racikan hangat<br>untuk harimu.</h1><p>Menu aktif akan tampil otomatis di layar ini.</p>';
    promoCounter.textContent = '01 / 01';
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
  promoCounter.textContent = `${String(promoIndex + 1).padStart(2, '0')} / ${String(products.length).padStart(2, '0')}`;
}

function applyState(nextState) {
  state = nextState;
  localStorage.setItem('queue-display-state', JSON.stringify(state));
  const activeCall = state.activeCall;
  number.textContent = activeCall?.queueNumber ?? '---';
  message.textContent = activeCall ? 'Silakan ambil pesanan di counter' : 'Menunggu panggilan berikutnya';
  announce(activeCall);
  renderPromo();
}

voiceButton.addEventListener('click', () => {
  voiceEnabled = true;
  localStorage.setItem('queue-voice-enabled', 'true');
  voiceButton.textContent = 'Suara aktif';
  voiceButton.classList.add('enabled');
  if (state?.activeCall) {
    lastSpokenEvent = state.activeCall.eventId - 1;
    announce(state.activeCall);
  }
});

if (voiceEnabled) {
  voiceButton.textContent = 'Suara aktif';
  voiceButton.classList.add('enabled');
}
if (state) applyState(state);

async function connect() {
  try {
    const response = await fetch('/api/state', { cache: 'no-store' });
    if (!response.ok) throw new Error('Server tidak merespons');
    applyState(await response.json());
    setConnection(true);
  } catch {
    setConnection(false);
  }
  const events = new EventSource('/api/events');
  events.onmessage = (event) => { applyState(JSON.parse(event.data)); setConnection(true); };
  events.onerror = () => setConnection(false);
}

window.setInterval(() => {
  promoIndex += 1;
  renderPromo();
}, 8000);

connect();
