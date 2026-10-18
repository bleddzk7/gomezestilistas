import { uploadImage } from './api.js';
import { mediaUrl } from '../../js/media.js';

/** Crea elementos sin innerHTML: todo el texto se inserta como texto plano. */
export function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else if (key === 'value') node.value = value;
    else if (key === 'checked') node.checked = Boolean(value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  children.flat().forEach((child) => {
    if (child !== null && child !== undefined && child !== false) node.append(child);
  });
  return node;
}

let toastTimer;
export function toast(message, type = 'ok') {
  const box = document.querySelector('#toast');
  box.textContent = message;
  box.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { box.className = 'toast'; }, type === 'error' ? 6000 : 3000);
}

export function confirmDialog(message, okLabel = 'Eliminar') {
  return new Promise((resolve) => {
    const dialog = h('dialog', { class: 'dialog' },
      h('p', {}, message),
      h('div', { class: 'row-actions' },
        h('button', { class: 'btn ghost', type: 'button', onclick: () => dialog.close('no') }, 'Cancelar'),
        h('button', { class: 'btn danger', type: 'button', onclick: () => dialog.close('yes') }, okLabel)));
    dialog.addEventListener('close', () => { resolve(dialog.returnValue === 'yes'); dialog.remove(); });
    document.body.append(dialog);
    dialog.showModal();
  });
}

export function promptDialog(title, value = '', max = 500) {
  return new Promise((resolve) => {
    const area = h('textarea', { rows: 5, maxlength: max }, value);
    area.value = value;
    const dialog = h('dialog', { class: 'dialog' },
      h('h3', {}, title), area,
      h('div', { class: 'row-actions' },
        h('button', { class: 'btn ghost', type: 'button', onclick: () => dialog.close('') }, 'Cancelar'),
        h('button', { class: 'btn', type: 'button', onclick: () => dialog.close('save') }, 'Guardar')));
    dialog.addEventListener('close', () => { resolve(dialog.returnValue === 'save' ? area.value.trim() : null); dialog.remove(); });
    document.body.append(dialog);
    dialog.showModal();
    area.focus();
  });
}

let counter = 0;
/** Campo de formulario. Devuelve { node, get(), set(v) }. */
export function field(def, initial) {
  const id = `f${++counter}`;
  let input;
  if (def.type === 'textarea') input = h('textarea', { id, rows: def.rows || 3, maxlength: def.max || 600 });
  else if (def.type === 'bool') input = h('input', { id, type: 'checkbox' });
  else if (def.type === 'number') input = h('input', { id, type: 'number', min: def.min ?? 0, max: def.max ?? 999, step: def.step ?? 0.5, inputmode: 'decimal' });
  else if (def.type === 'select') input = h('select', { id }, def.options.map(([value, label]) => h('option', { value }, label)));
  else input = h('input', { id, type: def.type || 'text', maxlength: def.max || 120, placeholder: def.placeholder || '' });
  if (def.type === 'bool') input.checked = Boolean(initial); else input.value = initial ?? '';
  const label = h('label', { for: id }, def.label);
  const node = h('div', { class: `field${def.type === 'bool' ? ' field-bool' : ''}` },
    def.type === 'bool' ? [input, label] : [label, input], def.help ? h('small', {}, def.help) : null);
  return {
    node,
    input,
    get: () => (def.type === 'bool' ? input.checked : def.type === 'number' ? (input.value === '' ? NaN : Number(input.value)) : input.value.trim()),
    set: (value) => { if (def.type === 'bool') input.checked = Boolean(value); else input.value = value ?? ''; }
  };
}

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

/** Redimensiona y comprime en el navegador antes de subir. */
export async function processImage(file, maxSide = 1600) {
  if (!ALLOWED.includes(file.type)) throw new Error('Formato no permitido. Usa JPG, PNG o WebP.');
  if (file.size > 20 * 1024 * 1024) throw new Error('La imagen supera los 20 MB.');
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  let blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.86));
  if (!blob || blob.type !== 'image/webp') blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88));
  if (!blob) throw new Error('No se pudo procesar la imagen.');
  if (blob.size > 7.5 * 1024 * 1024) throw new Error('La imagen sigue siendo demasiado pesada.');
  return { blob, extension: blob.type === 'image/webp' ? 'webp' : 'jpg' };
}

/** Selector de imagen con vista previa y subida a Storage. */
export function imageField(def, initial) {
  let value = initial || '';
  const preview = h('img', { class: 'thumb', alt: '', width: 120, height: 120 });
  const status = h('small', {}, '');
  const input = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', class: 'visually-hidden' });
  const paint = () => {
    const src = mediaUrl(value);
    if (src) preview.setAttribute('src', src); else preview.removeAttribute('src');
    preview.classList.toggle('empty', !src);
  };
  const button = h('button', { class: 'btn ghost small', type: 'button', onclick: () => input.click() }, 'Cambiar imagen');
  input.addEventListener('change', async () => {
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    button.disabled = true;
    status.textContent = 'Subiendo…';
    try {
      const { blob, extension } = await processImage(file, def.maxSide);
      value = await uploadImage(blob, extension);
      paint();
      status.textContent = 'Imagen subida. Recuerda guardar los cambios.';
    } catch (error) {
      status.textContent = error.message;
      toast(error.message, 'error');
    } finally {
      button.disabled = false;
    }
  });
  paint();
  const node = h('div', { class: 'field image-field' }, h('span', { class: 'label' }, def.label),
    h('div', { class: 'image-row' }, preview, h('div', {}, button, input, status)));
  return { node, get: () => value, set: (v) => { value = v || ''; paint(); } };
}

export const slugify = (text) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'servicio';
