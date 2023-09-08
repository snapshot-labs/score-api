import init, { client } from '@snapshot-labs/snapshot-metrics';
import { Express } from 'express';

const whitelistedPath = [/^\/$/, /^\/api\/(strategies|validations|scores)$/];
let server;

const rateLimitedRequestsCount = new client.Counter({
  name: 'http_requests_by_rate_limit_count',
  help: 'Total number of requests, by rate limit status',
  labelNames: ['rate_limited']
});

function instrumentRateLimitedRequests(req, res, next) {
  res.on('finish', () => {
    if (whitelistedPath.some(path => path.test(req.path))) {
      rateLimitedRequestsCount.inc({ rate_limited: res.statusCode === 429 ? 1 : 0 });
    }
  });

  next();
}

export default function initMetrics(app: Express) {
  init(app, { whitelistedPath });

  app.use(instrumentRateLimitedRequests);

  app.use((req, res, next) => {
    if (!server) {
      // @ts-ignore
      server = req.socket.server;
    }
    next();
  });
}

export const requestDeduplicatorSize = new client.Gauge({
  name: 'request_deduplicator_size',
  help: 'Total number of items in the deduplicator queue'
});

new client.Gauge({
  name: 'express_open_connections_size',
  help: 'Number of open connections on the express server',
  async collect() {
    if (server) {
      this.set(server._connections);
    }
  }
});
