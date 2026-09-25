const service = (name, duration, durationMinutes, price, category, description) => Object.freeze({
  name,
  duration,
  durationMinutes,
  price,
  category,
  description
});

export const CONFIG = Object.freeze({
  businessName: 'Gómez Estilistas',
  address: 'C. de la Zapatería, 38, Pamplona',
  bookingWindowDays: 90,
  services: Object.freeze({
    exfoliacion: service('Exfoliación', '1h', 60, 35, 'Tratamientos capilares', 'Limpieza profunda y revitalización del cuero cabelludo.'),
    hidratacion: service('Hidratación', '1h', 60, 60, 'Tratamientos capilares', 'Un aporte intenso de hidratación para recuperar suavidad y brillo.'),
    hidratacionReconstruccion: service('Hidratación y Reconstrucción', '1h 30m', 90, 120, 'Tratamientos capilares', 'Tratamiento completo para devolver fuerza, elasticidad y movimiento.'),
    botoxCorto: service('Bótox capilar · Pelo corto', '3h 15m', 195, 200, 'Bótox capilar', 'Alisado y reparación profunda adaptados a melenas cortas.'),
    botoxMedio: service('Bótox capilar · Pelo medio', '3h 45m', 225, 245, 'Bótox capilar', 'Tratamiento disciplinante y reparador para pelo medio.'),
    botoxLargo: service('Bótox capilar · Pelo largo', '4h 45m', 285, 300, 'Bótox capilar', 'Tratamiento completo para melenas largas y exigentes.'),
    peinadoCorto: service('Peinado · Pelo corto', '45m', 45, 25, 'Peinados', 'Acabado pulido y personalizado para pelo corto.'),
    peinadoMedio: service('Peinado · Pelo medio', '45m', 45, 35, 'Peinados', 'Movimiento y textura para pelo medio.'),
    peinadoLargo: service('Peinado · Pelo largo', '45m', 45, 45, 'Peinados', 'Acabado de alta precisión para pelo largo.'),
    moldeadoCorto: service('Moldeado corto', '1h 15m', 75, 75, 'Peinados', 'Forma duradera y movimiento para pelo corto.'),
    semirecogido: service('Semirecogido', '1h', 60, 70, 'Peinados', 'Un acabado elegante y versátil para cualquier ocasión.'),
    recogido: service('Recogido', '1h 15m', 75, 85, 'Peinados', 'Diseño personalizado para eventos y ocasiones especiales.'),
    flequillo: service('Flequillo', '15m', 15, 10, 'Cortes', 'Ajuste preciso para renovar tu corte.'),
    cortePeinadoCorto: service('Corte y peinado · Pelo corto', '1h', 60, 50, 'Cortes', 'Corte diseñado y acabado para pelo corto.'),
    cortePeinadoMedio: service('Corte y peinado · Pelo medio', '1h 15m', 75, 65, 'Cortes', 'Corte y peinado adaptados a tu textura.'),
    cortePeinadoLargo: service('Corte y peinado · Pelo largo', '1h 30m', 90, 80, 'Cortes', 'Diseño de forma y acabado para pelo largo.'),
    lavadoCorteCorto: service('Lavado + corte · Pelo corto', '1h', 60, 40, 'Cortes', 'Lavado, corte y acabado para pelo corto.'),
    lavadoCorteMedio: service('Lavado + corte · Pelo medio', '1h 15m', 75, 55, 'Cortes', 'Lavado, corte y acabado para pelo medio.'),
    corteCaballero: service('Corte caballero', '45m', 45, 25, 'Cortes', 'Corte masculino de precisión y acabado limpio.'),
    mechasLargo: service('Mechas completas · Pelo largo', '4h', 240, 235, 'Color y mechas', 'Iluminación completa para melenas largas.'),
    balayageCorto: service('Balayage · Pelo corto', '3h 30m', 210, 215, 'Color y mechas', 'Luz y dimensión natural para pelo corto.'),
    balayageMedio: service('Balayage · Media melena', '4h', 240, 285, 'Color y mechas', 'Degradado artesanal para media melena.'),
    balayageLargo: service('Balayage · Pelo largo', '5h', 300, 360, 'Color y mechas', 'Balayage completo para una melena larga.'),
    retoqueRaiz: service('Retoque raíz', '1h 30m', 90, 65, 'Color y mechas', 'Mantenimiento preciso del color en la raíz.'),
    matiz: service('Matiz', '45m', 45, 85, 'Color y mechas', 'Refresco de tono y brillo para tu color.'),
    depilacionCejas: service('Depilación cera cejas', '30m', 30, 30, 'Depilación y facial', 'Diseño y definición de cejas con cera.'),
    maquillajeDia: service('Maquillaje de día', '45m', 45, 60, 'Depilación y facial', 'Maquillaje luminoso y natural para el día.'),
    maquillajeNoche: service('Maquillaje de noche', '1h', 60, 80, 'Depilación y facial', 'Maquillaje sofisticado para una ocasión especial.')
  }),
  schedule: Object.freeze({
    weekday: Object.freeze({ opening: '10:00', closing: '18:00' }),
    saturday: Object.freeze({ opening: '09:00', closing: '14:00' }),
    sunday: null
  })
});

export const getServiceEntries = () => Object.entries(CONFIG.services);

export const getTimeSlots = (dateValue = '', durationMinutes = 0) => {
  const date = dateValue ? new Date(`${dateValue}T00:00:00`) : new Date();
  if (Number.isNaN(date.getTime())) return [];
  const schedule = date.getDay() === 6 ? CONFIG.schedule.saturday : CONFIG.schedule.weekday;
  if (date.getDay() === 0 || !schedule) return [];
  const [openingHour, openingMinutes] = schedule.opening.split(':').map(Number);
  const [closingHour, closingMinutes] = schedule.closing.split(':').map(Number);
  const opening = openingHour * 60 + openingMinutes;
  const closing = closingHour * 60 + closingMinutes;
  const latestStart = closing - Math.max(durationMinutes, 60);
  const slots = [];
  for (let minutes = opening; minutes <= latestStart; minutes += 30) {
    slots.push(`${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`);
  }
  return slots;
};
