import { isConfigured, login, logout, verifySession, userEmail, changePassword, db, hasSession } from './api.js';
import { h, toast, confirmDialog, promptDialog, field, imageField, slugify } from './ui.js';

const $ = (selector) => document.querySelector(selector);
const TZ = 'Europe/Madrid';
const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const fmtDate = (iso) => iso.split('-').reverse().join('/');
const fmtDateTime = (iso) => new Date(iso).toLocaleString('es-ES', { timeZone: TZ, dateStyle: 'short', timeStyle: 'short' });
const todayIso = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
const eur = (n) => `${Number(n).toLocaleString('es-ES', { maximumFractionDigits: 2 })} €`;
const httpsOrEmpty = (v) => { if (!v) return true; try { return new URL(v).protocol === 'https:'; } catch { return false; } };
const phoneOk = (v) => /^\+?[0-9 ]{9,15}$/.test(v);

/* ---------- Definición de los campos editables de la web ---------- */
const urlRule = (v) => (httpsOrEmpty(v) ? null : 'Debe ser un enlace que empiece por https://');
const CONTENT = {
  textos: {
    title: 'Textos de la web',
    intro: 'Cambia los títulos y párrafos. En los campos con varias líneas, un salto de línea se mostrará como salto en la web.',
    groups: [
      { title: 'Portada', fields: [
        { store: 'texts', key: 'hero_eyebrow', label: 'Texto superior', max: 60 },
        { store: 'texts', key: 'hero_claim', label: 'Lema principal', max: 100 },
        { store: 'texts', key: 'hero_sub', label: 'Subtítulo', type: 'textarea', max: 200, rows: 2 }] },
      { title: 'Sobre nosotros', fields: [
        { store: 'texts', key: 'about_title', label: 'Título', type: 'textarea', rows: 2, max: 80 },
        { store: 'texts', key: 'about_p1', label: 'Primer párrafo', type: 'textarea', rows: 4, max: 500 },
        { store: 'texts', key: 'about_p2', label: 'Segundo párrafo', type: 'textarea', rows: 4, max: 500 },
        { store: 'texts', key: 'fact1_value', label: 'Dato 1 · cifra', max: 12 }, { store: 'texts', key: 'fact1_label', label: 'Dato 1 · texto', max: 40 },
        { store: 'texts', key: 'fact2_value', label: 'Dato 2 · cifra', max: 12 }, { store: 'texts', key: 'fact2_label', label: 'Dato 2 · texto', max: 40 },
        { store: 'texts', key: 'fact3_value', label: 'Dato 3 · cifra', max: 12 }, { store: 'texts', key: 'fact3_label', label: 'Dato 3 · texto', max: 40 }] },
      { title: 'Secciones', fields: [
        { store: 'texts', key: 'services_title', label: 'Servicios · título', max: 60 },
        { store: 'texts', key: 'services_sub', label: 'Servicios · subtítulo', max: 200 },
        { store: 'texts', key: 'gallery_title', label: 'Galería · título', max: 60 },
        { store: 'texts', key: 'team_title', label: 'Equipo · título', max: 60 },
        { store: 'texts', key: 'team_sub', label: 'Equipo · subtítulo', max: 200 },
        { store: 'texts', key: 'reviews_title', label: 'Reseñas · título', max: 80 },
        { store: 'texts', key: 'rating_score', label: 'Valoración (ej. 5,0)', max: 8 },
        { store: 'texts', key: 'rating_count', label: 'Texto de reseñas (ej. 19 reseñas en Google)', max: 60 }] },
      { title: 'Reservas y ubicación', fields: [
        { store: 'texts', key: 'booking_title', label: 'Reservas · título', type: 'textarea', rows: 2, max: 60 },
        { store: 'texts', key: 'booking_text', label: 'Reservas · texto', type: 'textarea', rows: 4, max: 500 },
        { store: 'texts', key: 'location_title', label: 'Ubicación · título', type: 'textarea', rows: 2, max: 60 },
        { store: 'texts', key: 'address', label: 'Dirección (se muestra tal cual)', type: 'textarea', rows: 3, max: 200 }] }
    ]
  },
  contacto: {
    title: 'Contacto y enlaces',
    intro: 'Teléfono del dueño, WhatsApp, mapa y redes. Los enlaces vacíos se ocultan.',
    groups: [
      { title: 'Contacto', fields: [
        { store: 'contact', key: 'phone', label: 'Teléfono visible', max: 20, required: true, rule: (v) => (phoneOk(v) ? null : 'Teléfono no válido (9 a 15 dígitos).') },
        { store: 'contact', key: 'whatsapp', label: 'WhatsApp (con prefijo, solo números)', max: 20, required: true, help: 'Ejemplo: 34604978534', rule: (v) => (/^[0-9]{9,15}$/.test(v) ? null : 'Solo números, con prefijo de país (9 a 15 dígitos).') },
        { store: 'contact', key: 'map_query', label: 'Dirección para el mapa', max: 200, required: true }] },
      { title: 'Enlaces', fields: [
        { store: 'links', key: 'review_url', label: 'Enlace para dejar reseña', max: 400, rule: urlRule },
        { store: 'links', key: 'maps_url', label: 'Enlace «Cómo llegar» (vacío = automático)', max: 400, rule: urlRule },
        { store: 'links', key: 'google_url', label: 'Enlace de Google (pie de página)', max: 400, rule: urlRule },
        { store: 'links', key: 'instagram', label: 'Instagram', max: 400, rule: urlRule },
        { store: 'links', key: 'facebook', label: 'Facebook', max: 400, rule: urlRule },
        { store: 'links', key: 'tiktok', label: 'TikTok', max: 400, rule: urlRule }] }
    ]
  },
  imagenes: {
    title: 'Imágenes de la web',
    intro: 'Sustituye las imágenes principales. Se redimensionan y comprimen automáticamente.',
    groups: [{ title: 'Imágenes', fields: [
      { store: 'images', key: 'hero_logo', label: 'Logotipo de portada', type: 'image' },
      { store: 'images', key: 'about_photo', label: 'Foto de «Sobre nosotros»', type: 'image' },
      { store: 'images', key: 'compare_before', label: 'Comparador · ANTES', type: 'image' },
      { store: 'images', key: 'compare_after', label: 'Comparador · DESPUÉS', type: 'image' }] }]
  }
};

