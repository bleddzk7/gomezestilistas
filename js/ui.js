export function formatDisplayDate(dateString) {
  return new Intl.DateTimeFormat('es-ES', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${dateString}T12:00:00`));
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>\'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

export function showToast(message) {
  const toast = document.querySelector('#success-toast');
  if (!toast) return;
  document.querySelector('#success-toast-message').textContent = message;
  toast.hidden = false;
  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => { toast.hidden = true; }, 8000);
}

export function setupReveal() {
  const items = document.querySelectorAll('[data-reveal]');
  if (!items.length) return;
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
  }), { threshold: 0.12 });
  items.forEach((item) => observer.observe(item));
}

export function setupToastClose() {
  document.querySelector('[data-toast-close]')?.addEventListener('click', () => { document.querySelector('#success-toast').hidden = true; });
}
