export const getBookingKey = (date, time) => `${date}T${time}`;
const isLocalFrontend = ['localhost', '127.0.0.1'].includes(window.location.hostname) && window.location.port !== '5503';
const API_BASE_URL = isLocalFrontend ? 'http://localhost:5503' : '';
const apiUrl = (path) => `${API_BASE_URL}${path}`;

async function request(url, options = {}) {
  let response;
  try {
    response = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('No se puede conectar con la API. Comprueba que npm start esté ejecutándose.');
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || 'No se pudo completar la solicitud.');
    error.status = response.status;
    throw error;
  }
  return payload;
}

export const loadAvailability = (date, signal) => request(apiUrl(`/api/availability?date=${encodeURIComponent(date)}`), { signal });
export const createAppointment = (data) => request(apiUrl('/api/appointments'), { method: 'POST', body: JSON.stringify(data) });

export const loginAdmin = (email, password) => request(apiUrl('/api/admin/login'), { method: 'POST', body: JSON.stringify({ email, password }) });

export const loadAppointments = (token) => request(apiUrl('/api/appointments'), { headers: { Authorization: `Bearer ${token}` } });

export const cancelAppointment = (id, token) => request(apiUrl(`/api/appointments/${encodeURIComponent(id)}/cancel`), {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${token}` }
});

export const loadBlockedSlots = (token) => request(apiUrl('/api/blocked-slots'), { headers: { Authorization: `Bearer ${token}` } });

export const blockSlot = (data, token) => request(apiUrl('/api/blocked-slots'), {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: JSON.stringify(data)
});

export const unblockSlot = (id, token) => request(apiUrl(`/api/blocked-slots/${encodeURIComponent(id)}`), {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${token}` }
});