const COLLECTIONS = {
  servicios: {
    table: 'services', pk: 'slug', title: 'Servicios y precios', addLabel: 'Añadir servicio',
    intro: 'Los servicios activos aparecen en la carta y en el formulario de reservas.',
    itemTitle: (d) => d.name || 'Nuevo servicio',
    columns: [
      { key: 'name', label: 'Nombre', max: 60, required: true },
      { key: 'price', label: 'Precio (€)', type: 'number', max: 999, step: 0.5, required: true },
      { key: 'description', label: 'Descripción', type: 'textarea', rows: 2, max: 200 },
      { key: 'featured', label: 'Destacado', type: 'bool' },
      { key: 'tag', label: 'Etiqueta del destacado', max: 30 },
      { key: 'active', label: 'Visible en la web', type: 'bool' }],
    blank: () => ({ name: '', price: 10, description: '', featured: false, tag: '', active: true })
  },
  galeria: {
    table: 'gallery_items', pk: 'id', title: 'Galería de trabajos', addLabel: 'Añadir imagen',
    intro: 'Las imágenes se muestran en este orden. «Ajustar sin recortar» sirve para logotipos.',
    itemTitle: (d) => d.caption || 'Imagen',
    columns: [
      { key: 'image', label: 'Imagen', type: 'image', required: true },
      { key: 'caption', label: 'Pie de foto', max: 40 },
      { key: 'alt', label: 'Descripción para accesibilidad', max: 160 },
      { key: 'contain', label: 'Ajustar sin recortar', type: 'bool' },
      { key: 'active', label: 'Visible en la web', type: 'bool' }],
    blank: () => ({ image: '', caption: '', alt: '', contain: false, active: true })
  },
  equipo: {
    table: 'team_members', pk: 'id', title: 'Equipo', addLabel: 'Añadir persona',
    intro: 'Personas que se muestran en la sección «Equipo».',
    itemTitle: (d) => d.name || 'Nueva persona',
    columns: [
      { key: 'name', label: 'Nombre', max: 80, required: true },
      { key: 'role', label: 'Función', max: 80 },
      { key: 'photo', label: 'Foto', type: 'image', maxSide: 1200 },
      { key: 'active', label: 'Visible en la web', type: 'bool' }],
    blank: () => ({ name: '', role: '', photo: '', active: true })
  },
  resenas: {
    table: 'reviews', pk: 'id', title: 'Reseñas destacadas', addLabel: 'Añadir reseña',
    intro: 'Reseñas reales que quieras mostrar en la web.',
    itemTitle: (d) => d.author || 'Nueva reseña',
    columns: [
      { key: 'author', label: 'Autor', max: 60, required: true },
      { key: 'text', label: 'Texto', type: 'textarea', rows: 3, max: 600, required: true },
      { key: 'rating', label: 'Estrellas (1-5)', type: 'number', min: 1, max: 5, step: 1, required: true },
      { key: 'active', label: 'Visible en la web', type: 'bool' }],
    blank: () => ({ author: '', text: '', rating: 5, active: true })
  }
};

