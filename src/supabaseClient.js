export function createSupabaseClient({ url, serviceRoleKey, fetchImpl = fetch }) {
  async function rpc(functionName, body) {
    const response = await fetchImpl(`${url}/rest/v1/rpc/${functionName}`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(body),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(payload?.message ?? 'Supabase error');
      err.status = response.status;
      err.payload = payload;
      throw err;
    }

    return payload;
  }

  async function getActiveAppointmentBySnils(snils) {
    const params = new URLSearchParams({
      select: 'appointment_at',
      snils: `eq.${snils}`,
      visited_at: 'is.null',
      order: 'created_at.desc',
      limit: '1',
    });

    const response = await fetchImpl(`${url}/rest/v1/queue_requests?${params.toString()}`, {
      method: 'GET',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    });

    const payload = await response.json().catch(() => []);
    if (!response.ok) {
      const err = new Error('Supabase select error');
      err.status = response.status;
      err.payload = payload;
      throw err;
    }

    return Array.isArray(payload) && payload[0] ? payload[0] : null;
  }

  return { rpc, getActiveAppointmentBySnils };
}
