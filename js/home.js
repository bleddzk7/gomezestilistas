export function initHomePage() {
  const compare = document.querySelector('.compare-frame');
  const slider = compare?.querySelector('.compare-range');
  if (compare && slider) {
    const updateSplit = () => compare.style.setProperty('--split', `${slider.value}%`);
    slider.addEventListener('input', updateSplit);
    updateSplit();
  }

  const cursor = document.querySelector('.custom-cursor');
  if (cursor && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.addEventListener('pointermove', (event) => {
      cursor.style.left = `${event.clientX}px`;
      cursor.style.top = `${event.clientY}px`;
    });
    document.querySelectorAll('a, button, input, select').forEach((element) => {
      element.addEventListener('pointerenter', () => cursor.classList.add('is-active'));
      element.addEventListener('pointerleave', () => cursor.classList.remove('is-active'));
    });
  }
}
