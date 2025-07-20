import { Redis } from "@upstash/redis"

// Validate environment variables
const redisUrl = process.env.UPSTASH_REDIS_URL;
const redisToken = process.env.UPSTASH_REDIS_TOKEN;

if (!redisUrl || !redisToken) {
  console.error('Missing Redis configuration:');
  console.error('UPSTASH_REDIS_URL:', redisUrl ? 'Set' : 'Missing');
  console.error('UPSTASH_REDIS_TOKEN:', redisToken ? 'Set' : 'Missing');
  throw new Error('Redis configuration is incomplete. Please set UPSTASH_REDIS_URL and UPSTASH_REDIS_TOKEN environment variables.');
}

export const redisdb = new Redis({
  url: redisUrl,
  token: redisToken,
})

// Test the connection
redisdb.ping().catch((error) => {
  console.error('Failed to connect to Redis:', error);
});
