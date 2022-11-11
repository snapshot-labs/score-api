import rateLimit from 'express-rate-limit';
import { getIp, rpcError, sha256 } from './utils';

const whitelistKeyHashes = ['fe96c6df2fa1f3d40f2e0a567b1d4feb12dbbd751fc39bc961e7b51eeeb66427'];

export default rateLimit({
  windowMs: 16 * 1e3,
  max: 32,
  keyGenerator: (req) => getIp(req),
  standardHeaders: true,
  skip: (request) =>
    request.headers['x-api-key']
      ? whitelistKeyHashes.includes(sha256(request.headers['x-api-key']))
      : false,
  handler: (_req, res) => {
    rpcError(res, 429, 'too many requests', null);
  }
});
