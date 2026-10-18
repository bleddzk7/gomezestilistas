import { CONFIG } from './config.js';

function renderServiceRows(container, linked) {
  container.innerHTML = Object.entries(CONFIG.services).map(([id, service], index) => `
    <a id="${id}" class="service-row" href="${linked ? `reservas.html?servicio=${id}` : 'reservas.html'}">
      <span class="service-row-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>
      <span><strong class="service-row-name">${service.name}</strong><span class="service-row-description">${service.description}</span></span>
      <span class="service-row-price">${service.price} €</span>
      <span class="service-row-arrow" aria-hidden="true">↗</span>
    </a>`).join('');
}

export function initServicesPage() {
  const catalog = document.querySelector('#service-catalog');
  if (catalog) renderServiceRows(catalog, false);
  const homeList = document.querySelector('#home-service-list');
  if (homeList) renderServiceRows(homeList, true);
}
