import Redis from 'ioredis'

const globalForRedis = global as unknown as { redis: Redis }

export const redis =
  globalForRedis.redis ||
  new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    enableReadyCheck: false,
  })

if (process.env.NODE_ENV !== 'production')
  globalForRedis.redis = redis

export const cache = {
  get: (key: string) => redis.get(key),
  set: (key: string, value: string, ttl?: number) => {
    if (ttl) return redis.setex(key, ttl, value)
    return redis.set(key, value)
  },
  del: (key: string) => redis.del(key),
  exists: (key: string) => redis.exists(key),
}
