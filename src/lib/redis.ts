import { createClient } from 'redis';

type AppRedisClient = ReturnType<typeof createClient>;

let redisClientPromise: Promise<AppRedisClient> | null = null;

function getRedisUrl() {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    throw new Error('REDIS_URL is required');
  }
  return redisUrl;
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
