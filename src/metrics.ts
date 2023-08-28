import init from '@snapshot-labs/snapshot-metrics';
import { Express } from 'express';

export default function initMetrics(app: Express) {
  init(app, { whitelistedPath: [/^\/$/, /^\/api\/(strategies|validations|scores)$/] });
}

export const requestDeduplicatorSize = new client.Gauge({
  name: 'request_deduplicator_size',
  help: 'Total number of items in the deduplicator queue'
});
