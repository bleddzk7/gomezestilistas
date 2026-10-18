import { CONFIG } from './config.js';

const timeZone = 'Europe/Madrid';
const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone,
  weekday: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
});
const calendarFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});
const weekdayNumbers = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
const dayNames = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

function madridParts(date) {
  const parts = Object.fromEntries(formatter.formatToParts(date).map(({ type, value }) => [type, value]));
  const calendar = Object.fromEntries(calendarFormatter.formatToParts(date).map(({ type, value }) => [type, value]));
  return {
    weekday: weekdayNumbers[parts.weekday],
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    year: Number(calendar.year),
    month: Number(calendar.month),
    day: Number(calendar.day)
  };
}

function nextOpening({ year, month, day }) {
  const nextDate = new Date(Date.UTC(year, month - 1, day));
  for (let offset = 1; offset <= 7; offset += 1) {
    const candidate = new Date(nextDate);
    candidate.setUTCDate(candidate.getUTCDate() + offset);
    const nextDay = candidate.getUTCDay() || 7;
    const [firstShift] = CONFIG.schedule[nextDay];
    if (firstShift) {
      const relative = offset === 1 ? 'mañana' : `el ${dayNames[nextDay % 7]}`;
      return `CERRADO · abre ${relative} a las ${firstShift.opening}`;
    }
  }
  return 'CERRADO';
}

export function getOpeningStatus(date = new Date()) {
  const parts = madridParts(date);
  for (const shift of CONFIG.schedule[parts.weekday]) {
    const [openingHour, openingMinute] = shift.opening.split(':').map(Number);
    const [closingHour, closingMinute] = shift.closing.split(':').map(Number);
    const opening = openingHour * 60 + openingMinute;
    const closing = closingHour * 60 + closingMinute;
    if (parts.minutes >= opening && parts.minutes < closing) {
      return { text: `ABIERTO AHORA · cierra a las ${shift.closing}`, open: true };
    }
    if (parts.minutes < opening) {
      return { text: `CERRADO · abre hoy a las ${shift.opening}`, open: false };
    }
  }
  return { text: nextOpening(parts), open: false };
}

export function initLiveStatus() {
  const displays = [...document.querySelectorAll('[data-open-status]')];
  if (!displays.length) return;
  const update = () => {
    const result = getOpeningStatus();
    displays.forEach((display) => {
      const text = display.querySelector('span:last-child');
      if (text) text.textContent = result.text;
      display.classList.toggle('is-open', result.open);
      display.classList.toggle('is-closed', !result.open);
    });
  };
  update();
  document.addEventListener('cms:applied', update);
  window.setInterval(update, 60_000);
}
