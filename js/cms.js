import { CONFIG } from './config.js';
import { mediaUrl, safeUrl } from './media.js';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const ISO_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const digits = (value) => String(value || '').replace(/\D/g, '');

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => { if (value !== null && value !== undefined && value !== false) node.setAttribute(key, value === true ? '' : value); });
  children.forEach((child) => { if (child !== null && child !== undefined) node.append(child); });
  return node;
}

function setText(node, value) {
  const lines = String(value).split('\n');
  node.replaceChildren(...lines.flatMap((line, index) => (index ? [document.createElement('br'), document.createTextNode(line)] : [document.createTextNode(line)])));
}

async function get(path, signal) {
  const response = await fetch(`${CONFIG.supabaseUrl.replace(/\/$/, '')}/rest/v1/${path}`, {
    signal,
    headers: { apikey: CONFIG.supabaseKey, Authorization: `Bearer ${CONFIG.supabaseKey}` }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

function deriveLinks(contact, links) {
  const wa = digits(contact.whatsapp);
  const phone = digits(contact.phone);
  const query = String(contact.map_query || '');
  return {
    wa: wa ? `https://wa.me/${wa}` : '',
    tel: phone ? `tel:+${phone.length === 9 ? `34${phone}` : phone}` : '',
    directions: safeUrl(links.maps_url) || (query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : ''),
    map_embed: query ? `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed` : ''
  };
}

function validSlots(slots) {
  return (Array.isArray(slots) ? slots : [])
    .filter((slot) => slot && TIME.test(slot.opening) && TIME.test(slot.closing) && slot.opening < slot.closing)
    .map(({ opening, closing }) => ({ opening, closing }));
}

function bind(values) {
  const lookup = (path) => path.split('.').reduce((acc, key) => (acc ? acc[key] : undefined), values);
  document.querySelectorAll('[data-cms-text]').forEach((node) => {
    const value = lookup(node.dataset.cmsText);
    if (typeof value === 'string' && value.trim()) setText(node, value);
  });
  document.querySelectorAll('[data-cms-href]').forEach((node) => {
    const value = lookup(node.dataset.cmsHref);
    const safe = typeof value === 'string' ? safeUrl(value, ['https:', 'tel:']) : '';
    if (safe) node.setAttribute('href', safe);
  });
  document.querySelectorAll('[data-cms-img]').forEach((node) => {
    const src = mediaUrl(lookup(node.dataset.cmsImg));
    if (src) node.setAttribute('src', src);
  });
  document.querySelectorAll('[data-cms-src]').forEach((node) => {
    const value = lookup(node.dataset.cmsSrc);
    if (typeof value === 'string' && value.startsWith('https://www.google.com/maps')) node.setAttribute('src', value);
  });
  document.querySelectorAll('[data-cms-social]').forEach((item) => {
    const url = safeUrl(values.links?.[item.dataset.cmsSocial]);
    const link = item.querySelector('a');
    if (url && link) { link.setAttribute('href', url); item.hidden = false; } else { item.hidden = true; }
  });
}

function renderServices(rows) {
  const list = document.querySelector('#services-list');
  if (!list || !rows.length) return;
  const price = (n) => `${Number(n).toLocaleString('es-ES', { maximumFractionDigits: 2 })} €`;
  list.replaceChildren(...rows.map((row) => el('li', { class: `card${row.featured ? ' card-featured' : ''} reveal in` },
    row.featured && row.tag ? el('span', { class: 'tag' }, row.tag) : null,
    el('h3', {}, row.name), el('p', {}, row.description), el('span', { class: 'price' }, price(row.price)))));
}

function renderHours(schedule) {
  const dl = document.querySelector('#hours-list');
  if (!dl) return;
  const label = (slots) => (slots.length ? slots.map((s) => `${s.opening.replace(/^0/, '')}–${s.closing.replace(/^0/, '')}`).join(' · ') : 'Cerrado');
  const groups = [];
  for (let day = 1; day <= 7; day += 1) {
    const text = label(schedule[day]);
    const last = groups[groups.length - 1];
    if (last && last.text === text) last.end = day; else groups.push({ start: day, end: day, text });
  }
  dl.replaceChildren(...groups.map((g) => el('div', {},
    el('dt', {}, g.start === g.end ? DAYS[g.start - 1] : `${DAYS[g.start - 1]} a ${DAYS[g.end - 1].toLowerCase()}`),
    el('dd', {}, g.text))));
}

function renderGallery(rows) {
  const list = document.querySelector('#gallery-list');
  if (!list) return;
  list.replaceChildren(...rows.map((row) => {
    const src = mediaUrl(row.image);
    if (!src) return null;
    return el('li', { class: 'reveal in' },
      el('img', { src, alt: row.alt || '', width: 800, height: 1000, loading: 'lazy', decoding: 'async', class: row.contain ? 'logo-tile' : null }),
      row.caption ? el('span', {}, row.caption) : null);
  }).filter(Boolean));
}

function renderTeam(rows) {
  const list = document.querySelector('#team-list');
  if (!list) return;
  list.replaceChildren(...rows.map((row) => {
    const src = mediaUrl(row.photo);
    const avatar = el('div', { class: 'avatar' });
    if (src) {
      avatar.append(el('img', { src, alt: row.name, width: 400, height: 400, loading: 'lazy', decoding: 'async' }));
    } else {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('aria-hidden', 'true');
      const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
      use.setAttribute('href', '#person');
      svg.append(use);
      avatar.append(svg);
    }
    return el('li', { class: 'reveal in' }, avatar, el('h3', {}, row.name), row.role ? el('p', { class: 'role' }, row.role) : null);
  }));
}

function renderReviews(rows) {
  const list = document.querySelector('#reviews-list');
  if (!list) return;
  list.replaceChildren(...rows.map((row) => el('li', { class: 'card reveal in' },
    el('p', { class: 'stars', role: 'img', 'aria-label': `${row.rating} estrellas de 5` }, '★'.repeat(row.rating) + '☆'.repeat(5 - row.rating)),
    el('p', {}, `“${row.text}”`), el('h3', {}, row.author))));
}

function updateStructuredData(schedule, phone) {
  const script = document.querySelector('script[type="application/ld+json"]');
  if (!script) return;
  try {
    const data = JSON.parse(script.textContent);
    if (phone) data.telephone = phone;
    data.openingHoursSpecification = Object.entries(schedule).flatMap(([day, slots]) => slots.map((slot) => (
      { '@type': 'OpeningHoursSpecification', dayOfWeek: [ISO_DAYS[day - 1]], opens: slot.opening, closes: slot.closing })));
    script.textContent = JSON.stringify(data);
  } catch { /* se mantiene el JSON-LD original */ }
}

/** Carga el contenido editable desde Supabase. Si algo falla, la web conserva el contenido del HTML. */
export async function loadContent(timeoutMs = 2500) {
  if (!CONFIG.supabaseUrl || !CONFIG.supabaseKey) return false;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const [content, services, schedule, team, gallery, reviews] = await Promise.all([
      get('site_content?select=key,value', controller.signal),
      get('services?select=*&active=eq.true&order=sort.asc', controller.signal),
      get('schedule?select=*&order=day.asc', controller.signal),
      get('team_members?select=*&active=eq.true&order=sort.asc', controller.signal),
      get('gallery_items?select=*&active=eq.true&order=sort.asc', controller.signal),
      get('reviews?select=*&active=eq.true&order=sort.asc', controller.signal)
    ]);
    const values = Object.fromEntries(content.map((row) => [row.key, row.value || {}]));
    values.texts ||= {}; values.contact ||= {}; values.links ||= {}; values.images ||= {};
    values.derived = deriveLinks(values.contact, values.links);

    if (values.contact.phone) CONFIG.phone = values.contact.phone;
    if (digits(values.contact.whatsapp)) CONFIG.whatsapp = digits(values.contact.whatsapp);
    if (safeUrl(values.links.review_url)) CONFIG.reviewUrl = safeUrl(values.links.review_url);
    if (values.derived.directions) CONFIG.directionsUrl = values.derived.directions;

    if (services.length) {
      CONFIG.services = Object.fromEntries(services.map((s) => [s.slug, { name: s.name, price: Number(s.price), description: s.description }]));
      renderServices(services);
    }
    if (schedule.length) {
      const byDay = Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((day) => [day, []]));
      schedule.forEach((row) => { if (byDay[row.day]) byDay[row.day] = validSlots(row.slots); });
      CONFIG.schedule = byDay;
      renderHours(byDay);
      updateStructuredData(byDay, values.derived.tel.replace('tel:', ''));
    }
    renderGallery(gallery);
    renderTeam(team);
    renderReviews(reviews);
    bind(values);
    document.dispatchEvent(new CustomEvent('cms:applied'));
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
