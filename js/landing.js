import { CONFIG } from './config.js';
import { loadContent } from './cms.js';
import { initCookieConsent } from './cookies.js';
import { initLiveStatus } from './live-status.js';

document.documentElement.classList.add('js');
initCookieConsent();
initLiveStatus();
document.querySelector('#year').textContent = new Date().getFullYear();

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Menú móvil
const toggle = document.querySelector('.nav-toggle');
const nav = document.querySelector('#site-nav');
const setMenu = (open) => {
  nav.classList.toggle('open', open);
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
};
toggle.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
nav.addEventListener('click', (event) => { if (event.target.closest('a')) setMenu(false); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') setMenu(false); });

// Aparición al hacer scroll
const revealItems = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window && !reduceMotion) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) { entry.target.classList.add('in'); observer.unobserve(entry.target); }
    });
  }, { threshold: 0.12 });
  revealItems.forEach((item) => observer.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add('in'));
}

// Parallax ligero
if (!reduceMotion) {
  const logo = document.querySelector('[data-parallax]');
  const photo = document.querySelector('[data-parallax-img]');
  let ticking = false;
  const update = () => {
    const y = window.scrollY;
    if (logo && y < window.innerHeight) logo.style.transform = `translateY(${y * 0.12}px)`;
    if (photo) {
      const rect = photo.parentElement.getBoundingClientRect();
      if (rect.bottom > 0 && rect.top < window.innerHeight) photo.style.transform = `translateY(${(rect.top - window.innerHeight / 2) * -0.06}px)`;
    }
    ticking = false;
  };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
}

// Brasas del hero
const canvas = document.querySelector('.embers');
if (canvas && !reduceMotion) {
  const ctx = canvas.getContext('2d');
  const hero = canvas.parentElement;
  let width = 0; let height = 0; let running = false;
  const count = window.innerWidth < 720 ? 28 : 56;
  const spawn = (initial) => ({
    x: Math.random() * width,
    y: initial ? Math.random() * height : height + 10,
    r: 0.6 + Math.random() * 1.8,
    vy: 0.25 + Math.random() * 0.8,
    drift: (Math.random() - 0.5) * 0.4,
    life: Math.random() * Math.PI * 2,
    hot: Math.random() < 0.35
  });
  let embers = [];
  const resize = () => {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    width = hero.clientWidth; height = hero.clientHeight;
    canvas.width = width * ratio; canvas.height = height * ratio;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    embers = Array.from({ length: count }, () => spawn(true));
  };
  const frame = () => {
    if (!running) return;
    ctx.clearRect(0, 0, width, height);
    embers.forEach((e, i) => {
      e.y -= e.vy; e.life += 0.03; e.x += e.drift + Math.sin(e.life) * 0.25;
      const fade = Math.max(0, Math.min(1, e.y / height));
      ctx.globalAlpha = fade * (0.45 + Math.sin(e.life * 2) * 0.25);
      ctx.fillStyle = e.hot ? '#E8452C' : '#C4521F';
      ctx.shadowColor = '#E8452C'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2); ctx.fill();
      if (e.y < -10) embers[i] = spawn(false);
    });
    requestAnimationFrame(frame);
  };
  resize();
  window.addEventListener('resize', resize);
  new IntersectionObserver(([entry]) => {
    running = entry.isIntersecting;
    if (running) requestAnimationFrame(frame);
  }).observe(hero);
}

// Contenido editable desde el panel de administración (si falla, se conserva el HTML)
await loadContent();

// Comparador antes / después
document.querySelectorAll('[data-compare]').forEach((box) => {
  const range = box.querySelector('.compare-range');
  const update = () => box.style.setProperty('--pos', `${range.value}%`);
  range.addEventListener('input', update);
  update();
});

// Servicios en el formulario
const serviceSelect = document.querySelector('#b-service');
Object.entries(CONFIG.services).forEach(([id, service]) => {
  serviceSelect.append(new Option(`${service.name} · ${service.price} €`, id));
});

// Reservas por WhatsApp
const form = document.querySelector('#booking-form');
const dateInput = document.querySelector('#b-date');
const timeSelect = document.querySelector('#b-time');
const status = document.querySelector('#booking-status');
const pad = (n) => String(n).padStart(2, '0');
const today = new Date();
dateInput.min = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

const toMinutes = (time) => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };

// Horas ya reservadas por otras personas (la base de datos solo devuelve horas, sin datos personales)
async function fetchTaken(date) {
  if (!CONFIG.supabaseUrl || !CONFIG.supabaseKey) return new Set();
  try {
    const response = await fetch(`${CONFIG.supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/booked_times`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: CONFIG.supabaseKey, Authorization: `Bearer ${CONFIG.supabaseKey}` },
      body: JSON.stringify({ p_date: date })
    });
    return response.ok ? new Set(await response.json()) : new Set();
  } catch {
    return new Set();
  }
}

