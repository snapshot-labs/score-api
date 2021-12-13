import { createHash } from 'crypto';
import cache from 'memory-cache';
import events from 'events';

const memCache = new cache.Cache();
const eventEmitter = new events.EventEmitter();

const cacheTime = 30000; // ms
export const cacheMiddleware = (req, res, next) => {
  const key = createHash('sha256')
    .update(JSON.stringify(req.body))
    .digest('hex');

  const cacheContent = memCache.get(key);

  // If cache is available, refresh cache time, respond with it
  if (cacheContent && cacheContent !== 'pending') {
    memCache.put(key, cacheContent, cacheTime);
    res.send(JSON.parse(cacheContent));
  }
  // If cache is pending, wait for cache event and respond with it
  else if (cacheContent && cacheContent === 'pending') {
    eventEmitter.on(key, () => {
      const cacheContent = memCache.get(key);
      res.send(JSON.parse(cacheContent));
    });
  }
  // If cache is not available, send the request to next function to get the data, store it in cache and call the event
  else {
    memCache.put(key, 'pending', cacheTime);
    res.sendResponse = res.send;
    res.send = body => {
      memCache.put(key, body, cacheTime);
      eventEmitter.emit(key);
      res.sendResponse(body);
    };
    next();
  }
};
