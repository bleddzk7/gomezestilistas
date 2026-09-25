import { setupReveal, setupToastClose } from './js/ui.js';
import { initCookieConsent } from './js/cookies.js';
import { initNavigation } from './js/navigation.js';

document.documentElement.classList.add('js-ready');
initCookieConsent();
initNavigation();
setupReveal();
setupToastClose();

const page = document.body.dataset.page;

if (page === 'booking') import('./js/booking.js');
if (page === 'admin') import('./js/admin.js');
if (page === 'home') import('./js/home.js').then(({ initHomePage }) => initHomePage?.());
if (page === 'services') import('./js/services.js').then(({ initServicesPage }) => initServicesPage());
