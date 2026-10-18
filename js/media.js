import { CONFIG } from './config.js';

const SAFE_PATH = /^(assets|uploads)\/[A-Za-z0-9._-]{1,120}$/;

// Convierte una ruta guardada en base de datos en una URL de imagen; rechaza cualquier otra cosa.
export function mediaUrl(value) {
  const path = String(value || '');
  if (!SAFE_PATH.test(path)) return '';
  if (path.startsWith('assets/')) return `/${path}`;
  return `${CONFIG.supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/site-media/${path}`;
}

export function safeUrl(value, protocols = ['https:']) {
  try {
    const url = new URL(String(value || ''));
    return protocols.includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}