const SECTIONS = [
  ['resumen', 'Resumen'], ['reservas', 'Reservas'], ['textos', 'Textos'], ['contacto', 'Contacto y enlaces'],
  ['servicios', 'Servicios'], ['horarios', 'Horarios'], ['imagenes', 'Imágenes'], ['galeria', 'Galería'],
  ['equipo', 'Equipo'], ['resenas', 'Reseñas'], ['cuenta', 'Cuenta']
];

/* ---------- Utilidades de interfaz ---------- */
function page(title, intro, ...body) {
  return h('section', { class: 'page' }, h('header', { class: 'page-head' }, h('h1', {}, title), intro ? h('p', {}, intro) : null), body);
}

async function guarded(button, task) {
  button.disabled = true;
  const label = button.textContent;
  button.textContent = 'Guardando…';
  try { await task(); } catch (error) { toast(error.message || 'No se pudo completar la acción.', 'error'); } finally { button.disabled = false; button.textContent = label; }
}

function makeField(def, value) {
  return def.type === 'image' ? imageField(def, value) : field(def, value);
}

function validateField(def, fieldObj) {
  const value = fieldObj.get();
  if (def.type === 'number') {
    if (Number.isNaN(value) && def.required) return `${def.label}: introduce un número.`;
    if (!Number.isNaN(value) && (value < (def.min ?? 0) || value > (def.max ?? 999))) return `${def.label}: valor fuera de rango.`;
    return null;
  }
  if (def.required && !value) return `${def.label}: es obligatorio.`;
  if (def.rule && (value || def.required)) { const message = def.rule(value); if (message) return `${def.label}: ${message}`; }
  return null;
}

