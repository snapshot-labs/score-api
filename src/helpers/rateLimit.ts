import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';
import { rateLimitedRequestsCount } from '../metrics';
import { getIp, rpcError } from '../utils';

let client;

(async () => {
  if (!process.env.RATE_LIMIT_DATABASE_URL) return;

  console.log('[redis-rl] Connecting to Redis');
  client = createClient({ url: process.env.RATE_LIMIT_DATABASE_URL });
  client.on('connect', () => console.log('[redis-rl] Redis connect'));
  client.on('ready', () => console.log('[redis-rl] Redis ready'));
  client.on('reconnecting', (err) => console.log('[redis-rl] Redis reconnecting', err));
  client.on('error', (err) => console.log('[redis-rl] Redis error', err));
  client.on('end', (err) => console.log('[redis-rl] Redis end', err));
  await client.connect();
})();

export default rateLimit({
  windowMs: 20 * 1e3,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getIp(req),
  skip: (req, res) => {
    const keycardData = res.locals.keycardData;
    if (keycardData?.valid && !keycardData.rateLimited) {
      rateLimitedRequestsCount.inc({ rate_limited: 1 });
      return true;
    }

    rateLimitedRequestsCount.inc({ rate_limited: 0 });
    return false;
  },
  handler: (req, res) => {
    const { id = null } = req.body;

    console.log(`too many requests ${getIp(req).slice(0, 7)}`);
    rpcError(
      res,
      429,
      'too many requests, Refer: https://twitter.com/SnapshotLabs/status/1605567222713196544',
      id
    );
  },
  store: client
    ? new RedisStore({
        sendCommand: (...args: string[]) => client.sendCommand(args),
        prefix: 'score-api:'
      })
    : undefined
});
