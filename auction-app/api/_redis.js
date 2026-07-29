const { createClient } = require('redis');

let clientPromise = null;

function getClient() {
  if (!clientPromise) {
    const client = createClient({ url: process.env.REDIS_URL });
    client.on('error', (err) => console.error('Redis client error', err));
    clientPromise = client.connect().then(() => client);
  }
  return clientPromise;
}

const KEY = 'draft:state';

module.exports = { getClient, KEY };
