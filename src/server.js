import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadConfig } from './config.js';
import { createSupabaseClient } from './supabaseClient.js';
import { createCsrfToken, createRateLimiter, parseCookies, safeJsonParse, secureHeaders } from './security.js';
import { formatSnils, validatePayload } from './validation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, '..', 'public');

function json(res, statusCode, data, headers = {}) {
  const body = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    ...headers,
  });
  res.end(body);
}

function getClientIp(req) {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string') {
    return forwardedFor.split(',')[0].trim();
  }

  return req.socket.remoteAddress ?? 'unknown';
}

async function readRequestBody(req, limitBytes = 10_000) {
  const chunks = [];
  let total = 0;

  for await (const chunk of req) {
    total += chunk.length;
    if (total > limitBytes) {
      const error = new Error('Payload too large');
      error.status = 413;
      throw error;
    }

    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString('utf-8');
}

export function createServer({ config = loadConfig(), supabase = null } = {}) {
  const headers = secureHeaders(config.appOrigin);
  const rateLimiter = createRateLimiter({
    windowMs: config.rateLimitWindowMs,
    maxRequests: config.rateLimitMax,
  });

  const supabaseClient =
    supabase ??
    createSupabaseClient({
      url: config.supabaseUrl,
      serviceRoleKey: config.supabaseServiceRoleKey,
    });

  return http.createServer(async (req, res) => {
    Object.entries(headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    if (!req.url || !req.method) {
      json(res, 400, { error: 'Bad request' });
      return;
    }

    const url = new URL(req.url, config.appOrigin);
    const ip = getClientIp(req);

    if (rateLimiter(ip)) {
      json(res, 429, { error: 'Слишком много запросов. Повторите позже.' });
      return;
    }

    if (req.method === 'GET' && url.pathname === '/') {
      try {
        const htmlPath = path.join(publicDir, 'index.html');
        let html = await readFile(htmlPath, 'utf-8');
        const csrfToken = createCsrfToken();

        html = html.replace('__CSRF_TOKEN__', csrfToken);

        res.setHeader('Set-Cookie', `csrf_token=${csrfToken}; HttpOnly; Path=/; SameSite=Strict; Max-Age=7200`);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(html);
      } catch {
        json(res, 500, { error: 'Не удалось загрузить страницу.' });
      }
      return;
    }

    if (req.method === 'GET' && url.pathname.startsWith('/assets/')) {
      const filePath = path.join(publicDir, url.pathname.replace('/assets/', 'assets/'));
      try {
        const ext = path.extname(filePath);
        const mime = ext === '.css' ? 'text/css; charset=utf-8' : 'application/javascript; charset=utf-8';
        const data = await readFile(filePath);
        res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'public, max-age=3600' });
        res.end(data);
      } catch {
        json(res, 404, { error: 'Файл не найден.' });
      }
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/appointments') {
      const origin = req.headers.origin;
      if (origin && origin !== config.appOrigin) {
        json(res, 403, { error: 'Недопустимый origin.' });
        return;
      }

      const cookies = parseCookies(req.headers.cookie ?? '');
      const csrfHeader = req.headers['x-csrf-token'];
      if (!cookies.csrf_token || csrfHeader !== cookies.csrf_token) {
        json(res, 403, { error: 'CSRF проверка не пройдена.' });
        return;
      }

      try {
        const rawBody = await readRequestBody(req);
        const payload = safeJsonParse(rawBody);
        if (!payload) {
          json(res, 400, { error: 'Неверный формат JSON.' });
          return;
        }

        const validation = validatePayload(payload);
        if (!validation.success) {
          json(res, 400, { error: validation.errors.join(' ') });
          return;
        }

        const { fullName, snils, appointmentAt } = validation.data;

        const [result] = await supabaseClient.rpc('create_queue_request', {
          p_full_name: fullName,
          p_snils: formatSnils(snils),
          p_appointment_at: appointmentAt,
          p_ip_hash: ip,
        });

        json(res, 201, {
          message: 'Запись успешно создана.',
          ticketId: result.ticket_id,
          appointmentAt: result.appointment_at,
        });
      } catch (error) {
        if (error?.status === 409) {
          json(res, 409, {
            error: 'Для данного СНИЛС уже существует активная запись. Дождитесь посещения.',
          });
          return;
        }

        if (error?.status === 413) {
          json(res, 413, { error: 'Слишком большой запрос.' });
          return;
        }

        json(res, 500, { error: 'Внутренняя ошибка сервера.' });
      }
      return;
    }

    json(res, 404, { error: 'Not found' });
  });
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun && process.env.NODE_ENV !== 'test') {
  const config = loadConfig();

  if (config.missing.length > 0) {
    // eslint-disable-next-line no-console
    console.error(`Отсутствуют обязательные переменные окружения: ${config.missing.join(', ')}`);
    process.exit(1);
  }

  const server = createServer({ config });
  server.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Queue app started on http://localhost:${config.port}`);
  });
}
