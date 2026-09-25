import { blockSlot, cancelAppointment, loadAppointments, loadBlockedSlots, loginAdmin, unblockSlot } from './storage.js';
import { getTimeSlots } from './config.js';
import { escapeHtml, formatDisplayDate } from './ui.js';

const loginView = document.querySelector('#admin-login-view');
const dashboard = document.querySelector('#admin-dashboard');
const loginForm = document.querySelector('#admin-login-form');
const emailInput = document.querySelector('#admin-email');
const passwordInput = document.querySelector('#admin-password');
const loginStatus = document.querySelector('#admin-login-status');
const list = document.querySelector('#appointments-list');
const blockedList = document.querySelector('#blocked-slots-list');
const blockForm = document.querySelector('#block-slot-form');
const blockDate = document.querySelector('#blocked-date');
const blockTime = document.querySelector('#blocked-time');
const blockStatus = document.querySelector('#blocked-slot-status');
const adminName = document.querySelector('#admin-name');
const appointmentCount = document.querySelector('#appointment-count');
const blockedCount = document.querySelector('#blocked-count');
let appointments = [];
let blockedSlots = [];
let adminToken = '';

function lockAdminPanel(message = '') {
  adminToken = '';
  appointments = [];
  blockedSlots = [];
  dashboard.hidden = true;
  loginView.hidden = false;
  passwordInput.value = '';
  loginStatus.textContent = message;
  emailInput.focus();
}

function render() {
  appointmentCount.textContent = `${appointments.length} ${appointments.length === 1 ? 'cita confirmada' : 'citas confirmadas'}`;
  list.replaceChildren();
  const sorted = [...appointments];
  if (!sorted.length) { const empty = document.createElement('p'); empty.className = 'empty-dashboard'; empty.textContent = 'Aun no hay citas reservadas.'; list.append(empty); return; }
  sorted.forEach((appointment) => {
    const row = document.createElement('article');
    row.className = 'appointment-row';
    const date = appointment.appointment_date;
    const time = String(appointment.appointment_time).slice(0, 5);
    row.innerHTML = `<div><strong>${escapeHtml(appointment.customer_name)}</strong><small>${formatDisplayDate(date)} · ${time} · ${escapeHtml(appointment.service_name)}</small><small>${escapeHtml(appointment.phone)} · ${escapeHtml(appointment.email)}</small></div>`;
    const cancel = document.createElement('button');
    cancel.type = 'button'; cancel.className = 'cancel-button'; cancel.textContent = 'Cancelar';
    cancel.addEventListener('click', async () => {
      if (!window.confirm(`Cancelar la cita de ${appointment.customer_name}?`)) return;
      cancel.disabled = true;
      try {
        await cancelAppointment(appointment.id, adminToken);
        appointments = appointments.filter((item) => item.id !== appointment.id);
        render();
      } catch (error) {
        if (error.status === 401) { lockAdminPanel('La sesión ha caducado. Vuelve a entrar.'); return; }
        loginStatus.textContent = error.message;
        cancel.disabled = false;
      }
    });
    row.append(cancel); list.append(row);
  });
}

function renderBlockedSlots() {
  blockedCount.textContent = `${blockedSlots.length} ${blockedSlots.length === 1 ? 'bloqueo activo' : 'bloqueos activos'}`;
  blockedList.replaceChildren();
  if (!blockedSlots.length) {
    blockedList.innerHTML = '<p class="empty-dashboard">No hay horarios bloqueados manualmente.</p>';
    return;
  }
  blockedSlots.forEach((slot) => {
    const row = document.createElement('article');
    row.className = 'appointment-row';
    row.innerHTML = `<div><strong>${formatDisplayDate(slot.blocked_date)} · ${String(slot.blocked_time).slice(0, 5)}</strong><small>${escapeHtml(slot.reason)}</small></div>`;
    const release = document.createElement('button');
    release.type = 'button'; release.className = 'cancel-button'; release.textContent = 'Liberar';
    release.addEventListener('click', async () => {
      release.disabled = true;
      try {
        await unblockSlot(slot.id, adminToken);
        blockedSlots = blockedSlots.filter((item) => item.id !== slot.id);
        renderBlockedSlots();
      } catch (error) {
        blockStatus.textContent = error.message;
        release.disabled = false;
      }
    });
    row.append(release); blockedList.append(row);
  });
}

function renderBlockTimes() {
  const currentTime = new Date();
  const today = `${currentTime.getFullYear()}-${String(currentTime.getMonth() + 1).padStart(2, '0')}-${String(currentTime.getDate()).padStart(2, '0')}`;
  const nowMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
  blockTime.replaceChildren();
  getTimeSlots(blockDate.value).filter((time) => {
    if (blockDate.value !== today) return true;
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes > nowMinutes;
  }).forEach((time) => {
    const option = document.createElement('option');
    option.value = time; option.textContent = time; blockTime.append(option);
  });
}

function initializeBlockDate() {
  const today = new Date();
  const format = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const maximum = new Date(today);
  maximum.setDate(maximum.getDate() + 90);
  blockDate.min = format(today);
  blockDate.max = format(maximum);
  blockDate.value = format(today);
  renderBlockTimes();
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const session = await loginAdmin(emailInput.value, passwordInput.value);
    adminToken = session.token;
    [appointments, blockedSlots] = await Promise.all([loadAppointments(adminToken), loadBlockedSlots(adminToken)]);
    adminName.textContent = session.name;
    loginView.hidden = true; dashboard.hidden = false; loginStatus.textContent = ''; render();
    renderBlockedSlots(); initializeBlockDate();
  } catch (error) {
    loginStatus.textContent = error.message;
  }
});

blockDate.addEventListener('change', renderBlockTimes);
blockForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  blockStatus.textContent = '';
  try {
    const formData = new FormData(blockForm);
    const slot = await blockSlot({ date: formData.get('date'), time: formData.get('time'), reason: formData.get('reason') }, adminToken);
    blockedSlots.push(slot);
    blockedSlots.sort((a, b) => `${a.blocked_date}${a.blocked_time}`.localeCompare(`${b.blocked_date}${b.blocked_time}`));
    blockForm.reset(); renderBlockTimes(); renderBlockedSlots();
    blockStatus.textContent = 'Horario bloqueado correctamente.';
  } catch (error) {
    blockStatus.textContent = error.message;
  }
});

document.querySelector('#admin-logout').addEventListener('click', () => { adminToken = ''; appointments = []; blockedSlots = []; dashboard.hidden = true; loginView.hidden = false; passwordInput.value = ''; emailInput.focus(); });

window.setInterval(() => {
  if (dashboard.hidden || document.hidden) return;
  loadAppointments(adminToken).then((latest) => { appointments = latest; render(); }).catch((error) => { if (error.status === 401) lockAdminPanel('La sesión ha caducado. Vuelve a entrar.'); });
}, 60000);

document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !dashboard.hidden) loadAppointments(adminToken).then((latest) => { appointments = latest; render(); }).catch(() => {});
});
