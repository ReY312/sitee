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

  return { rpc };
}
