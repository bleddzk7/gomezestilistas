import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcrypt';
import compression from 'compression';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { createClient } from '@supabase/supabase-js';
import { jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';
import { CONFIG } from './js/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 5502);
const adminEmail = process.env.ADMIN_EMAIL || '';
const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH || '';
const adminName = process.env.ADMIN_NAME || 'Administrador';
const adminTokenSecret = process.env.ADMIN_TOKEN_SECRET || '';
const publicOrigin = process.env.PUBLIC_APP_ORIGIN || '';
const madridDateTime = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Madrid',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
});
const supabase = process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

app.set('trust proxy', 1);
app.use(compression());
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'https://images.unsplash.com', 'data:'],
      connectSrc: ["'self'", 'http://localhost:5502', 'http://localhost:5503', publicOrigin].filter(Boolean),
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"]
    }
  }
}));
app.use(cors({
  origin(origin, callback) {
    const allowedOrigins = new Set([publicOrigin, 'http://localhost:5502', 'http://localhost:5503'].filter(Boolean));
    const isLocalDevelopment = process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin || '');
    if (!origin || allowedOrigins.has(origin) || isLocalDevelopment) return callback(null, true);
    return callback(new Error('Origen no autorizado.'));
  }
}));
app.use(express.json({ limit: '16kb' }));
app.use(express.static(__dirname, {
  etag: true,
  lastModified: true,
  setHeaders(response, filePath) {
    if (filePath.endsWith('.html') || filePath.endsWith('.js')) {
      response.setHeader('Cache-Control', 'no-cache, max-age=0, must-revalidate');
    } else {
      response.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
    }
  }
}));

const services = Object.fromEntries(Object.entries(CONFIG.services).map(([id, service]) => [id, [service.name, service.durationMinutes, service.price]]));
const missingBlockedSlotsTable = (error) => ['42P01', 'PGRST205'].includes(error?.code);
const jwtIssuer = 'gomez-estilistas';
const jwtAudience = 'gomez-estilistas-admin';
const jwtKey = new TextEncoder().encode(adminTokenSecret);

const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Espera unos minutos antes de volver a intentarlo.' }
});

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(200)
}).strict();

const appointmentSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,30}$/),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  serviceId: z.string().refine((value) => Boolean(services[value]), 'Servicio no válido.'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/)
}).strict();

const blockedSlotSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/),
  reason: z.string().trim().max(120).optional().default('Bloqueo manual')
}).strict();

function dateIsAllowed(value) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return false;
  const today = localDateKey();
  const maximum = new Date(`${today}T00:00:00.000Z`);
  maximum.setUTCDate(maximum.getUTCDate() + 90);
  return value >= today && value <= maximum.toISOString().slice(0, 10);
}

function localDateKey(date = new Date()) {
  const parts = Object.fromEntries(madridDateTime.formatToParts(date).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function slotsFor(dateValue, durationMinutes = 0) {
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  const weekday = date.getUTCDay();
  if (weekday === 0 || Number.isNaN(date.getTime())) return [];
  const opening = weekday === 6 ? 9 * 60 : 10 * 60;
  const closing = weekday === 6 ? 14 * 60 : 18 * 60;
  const latestStart = closing - Math.max(durationMinutes, 60);
  const slotCount = Math.max(0, Math.floor((latestStart - opening) / 30) + 1);
  const slots = Array.from({ length: slotCount }, (_, index) => {
    const minutes = opening + index * 30;
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  });
  if (dateValue !== localDateKey()) return slots;
  const now = Object.fromEntries(madridDateTime.formatToParts(new Date()).map(({ type, value }) => [type, value]));
  const currentMinutes = Number(now.hour) * 60 + Number(now.minute);
  return slots.filter((time) => {
    const [hour, minutes] = time.split(':').map(Number);
    return hour * 60 + minutes > currentMinutes;
  });
}

function requireDatabase(req, res, next) {
  if (!supabase) return res.status(503).json({ error: 'La base de datos no está configurada.' });
  next();
}

function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) return res.status(400).json({ error: 'Revisa los datos enviados.' });
    req.validatedBody = result.data;
    next();
  };
}

async function createAdminToken() {
  return new SignJWT({ name: adminName })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(adminEmail.toLowerCase())
    .setIssuer(jwtIssuer)
    .setAudience(jwtAudience)
    .setIssuedAt()
    .setExpirationTime('30m')
    .sign(jwtKey);
}

async function requireAdmin(req, res, next) {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token || !adminTokenSecret) return res.status(401).json({ error: 'Sesión de administración no válida.' });
  try {
    await jwtVerify(token, jwtKey, { issuer: jwtIssuer, audience: jwtAudience });
    next();
  } catch {
    res.status(401).json({ error: 'Sesión de administración no válida.' });
  }
}

