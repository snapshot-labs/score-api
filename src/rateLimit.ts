import rateLimit from 'express-rate-limit';
import { rpcError, sha256 } from './utils';

const whitelistKeyHashes = ['a67acacdb3b382847fc058c206d6290c9873ccea4c656e06f2242d573a553db8'];

export default rateLimit({
  windowMs: 16 * 1e3,
  max: 80,
  keyGenerator: req => getIp(req),
  standardHeaders: true,
  skip: (request) =>
    request.headers['x-api-key']
      ? whitelistKeyHashes.includes(sha256(request.headers['x-api-key']))
      : false,
  handler: (_req, res) => {
    rpcError(res, 429, 'too many requests', null);
  }
});
