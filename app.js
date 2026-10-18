import { setupReveal } from './js/ui.js';
import { initCookieConsent } from './js/cookies.js';
import { initNavigation } from './js/navigation.js';
import { initLiveStatus } from './js/live-status.js';

document.documentElement.classList.add('js-ready');
initCookieConsent();
initNavigation();
setupReveal();
initLiveStatus();

const page = document.body.dataset.page;

if (page === 'booking') import('./js/booking.js');
if (page === 'home') import('./js/home.js').then(({ initHomePage }) => initHomePage?.());
if (page === 'home' || page === 'services') import('./js/services.js').then(({ initServicesPage }) => initServicesPage());
