export const CONFIG = {
  businessName: 'IRUÑARTEA',
  address: 'C. Bernardino Tirapu, 31, 31014 Pamplona, Navarra',
  phone: '604 97 85 34',
  phoneLink: '+34604978534',
  whatsapp: '34604978534',
  // Supabase (Project Settings > API). La clave "anon/publishable" es pública por diseño; la seguridad la dan las políticas RLS.
  // Vacío = la web usa el contenido incluido en el HTML y el panel de administración queda desactivado.
  supabaseUrl: 'https://fnjcgfjmxuvgyoclrlnr.supabase.co',
  supabaseKey: 'sb_publishable_9emt8lAGlymWLOLyDDHQiw_2HfK_Wbc',
  // URL de la aplicación web de Google Apps Script (ver google-sheets/Code.gs). Vacío = no se guarda nada.
  bookingsUrl: 'https://script.google.com/macros/s/AKfycbzn4Ax_5fCusQtfJGdGENZxyRir5F0rT5y_cRa_BYPvRzwgUPQ0tLKNmF1zkMOWrWXl1Q/exec',
  bookingsToken: '049dd5e29af6bbe03bf49d4278e1a7c5e8bb',
  reviewUrl: 'https://search.google.com/local/writereview?placeid=ChIJ2U23ZwmTUA0RUODbXBFwLLU',
  directionsUrl: 'https://www.google.com/maps/search/?api=1&query=IRU%C3%91ARTEA+C.+Bernardino+Tirapu+31+31014+Pamplona',
  // Claves ISO: 1 = lunes … 7 = domingo
  schedule: Object.freeze({
    1: Object.freeze([{ opening: '09:30', closing: '14:00' }, { opening: '16:00', closing: '20:30' }]),
    2: Object.freeze([{ opening: '09:30', closing: '14:00' }, { opening: '16:30', closing: '20:30' }]),
    3: Object.freeze([{ opening: '09:30', closing: '14:00' }, { opening: '16:30', closing: '20:30' }]),
    4: Object.freeze([{ opening: '09:30', closing: '14:00' }, { opening: '16:30', closing: '20:30' }]),
    5: Object.freeze([{ opening: '09:30', closing: '13:00' }, { opening: '16:30', closing: '20:30' }]),
    6: Object.freeze([{ opening: '09:30', closing: '14:30' }, { opening: '16:30', closing: '20:30' }]),
    7: Object.freeze([])
  }),
  services: Object.freeze({
    corte: Object.freeze({ name: 'Corte', price: 15, description: 'Tijera y máquina, a tu medida.' }),
    degradado: Object.freeze({ name: 'Degradado', price: 17, description: 'Fade bien trabajado, de la piel al largo que elijas.' }),
    barba: Object.freeze({ name: 'Barba', price: 10, description: 'Perfilado, recorte y toalla caliente.' }),
    corteBarba: Object.freeze({ name: 'Corte + barba', price: 22, description: 'El servicio completo.' }),
    afeitado: Object.freeze({ name: 'Afeitado clásico', price: 15, description: 'Navaja, espuma y toalla caliente.' }),
    cejas: Object.freeze({ name: 'Cejas', price: 5, description: 'Diseño y perfilado con precisión.' })
  })
};

export const getServiceEntries = () => Object.entries(CONFIG.services);