/* ---------- Formularios de contenido (textos, contacto, imágenes) ---------- */
async function contentPage(config) {
  const rows = await db.select('site_content', 'select=key,value');
  const stores = Object.fromEntries(rows.map((r) => [r.key, r.value || {}]));
  const fields = [];
  const form = h('form', { class: 'stack', novalidate: true });
  config.groups.forEach((group) => {
    const box = h('fieldset', { class: 'panel' }, h('legend', {}, group.title));
    group.fields.forEach((def) => {
      const f = makeField(def, stores[def.store]?.[def.key]);
      fields.push({ def, f });
      box.append(f.node);
    });
    form.append(box);
  });
  const save = h('button', { class: 'btn', type: 'submit' }, 'Guardar cambios');
  form.append(h('div', { class: 'sticky-actions' }, save));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    guarded(save, async () => {
      for (const { def, f } of fields) { const error = validateField(def, f); if (error) throw new Error(error); }
      const next = {};
      fields.forEach(({ def, f }) => { (next[def.store] ||= { ...(stores[def.store] || {}) })[def.key] = f.get(); });
      const payload = Object.entries(next).map(([key, value]) => ({ key, value, updated_at: new Date().toISOString() }));
      await db.upsert('site_content', payload);
      Object.assign(stores, next);
      toast('Cambios guardados. Ya están en la web.');
    });
  });
  return page(config.title, config.intro, form);
}

/* ---------- Editor genérico de listas ---------- */
async function collectionPage(cfg) {
  const rows = await db.select(cfg.table, 'select=*&order=sort.asc');
  const items = [];
  const removed = [];
  const list = h('div', { class: 'stack' });

  const refresh = () => {
    list.replaceChildren(...items.map((item) => item.node));
    items.forEach((item, index) => {
      item.up.disabled = index === 0; item.down.disabled = index === items.length - 1;
      item.title.textContent = cfg.itemTitle(item.read());
    });
    if (!items.length) list.append(h('p', { class: 'empty-note' }, 'No hay elementos todavía.'));
  };

  function addItem(data, persisted) {
    const fields = Object.fromEntries(cfg.columns.map((def) => [def.key, makeField(def, data[def.key])]));
    const read = () => Object.fromEntries(cfg.columns.map((def) => [def.key, fields[def.key].get()]));
    const title = h('h3', {});
    const up = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Subir', title: 'Subir', onclick: () => move(item, -1) }, '↑');
    const down = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Bajar', title: 'Bajar', onclick: () => move(item, 1) }, '↓');
    const del = h('button', { class: 'icon-btn danger', type: 'button', 'aria-label': 'Eliminar', title: 'Eliminar', onclick: async () => {
      if (!(await confirmDialog('¿Eliminar este elemento? Se borrará al guardar.'))) return;
      items.splice(items.indexOf(item), 1);
      if (item.persisted) removed.push(item.pk);
      refresh();
    } }, '✕');
    const node = h('article', { class: 'panel item' }, h('header', { class: 'item-head' }, title, h('div', { class: 'row-actions' }, up, down, del)),
      h('div', { class: 'grid-fields' }, cfg.columns.map((def) => fields[def.key].node)));
    const item = { node, fields, read, title, up, down, persisted, pk: data[cfg.pk], id: data[cfg.pk] };
    items.push(item);
    return item;
  }
  function move(item, delta) {
    const i = items.indexOf(item);
    items.splice(i, 1); items.splice(i + delta, 0, item);
    refresh();
  }

  rows.forEach((row) => addItem(row, true));
  refresh();

  const add = h('button', { class: 'btn ghost', type: 'button', onclick: () => { addItem(cfg.blank(), false); refresh(); items.at(-1).node.scrollIntoView({ block: 'center' }); } }, `+ ${cfg.addLabel}`);
  const save = h('button', { class: 'btn', type: 'button' }, 'Guardar cambios');
  save.addEventListener('click', () => guarded(save, async () => {
    const used = new Set(items.filter((i) => i.persisted).map((i) => i.pk));
    const payload = [];
    for (const [index, item] of items.entries()) {
      for (const def of cfg.columns) { const error = validateField(def, item.fields[def.key]); if (error) throw new Error(`${cfg.itemTitle(item.read())} → ${error}`); }
      const data = item.read();
      if (cfg.pk === 'slug' && !item.persisted) {
        let slug = slugify(data.name); const base = slug; let n = 2;
        while (used.has(slug)) { slug = `${base}-${n}`; n += 1; }
        used.add(slug); item.pk = slug;
      }
      if (cfg.pk === 'id' && !item.persisted) item.pk = crypto.randomUUID();
      payload.push({ [cfg.pk]: item.pk, ...data, sort: index });
    }
    if (payload.length) await db.upsert(cfg.table, payload);
    for (const pk of removed.splice(0)) await db.remove(cfg.table, `${cfg.pk}=eq.${encodeURIComponent(pk)}`);
    items.forEach((item) => { item.persisted = true; });
    toast('Cambios guardados. Ya están en la web.');
  }));
  return page(cfg.title, cfg.intro, list, h('div', { class: 'sticky-actions' }, add, save));
}

