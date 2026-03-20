import { createClient } from 'redis';

type AppRedisClient = ReturnType<typeof createClient>;

let redisClientPromise: Promise<AppRedisClient> | null = null;

function getRedisUrl() {
  return process.env.REDIS_URL?.trim() || 'redis://ubuntu:root@192.168.11.166:6379';
}

export async function getRedisClient() {
  if (!redisClientPromise) {
    const client = createClient({
      url: getRedisUrl(),
    });
    redisClientPromise = client.connect().then(() => client);
  }

  return redisClientPromise;
}
