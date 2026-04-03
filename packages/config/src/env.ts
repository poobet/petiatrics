/**
 * Centralised environment configuration.
 * All process.env reads should go through this file to keep them auditable.
 */
export const env = {
  nodeEnv: (process.env['NODE_ENV'] ?? 'development') as 'development' | 'test' | 'production',
  port: parseInt(process.env['PORT'] ?? '3001', 10),
  database: {
    url: process.env['DATABASE_URL'] ?? '',
    mongoUri: process.env['MONGO_URI'] ?? '',
    redisUrl: process.env['REDIS_URL'] ?? '',
  },
  session: {
    secret: process.env['SESSION_SECRET'] ?? '',
    ttlSeconds: parseInt(process.env['SESSION_TTL_SECONDS'] ?? '86400', 10),
  },
  app: {
    apiUrl: process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001',
    webUrl: process.env['NEXT_PUBLIC_WEB_URL'] ?? 'http://localhost:3000',
  },
  cors: {
    origin: process.env['CORS_ORIGIN'] ?? 'http://localhost:3000',
  },
  storage: {
    objectStorageUrl: process.env['OBJECT_STORAGE_URL'] ?? '',
  },
} as const;
