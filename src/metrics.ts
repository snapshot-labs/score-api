import init from '@snapshot-labs/snapshot-metrics';
import { Express } from 'express';

export default function initMetrics(app: Express) {
  init(app, { whitelistedPath: [/^\/$/, /^\/api\/(strategies|validations|scores)$/] });
}
