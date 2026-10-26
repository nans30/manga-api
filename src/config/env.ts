import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  MANGADEX_API_URL: z.string().url().default('https://api.mangadex.org'),
  MANGADEX_UPLOADS_URL: z.string().url().default('https://uploads.mangadex.org'),
  SENTRY_DSN: z.string().url().optional(),
});

export type AppEnv = z.infer<typeof EnvSchema>;

export function validateEnv(rawEnv: Record<string, string | undefined>): AppEnv {
  const parsed = EnvSchema.safeParse(rawEnv);
  if (!parsed.success) {
    const formatted = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ');
    throw new Error(`[Invalid Environment Configuration]: ${formatted}`);
  }
  return parsed.data;
}

export const env: AppEnv = validateEnv(
  typeof process !== 'undefined' ? process.env : {}
);
