import 'dotenv/config';
import { fallbackLogger, initLogger } from '@snapshot-labs/snapshot-sentry';
import cors from 'cors';
import express from 'express';
import { checkKeycard } from './helpers/keycard';
import rateLimit from './helpers/rateLimit';
import initMetrics from './metrics';
import rpc from './rpc';
import { rpcError } from './utils';

const app = express();
const PORT = process.env.PORT ?? 3003;

initLogger(app);
initMetrics(app);

app.disable('x-powered-by');
app.use(express.json({ limit: '8mb' }));
app.use(express.urlencoded({ limit: '8mb', extended: false }));
app.use(cors({ maxAge: 86400 }));
app.use(checkKeycard, rateLimit);
app.use('/', rpc);

fallbackLogger(app);

app.use((req, res) => {
  rpcError(res, 404, {}, req.body.id);
});

app.listen(PORT, () => console.log(`Listening at http://localhost:${PORT}`));
