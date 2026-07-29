const { Redis } = require('@upstash/redis');

// Works whether Vercel injected the older KV_* names or the newer UPSTASH_* names.
const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = new Redis({ url, token });
const KEY = 'draft:state';

module.exports = { redis, KEY };
