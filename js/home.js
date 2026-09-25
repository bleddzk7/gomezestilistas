export function initHomePage() {
  const galleryGrid = document.querySelector('.gallery-grid');
  const storefront = new URL('../assets/Fotofuera.webp', import.meta.url).href;
  const heroArt = document.querySelector('.hero-art');

  if (heroArt) {
    heroArt.classList.add('hero-art-photo');
    heroArt.style.backgroundImage = `linear-gradient(0deg, rgba(17, 17, 15, .28), transparent 55%), url("${storefront}")`;
  }

  if (galleryGrid) {
    const photos = [
      {
        src: new URL('../assets/dentrouno.webp', import.meta.url).href,
        alt: 'Zona de recepción de Gómez Estilistas',
        caption: 'La recepción / 01'
      },
      {
        src: new URL('../assets/Dentrodos.webp', import.meta.url).href,
        alt: 'Zona de lavado del salón Gómez Estilistas',
        caption: 'El cuidado / 02'
      },
      {
        src: new URL('../assets/Dentrotres.webp', import.meta.url).href,
        alt: 'Puestos de peluquería de Gómez Estilistas',
        caption: 'El estudio / 03'
      }
    ];

    galleryGrid.replaceChildren();
    photos.forEach((photo) => {
      const item = document.createElement('figure');
      item.className = 'gallery-item';
      item.dataset.reveal = '';
      item.classList.add('is-visible');

      const image = document.createElement('img');
      image.src = photo.src;
      image.alt = photo.alt;
      image.loading = 'lazy';
      image.decoding = 'async';

      const caption = document.createElement('figcaption');
      caption.textContent = photo.caption;

      item.append(image, caption);
      galleryGrid.append(item);
    });

    galleryGrid.classList.add('gallery-grid-three');
  }

  document.querySelectorAll('.gallery-item').forEach((item) => item.addEventListener('mouseenter', () => item.classList.add('is-hovered')));
}
