import init, { client } from '@snapshot-labs/snapshot-metrics';
import { capture } from '@snapshot-labs/snapshot-sentry';
import { Express } from 'express';

const whitelistedPath = [/^\/$/, /^\/api\/(strategies|validations|scores)$/];

const rateLimitedRequestsCount = new client.Counter({
  name: 'http_requests_by_rate_limit_count',
  help: 'Total number of requests, by rate limit status',
  labelNames: ['rate_limited']
});

function instrumentRateLimitedRequests(req, res, next) {
  res.on('finish', () => {
    if (whitelistedPath.some((path) => path.test(req.path))) {
      rateLimitedRequestsCount.inc({ rate_limited: res.statusCode === 429 ? 1 : 0 });
    }
  });

  next();
}

export default function initMetrics(app: Express) {
  init(app, { whitelistedPath, errorHandler: capture });

  app.use(instrumentRateLimitedRequests);
}

export const requestDeduplicatorSize = new client.Gauge({
  name: 'request_deduplicator_size',
  help: 'Total number of items in the deduplicator queue'
});
