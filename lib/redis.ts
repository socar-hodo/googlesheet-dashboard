import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;

/**
 * Upstash Redis 싱글톤 클라이언트.
 * UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN 환경변수 필요.
 */
export function getRedis(): Redis {
  if (!_redis) {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      throw new Error("UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set");
    }
    _redis = new Redis({ url, token });
  }
  return _redis;
}
