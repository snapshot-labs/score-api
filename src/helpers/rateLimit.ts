import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';
import { getIp, rpcError, sha256 } from '../utils';

let client;

(async () => {
  if (!process.env.RATE_LIMIT_DATABASE_URL) return;

  console.log('[redis-rl] Connecting to Redis');
  client = createClient({ url: process.env.RATE_LIMIT_DATABASE_URL });
  client.on('connect', () => console.log('[redis-rl] Redis connect'));
  client.on('ready', () => console.log('[redis-rl] Redis ready'));
  client.on('reconnecting', err => console.log('[redis-rl] Redis reconnecting', err));
  client.on('error', err => console.log('[redis-rl] Redis error', err));
  client.on('end', err => console.log('[redis-rl] Redis end', err));
  await client.connect();
})();

const hashedIp = (req): string => sha256(getIp(req)).slice(0, 7);

export default rateLimit({
  windowMs: 60 * 1e3,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => hashedIp(req),
  skip: (req, res) => {
    const keycardData = res.locals.keycardData;
    if (keycardData?.valid && !keycardData.rateLimited) {
      return true;
    }
    return false;
  },
  handler: (req, res) => {
    const { id = null } = req.body;
    rpcError(
      res,
      429,
      'too many requests, refer to https://docs.snapshot.org/tools/api/api-keys#limits',
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
