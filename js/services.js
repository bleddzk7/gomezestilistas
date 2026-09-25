import { CONFIG } from './config.js';

export function initServicesPage() {
  const container = document.querySelector('#service-catalog');
  if (!container) return;
  const groups = Object.entries(CONFIG.services).reduce((result, [id, service]) => {
    result[service.category] ||= [];
    result[service.category].push({ id, ...service });
    return result;
  }, {});
  container.innerHTML = Object.entries(groups).map(([category, services], groupIndex) => `
    <section class="service-category" aria-labelledby="category-${groupIndex}">
      <div class="section-heading"><div><p class="eyebrow">${category}</p><h2 id="category-${groupIndex}">${category}</h2></div></div>
      <div class="service-grid">${services.map((service, index) => `
        <article id="${service.id}" class="service-card" data-reveal>
          <span class="service-number">${String(index + 1).padStart(2, '0')}</span>
          <h3>${service.name}</h3><p>${service.description}</p>
          <div><strong>${service.price}€</strong><span>${service.duration}</span></div>
          <a class="service-detail-link" href="reservas.html?servicio=${service.id}">Reservar <span aria-hidden="true">↗</span></a>
        </article>`).join('')}</div>
    </section>`).join('');
  container.querySelectorAll('[data-reveal]').forEach((element) => element.classList.add('is-visible'));
  const requested = window.location.hash.slice(1);
  if (requested && CONFIG.services[requested]) document.querySelector(`#${requested}`)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
}
