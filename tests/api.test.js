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
    slotCapacity: 2,
    slotStartHour: 9,
    slotEndHour: 17,
    slotDurationMinutes: 30,
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

function futureDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return date.toISOString().slice(0, 10);
}

test('POST /api/appointments creates ticket', async () => {
  const supabaseMock = {
    async rpc(_fn, params) {
      assert.equal(params.p_slot_capacity, 2);
      return [{ ticket_id: 77, appointment_at: '2026-05-20T10:00:00+00:00' }];
    },
  };

  const { server, baseUrl } = await startServer(supabaseMock);

  const html = await fetch(`${baseUrl}/`);
  const cookie = html.headers.get('set-cookie');
  assert.ok(cookie);
  const token = cookie.split(';')[0].split('=')[1];

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
      selectedDate: futureDate(),
    }),
  });

  assert.equal(response.status, 201);
  server.close();
});

test('POST /api/appointments returns 422 if no slots', async () => {
  const supabaseMock = {
    async rpc() {
      const error = new Error('No free slot for selected date');
      error.payload = { message: 'No free slot for selected date' };
      throw error;
    },
  };

  const { server, baseUrl } = await startServer(supabaseMock);
  const html = await fetch(`${baseUrl}/`);
  const cookie = html.headers.get('set-cookie');
  const token = cookie.split(';')[0].split('=')[1];

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
      selectedDate: futureDate(),
    }),
  });

  assert.equal(response.status, 422);
  server.close();
});



test('POST /api/appointments falls back to legacy RPC signature', async () => {
  let call = 0;
  const supabaseMock = {
    async rpc(_fn, params) {
      call += 1;
      if (call === 1) {
        const error = new Error('Could not find the function public.create_queue_request');
        error.status = 400;
        error.payload = { message: 'Could not find the function public.create_queue_request' };
        throw error;
      }

      assert.ok(params.p_appointment_at);
      return [{ ticket_id: 88, appointment_at: '2026-06-20T09:00:00+00:00' }];
    },
  };

  const { server, baseUrl } = await startServer(supabaseMock);
  const html = await fetch(`${baseUrl}/`);
  const cookie = html.headers.get('set-cookie');
  const token = cookie.split(';')[0].split('=')[1];

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
      selectedDate: futureDate(),
    }),
  });

  assert.equal(response.status, 201);
  assert.equal(call, 2);
  server.close();
});



test('POST /api/appointments returns existing appointment datetime for duplicate snils', async () => {
  const supabaseMock = {
    async rpc() {
      const error = new Error('Active appointment already exists for SNILS');
      error.status = 409;
      error.payload = { code: '23505', message: 'Active appointment already exists for SNILS' };
      throw error;
    },
    async getActiveAppointmentBySnils() {
      return { appointment_at: '2026-06-20T10:00:00+00:00' };
    },
  };

  const { server, baseUrl } = await startServer(supabaseMock);
  const html = await fetch(`${baseUrl}/`);
  const cookie = html.headers.get('set-cookie');
  const token = cookie.split(';')[0].split('=')[1];

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
      selectedDate: futureDate(),
    }),
  });

  assert.equal(response.status, 409);
  const data = await response.json();
  assert.match(data.error, /уже существует запись на/i);
  assert.match(data.error, /2026|20\.06\.2026/);
  server.close();
});

test('POST /api/appointments blocks missing csrf', async () => {
  const supabaseMock = { rpc: async () => [{ ticket_id: 1, appointment_at: new Date().toISOString() }] };
  const { server, baseUrl } = await startServer(supabaseMock);

  const response = await fetch(`${baseUrl}/api/appointments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:3000',
    },
    body: JSON.stringify({
      fullName: 'Иванов Иван Иванович',
      snils: '112-233-445 95',
      selectedDate: futureDate(),
    }),
  });

  assert.equal(response.status, 403);
  server.close();
});
