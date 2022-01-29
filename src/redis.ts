import { createClient } from 'redis';

let client;

(async () => {
  client = createClient({ url: process.env.DATABASE_URL });
  client.on('error', err => console.log(err));
  await client.connect();
})();

export default client;
