const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];

export function loadConfig(env = process.env) {
  const missing = required.filter((key) => !env[key]);

  return {
    nodeEnv: env.NODE_ENV ?? 'development',
    port: Number.parseInt(env.PORT ?? '3000', 10),
    appOrigin: env.APP_ORIGIN ?? 'http://localhost:3000',
    supabaseUrl: env.SUPABASE_URL ?? '',
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    rateLimitWindowMs: Number.parseInt(env.RATE_LIMIT_WINDOW_MS ?? '900000', 10),
    rateLimitMax: Number.parseInt(env.RATE_LIMIT_MAX ?? '20', 10),
    slotCapacity: Number.parseInt(env.SLOT_CAPACITY ?? '5', 10),
    slotStartHour: Number.parseInt(env.SLOT_START_HOUR ?? '9', 10),
    slotEndHour: Number.parseInt(env.SLOT_END_HOUR ?? '17', 10),
    slotDurationMinutes: Number.parseInt(env.SLOT_DURATION_MINUTES ?? '30', 10),
    missing,
  };
}