/* ---------- Horarios ---------- */
async function schedulePage() {
  const rows = await db.select('schedule', 'select=day,slots&order=day.asc');
  const byDay = Object.fromEntries(rows.map((r) => [r.day, r.slots || []]));
  const days = DAYS.map((name, i) => {
    const day = i + 1;
    const slotsBox = h('div', { class: 'slots' });
    const state = [];
    const draw = () => {
      slotsBox.replaceChildren(...state.map((s) => s.node));
      if (!state.length) slotsBox.append(h('span', { class: 'closed' }, 'Cerrado'));
      addBtn.hidden = state.length >= 3;
    };
    const addSlot = (opening = '09:00', closing = '14:00') => {
      const o = h('input', { type: 'time', value: opening, step: 300, 'aria-label': `${name} apertura` });
      const c = h('input', { type: 'time', value: closing, step: 300, 'aria-label': `${name} cierre` });
      o.value = opening; c.value = closing;
      const slot = { o, c };
      slot.node = h('div', { class: 'slot' }, o, h('span', {}, 'a'), c,
        h('button', { class: 'icon-btn danger', type: 'button', 'aria-label': 'Quitar franja', onclick: () => { state.splice(state.indexOf(slot), 1); draw(); } }, '✕'));
      state.push(slot);
    };
    const addBtn = h('button', { class: 'btn ghost small', type: 'button', onclick: () => { addSlot(); draw(); } }, '+ Franja');
    (byDay[day] || []).forEach((s) => addSlot(s.opening, s.closing));
    draw();
    return { day, name, state, node: h('div', { class: 'panel day' }, h('h3', {}, name), slotsBox, addBtn) };
  });
  const save = h('button', { class: 'btn', type: 'button' }, 'Guardar horarios');
  save.addEventListener('click', () => guarded(save, async () => {
    const payload = days.map((d) => {
      const slots = d.state.map((s) => ({ opening: s.o.value, closing: s.c.value })).sort((a, b) => a.opening.localeCompare(b.opening));
      slots.forEach((s, i) => {
        if (!TIME.test(s.opening) || !TIME.test(s.closing)) throw new Error(`${d.name}: horas no válidas.`);
        if (s.opening >= s.closing) throw new Error(`${d.name}: la apertura debe ser anterior al cierre.`);
        if (i && slots[i - 1].closing > s.opening) throw new Error(`${d.name}: las franjas se solapan.`);
      });
      return { day: d.day, slots };
    });
    await db.upsert('schedule', payload);
    toast('Horarios guardados. Las reservas usarán estos tramos (cada 30 min).');
  }));
  return page('Horarios', 'Hasta 3 franjas por día. Las citas se ofrecen cada 30 minutos dentro de estas franjas.', h('div', { class: 'days' }, days.map((d) => d.node)), h('div', { class: 'sticky-actions' }, save));
}

/* ---------- Reservas ---------- */
const STATUSES = ['pendiente', 'confirmada', 'completada', 'cancelada'];