let fillRun = 0;
async function fillTimes() {
  const run = ++fillRun;
  timeSelect.innerHTML = '';
  if (!dateInput.value) {
    timeSelect.append(new Option('Elige primero la fecha', '')); timeSelect.disabled = true; return;
  }
  const [y, m, d] = dateInput.value.split('-').map(Number);
  const weekday = new Date(y, m - 1, d).getDay() || 7;
  const slots = [];
  CONFIG.schedule[weekday].forEach(({ opening, closing }) => {
    for (let t = toMinutes(opening); t + 30 <= toMinutes(closing); t += 30) slots.push(`${pad(Math.floor(t / 60))}:${pad(t % 60)}`);
  });
  if (!slots.length) {
    timeSelect.append(new Option('Cerrado ese día', '')); timeSelect.disabled = true; return;
  }
  timeSelect.disabled = true;
  timeSelect.append(new Option('Cargando horas…', ''));
  const taken = await fetchTaken(dateInput.value);
  if (run !== fillRun) return;
  timeSelect.innerHTML = '';
  const free = slots.filter((slot) => !taken.has(slot));
  if (!free.length) {
    timeSelect.append(new Option('Completo ese día', '')); return;
  }
  timeSelect.disabled = false;
  timeSelect.append(new Option('Selecciona hora', ''));
  free.forEach((slot) => timeSelect.append(new Option(slot, slot)));
}
dateInput.addEventListener('change', fillTimes);

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const name = String(data.get('name') || '').trim();
  const service = CONFIG.services[String(data.get('service'))];
  const date = String(data.get('date') || '');
  const time = String(data.get('time') || '');
  const phone = String(data.get('phone') || '').trim();
  const honeypot = String(data.get('website') || '');
  if (!name || !service || !date || !time || !phone) {
    status.className = 'form-status error';
    status.textContent = 'Completa todos los campos para preparar tu cita.';
    return;
  }
  if (!/^\+?[0-9 ]{9,15}$/.test(phone)) {
    status.className = 'form-status error';
    status.textContent = 'Introduce un teléfono válido (solo números, 9 a 15 dígitos).';
    return;
  }
  const [y, m, d] = date.split('-');
  const message = `Hola, soy ${name}. Quería reservar ${service.name} el ${d}/${m}/${y} a las ${time}. Mi teléfono: ${phone}. ¿Tenéis hueco?`;
  const url = new URL(`https://wa.me/${CONFIG.whatsapp}`);
  url.searchParams.set('text', message);
  status.className = 'form-status';
  status.textContent = 'Se abrirá WhatsApp con tu mensaje. Envíalo para solicitar la cita.';
  if (!honeypot) {
    saveBooking({ name, service: String(data.get('service')), date, time, phone, elapsed: Date.now() - pageLoadedAt });
  }
  window.open(url.href, '_blank', 'noopener,noreferrer');
  setTimeout(fillTimes, 1500);
});

const pageLoadedAt = Date.now();

// Registro de la solicitud en Google Sheets; no bloquea ni impide abrir WhatsApp si falla
function saveBooking(booking) {
  saveToDatabase(booking);
  if (!CONFIG.bookingsUrl) return;
  const body = JSON.stringify({ ...booking, token: CONFIG.bookingsToken });
  // sendBeacon sobrevive a la apertura de WhatsApp; fetch queda como alternativa
  const queued = navigator.sendBeacon && navigator.sendBeacon(CONFIG.bookingsUrl, new Blob([body], { type: 'text/plain;charset=utf-8' }));
  if (queued) return;
  fetch(CONFIG.bookingsUrl, { method: 'POST', mode: 'no-cors', keepalive: true, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body }).catch(() => {});
}

// Registro en la base de datos del panel de administración (función con validación en servidor)
function saveToDatabase(booking) {
  if (!CONFIG.supabaseUrl || !CONFIG.supabaseKey) return;
  fetch(`${CONFIG.supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/submit_booking`, {
    method: 'POST',
    keepalive: true,
    headers: { 'Content-Type': 'application/json', apikey: CONFIG.supabaseKey, Authorization: `Bearer ${CONFIG.supabaseKey}` },
    body: JSON.stringify({ p_name: booking.name, p_phone: booking.phone, p_service: booking.service, p_date: booking.date, p_time: booking.time, p_elapsed: booking.elapsed, p_website: '' })
  }).catch(() => {});
}