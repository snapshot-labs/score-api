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
  // If cache is pending, listen to cache event and respond with data
  else if (cacheContent === 'pending') {
    eventEmitter.on(key, function(data) {
      if (!res.headersSent) {
        res.send(JSON.parse(data));
      }
    });
  }
  // If cache is not available, send the request to next function to get the data, store it in cache and trigger the event
  else {
    memCache.put(key, 'pending', cacheTime);
    res.sendResponse = res.send;
    res.send = body => {
      memCache.put(key, body, cacheTime);
      res.sendResponse(body);
      eventEmitter.emit(key, body);
    };
    next();
  }
};
