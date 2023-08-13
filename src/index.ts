import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { initLogger, fallbackLogger } from '@snapshot-labs/snapshot-sentry';
import rpc from './rpc';
import { rpcError } from './utils';
import initMetrics from './metrics';

const app = express();
const PORT = process.env.PORT ?? 3003;

initLogger(app);
initMetrics(app);

app.disable('x-powered-by');
app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ limit: '8mb', extended: false }));
app.use(cors({ maxAge: 86400 }));
app.use('/', rpc);

fallbackLogger(app);

app.use((req, res) => {
  rpcError(res, 404, {}, req.body.id);
});

app.listen(PORT, () => console.log(`Listening at http://localhost:${PORT}`));
