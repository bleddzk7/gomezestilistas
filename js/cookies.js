const CONSENT_KEY = 'gomez-estilistas:consent:v1';
const CONSENT_VERSION = 1;

const defaultConsent = () => ({
  version: CONSENT_VERSION,
  necessary: true,
  preferences: false,
  analytics: false,
  marketing: false,
  updatedAt: new Date().toISOString()
});

function readConsent() {
  try {
    const stored = JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null');
    return stored?.version === CONSENT_VERSION ? stored : null;
  } catch {
    return null;
  }
}

function saveConsent(consent) {
  const value = { ...defaultConsent(), ...consent, version: CONSENT_VERSION, updatedAt: new Date().toISOString() };
  localStorage.setItem(CONSENT_KEY, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent('cookieconsentchange', { detail: value }));
  return value;
}

function removeBanner() {
  document.querySelector('#cookie-consent-banner')?.remove();
  document.querySelector('#cookie-preferences-dialog')?.remove();
}

function showPreferences(consent = readConsent() || defaultConsent()) {
  document.querySelector('#cookie-preferences-dialog')?.remove();
  const dialog = document.createElement('div');
  dialog.id = 'cookie-preferences-dialog';
  dialog.className = 'cookie-dialog-backdrop';
  dialog.innerHTML = `<section class="cookie-dialog" role="dialog" aria-modal="true" aria-labelledby="cookie-dialog-title">
    <button class="cookie-dialog-close" type="button" data-cookie-close aria-label="Cerrar preferencias">×</button>
    <p class="eyebrow">Privacidad</p><h2 id="cookie-dialog-title">Preferencias de cookies</h2>
    <p>Las cookies y tecnologías necesarias permiten que el sitio funcione. Las categorías opcionales permanecen desactivadas hasta que las elijas.</p>
    <label class="cookie-toggle"><input type="checkbox" data-consent-preferences ${consent.preferences ? 'checked' : ''}><span><strong>Preferencias</strong><small>Recordar opciones de navegación.</small></span></label>
    <label class="cookie-toggle"><input type="checkbox" data-consent-analytics ${consent.analytics ? 'checked' : ''}><span><strong>Analítica</strong><small>No hay herramientas analíticas activas actualmente.</small></span></label>
    <label class="cookie-toggle"><input type="checkbox" data-consent-marketing ${consent.marketing ? 'checked' : ''}><span><strong>Marketing</strong><small>No se utilizan herramientas de marketing actualmente.</small></span></label>
    <button class="button" type="button" data-cookie-save>Guardar preferencias</button>
  </section>`;
  document.body.append(dialog);
  dialog.querySelector('[data-cookie-close]').addEventListener('click', () => dialog.remove());
  dialog.querySelector('[data-cookie-save]').addEventListener('click', () => {
    saveConsent({
      preferences: dialog.querySelector('[data-consent-preferences]').checked,
      analytics: dialog.querySelector('[data-consent-analytics]').checked,
      marketing: dialog.querySelector('[data-consent-marketing]').checked
    });
    dialog.remove();
  });
}

function showBanner() {
  if (readConsent() || document.querySelector('#cookie-consent-banner')) return;
  const banner = document.createElement('aside');
  banner.id = 'cookie-consent-banner';
  banner.className = 'cookie-banner';
  banner.setAttribute('aria-label', 'Preferencias de privacidad');
  banner.innerHTML = `<div><p class="eyebrow">Tu privacidad</p><p>Usamos tecnologías necesarias para prestar el servicio de reservas. Las categorías opcionales no se activan sin tu permiso.</p><a href="cookies-policy.html">Leer la política de cookies</a></div><div class="cookie-actions"><button class="text-link" type="button" data-cookie-reject>Rechazar no necesarias</button><button class="text-link" type="button" data-cookie-configure>Configurar</button><button class="button" type="button" data-cookie-accept>Aceptar todas</button></div>`;
  document.body.append(banner);
  banner.querySelector('[data-cookie-reject]').addEventListener('click', () => { saveConsent({}); removeBanner(); });
  banner.querySelector('[data-cookie-accept]').addEventListener('click', () => { saveConsent({ preferences: true, analytics: true, marketing: true }); removeBanner(); });
  banner.querySelector('[data-cookie-configure]').addEventListener('click', () => showPreferences());
}

export function openCookiePreferences() {
  showPreferences(readConsent() || defaultConsent());
}

export function initCookieConsent() {
  document.querySelectorAll('[data-cookie-settings]').forEach((button) => button.addEventListener('click', openCookiePreferences));
  if (!readConsent()) showBanner();
}
