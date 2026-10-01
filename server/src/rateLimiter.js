// Rate limiter con soporte dual: Upstash Redis (producción) + Map en memoria (desarrollo)
// Expone la misma interfaz para que el resto del código no cambie.

import { Redis } from '@upstash/redis';
import { recordRateLimit } from './metrics.js';

class InMemoryRateLimiter {
  constructor() {
    this.ipLimits = new Map();      // ip → sorted array of timestamps
    this.accountLimits = new Map(); // key → sorted array of timestamps
  }

  async checkIpLimit(ip, maxAttempts, windowMs) {
    const now = Date.now();
    const windowStart = now - windowMs;
    let timestamps = this.ipLimits.get(ip) || [];
    timestamps = timestamps.filter(t => t > windowStart);
    const allowed = timestamps.length < maxAttempts;
    if (allowed) {
      timestamps.push(now);
      this.ipLimits.set(ip, timestamps);
    }
    recordRateLimit('ip', allowed);
    return allowed;
  }

  async checkAccountLimit(key, maxAttempts, windowMs) {
    const now = Date.now();
    const windowStart = now - windowMs;
    let timestamps = this.accountLimits.get(key) || [];
    timestamps = timestamps.filter(t => t > windowStart);
    const allowed = timestamps.length < maxAttempts;
    if (allowed) {
      timestamps.push(now);
      this.accountLimits.set(key, timestamps);
    }
    recordRateLimit('account', allowed);
    return allowed;
  }

  async reset() {
    this.ipLimits.clear();
    this.accountLimits.clear();
  }
}

class UpstashRateLimiter {
  constructor(redis) {
    this.redis = redis;
  }

  // Sorted set: score = timestamp, member = unique id
  async checkIpLimit(ip, maxAttempts, windowMs) {
    const key = `rl:ip:${ip}`;
    const now = Date.now();
    const windowStart = now - windowMs;
    const multi = this.redis.multi();
    multi.zremrangebyscore(key, 0, windowStart);
    multi.zcard(key);
    multi.zadd(key, { score: now, member: `${now}-${Math.random()}` });
    multi.expire(key, Math.ceil(windowMs / 1000));
    const results = await multi.exec();
    const count = results[1];
    const allowed = count < maxAttempts;
    recordRateLimit('ip', allowed);
    return allowed;
  }

  async checkAccountLimit(key, maxAttempts, windowMs) {
    const fullKey = `rl:acct:${key}`;
    const now = Date.now();
    const windowStart = now - windowMs;
    const multi = this.redis.multi();
    multi.zremrangebyscore(fullKey, 0, windowStart);
    multi.zcard(fullKey);
    multi.zadd(fullKey, { score: now, member: `${now}-${Math.random()}` });
    multi.expire(fullKey, Math.ceil(windowMs / 1000));
    const results = await multi.exec();
    const count = results[1];
    const allowed = count < maxAttempts;
    recordRateLimit('account', allowed);
    return allowed;
  }

  async reset() {
    // Upstash no tiene FLUSHALL fácil sin patrón; para tests usamos keys pattern
    const keys = await this.redis.keys('rl:*');
    if (keys.length > 0) await this.redis.del(...keys);
  }
}

function createRateLimiter() {
  const redisUrl = process.env.UPSTASH_REDIS_URL;
  const redisToken = process.env.UPSTASH_REDIS_TOKEN;

  if (redisUrl && redisToken) {
    const redis = new Redis({ url: redisUrl, token: redisToken });
    console.log('[rate-limiter] Upstash Redis conectado');
    return new UpstashRateLimiter(redis);
  }

  console.log('[rate-limiter] Usando fallback en memoria (desarrollo)');
  return new InMemoryRateLimiter();
}

export const rateLimiter = createRateLimiter();

export function resetRateLimiter() {
  return rateLimiter.reset();
}

export function checkRateLimit(ip, maxAttempts = 10, windowMs = 60000) {
  return rateLimiter.checkIpLimit(ip, maxAttempts, windowMs);
}

export function checkAccountLimit(key, maxAttempts = 5, windowMs = 60000) {
  return rateLimiter.checkAccountLimit(key, maxAttempts, windowMs);
}