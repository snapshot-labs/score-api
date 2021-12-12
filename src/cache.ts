import { createHash } from 'crypto';
import cache from 'memory-cache';

const memCache = new cache.Cache();

export const cacheMiddleware = duration => {
  return (req, res, next) => {
    const key =
      '__express__' +
      req.originalUrl +
      (req.body
        ? createHash('sha256')
            .update(JSON.stringify(req.body))
            .digest('hex')
        : '');

    const cacheContent = memCache.get(key);
    // If cache is available, refresh cache time, respond with it
    if (cacheContent && cacheContent !== 'pending') {
      memCache.put(key, cacheContent, duration * 1000);
      res.send(JSON.parse(cacheContent));
      return;
    }
    // If cache is pending, retry every second for 20 seconds, once cache available, respond with it, If still not available, return error
    else if (cacheContent && cacheContent === 'pending') {
      const maxNumberOfRetries = 20;
      let numberOfRetries = 0;
      const retryInterval = setInterval(function() {
        const cacheContent = memCache.get(key);
        if (cacheContent !== 'pending') {
          res.send(JSON.parse(cacheContent));
          clearInterval(retryInterval);
          return;
        }
        if (numberOfRetries >= maxNumberOfRetries) {
          res.status(500).json({
            jsonrpc: '2.0',
            error: {
              code: 500,
              data: 'taking too much time to get the response'
            }
          });
          clearInterval(retryInterval);
        }

        numberOfRetries++;
      }, 1000);
    }
    // If cache is not available, send the request to next function to get the data. and store it in cache
    else {
      memCache.put(key, 'pending', duration * 1000);
      res.sendResponse = res.send;
      res.send = body => {
        memCache.put(key, body, duration * 1000);
        res.sendResponse(body);
      };
      next();
    }
  };
};
