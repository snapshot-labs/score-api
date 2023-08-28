import init, { client } from '@snapshot-labs/snapshot-metrics';
import { Express } from 'express';

export default function initMetrics(app: Express) {
  init(app, { whitelistedPath: [/^\/$/, /^\/api\/(strategies|validations|scores)$/] });
}

export const rateLimitedRequestsCount = new client.Counter({
  name: 'http_requests_by_rate_limit_count',
  help: 'Total number of requests, by rate limit status',
  labelNames: ['rate_limited']
});
