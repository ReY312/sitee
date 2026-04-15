import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';

function makeConfig() {
  return {
    nodeEnv: 'test',
    port: 0,
    appOrigin: 'http://localhost:3000',
    supabaseUrl: 'https://example.supabase.co',
    supabaseServiceRoleKey: 'service-key',
    rateLimitWindowMs: 900000,
    rateLimitMax: 100,
    missing: [],
  };
}

async function startServer(supabaseMock) {
  const server = createServer({ config: makeConfig(), supabase: supabaseMock });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  return {
    server,
    baseUrl: `http://127.0.0.1:${port}`,
  };
}

test('POST /api/appointments creates ticket', async () => {
  const supabaseMock = {
    async rpc() {
      return [{ ticket_id: 77, appointment_at: '2026-05-20T10:00:00+00:00' }];
    },
  };

  const { server, baseUrl } = await startServer(supabaseMock);

  const html = await fetch(`${baseUrl}/`);
  const cookie = html.headers.get('set-cookie');
  assert.ok(cookie);
  const token = cookie.split(';')[0].split('=')[1];

  const appointmentAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const response = await fetch(`${baseUrl}/api/appointments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:3000',
      Cookie: cookie,
      'X-CSRF-Token': token,
    },
    body: JSON.stringify({
      fullName: 'Иванов Иван Иванович',
      snils: '112-233-445 95',
      appointmentAt,
    }),
  });

  assert.equal(response.status, 201);

  server.close();
});

test('POST /api/appointments returns 409 on duplicate snils', async () => {
  const supabaseMock = {
    async rpc() {
      const error = new Error('duplicate');
      error.status = 409;
      throw error;
    },
  };

  const { server, baseUrl } = await startServer(supabaseMock);
  const html = await fetch(`${baseUrl}/`);
  const cookie = html.headers.get('set-cookie');
  const token = cookie.split(';')[0].split('=')[1];

  const appointmentAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const response = await fetch(`${baseUrl}/api/appointments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:3000',
      Cookie: cookie,
      'X-CSRF-Token': token,
    },
    body: JSON.stringify({
      fullName: 'Иванов Иван Иванович',
      snils: '112-233-445 95',
      appointmentAt,
    }),
  });

  assert.equal(response.status, 409);
  server.close();
});

test('POST /api/appointments blocks missing csrf', async () => {
  const supabaseMock = { rpc: async () => [{ ticket_id: 1, appointment_at: new Date().toISOString() }] };
  const { server, baseUrl } = await startServer(supabaseMock);

  const appointmentAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const response = await fetch(`${baseUrl}/api/appointments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:3000',
    },
    body: JSON.stringify({
      fullName: 'Иванов Иван Иванович',
      snils: '112-233-445 95',
      appointmentAt,
    }),
  });

  assert.equal(response.status, 403);
  server.close();
});
