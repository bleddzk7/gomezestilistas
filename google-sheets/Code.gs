// Pegar en Google Apps Script (Extensiones > Apps Script) de una hoja de cálculo de Google.
// Tras editarlo: Implementar > Gestionar implementaciones > Editar > Nueva versión > Implementar.
const SHEET_NAME = 'Reservas';
const TOKEN = '049dd5e29af6bbe03bf49d4278e1a7c5e8bb'; // debe coincidir con bookingsToken en js/config.js
const HEADERS = ['Solicitud (fecha y hora)', 'Nombre', 'Teléfono', 'Servicio', 'Precio (€)', 'Fecha de la cita', 'Hora de la cita'];
const SERVICES = { corte: ['Corte', 15], degradado: ['Degradado', 17], barba: ['Barba', 10], corteBarba: ['Corte + barba', 22], afeitado: ['Afeitado clásico', 15], cejas: ['Cejas', 5] };
// Franjas por día ISO (1 = lunes … 7 = domingo), en minutos desde medianoche
const H = (h, m) => h * 60 + m;
const MORNING = [H(9, 30), H(14, 0)];
const SCHEDULE = {
  1: [MORNING, [H(16, 0), H(20, 30)]], 2: [MORNING, [H(16, 30), H(20, 30)]], 3: [MORNING, [H(16, 30), H(20, 30)]],
  4: [MORNING, [H(16, 30), H(20, 30)]], 5: [[H(9, 30), H(13, 0)], [H(16, 30), H(20, 30)]], 6: [[H(9, 30), H(14, 30)], [H(16, 30), H(20, 30)]], 7: []
};
// Opcional: lee servicios y horarios editados en el panel de administración (Supabase). Vacío = usa los valores de arriba.
const SUPABASE_URL = ''; // p. ej. https://xxxx.supabase.co
const SUPABASE_KEY = ''; // clave anon/publishable (la misma de js/config.js)
const MAX_DAYS_AHEAD = 90, MIN_FILL_MS = 2500, MAX_PER_HOUR = 40, MAX_PER_PHONE_DAY = 3;

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const data = JSON.parse(e.postData.contents);
    const booking = validate(data);
    if (!booking) return out('rejected');
    if (!withinRateLimit()) return out('rate');

    const book = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = book.getSheetByName(SHEET_NAME) || book.insertSheet(SHEET_NAME);
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.setFrozenRows(1);
    }
    if (isRepeated(sheet, booking)) return out('duplicate');

    sheet.appendRow([
      Utilities.formatDate(new Date(), 'Europe/Madrid', 'dd/MM/yyyy HH:mm:ss'),
      booking.name, booking.phone, booking.service, booking.price, booking.date, booking.time
    ].map(guardFormula));
    return out('ok');
  } catch (err) {
    return out('error');
  } finally {
    lock.releaseLock();
  }
}

function loadRules() {
  const fallback = { services: SERVICES, schedule: SCHEDULE };
  if (!SUPABASE_URL || !SUPABASE_KEY) return fallback;
  const cache = CacheService.getScriptCache();
  const cached = cache.get('rules');
  if (cached) return JSON.parse(cached);
  try {
    const get = (path) => JSON.parse(UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/' + path, {
      headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY }, muteHttpExceptions: false
    }).getContentText());
    const services = {};
    get('services?select=slug,name,price&active=eq.true').forEach((s) => { services[s.slug] = [s.name, Number(s.price)]; });
    const schedule = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] };
    const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
    get('schedule?select=day,slots').forEach((r) => { schedule[r.day] = (r.slots || []).map((x) => [toMin(x.opening), toMin(x.closing)]); });
    if (!Object.keys(services).length) return fallback;
    const rules = { services, schedule };
    cache.put('rules', JSON.stringify(rules), 300);
    return rules;
  } catch (err) {
    return fallback;
  }
}

function out(text) { return ContentService.createTextOutput(text); }

// Impide que un texto se interprete como fórmula en la hoja
function guardFormula(value) { return typeof value === 'string' && /^[=+\-@]/.test(value) ? "'" + value : value; }

function validate(d) {
  if (!d || d.token !== TOKEN) return null;
  if (Number(d.elapsed) < MIN_FILL_MS) return null;
  const name = String(d.name || '').trim().replace(/\s+/g, ' ');
  const phone = String(d.phone || '').trim();
  const rules = loadRules();
  const svc = rules.services[String(d.service)];
  const date = String(d.date || '');
  const time = String(d.time || '');
  if (!/^[\p{L}][\p{L} .'-]{1,79}$/u.test(name)) return null;
  if (!/^\+?[0-9 ]{9,15}$/.test(phone)) return null;
  if (!svc) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;

  const [y, m, day] = date.split('-').map(Number);
  const when = new Date(y, m - 1, day);
  if (when.getFullYear() !== y || when.getMonth() !== m - 1 || when.getDate() !== day) return null;
  const todayMadrid = Utilities.formatDate(new Date(), 'Europe/Madrid', 'yyyy-MM-dd');
  const [ty, tm, td] = todayMadrid.split('-').map(Number);
  const diffDays = Math.round((when - new Date(ty, tm - 1, td)) / 86400000);
  if (diffDays < 0 || diffDays > MAX_DAYS_AHEAD) return null;

  const [hh, mm] = time.split(':').map(Number);
  const minutes = hh * 60 + mm;
  const slots = rules.schedule[when.getDay() || 7] || [];
  const fits = slots.some(([open, close]) => minutes >= open && minutes + 30 <= close && (minutes - open) % 30 === 0);
  if (!fits) return null;
  return { name, phone, service: svc[0], price: svc[1], date, time };
}

// Límite global por hora para frenar envíos masivos
function withinRateLimit() {
  const cache = CacheService.getScriptCache();
  const key = 'rate_' + Utilities.formatDate(new Date(), 'Europe/Madrid', 'yyyyMMddHH');
  const count = Number(cache.get(key) || 0);
  if (count >= MAX_PER_HOUR) return false;
  cache.put(key, String(count + 1), 3600);
  return true;
}

// Rechaza la misma cita repetida y limita las solicitudes por teléfono
function isRepeated(sheet, b) {
  const last = sheet.getLastRow();
  if (last < 2) return false;
  const rows = sheet.getRange(Math.max(2, last - 199), 1, Math.min(200, last - 1), 7).getValues();
  const today = Utilities.formatDate(new Date(), 'Europe/Madrid', 'dd/MM/yyyy');
  const digits = (s) => String(s).replace(/\D/g, '');
  let sameDay = 0;
  for (const r of rows) {
    if (digits(r[2]) !== digits(b.phone)) continue;
    if (String(r[5]) === b.date && String(r[6]) === b.time) return true;
    if (String(r[0]).startsWith(today)) sameDay++;
  }
  return sameDay >= MAX_PER_PHONE_DAY;
}
