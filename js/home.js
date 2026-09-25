export function initHomePage() {
  document.querySelectorAll('.gallery-item').forEach((item) => item.addEventListener('mouseenter', () => item.classList.add('is-hovered')));
}
