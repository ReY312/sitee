import crypto from 'node:crypto';

const limiterStore = new Map();

export function createRateLimiter({ windowMs, maxRequests }) {
  return function isRateLimited(ip) {
    const now = Date.now();
    const record = limiterStore.get(ip);
    if (!record || now > record.expiresAt) {
      limiterStore.set(ip, { count: 1, expiresAt: now + windowMs });
      return false;
    }

    record.count += 1;
    if (record.count > maxRequests) {
      return true;
    }

    return false;
  };
}

export function createCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function parseCookies(cookieHeader = '') {
  const pairs = cookieHeader.split(';');
  const cookies = {};

  for (const rawPair of pairs) {
    const [key, ...rest] = rawPair.split('=');
    if (!key || rest.length === 0) {
      continue;
    }

    cookies[key.trim()] = decodeURIComponent(rest.join('=').trim());
  }

  return cookies;
}

export function secureHeaders(origin) {
  return {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      `form-action ${origin}`,
      "base-uri 'none'",
      "object-src 'none'",
    ].join('; '),
  };
}

export function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