function csvCell(value) {
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

async function bookingsPage() {
  const data = await db.select('bookings', 'select=*&order=created_at.desc&limit=1000');
  const status = h('select', { 'aria-label': 'Estado' }, h('option', { value: '' }, 'Todos los estados'), STATUSES.map((s) => h('option', { value: s }, s)));
  const when = h('select', { 'aria-label': 'Fecha' }, [['all', 'Todas las fechas'], ['today', 'Hoy'], ['upcoming', 'Próximas'], ['past', 'Pasadas']].map(([v, l]) => h('option', { value: v }, l)));
  const search = h('input', { type: 'search', placeholder: 'Buscar nombre o teléfono', 'aria-label': 'Buscar', maxlength: 40 });
  const body = h('tbody', {});
  const count = h('p', { class: 'count' });

  const visible = () => {
    const q = search.value.trim().toLowerCase(); const today = todayIso();
    return data.filter((b) => (!status.value || b.status === status.value)
      && (when.value === 'all' || (when.value === 'today' && b.booking_date === today) || (when.value === 'upcoming' && b.booking_date >= today) || (when.value === 'past' && b.booking_date < today))
      && (!q || b.name.toLowerCase().includes(q) || b.phone.replace(/\s/g, '').includes(q.replace(/\s/g, ''))));
  };

  const draw = () => {
    const list = visible();
    count.textContent = `${list.length} reserva${list.length === 1 ? '' : 's'}`;
    body.replaceChildren(...list.map((b) => {
      const select = h('select', { class: `status s-${b.status}`, 'aria-label': 'Cambiar estado' }, STATUSES.map((s) => h('option', { value: s }, s)));
      select.value = b.status;
      select.addEventListener('change', async () => {
        const previous = b.status;
        try { await db.patch('bookings', `id=eq.${b.id}`, { status: select.value }); b.status = select.value; select.className = `status s-${b.status}`; toast('Estado actualizado.'); } catch (error) { select.value = previous; toast(error.message, 'error'); }
      });
      const note = h('button', { class: 'link-btn', type: 'button', onclick: async () => {
        const result = await promptDialog(`Notas · ${b.name}`, b.notes, 500);
        if (result === null) return;
        try { await db.patch('bookings', `id=eq.${b.id}`, { notes: result }); b.notes = result; draw(); toast('Nota guardada.'); } catch (error) { toast(error.message, 'error'); }
      } }, b.notes ? b.notes.slice(0, 40) + (b.notes.length > 40 ? '…' : '') : '+ nota');
      const del = h('button', { class: 'icon-btn danger', type: 'button', 'aria-label': 'Eliminar reserva', onclick: async () => {
        if (!(await confirmDialog(`¿Eliminar la reserva de ${b.name}?`))) return;
        try { await db.remove('bookings', `id=eq.${b.id}`); data.splice(data.indexOf(b), 1); draw(); toast('Reserva eliminada.'); } catch (error) { toast(error.message, 'error'); }
      } }, '✕');
      const phoneDigits = b.phone.replace(/\D/g, '');
      return h('tr', {},
        h('td', { 'data-label': 'Cita' }, h('strong', {}, `${fmtDate(b.booking_date)} · ${b.booking_time.slice(0, 5)}`)),
        h('td', { 'data-label': 'Cliente' }, b.name),
        h('td', { 'data-label': 'Teléfono' }, h('a', { href: `tel:${phoneDigits.length === 9 ? '+34' : '+'}${phoneDigits}` }, b.phone)),
        h('td', { 'data-label': 'Servicio' }, `${b.service_name} · ${eur(b.price)}`),
        h('td', { 'data-label': 'Solicitada' }, fmtDateTime(b.created_at)),
        h('td', { 'data-label': 'Estado' }, select), h('td', { 'data-label': 'Notas' }, note), h('td', {}, del));
    }));
    if (!list.length) body.append(h('tr', {}, h('td', { colspan: 8, class: 'empty-note' }, 'No hay reservas con estos filtros.')));
  };
  [status, when].forEach((n) => n.addEventListener('change', draw));
  search.addEventListener('input', draw);

  const exportCsv = h('button', { class: 'btn ghost', type: 'button', onclick: () => {
    const head = ['Solicitud', 'Fecha cita', 'Hora', 'Cliente', 'Teléfono', 'Servicio', 'Precio', 'Estado', 'Notas'];
    const lines = [head, ...visible().map((b) => [fmtDateTime(b.created_at), fmtDate(b.booking_date), b.booking_time.slice(0, 5), b.name, b.phone, b.service_name, b.price, b.status, b.notes])];
    const blob = new Blob([`\ufeff${lines.map((l) => l.map(csvCell).join(';')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: `reservas-${todayIso()}.csv` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } }, 'Exportar CSV');

  draw();
  return page('Reservas', 'Solicitudes recibidas desde la web. Cambia su estado o añade notas.',
    h('div', { class: 'toolbar' }, search, status, when, exportCsv), count,
    h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
      h('thead', {}, h('tr', {}, ['Cita', 'Cliente', 'Teléfono', 'Servicio', 'Solicitada', 'Estado', 'Notas', ''].map((t) => h('th', { scope: 'col' }, t)))), body)));
}

/* ---------- Resumen ---------- */
async function dashboardPage() {
  const data = await db.select('bookings', 'select=*&order=booking_date.asc,booking_time.asc&limit=1000');
  const today = todayIso();
  const week = new Date(`${today}T00:00:00`); week.setDate(week.getDate() + 7);
  const weekIso = new Intl.DateTimeFormat('en-CA').format(week);
  const active = data.filter((b) => b.status !== 'cancelada');
  const upcoming = active.filter((b) => b.booking_date >= today);
  const stat = (label, value) => h('div', { class: 'stat' }, h('strong', {}, String(value)), h('span', {}, label));
  const next = upcoming.slice(0, 8);
  return page('Resumen', `Sesión iniciada como ${userEmail()}.`,
    h('div', { class: 'stats' },
      stat('Pendientes de confirmar', data.filter((b) => b.status === 'pendiente' && b.booking_date >= today).length),
      stat('Citas de hoy', active.filter((b) => b.booking_date === today).length),
      stat('Próximos 7 días', active.filter((b) => b.booking_date >= today && b.booking_date <= weekIso).length),
      stat('Reservas totales', data.length)),
    h('div', { class: 'panel' }, h('h2', {}, 'Próximas citas'),
      next.length ? h('ul', { class: 'upcoming' }, next.map((b) => h('li', {}, h('strong', {}, `${fmtDate(b.booking_date)} · ${b.booking_time.slice(0, 5)}`), ` ${b.name} — ${b.service_name} `, h('span', { class: `status s-${b.status}` }, b.status))))
        : h('p', { class: 'empty-note' }, 'No hay citas próximas.')),
    h('p', { class: 'hint' }, 'Consejo: los cambios que guardes se ven en la web al recargarla.'));
}

/* ---------- Cuenta ---------- */
async function accountPage() {
  const pw = field({ label: 'Nueva contraseña (mínimo 12 caracteres)', type: 'password', max: 72 }, '');
  const pw2 = field({ label: 'Repite la contraseña', type: 'password', max: 72 }, '');
  pw.input.autocomplete = 'new-password'; pw2.input.autocomplete = 'new-password';
  const save = h('button', { class: 'btn', type: 'submit' }, 'Cambiar contraseña');
  const form = h('form', { class: 'panel stack narrow', novalidate: true }, h('h2', {}, 'Contraseña'), pw.node, pw2.node, save);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    guarded(save, async () => {
      const a = pw.get();
      if (a.length < 12) throw new Error('La contraseña debe tener al menos 12 caracteres.');
      if (a !== pw2.get()) throw new Error('Las contraseñas no coinciden.');
      await changePassword(a);
      pw.set(''); pw2.set('');
      toast('Contraseña actualizada.');
    });
  });
  const out = h('button', { class: 'btn ghost', type: 'button', onclick: () => signOut() }, 'Cerrar sesión');
  return page('Cuenta', `Administrador: ${userEmail()}`, form, h('div', { class: 'panel narrow' }, h('h2', {}, 'Sesión'), h('p', {}, 'La sesión se cierra sola tras 30 minutos sin actividad.'), out));
}

/* ---------- Arranque, navegación y sesión ---------- */
const RENDER = {
  resumen: dashboardPage, reservas: bookingsPage, horarios: schedulePage, cuenta: accountPage,
  textos: () => contentPage(CONTENT.textos), contacto: () => contentPage(CONTENT.contacto), imagenes: () => contentPage(CONTENT.imagenes),
  servicios: () => collectionPage(COLLECTIONS.servicios), galeria: () => collectionPage(COLLECTIONS.galeria),
  equipo: () => collectionPage(COLLECTIONS.equipo), resenas: () => collectionPage(COLLECTIONS.resenas)
};

let navToken = 0;
async function route() {
  const id = RENDER[location.hash.slice(1)] ? location.hash.slice(1) : 'resumen';
  const mine = ++navToken;
  document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.id === id));
  $('#nav').classList.remove('open');
  const view = $('#view');
  view.replaceChildren(h('p', { class: 'loading' }, 'Cargando…'));
  try {
    const node = await RENDER[id]();
    if (mine === navToken) view.replaceChildren(node);
  } catch (error) {
    if (error.status === 401) { await signOut('La sesión ha caducado. Vuelve a entrar.'); return; }
    if (mine === navToken) view.replaceChildren(page('Error', null, h('p', { class: 'error' }, error.message), h('button', { class: 'btn', type: 'button', onclick: route }, 'Reintentar')));
  }
  window.scrollTo(0, 0);
}

let idleTimer;
const IDLE_MS = 30 * 60 * 1000;
function resetIdle() { clearTimeout(idleTimer); idleTimer = setTimeout(() => signOut('Sesión cerrada por inactividad.'), IDLE_MS); }
['click', 'keydown', 'pointerdown', 'touchstart'].forEach((name) => document.addEventListener(name, () => { if (hasSession()) resetIdle(); }, { passive: true }));

async function signOut(message) {
  clearTimeout(idleTimer);
  await logout();
  showLogin(message);
}

function showApp() {
  $('#login').hidden = true; $('#app').hidden = false;
  $('#user-email').textContent = userEmail();
  resetIdle();
  route();
}

let failures = 0;
let lockedUntil = 0;
function showLogin(message = '') {
  $('#app').hidden = true; $('#login').hidden = false;
  $('#login-error').textContent = message;
  $('#view').replaceChildren();
  $('#login-password').value = '';
}

function init() {
  $('#nav').append(...SECTIONS.map(([id, label]) => h('a', { href: `#${id}`, 'data-id': id }, label)));
  $('#menu-toggle').addEventListener('click', () => $('#nav').classList.toggle('open'));
  $('#logout').addEventListener('click', () => signOut());
  window.addEventListener('hashchange', () => { if (!$('#app').hidden) route(); });

  if (!isConfigured) { showLogin('Falta configurar Supabase en js/config.js (supabaseUrl y supabaseKey).'); $('#login-form').querySelector('button').disabled = true; return; }

  $('#login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const error = $('#login-error');
    const wait = lockedUntil - Date.now();
    if (wait > 0) { error.textContent = `Demasiados intentos. Espera ${Math.ceil(wait / 1000)} s.`; return; }
    const button = event.submitter || $('#login-form button');
    button.disabled = true; error.textContent = '';
    try {
      await login($('#login-email').value.trim(), $('#login-password').value);
      failures = 0;
      showApp();
    } catch (e) {
      failures += 1;
      if (failures >= 3) lockedUntil = Date.now() + Math.min(2 ** (failures - 2), 60) * 1000;
      error.textContent = e.status === 400 || e.status === 401 ? 'Correo o contraseña incorrectos.' : e.message;
    } finally { button.disabled = false; $('#login-password').value = ''; }
  });

  verifySession().then((ok) => (ok ? showApp() : showLogin()));
}

init();
