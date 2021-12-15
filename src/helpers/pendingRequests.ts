import { createHash } from 'crypto';
import events from 'events';
const eventEmitter = new events.EventEmitter();

const pendingRequestKeys: Array<string> = [];

export const pendingRequestsHandler = (req, res, next) => {
  const key = createHash('sha256')
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (!pendingRequestKeys.includes(key)) {
    pendingRequestKeys.push(key);
    res.sendResponse = res.send;
    res.send = body => {
      pendingRequestKeys.splice(pendingRequestKeys.indexOf(key), 1);
      res.sendResponse(body);
      eventEmitter.emit(key, body);
    };
    next();
  } else {
    eventEmitter.on(key, function(data) {
      if (!res.headersSent) {
        res.send(JSON.parse(data));
      }
    });
  }
};
