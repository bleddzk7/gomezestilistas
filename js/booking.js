import { CONFIG, getTimeSlots } from './config.js';
import { createAppointment, loadAvailability } from './storage.js';
import { formatDisplayDate, showToast } from './ui.js';

const dateInput = document.querySelector('#booking-date');
const dateDisplayInput = document.querySelector('#booking-date-display');
const datePickerButton = document.querySelector('#booking-date-picker');
const slotsContainer = document.querySelector('#time-slots');
const bookingForm = document.querySelector('#booking-form');
const serviceSelect = document.querySelector('#service-choice');
const status = document.querySelector('#booking-status');
let selectedTime = '';
let occupiedTimes = new Set();
let availabilityController;

function renderServiceOptions() {
  serviceSelect.innerHTML = '<option value="">Selecciona un servicio</option>';
  Object.entries(CONFIG.services).forEach(([id, service]) => {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = `${service.name} · ${service.price}€`;
    serviceSelect.append(option);
  });
}

function renderPrivacyNotice() {
  if (bookingForm.querySelector('.booking-privacy-notice')) return;
  const notice = document.createElement('p');
  notice.className = 'booking-privacy-notice';
  notice.innerHTML = 'Al confirmar, aceptas que tratemos tus datos para gestionar la cita. Consulta la <a href="privacidad.html">Política de privacidad</a>.';
  bookingForm.querySelector('button[type="submit"]').before(notice);
}

const formatDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const formatDisplayDateInput = (value) => {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
};
const parseDisplayDate = (value) => {
  const match = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return '';
  const [, day, month, year] = match;
  const date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00`);
  return date.getFullYear() === Number(year) && date.getMonth() + 1 === Number(month) && date.getDate() === Number(day) ? formatDate(date) : '';
};
const startDate = () => { const date = new Date(); date.setHours(0, 0, 0, 0); return date; };
const endDate = () => { const date = startDate(); date.setDate(date.getDate() + CONFIG.bookingWindowDays); return date; };
const allowedDate = (value) => { const date = new Date(`${value}T00:00:00`); return !Number.isNaN(date.getTime()) && date >= startDate() && date <= endDate() && date.getDay() !== 0; };

async function renderSlots() {
  availabilityController?.abort();
  slotsContainer.replaceChildren();
  selectedTime = '';
  const selectedDate = dateInput.value ? new Date(`${dateInput.value}T00:00:00`) : null;
  if (selectedDate && selectedDate.getDay() === 0) {
    slotsContainer.innerHTML = '<p class="booking-empty"><strong>0 horarios disponibles</strong><br>Domingo cerrado.</p>';
    return;
  }
  if (!dateInput.value || !getTimeSlots(dateInput.value).length) {
    slotsContainer.innerHTML = '<p class="booking-empty"><strong>0 horarios disponibles</strong><br>No hay servicio este día.</p>';
    return;
  }
  slotsContainer.innerHTML = '<p class="booking-loading">Consultando disponibilidad...</p>';
  const selectedService = CONFIG.services[serviceSelect.value];
  const validTimes = new Set(getTimeSlots(dateInput.value, selectedService?.durationMinutes ?? 0));
  availabilityController = new AbortController();
  try {
    const availability = await loadAvailability(dateInput.value, availabilityController.signal);
    occupiedTimes = new Set([...availability.occupied, ...availability.blocked]);
    const availableSlots = availability.slots.filter((time) => validTimes.has(time));
    if (!availableSlots.length) {
      slotsContainer.innerHTML = '<p class="booking-empty"><strong>0 horarios disponibles</strong><br>No quedan horas para este servicio antes del cierre.</p>';
      return;
    }
    slotsContainer.replaceChildren();
    availableSlots.forEach((time) => {
      const button = document.createElement('button');
      const isOccupied = occupiedTimes.has(time);
      const isBlocked = availability.blocked.includes(time);
      button.type = 'button';
      button.className = `time-slot${isOccupied ? ' is-occupied' : ''}`;
      button.disabled = isOccupied;
      button.dataset.time = time;
      button.textContent = isBlocked ? `${time} · No disponible` : isOccupied ? `${time} · Ocupado` : time;
      slotsContainer.append(button);
    });
  } catch (error) {
    if (error.name === 'AbortError') return;
    slotsContainer.innerHTML = `<p class="booking-error">${error.message}</p>`;
    return;
  }
}

function setInitialDate() {
  dateInput.min = formatDate(startDate());
  dateInput.max = formatDate(endDate());
  const date = startDate();
  if (date.getDay() === 0) date.setDate(date.getDate() + 1);
  dateInput.value = formatDate(date);
  dateDisplayInput.value = formatDisplayDateInput(dateInput.value);
}

setInitialDate();
renderServiceOptions();
renderPrivacyNotice();
serviceSelect.addEventListener('change', renderSlots);
const requestedService = new URLSearchParams(window.location.search).get('servicio');
if (requestedService && CONFIG.services[requestedService]) serviceSelect.value = requestedService;
renderSlots();
window.setInterval(() => {
  if (dateInput.value === formatDate(new Date())) renderSlots();
}, 60000);

dateInput.addEventListener('change', () => {
  dateDisplayInput.value = formatDisplayDateInput(dateInput.value);
  if (!allowedDate(dateInput.value)) {
    status.textContent = 'Selecciona un dia de lunes a sabado dentro de los proximos 90 dias.';
    const fallback = startDate();
    while (fallback.getDay() === 0) fallback.setDate(fallback.getDate() + 1);
    dateInput.value = formatDate(fallback);
  }
  renderSlots();
});

dateDisplayInput.addEventListener('change', () => {
  const parsedDate = parseDisplayDate(dateDisplayInput.value);
  if (!parsedDate) {
    status.textContent = 'Escribe una fecha válida con el formato dd/mm/aaaa.';
    return;
  }
  dateInput.value = parsedDate;
  dateInput.dispatchEvent(new Event('change'));
});

datePickerButton.addEventListener('click', () => {
  if (typeof dateInput.showPicker === 'function') dateInput.showPicker();
  else dateInput.click();
});

slotsContainer.addEventListener('click', (event) => {
  const button = event.target.closest('.time-slot');
  if (!button || button.disabled) return;
  slotsContainer.querySelectorAll('.time-slot').forEach((item) => item.classList.remove('selected'));
  button.classList.add('selected');
  selectedTime = button.dataset.time;
  status.textContent = `Has seleccionado las ${selectedTime}. Completa tus datos para continuar.`;
});

bookingForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!selectedTime) { status.textContent = 'Selecciona primero un horario disponible.'; return; }
  const data = new FormData(bookingForm);
  const date = dateInput.value;
  const submitButton = bookingForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    const appointment = await createAppointment({ date, time: selectedTime, serviceId: data.get('service'), name: String(data.get('name')).trim(), phone: String(data.get('phone')).trim(), email: String(data.get('email')).trim() });
    bookingForm.reset();
    selectedTime = '';
    status.textContent = '';
    showToast(`${formatDisplayDate(date)} a las ${String(appointment.appointment_time).slice(0, 5)} · ${appointment.service_name}`);
    await renderSlots();
  } catch (error) {
    status.textContent = error.status === 409 ? 'Este horario acaba de ser reservado. Elige otro.' : error.message;
    await renderSlots();
  } finally {
    submitButton.disabled = false;
  }
});