app.get('/api/availability', requireDatabase, async (req, res) => {
  const { date } = req.query;
  if (!dateIsAllowed(date)) return res.status(400).json({ error: 'Fecha no disponible.' });
  const [{ data: appointments, error: appointmentsError }, { data: blocked, error: blockedError }] = await Promise.all([
    supabase.from('appointments').select('appointment_time').eq('appointment_date', date).eq('status', 'confirmed'),
    supabase.from('blocked_slots').select('blocked_time').eq('blocked_date', date)
  ]);
  if (appointmentsError || (blockedError && !missingBlockedSlotsTable(blockedError))) return res.status(500).json({ error: 'No se pudo consultar la disponibilidad.' });
  res.json({ slots: slotsFor(date), occupied: appointments.map((item) => String(item.appointment_time).slice(0, 5)), blocked: blockedError ? [] : blocked.map((item) => String(item.blocked_time).slice(0, 5)) });
});

app.post('/api/admin/login', adminLoginLimiter, validateBody(loginSchema), async (req, res) => {
  const { email, password } = req.validatedBody;
  if (!adminEmail || !adminPasswordHash || !adminTokenSecret) return res.status(503).json({ error: 'El acceso de administración no está configurado.' });
  const passwordMatches = await bcrypt.compare(password, adminPasswordHash).catch(() => false);
  if (email.toLowerCase() !== adminEmail.toLowerCase() || !passwordMatches) return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
  res.json({ token: await createAdminToken(), name: adminName });
});

app.post('/api/appointments', requireDatabase, validateBody(appointmentSchema), async (req, res) => {
  const { name, phone, email, serviceId, date, time } = req.validatedBody;
  const service = services[serviceId];
  if (!name?.trim() || !phone?.trim() || !email?.trim() || !service || !dateIsAllowed(date) || !slotsFor(date, service[1]).includes(time)) return res.status(400).json({ error: 'Revisa los datos y el horario seleccionado.' });
  const { data: blockedSlot, error: blockedError } = await supabase.from('blocked_slots').select('id').eq('blocked_date', date).eq('blocked_time', time).maybeSingle();
  if (blockedError) return res.status(500).json({ error: 'No se pudo validar el horario.' });
  if (blockedSlot) return res.status(409).json({ error: 'Este horario no está disponible.' });
  const { data, error } = await supabase.from('appointments').insert({ customer_name: name.trim(), phone: phone.trim(), email: email.trim(), service_id: serviceId, service_name: service[0], duration_minutes: service[1], price: service[2], appointment_date: date, appointment_time: time }).select().single();
  if (error) return res.status(error.code === '23505' ? 409 : 500).json({ error: error.code === '23505' ? 'Este horario acaba de ser reservado.' : 'No se pudo guardar la cita.' });
  res.status(201).json(data);
});

app.get('/api/appointments', requireDatabase, requireAdmin, async (_req, res) => {
  const { data, error } = await supabase.from('appointments').select('*').eq('status', 'confirmed').order('appointment_date').order('appointment_time');
  if (error) return res.status(500).json({ error: 'No se pudieron cargar las citas.' });
  res.json(data);
});

app.patch('/api/appointments/:id/cancel', requireDatabase, requireAdmin, async (req, res) => {
  const { data, error } = await supabase.from('appointments').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', req.params.id).eq('status', 'confirmed').select().single();
  if (error) return res.status(error.code === 'PGRST116' ? 404 : 500).json({ error: 'No se pudo cancelar la cita.' });
  res.json(data);
});

app.get('/api/blocked-slots', requireDatabase, requireAdmin, async (_req, res) => {
  const { data, error } = await supabase.from('blocked_slots').select('*').order('blocked_date').order('blocked_time');
  if (missingBlockedSlotsTable(error)) return res.json([]);
  if (error) return res.status(500).json({ error: 'No se pudieron cargar los bloqueos.' });
  res.json(data);
});

app.post('/api/blocked-slots', requireDatabase, requireAdmin, validateBody(blockedSlotSchema), async (req, res) => {
  const { date, time, reason } = req.validatedBody;
  if (!dateIsAllowed(date) || !slotsFor(date).includes(time)) return res.status(400).json({ error: 'Fecha u hora no válida.' });
  const { data: appointment } = await supabase.from('appointments').select('id').eq('appointment_date', date).eq('appointment_time', time).eq('status', 'confirmed').maybeSingle();
  if (appointment) return res.status(409).json({ error: 'Ya existe una cita en ese horario. Cancélala primero si es necesario.' });
  const { data, error } = await supabase.from('blocked_slots').insert({ blocked_date: date, blocked_time: time, reason: reason?.trim() || 'Bloqueo manual' }).select().single();
  if (missingBlockedSlotsTable(error)) return res.status(503).json({ error: 'Ejecuta primero supabase/schema.sql para activar los bloqueos.' });
  if (error) return res.status(error.code === '23505' ? 409 : 500).json({ error: error.code === '23505' ? 'Ese horario ya está bloqueado.' : 'No se pudo bloquear el horario.' });
  res.status(201).json(data);
});

app.delete('/api/blocked-slots/:id', requireDatabase, requireAdmin, async (req, res) => {
  const { error } = await supabase.from('blocked_slots').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: 'No se pudo liberar el horario.' });
  res.status(204).end();
});

app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && 'body' in error) return res.status(400).json({ error: 'El cuerpo de la solicitud no es válido.' });
  console.error('Error interno de API');
  res.status(500).json({ error: 'No se pudo completar la solicitud.' });
});

app.listen(port, () => console.log(`Gómez Estilistas disponible en http://localhost:${port}`));
