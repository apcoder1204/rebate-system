import Redis from 'ioredis';

// Redis is optional — when REDIS_URL is not set the app runs fine without it.
const redis: Redis | null = process.env.REDIS_URL
  ? new Redis(process.env.REDIS_URL, {
      retryStrategy: (times) => Math.min(times * 100, 3000),
      enableOfflineQueue: false,
      maxRetriesPerRequest: 2,
      lazyConnect: true,
    })
  : null;

if (redis) {
  redis.on('connect', () => console.log('[Redis] Connected'));
  redis.on('error', (err: Error) => console.error('[Redis] Error:', err.message));
  redis.on('reconnecting', () => console.log('[Redis] Reconnecting…'));
}

export default redis;
