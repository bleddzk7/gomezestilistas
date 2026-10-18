import { CONFIG } from './config.js';

const bookingForm = document.querySelector('#booking-form');
const serviceSelect = document.querySelector('#service-choice');
const status = document.querySelector('#booking-status');

if (bookingForm && serviceSelect) {
  serviceSelect.innerHTML = '<option value="">Selecciona un servicio</option>';
  Object.entries(CONFIG.services).forEach(([id, service]) => {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = `${service.name} · ${service.price} €`;
    serviceSelect.append(option);
  });

  const requestedService = new URLSearchParams(window.location.search).get('servicio');
  if (requestedService && CONFIG.services[requestedService]) serviceSelect.value = requestedService;

  bookingForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(bookingForm);
    const name = String(formData.get('name') || '').trim();
    const service = CONFIG.services[String(formData.get('service'))];
    const preference = String(formData.get('preference') || '').trim();
    if (!name || !service || !preference) return;

    const message = `Hola, soy ${name}. Quería pedir cita para ${service.name}. Me vendría bien ${preference}. ¿Tenéis hueco?`;
    const whatsappUrl = new URL(`https://wa.me/${CONFIG.whatsapp}`);
    whatsappUrl.searchParams.set('text', message);
    status.textContent = 'WhatsApp se abrirá con tu mensaje. Envíalo para solicitar la cita.';
    window.open(whatsappUrl.href, '_blank', 'noopener,noreferrer');
  });
}
