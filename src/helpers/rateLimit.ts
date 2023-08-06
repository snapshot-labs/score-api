import rateLimit from 'express-rate-limit';
import { getIp, rpcError } from '../utils';

export default rateLimit({
  windowMs: 20 * 1e3,
  max: 60,
  keyGenerator: (req) => getIp(req),
  standardHeaders: true,
  skip: (req, res) => {
    const keycardData = res.locals.keycardData;
    if (keycardData?.valid && !keycardData.rateLimited) {
      return true;
    }

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
  }
});
